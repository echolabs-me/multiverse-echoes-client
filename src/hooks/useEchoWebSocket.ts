import { useEffect, useRef, useState } from 'react';
import { getBaseUrl, getAccessToken } from '../lib/api/client.ts';
import type { WsEchoEvent } from '../types/api.ts';

export type WsStatus = 'connected' | 'reconnecting' | 'disconnected';

const INITIAL_RETRY_MS = 1000;
const MAX_RETRY_MS = 30000;
const FALLBACK_POLL_MS = 5000;
const MAX_FALLBACK_POLL_MS = 60000;

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
    let pollTimer: ReturnType<typeof setInterval> | undefined;
    let pollInterval = FALLBACK_POLL_MS;

    function stopPolling() {
      if (pollTimer) {
        clearInterval(pollTimer);
        pollTimer = undefined;
      }
      pollInterval = FALLBACK_POLL_MS;
    }

    function startPolling() {
      stopPolling();
      if (!onFallbackPollRef.current) return;
      const poll = onFallbackPollRef.current;
      pollTimer = setInterval(() => {
        poll();
      }, pollInterval);
      pollInterval = Math.min(pollInterval * 2, MAX_FALLBACK_POLL_MS);
    }

    function connect() {
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

      ws.onclose = () => {
        ws = null;
        if (!intentionalClose) {
          setStatus('reconnecting');
          startPolling();
          retryTimer = setTimeout(connect, retryMs);
          retryMs = Math.min(retryMs * 2, MAX_RETRY_MS);
        } else {
          setStatus('disconnected');
        }
      };

      ws.onerror = () => {
        // onclose fires after onerror
      };
    }

    connect();

    return () => {
      intentionalClose = true;
      clearTimeout(retryTimer);
      stopPolling();
      ws?.close();
      ws = null;
      setStatus('disconnected');
    };
  }, [path]);

  return status;
}
