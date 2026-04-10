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
  REGION_SANDBOX_OBJECT_LIMIT,
  REGION_MAP,
  parseClientMessage,
  makeServerMessage,
  RegionWorldObjectSchema,
  type Player,
  type RegionId,
  type RegionWorldObject,
  type RegionObjectKind,
  type RegionObjectMaterial,
  type ServerMessage,
} from '@veltara/shared';
import { verifyJwt } from './utils/jwt.js';
import {
  applyObjectInteraction,
  canEditOrRemoveObject,
  initializeObjectState,
  normalizeObjectSnapshot,
} from './sandbox-state.js';
import { normalizeAndValidateObjectMetadata } from './object-metadata.js';

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

interface RegionObjectTransform {
  x: number;
  y: number;
  z: number;
}

interface RegionObjectUpsertData {
  id?: string;
  version?: number;
  kind: RegionObjectKind;
  material?: RegionObjectMaterial;
  position: RegionObjectTransform;
  rotation?: RegionObjectTransform;
  scale?: RegionObjectTransform;
  interactive?: boolean;
  metadata?: Record<string, unknown>;
}

export class RegionRoom implements DurableObject {
  private state: DurableObjectState;
  private env: RegionRoomEnv;
  private players: Map<string, StoredPlayer> = new Map();
  private chatHistory: ChatEntry[] = [];
  private worldObjects: Map<string, RegionWorldObject> = new Map();
  private regionId: RegionId | null = null;
  private worldState: Record<string, unknown> = {};
  private worldObjectsDirty = false;
  private worldObjectsPersistCounter = 0;
  /** Per-user timestamps of recent object_upsert calls for rate limiting */
  private upsertTimestamps: Map<string, number[]> = new Map();
  /** Per-user timestamps of recent chat messages for rate limiting */
  private chatTimestamps: Map<string, number[]> = new Map();

  constructor(state: DurableObjectState, env: RegionRoomEnv) {
    this.state = state;
    this.env = env;

    // Restore persisted state on startup
    this.state.blockConcurrencyWhile(async () => {
      this.chatHistory = (await this.state.storage.get<ChatEntry[]>('chat_history')) ?? [];
      this.regionId = (await this.state.storage.get<RegionId>('region_id')) ?? null;
      const storedObjects = (await this.state.storage.get<RegionWorldObject[]>('region_objects')) ?? [];
      this.worldObjects = new Map(
        storedObjects.map((obj) => [obj.id, initializeObjectState({ ...obj, version: obj.version ?? 0 })]),
      );
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
        region_objects: RegionWorldObject[];
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
        region_objects: this.getWorldObjectsArray(),
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
    this.upsertTimestamps.delete(player.id);
    this.chatTimestamps.delete(player.id);

    this.broadcast(
      makeServerMessage({
        type: 'player_left',
        payload: { id: player.id, username: player.username },
      }),
    );

    if (this.players.size === 0) {
      await this.persistWorldObjectsIfNeeded(true);
    }
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
        const { is_global } = message.payload;
        const text = message.payload.text.trim().slice(0, RegionRoom.CHAT_MAX_LENGTH);

        if (!text) break;

        if (this.isChatRateLimited(player.id, Date.now())) {
          this.send(
            player.ws,
            makeServerMessage({
              type: 'error',
              payload: { code: 'CHAT_RATE_LIMITED', message: 'You are sending messages too fast.' },
            }),
          );
          break;
        }

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

        if (actionType === 'object_upsert') {
          await this.handleObjectUpsert(player, data);
          break;
        }

        if (actionType === 'object_remove') {
          await this.handleObjectRemove(player, data);
          break;
        }

        if (actionType === 'object_interact') {
          await this.handleObjectInteract(player, data);
          break;
        }

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

  private static readonly UPSERT_RATE_LIMIT = 10; // max upserts per window
  private static readonly UPSERT_RATE_WINDOW_MS = 10_000; // 10-second window
  private static readonly CHAT_RATE_LIMIT = 5; // max messages per window
  private static readonly CHAT_RATE_WINDOW_MS = 10_000; // 10-second window
  private static readonly CHAT_MAX_LENGTH = 500;
  private static readonly PER_USER_OBJECT_LIMIT = 200;
  private static readonly WORLD_OBJECTS_CHECKPOINT_INTERVAL = 10;

  private isSlidingWindowLimited(
    store: Map<string, number[]>,
    key: string,
    now: number,
    windowMs: number,
    limit: number,
  ): boolean {
    const timestamps = store.get(key) ?? [];
    const windowStart = now - windowMs;
    const recent = timestamps.filter((t) => t > windowStart);
    recent.push(now);
    store.set(key, recent);
    return recent.length > limit;
  }

  private isUpsertRateLimited(playerId: string, now: number): boolean {
    return this.isSlidingWindowLimited(
      this.upsertTimestamps, playerId, now,
      RegionRoom.UPSERT_RATE_WINDOW_MS, RegionRoom.UPSERT_RATE_LIMIT,
    );
  }

  private isChatRateLimited(playerId: string, now: number): boolean {
    return this.isSlidingWindowLimited(
      this.chatTimestamps, playerId, now,
      RegionRoom.CHAT_RATE_WINDOW_MS, RegionRoom.CHAT_RATE_LIMIT,
    );
  }

  private async handleObjectUpsert(player: StoredPlayer, data: unknown): Promise<void> {
    if (!this.regionId) return;

    if (this.isUpsertRateLimited(player.id, Date.now())) {
      this.send(
        player.ws,
        makeServerMessage({
          type: 'error',
          payload: { code: 'UPSERT_RATE_LIMITED', message: 'Too many object changes. Slow down.' },
        }),
      );
      return;
    }

    const upsertData = data as RegionObjectUpsertData;
    if (!upsertData || !upsertData.kind || !upsertData.position) {
      this.send(
        player.ws,
        makeServerMessage({
          type: 'error',
          payload: { code: 'INVALID_OBJECT_DATA', message: 'Object payload is invalid.' },
        }),
      );
      return;
    }

    const isNewObject = !this.worldObjects.has(upsertData.id ?? '');

    if (isNewObject && this.worldObjects.size >= REGION_SANDBOX_OBJECT_LIMIT) {
      this.send(
        player.ws,
        makeServerMessage({
          type: 'error',
          payload: { code: 'REGION_OBJECT_LIMIT', message: 'Region object limit reached.' },
        }),
      );
      return;
    }

    if (isNewObject) {
      let userObjectCount = 0;
      for (const obj of this.worldObjects.values()) {
        if (obj.owner_id === player.id) userObjectCount++;
      }
      if (userObjectCount >= RegionRoom.PER_USER_OBJECT_LIMIT) {
        this.send(
          player.ws,
          makeServerMessage({
            type: 'error',
            payload: { code: 'USER_OBJECT_LIMIT', message: 'You have placed too many objects in this region.' },
          }),
        );
        return;
      }
    }

    const existing = upsertData.id ? this.worldObjects.get(upsertData.id) : undefined;
    if (existing && !canEditOrRemoveObject(existing, player.id)) {
      this.send(
        player.ws,
        makeServerMessage({
          type: 'error',
          payload: { code: 'OBJECT_PERMISSION_DENIED', message: 'Only the owner can edit this object.' },
        }),
      );
      return;
    }

    const now = Date.now();
    const object: RegionWorldObject = initializeObjectState({
      id: existing?.id ?? upsertData.id ?? crypto.randomUUID(),
      region_id: this.regionId,
      owner_id: existing?.owner_id ?? player.id,
      version: Math.max(existing?.version ?? 0, upsertData.version ?? 0) + 1,
      kind: upsertData.kind,
      material: upsertData.material ?? existing?.material ?? 'stone',
      position: this.clampTransform(upsertData.position, existing?.position),
      rotation: this.clampRotation(upsertData.rotation ?? existing?.rotation),
      scale: this.clampScale(upsertData.scale ?? existing?.scale),
      interactive: upsertData.interactive ?? existing?.interactive ?? true,
      metadata: upsertData.metadata ?? existing?.metadata,
      created_at: existing?.created_at ?? now,
      updated_at: now,
    });

    const metadataResult = normalizeAndValidateObjectMetadata(object.metadata);
    if (metadataResult.error) {
      this.send(
        player.ws,
        makeServerMessage({
          type: 'error',
          payload: metadataResult.error,
        }),
      );
      return;
    }
    object.metadata = metadataResult.metadata;

    const validated = RegionWorldObjectSchema.safeParse(object);
    if (!validated.success) {
      this.send(
        player.ws,
        makeServerMessage({
          type: 'error',
          payload: { code: 'INVALID_OBJECT_SCHEMA', message: 'Object schema validation failed.' },
        }),
      );
      return;
    }

    this.worldObjects.set(object.id, validated.data as RegionWorldObject);
    await this.persistWorldObjectsIfNeeded();

    this.broadcast(
      makeServerMessage({
        type: 'region_object_upsert',
        payload: {
          region_id: this.regionId,
          object,
          actor_id: player.id,
        },
      }),
    );
  }

  private async handleObjectRemove(player: StoredPlayer, data: unknown): Promise<void> {
    if (!this.regionId) return;

    const objectId = (data as { object_id?: string })?.object_id;
    if (!objectId) return;

    const existing = this.worldObjects.get(objectId);
    if (!existing) return;

    if (!canEditOrRemoveObject(existing, player.id)) {
      this.send(
        player.ws,
        makeServerMessage({
          type: 'error',
          payload: { code: 'OBJECT_PERMISSION_DENIED', message: 'Only the owner can remove this object.' },
        }),
      );
      return;
    }

    this.worldObjects.delete(objectId);
    await this.persistWorldObjectsIfNeeded();

    this.broadcast(
      makeServerMessage({
        type: 'region_object_remove',
        payload: {
          region_id: this.regionId,
          object_id: objectId,
          actor_id: player.id,
        },
      }),
    );
  }

  private async handleObjectInteract(player: StoredPlayer, data: unknown): Promise<void> {
    if (!this.regionId) return;

    const objectId = (data as { object_id?: string })?.object_id;
    const interactionType = (data as { interaction_type?: string })?.interaction_type;
    const interactionPayload = (data as { payload?: Record<string, unknown> })?.payload;

    if (!objectId || !interactionType) {
      this.send(
        player.ws,
        makeServerMessage({
          type: 'error',
          payload: { code: 'INVALID_INTERACTION', message: 'Missing object_id or interaction_type.' },
        }),
      );
      return;
    }

    const existing = this.worldObjects.get(objectId);
    if (!existing) {
      this.send(
        player.ws,
        makeServerMessage({
          type: 'error',
          payload: { code: 'OBJECT_NOT_FOUND', message: 'Object not found in this region.' },
        }),
      );
      return;
    }

    const result = applyObjectInteraction(
      existing,
      player.id,
      interactionType,
      interactionPayload,
      Date.now(),
    );

    if (!result.ok || !result.object) {
      this.send(
        player.ws,
        makeServerMessage({
          type: 'error',
          payload: {
            code: result.code ?? 'INTERACTION_REJECTED',
            message: result.message ?? 'Object interaction rejected.',
          },
        }),
      );
      return;
    }

    this.worldObjects.set(result.object.id, result.object);
    await this.persistWorldObjectsIfNeeded();

    this.broadcast(
      makeServerMessage({
        type: 'region_object_upsert',
        payload: {
          region_id: this.regionId,
          object: result.object,
          actor_id: player.id,
        },
      }),
    );

    this.broadcast(
      makeServerMessage({
        type: 'region_event',
        payload: {
          region_id: player.region_id,
          event_type: 'object_interact',
          data: {
            object_id: result.object.id,
            interaction_type: interactionType,
            state: result.data ?? null,
            player_id: player.id,
          },
        },
      }),
    );
  }

  private async persistWorldObjectsIfNeeded(force = false): Promise<void> {
    this.worldObjectsDirty = true;
    this.worldObjectsPersistCounter += 1;
    if (!force && this.worldObjectsPersistCounter < RegionRoom.WORLD_OBJECTS_CHECKPOINT_INTERVAL) {
      return;
    }
    await this.persistWorldObjectsSnapshot();
  }

  private async persistWorldObjectsSnapshot(): Promise<void> {
    if (!this.worldObjectsDirty) return;
    const snapshot = normalizeObjectSnapshot(this.getWorldObjectsArray());
    await this.state.storage.put('region_objects', snapshot);
    await this.state.storage.put('region_objects_checkpoint', {
      version: Date.now(),
      count: snapshot.length,
      updated_at: Date.now(),
    });
    this.worldObjectsDirty = false;
    this.worldObjectsPersistCounter = 0;
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
    object_count: number;
  } {
    return {
      region_id: this.regionId,
      player_count: this.players.size,
      players: this.getPlayersArray(),
      chat_history: this.chatHistory.slice(-50),
      object_count: this.worldObjects.size,
    };
  }

  private getWorldObjectsArray(): RegionWorldObject[] {
    return Array.from(this.worldObjects.values());
  }

  private clamp(value: number, min: number, max: number): number {
    return Math.max(min, Math.min(max, value));
  }

  private clampTransform(input: RegionObjectTransform, fallback?: RegionObjectTransform): RegionObjectTransform {
    const source = input ?? fallback ?? { x: 0, y: 0, z: 0 };
    return {
      x: this.clamp(source.x, -200, 200),
      y: this.clamp(source.y, -100, 100),
      z: this.clamp(source.z, -200, 200),
    };
  }

  private clampRotation(input?: RegionObjectTransform): RegionObjectTransform {
    const source = input ?? { x: 0, y: 0, z: 0 };
    return {
      x: this.clamp(source.x, -Math.PI * 2, Math.PI * 2),
      y: this.clamp(source.y, -Math.PI * 2, Math.PI * 2),
      z: this.clamp(source.z, -Math.PI * 2, Math.PI * 2),
    };
  }

  private clampScale(input?: RegionObjectTransform): RegionObjectTransform {
    const source = input ?? { x: 1, y: 1, z: 1 };
    return {
      x: this.clamp(source.x, 0.2, 20),
      y: this.clamp(source.y, 0.2, 20),
      z: this.clamp(source.z, 0.2, 20),
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
