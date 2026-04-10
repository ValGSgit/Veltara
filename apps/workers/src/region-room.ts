/**
 * RegionRoom — Cloudflare Durable Object
 *
 * One instance per region. Maintains authoritative state:
 * - Connected player list with positions and actions
 * - Region chat history (last 200 messages)
 * - Local events and world objects
 *
 * Supports Hibernation API to save costs when empty.
 */

import {
  REGIONS,
  CHAT_HISTORY_LIMIT,
  REGION_MAP,
  parseClientMessage,
  makeServerMessage,
  type Player,
  type ChatMessageServer,
  type RegionId,
  type ServerMessage,
} from '@veltara/shared';
import { verifyJwt } from './utils/jwt.js';

interface RegionRoomEnv {
  JWT_SECRET: string;
  KV_WORLD: KVNamespace;
  AI: Ai;
}

interface StoredPlayer extends Player {
  ws: WebSocket;
}

interface ChatEntry {
  id: string;
  user_id: string;
  username: string;
  avatar_url: string | null;
  text: string;
  region_id: string | null;
  is_global: boolean;
  is_npc?: boolean;
  npc_name?: string;
  created_at: number;
}

export class RegionRoom implements DurableObject {
  private state: DurableObjectState;
  private env: RegionRoomEnv;
  private players: Map<string, StoredPlayer> = new Map();
  private chatHistory: ChatEntry[] = [];
  private regionId: RegionId | null = null;
  private worldState: Record<string, unknown> = {};

  constructor(state: DurableObjectState, env: RegionRoomEnv) {
    this.state = state;
    this.env = env;

    // Restore persisted state on startup
    this.state.blockConcurrencyWhile(async () => {
      this.chatHistory = (await this.state.storage.get<ChatEntry[]>('chat_history')) ?? [];
      this.regionId = (await this.state.storage.get<RegionId>('region_id')) ?? null;
    });
  }

  // ─── HTTP / WebSocket Entry Point ───────────────────────────────────────────

  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);

    if (request.headers.get('Upgrade') === 'websocket') {
      return this.handleWebSocket(request);
    }

    if (url.pathname.endsWith('/state')) {
      return new Response(JSON.stringify(this.getState()), {
        headers: { 'Content-Type': 'application/json' },
      });
    }

    if (url.pathname.endsWith('/broadcast') && request.method === 'POST') {
      const msg = (await request.json()) as ServerMessage;
      this.broadcast(msg);
      return new Response('ok');
    }

    return new Response('Not found', { status: 404 });
  }

  // ─── WebSocket Handling ──────────────────────────────────────────────────────

  private async handleWebSocket(request: Request): Promise<Response> {
    const url = new URL(request.url);
    const token = url.searchParams.get('token');

    // Authenticate
    let claims;
    try {
      if (!token) throw new Error('No token');
      claims = await verifyJwt(token, this.env.JWT_SECRET);
    } catch {
      return new Response('Unauthorized', { status: 401 });
    }

    // Set region from URL if first connection
    const regionId = url.searchParams.get('region') as RegionId | null;
    if (regionId && !this.regionId) {
      this.regionId = regionId;
      await this.state.storage.put('region_id', regionId);
    }

    const { 0: client, 1: server } = new WebSocketPair();

    // Use hibernation API — accept via state.acceptWebSocket
    this.state.acceptWebSocket(server, [claims.sub, claims.username]);

    const player: StoredPlayer = {
      id: claims.sub,
      username: claims.username,
      avatar_url: null,
      lat: regionId ? (REGION_MAP[regionId]?.lat ?? 0) : 0,
      lon: regionId ? (REGION_MAP[regionId]?.lon ?? 0) : 0,
      action: 'idle',
      region_id: (regionId ?? this.regionId ?? 'nexus-core') as RegionId,
      color_tint: this.getRegionColor(regionId ?? this.regionId),
      connected_at: Date.now(),
      ws: server,
    };

    this.players.set(claims.sub, player);
    await this.onConnect(player);

    return new Response(null, {
      status: 101,
      webSocket: client,
    });
  }

  // ─── Hibernation API Handlers ────────────────────────────────────────────────

  async webSocketMessage(ws: WebSocket, message: string | ArrayBuffer): Promise<void> {
    const tags = this.state.getTags(ws);
    const playerId = tags[0];
    const player = playerId ? this.players.get(playerId) : null;
    if (!player) return;

    const text = typeof message === 'string' ? message : new TextDecoder().decode(message);
    const parsed = parseClientMessage(text);
    if (!parsed) return;

    await this.onMessage(player, parsed as Parameters<typeof this.onMessage>[1]);
  }

  async webSocketClose(ws: WebSocket, code: number, reason: string, wasClean: boolean): Promise<void> {
    const tags = this.state.getTags(ws);
    const playerId = tags[0];
    if (playerId) {
      const player = this.players.get(playerId);
      if (player) await this.onDisconnect(player);
    }
  }

  async webSocketError(ws: WebSocket, error: unknown): Promise<void> {
    const tags = this.state.getTags(ws);
    const playerId = tags[0];
    if (playerId) {
      const player = this.players.get(playerId);
      if (player) await this.onDisconnect(player);
    }
  }

  // ─── Player Lifecycle ────────────────────────────────────────────────────────

  private async onConnect(player: StoredPlayer): Promise<void> {
    // Send initial state to the joining player
    const worldStateRaw = await this.env.KV_WORLD.get('world_state', 'json');
    const worldState = (worldStateRaw ?? this.getDefaultWorldState()) as Record<string, unknown>;

    const initMsg = makeServerMessage<{
      type: 'initial_state';
      payload: {
        your_id: string;
        region_id: string;
        players: Player[];
        chat_history: ChatEntry[];
        world_state: Record<string, unknown>;
      };
      timestamp: number;
    }>({
      type: 'initial_state',
      payload: {
        your_id: player.id,
        region_id: player.region_id,
        players: this.getPlayersArray(),
        chat_history: this.chatHistory.slice(-50),
        world_state: worldState,
      },
    });

    this.send(player.ws, initMsg);

    // Broadcast player_joined to everyone else
    this.broadcast(
      makeServerMessage({
        type: 'player_joined',
        payload: {
          id: player.id,
          username: player.username,
          avatar_url: player.avatar_url,
          lat: player.lat,
          lon: player.lon,
          action: player.action,
          region_id: player.region_id,
          color_tint: player.color_tint,
          connected_at: player.connected_at,
        },
      }),
      player.id,
    );
  }

  private async onDisconnect(player: StoredPlayer): Promise<void> {
    this.players.delete(player.id);

    this.broadcast(
      makeServerMessage({
        type: 'player_left',
        payload: { id: player.id, username: player.username },
      }),
    );
  }

  private async onMessage(
    player: StoredPlayer,
    message: ReturnType<typeof parseClientMessage>,
  ): Promise<void> {
    if (!message) return;

    switch (message.type) {
      case 'position_update': {
        const { lat, lon, action } = message.payload;
        player.lat = lat;
        player.lon = lon;
        player.action = action;

        this.broadcast(
          makeServerMessage({
            type: 'position_update',
            payload: { id: player.id, lat, lon, action },
          }),
          player.id,
        );
        break;
      }

      case 'chat_message': {
        const { text, is_global } = message.payload;

        // Check for mute (stored in player context)
        // In production, check KV mute status

        const entry: ChatEntry = {
          id: crypto.randomUUID(),
          user_id: player.id,
          username: player.username,
          avatar_url: player.avatar_url,
          text,
          region_id: player.region_id,
          is_global: is_global ?? false,
          created_at: Date.now(),
        };

        this.chatHistory.push(entry);
        if (this.chatHistory.length > CHAT_HISTORY_LIMIT) {
          this.chatHistory.shift();
        }

        // Persist chat history
        await this.state.storage.put('chat_history', this.chatHistory);

        this.broadcast(
          makeServerMessage({
            type: 'chat_message',
            payload: entry,
          }),
        );

        // Handle @npc mentions
        if (text.startsWith('@npc ') && this.regionId) {
          void this.handleNpcMessage(player, text.slice(5));
        }
        break;
      }

      case 'region_action': {
        const { type: actionType, data } = message.payload;

        this.broadcast(
          makeServerMessage({
            type: 'region_event',
            payload: {
              region_id: player.region_id,
              event_type: actionType,
              data: { ...data, player_id: player.id },
            },
          }),
        );
        break;
      }

      case 'ping': {
        const latency = Date.now() - message.payload.client_time;
        this.send(
          player.ws,
          makeServerMessage({
            type: 'pong',
            payload: { latency },
          }),
        );
        break;
      }
    }
  }

  // ─── NPC AI Response ─────────────────────────────────────────────────────────

  private async handleNpcMessage(player: StoredPlayer, text: string): Promise<void> {
    if (!this.regionId) return;

    const region = REGION_MAP[this.regionId];
    if (!region) return;

    try {
      const aiResponse = await (this.env.AI as unknown as {
        run: (model: string, opts: unknown) => Promise<{ response: string }>;
      }).run('@cf/meta/llama-3.1-8b-instruct', {
        messages: [
          { role: 'system', content: region.npc_personality },
          { role: 'user', content: text },
        ],
        max_tokens: 256,
      });

      const npcEntry: ChatEntry = {
        id: crypto.randomUUID(),
        user_id: 'npc',
        username: region.npc_name,
        avatar_url: null,
        text: aiResponse.response,
        region_id: this.regionId,
        is_global: false,
        is_npc: true,
        npc_name: region.npc_name,
        created_at: Date.now(),
      };

      this.chatHistory.push(npcEntry);
      await this.state.storage.put('chat_history', this.chatHistory);

      this.broadcast(
        makeServerMessage({
          type: 'chat_message',
          payload: npcEntry,
        }),
      );
    } catch {
      // NPC unavailable — silently fail
    }
  }

  // ─── Broadcast / Send ────────────────────────────────────────────────────────

  broadcast(message: unknown, excludeId?: string): void {
    const text = JSON.stringify(message);
    for (const [id, player] of this.players) {
      if (id !== excludeId) {
        this.send(player.ws, text);
      }
    }
  }

  private send(ws: WebSocket, message: unknown): void {
    try {
      ws.send(typeof message === 'string' ? message : JSON.stringify(message));
    } catch {
      // Socket closed — ignore
    }
  }

  // ─── State Serialization ─────────────────────────────────────────────────────

  getState(): {
    region_id: RegionId | null;
    player_count: number;
    players: Player[];
    chat_history: ChatEntry[];
  } {
    return {
      region_id: this.regionId,
      player_count: this.players.size,
      players: this.getPlayersArray(),
      chat_history: this.chatHistory.slice(-50),
    };
  }

  private getPlayersArray(): Player[] {
    return Array.from(this.players.values()).map(({ ws: _ws, ...p }) => p);
  }

  private getRegionColor(regionId: RegionId | string | null): string {
    if (!regionId) return '#ffffff';
    return REGION_MAP[regionId]?.color ?? '#ffffff';
  }

  private getDefaultWorldState(): Record<string, unknown> {
    return {
      planet_time: Date.now() / 1000,
      day_cycle_progress: 0.5,
      weather: 'clear',
      active_events: [],
      total_online: this.players.size,
      updated_at: Date.now(),
    };
  }
}
