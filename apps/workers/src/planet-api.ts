/**
 * planet-api — main game API Worker + router entry point
 *
 * Routes:
 * GET  /api/regions            → list regions with player counts
 * GET  /api/world-state        → current planet time, weather, events
 * POST /api/players/join       → authenticate and assign region
 * GET  /api/regions/:id/connect → WebSocket upgrade to RegionRoom DO
 * GET  /api/players/:id        → player profile
 * POST /api/events             → admin trigger world event
 *
 * Also exports RegionRoom Durable Object class.
 */

import { z } from 'zod';
import { REGIONS, REGION_MAP, getRegionForPosition, type RegionId } from '@veltara/shared';
import { handleCors, withCors } from './utils/cors.js';
import { Errors, jsonResponse } from './utils/errors.js';
import { requireAuth } from './middleware/auth.js';
import { createSupabaseClient } from './utils/supabase.js';
import { verifyJwt } from './utils/jwt.js';
import authWorker from './auth-worker.js';
import apiWorker from './api-worker.js';
export { RegionRoom } from './region-room.js';

interface Env {
  REGION_ROOM: DurableObjectNamespace;
  KV_WORLD: KVNamespace;
  KV_SESSIONS: KVNamespace;
  KV_API_KEYS: KVNamespace;
  SUPABASE_URL: string;
  SUPABASE_SERVICE_KEY: string;
  JWT_SECRET: string;
  AI: Ai;
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const corsResponse = handleCors(request);
    if (corsResponse) return corsResponse;

    const url = new URL(request.url);
    const path = url.pathname;

    try {
      let response: Response;

      if (path.startsWith('/api/auth/')) {
        response = await authWorker.fetch(request, env as Parameters<typeof authWorker.fetch>[1]);
      } else if (path.startsWith('/api/developer/') || path.startsWith('/v1/')) {
        response = await apiWorker.fetch(request, env as Parameters<typeof apiWorker.fetch>[1]);
      } else
      if (path === '/api/regions' && request.method === 'GET') {
        response = await handleGetRegions(env);
      } else if (path === '/api/world-state' && request.method === 'GET') {
        response = await handleGetWorldState(env);
      } else if (path === '/api/players/join' && request.method === 'POST') {
        response = await handlePlayerJoin(request, env);
      } else if (path.startsWith('/api/regions/') && path.endsWith('/connect')) {
        response = await handleRegionConnect(request, env, path);
      } else if (path.startsWith('/api/players/') && request.method === 'GET') {
        response = await handleGetPlayer(request, env, path);
      } else if (path === '/api/events' && request.method === 'POST') {
        response = await handleTriggerEvent(request, env);
      } else {
        response = Errors.notFound();
      }

      return withCors(response, request);
    } catch (err) {
      console.error('planet-api error:', err);
      return withCors(Errors.internalError(), request);
    }
  },

  // ─── Cron Handler ────────────────────────────────────────────────────────────
  async scheduled(event: ScheduledEvent, env: Env): Promise<void> {
    if (event.cron === '*/5 * * * *') {
      await updateWorldState(env);
    } else if (event.cron === '0 */6 * * *') {
      await generateWorldEvent(env);
    }
  },
};

// ─── GET /api/regions ─────────────────────────────────────────────────────────

async function handleGetRegions(env: Env): Promise<Response> {
  // Get player counts from each region DO
  const regionsWithCounts = await Promise.all(
    REGIONS.map(async (region) => {
      try {
        const id = env.REGION_ROOM.idFromName(region.id);
        const stub = env.REGION_ROOM.get(id);
        const res = await stub.fetch(`https://internal/state`);
        const state = await res.json() as { player_count: number };
        return { ...region, player_count: state.player_count };
      } catch {
        return { ...region, player_count: 0 };
      }
    }),
  );

  return jsonResponse({ regions: regionsWithCounts });
}

// ─── GET /api/world-state ─────────────────────────────────────────────────────

async function handleGetWorldState(env: Env): Promise<Response> {
  const state = await env.KV_WORLD.get('world_state', 'json');
  if (state) return jsonResponse(state);

  // Generate default state if none exists
  const defaultState = buildWorldState();
  await env.KV_WORLD.put('world_state', JSON.stringify(defaultState), { expirationTtl: 120 });
  return jsonResponse(defaultState);
}

// ─── POST /api/players/join ───────────────────────────────────────────────────

const JoinSchema = z.object({
  lat: z.number().min(-90).max(90).optional(),
  lon: z.number().min(-180).max(180).optional(),
  region_id: z.string().optional(),
});

async function handlePlayerJoin(request: Request, env: Env): Promise<Response> {
  const result = await requireAuth(request, env);
  if (result instanceof Response) return result;

  const body = await request.json().catch(() => ({}));
  const parsed = JoinSchema.safeParse(body);
  if (!parsed.success) return Errors.badRequest(parsed.error.message);

  const { lat = 0, lon = 0, region_id } = parsed.data;
  const assignedRegion: RegionId = (region_id as RegionId) ?? getRegionForPosition(lat, lon);

  // Update user's current region in Supabase
  const db = createSupabaseClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_KEY);
  await db.from('users').update({ current_region: assignedRegion }).eq('id', result.claims.sub);

  return jsonResponse({
    region_id: assignedRegion,
    region: REGION_MAP[assignedRegion],
    ws_url: `/api/regions/${assignedRegion}/connect`,
  });
}

// ─── GET /api/regions/:id/connect ────────────────────────────────────────────

async function handleRegionConnect(request: Request, env: Env, path: string): Promise<Response> {
  const regionId = path.split('/')[3] as RegionId;

  if (!REGION_MAP[regionId]) return Errors.notFound('Region not found');

  if (request.headers.get('Upgrade') !== 'websocket') {
    return Errors.badRequest('WebSocket upgrade required');
  }

  const url = new URL(request.url);
  const token = url.searchParams.get('token');
  if (!token) return Errors.unauthorized();

  try {
    await verifyJwt(token, env.JWT_SECRET);
  } catch {
    return Errors.unauthorized();
  }

  const id = env.REGION_ROOM.idFromName(regionId);
  const stub = env.REGION_ROOM.get(id);

  // Forward to Durable Object with region info, strip token from URL to avoid log leakage
  const doUrl = new URL(request.url);
  doUrl.searchParams.delete('token');
  doUrl.searchParams.set('region', regionId);

  return stub.fetch(new Request(doUrl, request));
}

// ─── GET /api/players/:id ─────────────────────────────────────────────────────

async function handleGetPlayer(request: Request, env: Env, path: string): Promise<Response> {
  const playerId = path.split('/')[3];
  if (!playerId) return Errors.badRequest('Player ID required');

  const db = createSupabaseClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_KEY);
  const { data: user } = await db
    .from('users')
    .select('id, username, avatar_url, bio, plan_tier, total_playtime, current_region, created_at')
    .eq('id', playerId)
    .single();

  if (!user) return Errors.notFound('Player not found');

  return jsonResponse({ player: user });
}

// ─── POST /api/events ─────────────────────────────────────────────────────────

const EventSchema = z.object({
  type: z.string().min(1).max(64),
  title: z.string().min(1).max(255),
  description: z.string().min(1).max(1000),
  region_id: z.string().nullable().optional(),
  duration_sec: z.number().int().min(60).max(86400).default(3600),
});

async function handleTriggerEvent(request: Request, env: Env): Promise<Response> {
  const result = await requireAuth(request, env);
  if (result instanceof Response) return result;

  // Only studio plan users can trigger events (simplified admin check)
  if (result.claims.plan_tier !== 'studio') return Errors.forbidden();

  const body = await request.json().catch(() => null);
  const parsed = EventSchema.safeParse(body);
  if (!parsed.success) return Errors.badRequest(parsed.error.message);

  const { type, title, description, region_id, duration_sec } = parsed.data;
  const now = Date.now();

  const event = {
    id: crypto.randomUUID(),
    type,
    title,
    description,
    region_id: region_id ?? null,
    starts_at: now,
    ends_at: now + duration_sec * 1000,
    active: true,
  };

  // Add to active events in KV
  const worldState = await env.KV_WORLD.get('world_state', 'json') as Record<string, unknown> | null;
  if (worldState) {
    const events = (worldState['active_events'] as unknown[]) ?? [];
    events.push(event);
    worldState['active_events'] = events;
    await env.KV_WORLD.put('world_state', JSON.stringify(worldState), { expirationTtl: 120 });
  }

  // Broadcast to target region(s)
  const targetRegions = region_id ? [region_id] : REGIONS.map((r) => r.id);
  await Promise.all(
    targetRegions.map(async (rid) => {
      try {
        const id = env.REGION_ROOM.idFromName(rid);
        const stub = env.REGION_ROOM.get(id);
        await stub.fetch(new Request('https://internal/broadcast', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            type: 'global_event',
            payload: event,
            timestamp: now,
          }),
        }));
      } catch { /* Region might be empty */ }
    }),
  );

  return jsonResponse({ event }, 201);
}

// ─── Cron: Update World State ─────────────────────────────────────────────────

async function updateWorldState(env: Env): Promise<void> {
  const state = buildWorldState();

  // Count total online players from all region DOs
  let totalOnline = 0;
  await Promise.all(
    REGIONS.map(async (region) => {
      try {
        const id = env.REGION_ROOM.idFromName(region.id);
        const stub = env.REGION_ROOM.get(id);
        const res = await stub.fetch('https://internal/state');
        const s = await res.json() as { player_count: number };
        totalOnline += s.player_count;
      } catch { /* Empty region */ }
    }),
  );

  state.total_online = totalOnline;

  // Keep active events that haven't expired
  const existing = await env.KV_WORLD.get('world_state', 'json') as Record<string, unknown> | null;
  if (existing) {
    const activeEvents = ((existing['active_events'] as unknown[]) ?? []).filter((e: unknown) => {
      const ev = e as { ends_at: number; active: boolean };
      return ev.active && ev.ends_at > Date.now();
    });
    state.active_events = activeEvents as typeof state.active_events;
  }

  await env.KV_WORLD.put('world_state', JSON.stringify(state), { expirationTtl: 120 });

  // Broadcast updated world state to all regions
  await Promise.all(
    REGIONS.map(async (region) => {
      try {
        const id = env.REGION_ROOM.idFromName(region.id);
        const stub = env.REGION_ROOM.get(id);
        await stub.fetch(new Request('https://internal/broadcast', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ type: 'world_state', payload: state, timestamp: Date.now() }),
        }));
      } catch { /* Empty region */ }
    }),
  );
}

// ─── Cron: Generate World Event ───────────────────────────────────────────────

async function generateWorldEvent(env: Env): Promise<void> {
  const worldState = await env.KV_WORLD.get('world_state', 'json') as Record<string, unknown> | null;

  const eventTypes = [
    'meteor_shower', 'trade_caravan', 'void_rift',
    'ancient_discovery', 'faction_war', 'weather_phenomenon',
  ];
  const eventType = eventTypes[Math.floor(Math.random() * eventTypes.length)]!;
  const targetRegion = REGIONS[Math.floor(Math.random() * REGIONS.length)]!;

  try {
    const aiRes = await (env.AI as unknown as {
      run: (model: string, opts: unknown) => Promise<{ response: string }>;
    }).run('@cf/meta/llama-3.1-8b-instruct', {
      messages: [
        {
          role: 'system',
          content: 'You are a creative game master for Veltara, a sci-fi social planet game. Generate vivid, atmospheric world event descriptions in 2-3 sentences. Be dramatic and immersive.',
        },
        {
          role: 'user',
          content: `Generate a ${eventType.replace('_', ' ')} event occurring in ${targetRegion.name}. Current weather: ${(worldState?.['weather'] as string) ?? 'clear'}.`,
        },
      ],
      max_tokens: 150,
    });

    const event = {
      id: crypto.randomUUID(),
      type: eventType,
      title: `${eventType.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())} in ${targetRegion.name}`,
      description: aiRes.response,
      region_id: targetRegion.id,
      starts_at: Date.now(),
      ends_at: Date.now() + 7200_000, // 2 hours
      active: true,
    };

    // Store and broadcast
    if (worldState) {
      const events = ((worldState['active_events'] as unknown[]) ?? []).slice(-9);
      events.push(event);
      worldState['active_events'] = events;
      await env.KV_WORLD.put('world_state', JSON.stringify(worldState), { expirationTtl: 120 });
    }

    // Broadcast to all regions
    await Promise.all(REGIONS.map(async (region) => {
      try {
        const id = env.REGION_ROOM.idFromName(region.id);
        const stub = env.REGION_ROOM.get(id);
        await stub.fetch(new Request('https://internal/broadcast', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ type: 'global_event', payload: event, timestamp: Date.now() }),
        }));
      } catch { /* Empty region */ }
    }));
  } catch (err) {
    console.error('Failed to generate world event:', err);
  }
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function buildWorldState() {
  const now = Date.now();
  const weathers = ['clear', 'cloudy', 'stormy', 'aurora', 'solar_flare', 'void_mist'] as const;
  return {
    planet_time: Math.floor(now / 1000),
    day_cycle_progress: (now % 600_000) / 600_000,
    weather: weathers[Math.floor(now / 600_000) % weathers.length]!,
    active_events: [] as unknown[],
    total_online: 0,
    updated_at: now,
  };
}
