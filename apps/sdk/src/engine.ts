/**
 * VeltaraEngine — main SDK class.
 * Embeds a live Three.js Veltara planet instance into any web app.
 */

import type {
  VeltaraOptions,
  VeltaraEventMap,
  Region,
  Player,
  RegionId,
  EmbedSession,
  RegionEvent,
} from './types.js';

const API_BASE = 'https://veltara.gg';
const WS_BASE = 'wss://veltara.gg';
const BACKOFF_BASE = 1000;
const BACKOFF_MAX = 30_000;

/**
 * Main SDK class for embedding Veltara planets.
 *
 * @example
 * ```ts
 * const engine = new VeltaraEngine({
 *   apiKey: 'vlt_your_key_here',
 *   container: '#my-planet',
 *   region: 'nexus-core',
 *   onReady: () => console.log('Planet ready!'),
 * });
 * await engine.mount();
 * ```
 */
export class VeltaraEngine {
  private options: VeltaraOptions;
  private container: HTMLElement | null = null;
  private iframe: HTMLIFrameElement | null = null;
  private ws: WebSocket | null = null;
  private session: EmbedSession | null = null;
  private handlers: Map<string, Set<(data: unknown) => void>> = new Map();
  private reconnectAttempt = 0;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private destroyed = false;

  constructor(options: VeltaraOptions) {
    this.options = options;
    this._bindOptions();
  }

  private _bindOptions(): void {
    const { onReady, onPlayerJoin, onPlayerLeave, onRegionEvent, onError } = this.options;
    if (onReady) this.on('ready', onReady as () => void);
    if (onPlayerJoin) this.on('player_join', onPlayerJoin as (p: Player) => void);
    if (onPlayerLeave) this.on('player_leave', onPlayerLeave as (p: Player) => void);
    if (onRegionEvent) this.on('region_event', onRegionEvent as (e: RegionEvent) => void);
    if (onError) this.on('error', onError as (e: Error) => void);
  }

  /**
   * Mounts the Veltara planet into the container element.
   * Fetches a session token, creates the iframe, and connects WebSocket.
   */
  async mount(): Promise<void> {
    this.container = this._resolveContainer();
    if (!this.container) {
      throw new Error(`VeltaraEngine: container "${String(this.options.container)}" not found`);
    }

    // Fetch embed session
    try {
      this.session = await this._fetchSession();
    } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err));
      this._emit('error', error);
      throw error;
    }

    // Build iframe
    this._buildIframe();

    // Connect WebSocket after iframe is ready
    setTimeout(() => this._connect(), 1000);
  }

  /**
   * Unmounts the engine, closes WebSocket, removes iframe.
   */
  unmount(): void {
    this.destroyed = true;
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
    this.ws?.close(1000, 'SDK unmounted');
    this.ws = null;
    this.iframe?.remove();
    this.iframe = null;
    this.handlers.clear();
  }

  /**
   * Switches to a different region.
   */
  async setRegion(regionId: RegionId): Promise<void> {
    this.options.region = regionId;

    if (this.iframe?.contentWindow) {
      this.iframe.contentWindow.postMessage({ type: 'set_region', regionId }, '*');
    }

    // Reconnect WebSocket to new region
    this.ws?.close(1000, 'Region change');
    this._connect();
  }

  /**
   * Triggers a custom event in the current region via the API.
   */
  async triggerEvent(type: string, data: unknown): Promise<void> {
    if (!this.session) throw new Error('Not mounted — call mount() first');

    const res = await fetch(`${API_BASE}/v1/events`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${this.options.apiKey}`,
      },
      body: JSON.stringify({
        type,
        title: `Custom Event: ${type}`,
        description: JSON.stringify(data),
        region_id: this.options.region ?? 'nexus-core',
      }),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: { message: 'Unknown error' } })) as { error?: { message?: string } };
      throw new Error(err.error?.message ?? `API error ${res.status}`);
    }
  }

  /**
   * Returns the current online player count.
   */
  async getOnlineCount(): Promise<number> {
    const res = await fetch(`${API_BASE}/v1/players/online`, {
      headers: { Authorization: `Bearer ${this.options.apiKey}` },
    });
    const data = await res.json() as { online: number };
    return data.online;
  }

  /**
   * Returns all regions with player counts.
   */
  async getRegions(): Promise<Region[]> {
    const res = await fetch(`${API_BASE}/v1/regions`, {
      headers: { Authorization: `Bearer ${this.options.apiKey}` },
    });
    const data = await res.json() as { regions: Region[] };
    return data.regions;
  }

  /**
   * Registers an event handler.
   */
  on<K extends keyof VeltaraEventMap>(
    event: K,
    handler: (data: VeltaraEventMap[K]) => void,
  ): void {
    if (!this.handlers.has(event)) this.handlers.set(event, new Set());
    this.handlers.get(event)!.add(handler as (data: unknown) => void);
  }

  /**
   * Removes an event handler.
   */
  off<K extends keyof VeltaraEventMap>(
    event: K,
    handler: (data: VeltaraEventMap[K]) => void,
  ): void {
    this.handlers.get(event)?.delete(handler as (data: unknown) => void);
  }

  // ─── Private Methods ────────────────────────────────────────────────────────

  private _emit<K extends keyof VeltaraEventMap>(event: K, data?: VeltaraEventMap[K]): void {
    this.handlers.get(event)?.forEach((h) => h(data));
  }

  private _resolveContainer(): HTMLElement | null {
    const c = this.options.container;
    if (typeof c === 'string') return document.querySelector(c);
    return c;
  }

  private async _fetchSession(): Promise<EmbedSession> {
    const res = await fetch(`${API_BASE}/v1/embed/session`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${this.options.apiKey}`,
      },
      body: JSON.stringify({ region_id: this.options.region ?? 'nexus-core' }),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: { message: 'Failed to create session' } })) as { error?: { message?: string } };
      throw new Error(err.error?.message ?? `Session error ${res.status}`);
    }

    return res.json() as Promise<EmbedSession>;
  }

  private _buildIframe(): void {
    if (!this.container || !this.session) return;

    const theme = this.options.theme ?? {};
    const showWatermark = this.session.show_watermark || theme.watermark === true;

    // Ensure container has position for absolute children
    if (getComputedStyle(this.container).position === 'static') {
      this.container.style.position = 'relative';
    }

    const params = new URLSearchParams({
      token: this.session.token,
      region: this.session.region_id,
      embed: '1',
      ...(theme.primaryColor ? { color: theme.primaryColor } : {}),
      ...(theme.showUI === false ? { noui: '1' } : {}),
      ...(theme.showChat === false ? { nochat: '1' } : {}),
    });

    this.iframe = document.createElement('iframe');
    this.iframe.src = `${API_BASE}/embed?${params}`;
    this.iframe.style.cssText = `
      position: absolute;
      inset: 0;
      width: 100%;
      height: 100%;
      border: none;
      border-radius: inherit;
    `;
    this.iframe.allow = 'fullscreen';
    this.iframe.setAttribute('title', 'Veltara Planet');

    if (showWatermark) {
      const watermark = document.createElement('a');
      watermark.href = 'https://veltara.gg';
      watermark.target = '_blank';
      watermark.rel = 'noopener noreferrer';
      watermark.textContent = 'Powered by Veltara';
      watermark.style.cssText = `
        position: absolute;
        bottom: 8px;
        right: 8px;
        z-index: 10;
        font-size: 10px;
        color: rgba(255,255,255,0.5);
        text-decoration: none;
        font-family: system-ui, sans-serif;
        pointer-events: auto;
      `;
      this.container.appendChild(watermark);
    }

    this.container.appendChild(this.iframe);

    // Listen for messages from iframe
    window.addEventListener('message', this._handleIframeMessage.bind(this));

    this._emit('ready', undefined);
  }

  private _handleIframeMessage(e: MessageEvent): void {
    if (e.source !== this.iframe?.contentWindow) return;
    const msg = e.data as { type: string; payload: unknown };

    switch (msg.type) {
      case 'player_joined':
        this._emit('player_join', msg.payload as Player);
        break;
      case 'player_left':
        this._emit('player_leave', msg.payload as Player);
        break;
      case 'region_event':
        this._emit('region_event', msg.payload as RegionEvent);
        break;
      case 'world_state':
        this._emit('world_state', msg.payload as VeltaraEventMap['world_state']);
        break;
    }
  }

  private _connect(): void {
    if (this.destroyed || !this.session) return;

    const regionId = this.options.region ?? this.session.region_id;
    const url = `${WS_BASE}/v1/regions/${regionId}/subscribe`;

    const ws = new WebSocket(url);
    ws.onopen = () => {
      this.reconnectAttempt = 0;
      this._emit('connected', undefined);
    };

    ws.onmessage = (e) => {
      try {
        const msg = JSON.parse(e.data as string) as { type: string; payload: unknown };
        if (msg.type === 'player_joined') this._emit('player_join', msg.payload as Player);
        if (msg.type === 'player_left') this._emit('player_leave', msg.payload as Player);
        if (msg.type === 'region_event') this._emit('region_event', msg.payload as RegionEvent);
        if (msg.type === 'world_state') this._emit('world_state', msg.payload as VeltaraEventMap['world_state']);
      } catch { /* ignore malformed */ }
    };

    ws.onclose = () => {
      this._emit('disconnected', undefined);
      this._scheduleReconnect();
    };

    this.ws = ws;
  }

  private _scheduleReconnect(): void {
    if (this.destroyed) return;
    const delay = Math.min(BACKOFF_BASE * 2 ** this.reconnectAttempt++, BACKOFF_MAX);
    this.reconnectTimer = setTimeout(() => this._connect(), delay);
  }
}
