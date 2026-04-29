import type { WorldEvent } from '../../types/api.ts';

export type ConnectionStatus = 'connected' | 'reconnecting' | 'disconnected';
type EventHandler = (event: WorldEvent) => void;
type StatusHandler = (status: ConnectionStatus) => void;

const INITIAL_RETRY_MS = 1000;
const MAX_RETRY_MS = 30000;

export class WebSocketClient {
  private ws: WebSocket | null = null;
  private baseUrl: string;
  private path: string;
  private token: string;
  private retryMs = INITIAL_RETRY_MS;
  private retryTimer: ReturnType<typeof setTimeout> | undefined;
  private intentionalClose = false;
  private eventHandlers: EventHandler[] = [];
  private statusHandlers: StatusHandler[] = [];
  private status: ConnectionStatus = 'disconnected';

  constructor(baseUrl: string, path: string, token: string) {
    this.baseUrl = baseUrl.replace(/^http/, 'ws');
    this.path = path;
    this.token = token;
  }

  connect() {
    this.intentionalClose = false;
    const url = `${this.baseUrl}${this.path}?token=${encodeURIComponent(this.token)}`;

    try {
      this.ws = new WebSocket(url);
    } catch {
      this.scheduleReconnect();
      return;
    }

    this.ws.onopen = () => {
      this.retryMs = INITIAL_RETRY_MS;
      this.setStatus('connected');
    };

    this.ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data as string) as WorldEvent;
        for (const handler of this.eventHandlers) {
          handler(data);
        }
      } catch {
        // Ignore malformed messages
      }
    };

    this.ws.onclose = () => {
      if (!this.intentionalClose) {
        this.setStatus('reconnecting');
        this.scheduleReconnect();
      } else {
        this.setStatus('disconnected');
      }
    };

    this.ws.onerror = () => {
      // onclose will fire after onerror
    };
  }

  disconnect() {
    this.intentionalClose = true;
    clearTimeout(this.retryTimer);
    this.ws?.close();
    this.ws = null;
    this.setStatus('disconnected');
  }

  onEvent(handler: EventHandler) {
    this.eventHandlers.push(handler);
    return () => {
      this.eventHandlers = this.eventHandlers.filter((h) => h !== handler);
    };
  }

  onStatusChange(handler: StatusHandler) {
    this.statusHandlers.push(handler);
    return () => {
      this.statusHandlers = this.statusHandlers.filter((h) => h !== handler);
    };
  }

  getStatus(): ConnectionStatus {
    return this.status;
  }

  updateToken(token: string) {
    this.token = token;
  }

  private setStatus(status: ConnectionStatus) {
    this.status = status;
    for (const handler of this.statusHandlers) {
      handler(status);
    }
  }

  private scheduleReconnect() {
    this.retryTimer = setTimeout(() => {
      this.connect();
    }, this.retryMs);
    this.retryMs = Math.min(this.retryMs * 2, MAX_RETRY_MS);
  }
}
