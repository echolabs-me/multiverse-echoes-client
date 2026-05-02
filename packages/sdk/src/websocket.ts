/**
 * WebSocket client for real-time Multiverse Echoes event streams.
 *
 * @example
 * ```ts
 * import { subscribeToEcho } from '@echolabs/multiverse-echoes';
 *
 * const ws = subscribeToEcho('wss://api.echolabsme.com', echoId, accessToken, {
 *   onEvent(event) { console.log('Event:', event.payload.type); },
 *   onClose() { console.log('Disconnected'); },
 * });
 * // Later: ws.close();
 * ```
 */

import type { WorldEvent } from './types.js';

export interface WebSocketCallbacks {
  /** Called for each WorldEvent received. */
  onEvent: (event: WorldEvent) => void;
  /** Called when the connection closes. */
  onClose?: () => void;
  /** Called on error. */
  onError?: (error: Event) => void;
}

export interface WebSocketHandle {
  /** Close the connection. */
  close: () => void;
}

/**
 * Subscribe to an Echo's real-time event stream.
 *
 * @param wsBaseUrl - WebSocket base URL, e.g. `wss://api.echolabsme.com`
 * @param echoId - The Echo to subscribe to.
 * @param accessToken - JWT access token for authentication.
 * @param callbacks - Event handlers.
 */
export function subscribeToEcho(
  wsBaseUrl: string,
  echoId: string,
  accessToken: string,
  callbacks: WebSocketCallbacks,
): WebSocketHandle {
  const url = `${wsBaseUrl}/ws/echoes/${echoId}/stream?token=${encodeURIComponent(accessToken)}`;
  const ws = new WebSocket(url);

  ws.onmessage = (e) => {
    try {
      const event = JSON.parse(e.data as string) as WorldEvent;
      callbacks.onEvent(event);
    } catch {
      // Ignore non-JSON messages (e.g. pong frames)
    }
  };

  ws.onclose = () => callbacks.onClose?.();
  ws.onerror = (e) => callbacks.onError?.(e);

  return { close: () => ws.close() };
}

/**
 * Subscribe to a Shard's real-time event stream.
 *
 * @param wsBaseUrl - WebSocket base URL.
 * @param shardId - The Shard to subscribe to.
 * @param accessToken - JWT access token.
 * @param callbacks - Event handlers.
 */
export function subscribeToShard(
  wsBaseUrl: string,
  shardId: string,
  accessToken: string,
  callbacks: WebSocketCallbacks,
): WebSocketHandle {
  const url = `${wsBaseUrl}/ws/shards/${shardId}/stream?token=${encodeURIComponent(accessToken)}`;
  const ws = new WebSocket(url);

  ws.onmessage = (e) => {
    try {
      const event = JSON.parse(e.data as string) as WorldEvent;
      callbacks.onEvent(event);
    } catch {
      // Ignore non-JSON messages
    }
  };

  ws.onclose = () => callbacks.onClose?.();
  ws.onerror = (e) => callbacks.onError?.(e);

  return { close: () => ws.close() };
}

/**
 * Subscribe to a Channel's real-time message stream.
 *
 * @param wsBaseUrl - WebSocket base URL.
 * @param channelId - The Channel to subscribe to.
 * @param accessToken - JWT access token.
 * @param callbacks - Event handlers.
 */
export function subscribeToChannel(
  wsBaseUrl: string,
  channelId: string,
  accessToken: string,
  callbacks: WebSocketCallbacks,
): WebSocketHandle {
  const url = `${wsBaseUrl}/ws/channels/${channelId}/stream?token=${encodeURIComponent(accessToken)}`;
  const ws = new WebSocket(url);

  ws.onmessage = (e) => {
    try {
      const event = JSON.parse(e.data as string) as WorldEvent;
      callbacks.onEvent(event);
    } catch {
      // Ignore non-JSON messages
    }
  };

  ws.onclose = () => callbacks.onClose?.();
  ws.onerror = (e) => callbacks.onError?.(e);

  return { close: () => ws.close() };
}
