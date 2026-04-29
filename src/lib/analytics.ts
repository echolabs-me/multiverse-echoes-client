/**
 * Client-side analytics event tracking.
 * Reference: ME-UXF-001 §16.
 *
 * Batches events in memory and flushes to POST /analytics/events.
 * Silent failure — analytics must never break the UI.
 */

import { request, getBaseUrl, getAccessToken } from './api/client.ts';

interface QueuedEvent {
  event_name: string;
  properties?: Record<string, unknown>;
}

const MAX_BATCH_SIZE = 50;
const FLUSH_INTERVAL_MS = 30_000;

let eventQueue: QueuedEvent[] = [];
let flushTimer: ReturnType<typeof setTimeout> | null = null;
let optedOut = false;

/** Set the opt-out flag. When true, events are silently discarded. */
export function setAnalyticsOptOut(value: boolean): void {
  optedOut = value;
}

/** Track a single analytics event. Batched and flushed automatically. */
export function trackEvent(
  name: string,
  properties?: Record<string, unknown>,
): void {
  if (optedOut) return;

  eventQueue.push({ event_name: name, properties });

  if (eventQueue.length >= MAX_BATCH_SIZE) {
    if (flushTimer) {
      clearTimeout(flushTimer);
      flushTimer = null;
    }
    void flush();
  } else if (!flushTimer) {
    flushTimer = setTimeout(() => void flush(), FLUSH_INTERVAL_MS);
  }
}

/** Flush all queued events to the server. */
async function flush(): Promise<void> {
  if (flushTimer) {
    clearTimeout(flushTimer);
    flushTimer = null;
  }

  if (eventQueue.length === 0) return;

  const batch = eventQueue.splice(0, MAX_BATCH_SIZE);

  try {
    await request('/analytics/events', {
      method: 'POST',
      body: JSON.stringify({ events: batch }),
    });
  } catch {
    // Silent failure — analytics must never break the UI
  }
}

// Flush on page unload
if (typeof window !== 'undefined') {
  window.addEventListener('beforeunload', () => {
    if (eventQueue.length > 0) {
      // Use fetch with keepalive for reliable delivery on page exit
      const url = `${getBaseUrl()}/analytics/events`;
      const token = getAccessToken();
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
      };
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }
      void fetch(url, {
        method: 'POST',
        headers,
        body: JSON.stringify({ events: eventQueue }),
        keepalive: true,
      });
      eventQueue = [];
    }
  });
}
