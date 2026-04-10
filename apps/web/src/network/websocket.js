/**
 * WebSocket client with automatic reconnection + exponential backoff.
 * Wraps the region WebSocket connection.
 */

import { parseServerMessage, exponentialBackoff } from '@veltara/shared';

const WS_BASE = import.meta.env.VITE_WS_BASE_URL ?? `ws://${window.location.host}`;

export class RegionSocket {
  /** @type {WebSocket|null} */
  ws = null;

  /** @type {string} */
  regionId;
  /** @type {string} */
  token;

  attempt = 0;
  maxAttempts = 10;
  reconnectTimer = null;
  destroyed = false;

  /** @type {Map<string, Set<Function>>} */
  handlers = new Map();

  constructor(regionId, token) {
    this.regionId = regionId;
    this.token = token;
  }

  connect() {
    if (this.destroyed) return;
    const url = `${WS_BASE}/api/regions/${this.regionId}/connect?token=${encodeURIComponent(this.token)}`;
    this.ws = new WebSocket(url);

    this.ws.onopen = () => {
      this.attempt = 0;
      this._emit('connected', {});
    };

    this.ws.onmessage = (e) => {
      const msg = parseServerMessage(e.data);
      if (msg) {
        this._emit(msg.type, msg.payload);
        this._emit('*', msg);
      }
    };

    this.ws.onclose = (e) => {
      this._emit('disconnected', { code: e.code, reason: e.reason });
      this._scheduleReconnect();
    };

    this.ws.onerror = () => {
      // onclose will also fire
    };
  }

  _scheduleReconnect() {
    if (this.destroyed || this.attempt >= this.maxAttempts) return;
    const delay = exponentialBackoff(this.attempt++, 1000, 30000, 500);
    this._emit('reconnecting', { attempt: this.attempt, delay });
    this.reconnectTimer = setTimeout(() => this.connect(), delay);
  }

  /**
   * Send a message to the server.
   * @param {string} type
   * @param {unknown} payload
   */
  send(type, payload) {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({ type, payload, timestamp: Date.now() }));
    }
  }

  /** Send a ping to measure latency. */
  ping() {
    this.send('ping', { client_time: Date.now() });
  }

  /**
   * Register an event handler.
   * @param {string} event
   * @param {Function} handler
   */
  on(event, handler) {
    if (!this.handlers.has(event)) this.handlers.set(event, new Set());
    this.handlers.get(event).add(handler);
  }

  off(event, handler) {
    this.handlers.get(event)?.delete(handler);
  }

  _emit(event, data) {
    this.handlers.get(event)?.forEach((h) => h(data));
  }

  disconnect() {
    this.destroyed = true;
    clearTimeout(this.reconnectTimer);
    this.ws?.close(1000, 'User disconnected');
    this.ws = null;
  }

  get isConnected() {
    return this.ws?.readyState === WebSocket.OPEN;
  }
}
