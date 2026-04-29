import { useEffect, useRef, useState, useCallback } from 'react';
import { useSystemStore } from '../stores/useSystemStore.ts';
import { useEchoWebSocket } from './useEchoWebSocket.ts';
import { useAuthStore } from '../stores/useAuthStore.ts';
import { useNotificationStore } from '../stores/useNotificationStore.ts';
import { useBillingHealth } from '../stores/useBillingHealth.ts';
import type { WsEchoEvent } from '../types/api.ts';

export type TickTimerState = 'counting_down' | 'generating' | 'arrived' | 'waiting';

const LS_KEY = 'me_last_tick_at';

function readLastTickAt(): number {
  try {
    return Number(localStorage.getItem(LS_KEY)) || 0;
  } catch {
    return 0;
  }
}

function writeLastTickAt(ms: number) {
  try {
    localStorage.setItem(LS_KEY, String(ms));
  } catch {
    // Storage full or unavailable — non-critical.
  }
}

export interface TickTimerData {
  state: TickTimerState;
  secondsRemaining: number;
  tickInterval: number;
}

/**
 * Global tick timer hook. Connects to the dashboard WS stream and
 * manages the 3-state machine: counting_down → generating → arrived → counting_down.
 */
export function useTickTimer(): TickTimerData {
  const tickInterval = useSystemStore((s) => s.tickIntervalSeconds);
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);

  const lastTickAtRef = useRef(readLastTickAt());
  const [state, setState] = useState<TickTimerState>(() => {
    const stored = readLastTickAt();
    if (stored > 0 && (Date.now() - stored) / 1000 >= tickInterval) {
      return 'generating';
    }
    return 'counting_down';
  });
  const [secondsRemaining, setSecondsRemaining] = useState(() => {
    const stored = readLastTickAt();
    if (stored > 0) {
      const remaining = tickInterval - Math.floor((Date.now() - stored) / 1000);
      return Math.max(0, remaining);
    }
    return tickInterval;
  });

  // Synchronous state ref — updated inline (not via useEffect) so the
  // interval callback always sees the latest state without a render delay.
  const stateRef = useRef(state);

  function setTimerState(next: TickTimerState) {
    stateRef.current = next;
    setState(next);
  }

  // Arrived timeout ref — auto-transition back to counting_down.
  const arrivedTimerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  const handleWsEvent = useCallback(
    (event: WsEchoEvent) => {
      if (event.type === 'ConnectionEstablished') {
        if ('last_tick_at' in event) {
          const serverAt = event.last_tick_at as number;
          if (serverAt > 0) {
            lastTickAtRef.current = serverAt;
            writeLastTickAt(serverAt);
          }
        }
        return;
      }

      // Real-time notification refresh.
      if (event.type === 'NotificationCreated') {
        void useNotificationStore.getState().fetchNotifications();
        return;
      }

      // Lane C billing-health WS forwarding. The dunning driver ticks
      // hourly, so `DunningPhaseChanged` is the slow authoritative
      // signal; `PaymentFailed` fires immediately on every failed
      // attempt and lets the banner surface the failure ahead of the
      // next driver pass. ME-MIS-001 §5.4.5.
      if (event.type === 'PaymentFailed') {
        useBillingHealth.getState().recordPaymentFailed();
        return;
      }
      if (event.type === 'DunningPhaseChanged') {
        // Narrowing collapses against WsEchoEvent's catch-all `{ type:
        // string; [key: string]: unknown }` arm — same precedent as
        // `event.last_tick_at as number` above. Extract<> pulls the
        // typed shape so `to` lands as the proper enum.
        const e = event as Extract<WsEchoEvent, { type: 'DunningPhaseChanged' }>;
        useBillingHealth.getState().setPhase(e.to);
        return;
      }

      // Lane H Commit 7: admin dashboard share-token revoked. Forwarded
      // by the dashboard WS only when the connected user is admin
      // (server-side gate in ws_dashboard_stream). The admin tab
      // listens via window event and re-fetches the active page.
      if (event.type === 'ShareTokenRevoked') {
        window.dispatchEvent(
          new CustomEvent('me:share-token-revoked', {
            detail: { token: event.token },
          }),
        );
        return;
      }

      // Any diary entry arrival signals the tick completed.
      if (event.type === 'DiaryEntryCreated') {
        const now = Date.now();
        lastTickAtRef.current = now;
        writeLastTickAt(now);

        // Transition to "arrived" state briefly.
        setTimerState('arrived');
        clearTimeout(arrivedTimerRef.current);
        arrivedTimerRef.current = setTimeout(() => {
          setTimerState('counting_down');
        }, 2000);
      }
    },
    [],
  );

  // Connect to dashboard WS stream (only when authenticated).
  const wsPath = isAuthenticated ? '/ws/dashboard/stream' : null;
  useEchoWebSocket(wsPath, handleWsEvent);

  // Countdown interval — updates every second.
  // Safety valve: if generating lingers beyond 90s (LLM timeout + margin),
  // auto-reset to counting_down. The tick completed even if no diary arrived.
  const generatingStartRef = useRef<number>(0);

  useEffect(() => {
    const compute = () => {
      const base = lastTickAtRef.current;
      if (base <= 0) return;

      // Never override the arrived state — let its 2s timeout handle the transition.
      // Also skip the first tick after arrived clears to avoid a flicker frame
      // where remaining briefly shows 0 before the new countdown stabilises.
      if (stateRef.current === 'arrived' || stateRef.current === 'waiting') return;

      const elapsed = (Date.now() - base) / 1000;
      const remaining = tickInterval - Math.floor(elapsed);

      if (remaining <= 0) {
        setSecondsRemaining(0);
        if (stateRef.current === 'counting_down') {
          setTimerState('generating');
          generatingStartRef.current = Date.now();
        }
        // Safety valve: if stuck generating for >90s, transition to
        // 'waiting' briefly so the user sees feedback before the countdown
        // resets. This covers WS reconnects and ticks that skipped the Echo.
        if (stateRef.current === 'generating' && generatingStartRef.current > 0) {
          const generatingFor = (Date.now() - generatingStartRef.current) / 1000;
          if (generatingFor > 90) {
            const now = Date.now();
            lastTickAtRef.current = now;
            writeLastTickAt(now);
            generatingStartRef.current = 0;
            setTimerState('waiting');
            clearTimeout(arrivedTimerRef.current);
            arrivedTimerRef.current = setTimeout(() => {
              setTimerState('counting_down');
            }, 3000);
          }
        }
      } else {
        // Only update if we're not in a post-arrived transition frame.
        // After arrived → counting_down, the remaining calc is always valid
        // because lastTickAtRef was updated on the DiaryEntryCreated event.
        if (stateRef.current !== 'counting_down' && stateRef.current !== 'generating') return;
        setSecondsRemaining(remaining);
        if (stateRef.current === 'generating') {
          generatingStartRef.current = 0;
          setTimerState('counting_down');
        }
      }
    };

    compute();
    const timer = setInterval(compute, 1000);
    return () => clearInterval(timer);
  }, [tickInterval]);

  // Cleanup arrived timer on unmount.
  useEffect(() => {
    return () => clearTimeout(arrivedTimerRef.current);
  }, []);

  return { state, secondsRemaining, tickInterval };
}
