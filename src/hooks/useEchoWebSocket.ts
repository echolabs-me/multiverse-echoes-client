import { useEffect, useRef, useState } from 'react';
import { getBaseUrl, getAccessToken } from '../lib/api/client.ts';
import { useAuthStore } from '../stores/useAuthStore.ts';
import type { WsEchoEvent } from '../types/api.ts';

export type WsStatus = 'connected' | 'reconnecting' | 'disconnected';

const INITIAL_RETRY_MS = 1000;
const MAX_RETRY_MS = 30000;
const FALLBACK_POLL_MS = 5000;
const MAX_FALLBACK_POLL_MS = 60000;

/**
 * WebSocket close codes that indicate the connection was terminated because
 * the credentials are invalid. Treat these as terminal — retrying will not
 * help, and aggressive reconnects leave the connection spamming the server
 * until the component unmounts.
 *
 *   1008  Policy Violation         — RFC 6455 generic auth/policy rejection
 *   4001  Custom: invalid token    — common app-layer convention
 *   4401  Custom: unauthorized     — mirrors HTTP 401
 *   4403  Custom: forbidden        — mirrors HTTP 403
 */
const AUTH_FAILURE_CLOSE_CODES: ReadonlySet<number> = new Set([
  1008, 4001, 4401, 4403,
]);

/**
 * Hook that connects to a WS Echo or Dashboard stream.
 * Falls back to polling on disconnect with exponential backoff.
 */
export function useEchoWebSocket(
  path: string | null,
  onEvent: (event: WsEchoEvent) => void,
  onFallbackPoll?: () => void,
) {
  const [status, setStatus] = useState<WsStatus>('disconnected');
  const onEventRef = useRef(onEvent);
  const onFallbackPollRef = useRef(onFallbackPoll);

  useEffect(() => {
    onEventRef.current = onEvent;
  }, [onEvent]);

  useEffect(() => {
    onFallbackPollRef.current = onFallbackPoll;
  }, [onFallbackPoll]);

  useEffect(() => {
    if (!path) return;

    let ws: WebSocket | null = null;
    let intentionalClose = false;
    let retryMs = INITIAL_RETRY_MS;
    let retryTimer: ReturnType<typeof setTimeout> | undefined;
    let pollTimer: ReturnType<typeof setTimeout> | undefined;
    let pollInterval = FALLBACK_POLL_MS;

    // Subscribe to auth state: if the user is logged out mid-session (token
    // expired, refresh failed), abort any pending reconnect and stop polling
    // immediately. The AppLayout auth guard will unmount this component on
    // the next render, but until then we must not keep hammering the server.
    const unsubAuth = useAuthStore.subscribe((state, prev) => {
      if (prev.isAuthenticated && !state.isAuthenticated) {
        intentionalClose = true;
        clearTimeout(retryTimer);
        retryTimer = undefined;
        stopPolling();
        ws?.close();
        ws = null;
        setStatus('disconnected');
      }
    });

    function stopPolling() {
      if (pollTimer) {
        clearTimeout(pollTimer);
        pollTimer = undefined;
      }
      pollInterval = FALLBACK_POLL_MS;
    }

    function startPolling() {
      if (pollTimer || !onFallbackPollRef.current) return;
      
      const runPoll = () => {
        if (!onFallbackPollRef.current) return;
        onFallbackPollRef.current();
        pollInterval = Math.min(pollInterval * 2, MAX_FALLBACK_POLL_MS);
        pollTimer = setTimeout(runPoll, pollInterval);
      };
      
      pollTimer = setTimeout(runPoll, pollInterval);
    }

    function connect() {
      // Don't attempt to connect if the user has been logged out.
      if (!useAuthStore.getState().isAuthenticated) {
        intentionalClose = true;
        return;
      }

      const token = getAccessToken();
      if (!token) return;

      const base = getBaseUrl().replace(/^http/, 'ws');
      const url = `${base}${path}?token=${encodeURIComponent(token)}`;

      try {
        ws = new WebSocket(url);
      } catch {
        setStatus('reconnecting');
        startPolling();
        retryTimer = setTimeout(connect, retryMs);
        retryMs = Math.min(retryMs * 2, MAX_RETRY_MS);
        return;
      }

      ws.onopen = () => {
        retryMs = INITIAL_RETRY_MS;
        setStatus('connected');
        stopPolling();
      };

      ws.onmessage = (e) => {
        try {
          const data = JSON.parse(e.data as string) as WsEchoEvent;
          onEventRef.current(data);
        } catch {
          // Ignore malformed messages
        }
      };

      ws.onclose = (event) => {
        ws = null;
        if (intentionalClose) {
          setStatus('disconnected');
          return;
        }
        // Auth-failure close codes are terminal — retrying with the same
        // (expired) token will just trigger another immediate close. Mark
        // the loop as terminated and let AppLayout's auth guard navigate
        // away on the next render cycle.
        if (AUTH_FAILURE_CLOSE_CODES.has(event.code)) {
          intentionalClose = true;
          setStatus('disconnected');
          return;
        }
        setStatus('reconnecting');
        startPolling();
        retryTimer = setTimeout(connect, retryMs);
        retryMs = Math.min(retryMs * 2, MAX_RETRY_MS);
      };

      ws.onerror = () => {
        // onclose fires after onerror
      };
    }

    connect();

    return () => {
      intentionalClose = true;
      unsubAuth();
      clearTimeout(retryTimer);
      stopPolling();
      ws?.close();
      ws = null;
      setStatus('disconnected');
    };
  }, [path]);

  return status;
}
