import { useEffect, useRef, useState, useCallback } from 'react';
import { useSystemStore } from '../stores/useSystemStore.ts';
import { useEchoWebSocket } from './useEchoWebSocket.ts';
import { useAuthStore } from '../stores/useAuthStore.ts';
import type { WsEchoEvent } from '../types/api.ts';

export type TickTimerState = 'counting_down' | 'generating' | 'arrived';

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

  // Track whether we're generating (ref for interval callback access).
  const stateRef = useRef(state);
  useEffect(() => {
    stateRef.current = state;
  }, [state]);

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

      // Any diary entry arrival signals the tick completed.
      if (event.type === 'DiaryEntryCreated') {
        const now = Date.now();
        lastTickAtRef.current = now;
        writeLastTickAt(now);

        // Transition to "arrived" state briefly.
        setState('arrived');
        clearTimeout(arrivedTimerRef.current);
        arrivedTimerRef.current = setTimeout(() => {
          setState('counting_down');
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

      const elapsed = (Date.now() - base) / 1000;
      const remaining = tickInterval - Math.floor(elapsed);

      if (remaining <= 0) {
        setSecondsRemaining(0);
        if (stateRef.current === 'counting_down') {
          setState('generating');
          generatingStartRef.current = Date.now();
        }
        // Safety valve: if stuck generating for >90s, force reset.
        if (stateRef.current === 'generating' && generatingStartRef.current > 0) {
          const generatingFor = (Date.now() - generatingStartRef.current) / 1000;
          if (generatingFor > 90) {
            const now = Date.now();
            lastTickAtRef.current = now;
            writeLastTickAt(now);
            generatingStartRef.current = 0;
            setState('counting_down');
          }
        }
      } else {
        setSecondsRemaining(remaining);
        if (stateRef.current === 'generating') {
          generatingStartRef.current = 0;
          setState('counting_down');
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
