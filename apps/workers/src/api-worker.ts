/**
 * api-worker — Developer API (public-facing B2B API)
 *
 * All routes require API key (Authorization: Bearer vlt_xxx)
 *
 * Routes:
 * POST /api/developer/keys          → generate API key
 * GET  /api/developer/keys          → list keys
 * DELETE /api/developer/keys/:id    → revoke key
 * GET  /api/developer/usage         → usage stats
 * GET  /v1/regions                  → public region list
 * GET  /v1/world-state              → world state
 * POST /v1/events                   → trigger event
 * GET  /v1/players/online           → online count
 * POST /v1/embed/session            → create embed session token
 * WS   /v1/regions/:id/subscribe    → WebSocket event stream
 */

import { z } from 'zod';
import { REGIONS, REGION_MAP, type RegionId } from '@veltara/shared';
import { handleCors, withCors } from './utils/cors.js';
import { Errors, jsonResponse } from './utils/errors.js';
import { requireAuth } from './middleware/auth.js';
import { requireApiKey } from './middleware/api-key.js';
import { createSupabaseClient } from './utils/supabase.js';
import { generateToken, sha256Hex, signJwt } from './utils/jwt.js';

interface Env {
  JWT_SECRET: string;
  KV_SESSIONS: KVNamespace;
  KV_WORLD: KVNamespace;
  KV_API_KEYS: KVNamespace;
  SUPABASE_URL: string;
  SUPABASE_SERVICE_KEY: string;
  REGION_ROOM: DurableObjectNamespace;
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const corsResponse = handleCors(request);
    if (corsResponse) return corsResponse;

    const url = new URL(request.url);
    const path = url.pathname;

    try {
      let response: Response;

      // ─── Developer Key Management (requires user JWT) ────────────────────
      if (path === '/api/developer/keys' && request.method === 'POST') {
        response = await handleCreateKey(request, env);
      } else if (path === '/api/developer/keys' && request.method === 'GET') {
        response = await handleListKeys(request, env);
      } else if (path.startsWith('/api/developer/keys/') && request.method === 'DELETE') {
        response = await handleRevokeKey(request, env, path);
      } else if (path === '/api/developer/usage' && request.method === 'GET') {
        response = await handleUsage(request, env);

        // ─── Public API (requires API key) ───────────────────────────────────
      } else if (path === '/v1/regions' && request.method === 'GET') {
        response = await handleV1Regions(request, env);
      } else if (path === '/v1/world-state' && request.method === 'GET') {
        response = await handleV1WorldState(request, env);
      } else if (path === '/v1/events' && request.method === 'POST') {
        response = await handleV1TriggerEvent(request, env);
      } else if (path === '/v1/players/online' && request.method === 'GET') {
        response = await handleV1OnlineCount(request, env);
      } else if (path === '/v1/embed/session' && request.method === 'POST') {
        response = await handleV1EmbedSession(request, env);
      } else if (path.startsWith('/v1/regions/') && path.endsWith('/subscribe')) {
        response = await handleV1Subscribe(request, env, path);
      } else {
        response = Errors.notFound();
      }

      return withCors(response, request);
    } catch (err) {
      console.error('api-worker error:', err);
      return withCors(Errors.internalError(), request);
    }
  },
};

// ─── POST /api/developer/keys ─────────────────────────────────────────────────

const CreateKeySchema = z.object({ name: z.string().min(1).max(100) });

async function handleCreateKey(request: Request, env: Env): Promise<Response> {
  const authResult = await requireAuth(request, env);
  if (authResult instanceof Response) return authResult;

  const body = await request.json().catch(() => null);
  const parsed = CreateKeySchema.safeParse(body);
  if (!parsed.success) return Errors.badRequest(parsed.error.message);

  const rawKey = `vlt_${generateToken(32)}`;
  const keyHash = await sha256Hex(rawKey);
  const keyPrefix = rawKey.slice(0, 12) + '...';

  const db = createSupabaseClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_KEY);
  const { data: key, error } = await db
    .from('api_keys')
    .insert({
      user_id: authResult.claims.sub,
      key_hash: keyHash,
      key_prefix: keyPrefix,
      name: parsed.data.name,
      tier: 'sandbox',
      rate_limit: 1000,
    })
    .select('id, key_prefix, name, tier, rate_limit, created_at')
    .single();

  if (error || !key) return Errors.internalError('Failed to create key');

  return jsonResponse({ key: { ...key, raw_key: rawKey } }, 201);
}

// ─── GET /api/developer/keys ──────────────────────────────────────────────────

async function handleListKeys(request: Request, env: Env): Promise<Response> {
  const authResult = await requireAuth(request, env);
  if (authResult instanceof Response) return authResult;

  const db = createSupabaseClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_KEY);
  const { data: keys } = await db
    .from('api_keys')
    .select('id, key_prefix, name, tier, requests_today, requests_total, rate_limit, created_at, last_used_at')
    .eq('user_id', authResult.claims.sub)
    .eq('is_active', true)
    .order('created_at', { ascending: false });

  return jsonResponse({ keys: keys ?? [] });
}

// ─── DELETE /api/developer/keys/:id ──────────────────────────────────────────

async function handleRevokeKey(request: Request, env: Env, path: string): Promise<Response> {
  const authResult = await requireAuth(request, env);
  if (authResult instanceof Response) return authResult;

  const keyId = path.split('/')[4];
  if (!keyId) return Errors.badRequest('Key ID required');

  const db = createSupabaseClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_KEY);
  const { data: key } = await db
    .from('api_keys')
    .select('id, user_id')
    .eq('id', keyId)
    .eq('user_id', authResult.claims.sub)
    .single() as { data: { id: string; user_id: string } | null };

  if (!key) return Errors.notFound('Key not found');

  await db.from('api_keys').update({ is_active: false }).eq('id', keyId);

  // Invalidate KV cache for this key
  await env.KV_API_KEYS.delete(`apikey:${keyId}`);

  return jsonResponse({ ok: true });
}

// ─── GET /api/developer/usage ─────────────────────────────────────────────────

async function handleUsage(request: Request, env: Env): Promise<Response> {
  const authResult = await requireAuth(request, env);
  if (authResult instanceof Response) return authResult;

  const db = createSupabaseClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_KEY);
  const { data: keys } = await db
    .from('api_keys')
    .select('id, key_prefix, name, requests_today, requests_total, tier')
    .eq('user_id', authResult.claims.sub)
    .eq('is_active', true) as { data: Array<{ id: string; key_prefix: string; name: string; requests_today: number; requests_total: number; tier: string }> | null };

  const usage = await Promise.all(
    (keys ?? []).map(async (key) => {
      const dailyStats: Array<{ date: string; count: number }> = [];
      for (let i = 0; i < 7; i++) {
        const date = new Date(Date.now() - i * 86400_000).toISOString().slice(0, 10);
        const counterKey = `ratelimit:${key.id}:${date}`;
        const count = await env.KV_API_KEYS.get(counterKey);
        dailyStats.push({ date, count: count ? parseInt(count) : 0 });
      }
      return { ...key, daily_stats: dailyStats.reverse() };
    }),
  );

  return jsonResponse({ usage });
}

// ─── GET /v1/regions ──────────────────────────────────────────────────────────

async function handleV1Regions(request: Request, env: Env): Promise<Response> {
  const apiKeyResult = await requireApiKey(request, env);
  if (apiKeyResult instanceof Response) return apiKeyResult;

  const regionsWithCounts = await Promise.all(
    REGIONS.map(async (region) => {
      try {
        const id = env.REGION_ROOM.idFromName(region.id);
        const stub = env.REGION_ROOM.get(id);
        const res = await stub.fetch('https://internal/state');
        const state = await res.json() as { player_count: number };
        return { id: region.id, name: region.name, color: region.color, player_count: state.player_count };
      } catch {
        return { id: region.id, name: region.name, color: region.color, player_count: 0 };
      }
    }),
  );

  return jsonResponse({ regions: regionsWithCounts });
}

// ─── GET /v1/world-state ──────────────────────────────────────────────────────

async function handleV1WorldState(request: Request, env: Env): Promise<Response> {
  const apiKeyResult = await requireApiKey(request, env);
  if (apiKeyResult instanceof Response) return apiKeyResult;

  const state = await env.KV_WORLD.get('world_state', 'json');
  return jsonResponse(state ?? { planet_time: Date.now() / 1000, weather: 'clear', active_events: [] });
}

// ─── POST /v1/events ──────────────────────────────────────────────────────────

const V1EventSchema = z.object({
  type: z.string().min(1).max(64),
  title: z.string().min(1).max(255),
  description: z.string().min(1).max(1000),
  region_id: z.string().optional(),
});

async function handleV1TriggerEvent(request: Request, env: Env): Promise<Response> {
  const apiKeyResult = await requireApiKey(request, env);
  if (apiKeyResult instanceof Response) return apiKeyResult;

  const body = await request.json().catch(() => null);
  const parsed = V1EventSchema.safeParse(body);
  if (!parsed.success) return Errors.badRequest(parsed.error.message);

  const event = {
    id: crypto.randomUUID(),
    ...parsed.data,
    starts_at: Date.now(),
    ends_at: Date.now() + 3600_000,
    active: true,
    source: 'api',
  };

  const targetRegions = parsed.data.region_id ? [parsed.data.region_id] : REGIONS.map((r) => r.id);
  await Promise.all(
    targetRegions.map(async (rid) => {
      try {
        const id = env.REGION_ROOM.idFromName(rid);
        const stub = env.REGION_ROOM.get(id);
        await stub.fetch(new Request('https://internal/broadcast', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ type: 'global_event', payload: event, timestamp: Date.now() }),
        }));
      } catch { /* Empty region */ }
    }),
  );

  return jsonResponse({ event }, 201);
}

// ─── GET /v1/players/online ───────────────────────────────────────────────────

async function handleV1OnlineCount(request: Request, env: Env): Promise<Response> {
  const apiKeyResult = await requireApiKey(request, env);
  if (apiKeyResult instanceof Response) return apiKeyResult;

  let total = 0;
  await Promise.all(
    REGIONS.map(async (region) => {
      try {
        const id = env.REGION_ROOM.idFromName(region.id);
        const stub = env.REGION_ROOM.get(id);
        const res = await stub.fetch('https://internal/state');
        const state = await res.json() as { player_count: number };
        total += state.player_count;
      } catch { /* Empty region */ }
    }),
  );

  return jsonResponse({ online: total });
}

// ─── POST /v1/embed/session ───────────────────────────────────────────────────

const EmbedSessionSchema = z.object({
  region_id: z.string().optional(),
  user_label: z.string().max(64).optional(),
});

async function handleV1EmbedSession(request: Request, env: Env): Promise<Response> {
  const apiKeyResult = await requireApiKey(request, env);
  if (apiKeyResult instanceof Response) return apiKeyResult;

  const body = await request.json().catch(() => ({}));
  const parsed = EmbedSessionSchema.safeParse(body);
  if (!parsed.success) return Errors.badRequest(parsed.error.message);

  const regionId = (parsed.data.region_id as RegionId) ?? 'nexus-core';
  if (!REGION_MAP[regionId]) return Errors.badRequest('Invalid region_id');

  const meta = apiKeyResult.meta;

  // Create a temporary JWT for the embedded session
  const sessionToken = await signJwt(
    {
      sub: `embed:${meta.user_id}:${crypto.randomUUID().slice(0, 8)}`,
      username: parsed.data.user_label ?? `Guest`,
      email: '',
      plan_tier: 'free',
    },
    env.JWT_SECRET,
    3600,
  );

  return jsonResponse({
    token: sessionToken,
    region_id: regionId,
    expires_at: Date.now() + 3600_000,
    tier: meta.tier,
    show_watermark: meta.show_watermark,
  });
}

// ─── WS /v1/regions/:id/subscribe ────────────────────────────────────────────

async function handleV1Subscribe(request: Request, env: Env, path: string): Promise<Response> {
  const apiKeyResult = await requireApiKey(request, env);
  if (apiKeyResult instanceof Response) return apiKeyResult;

  const regionId = path.split('/')[3] as RegionId;
  if (!REGION_MAP[regionId]) return Errors.notFound('Region not found');

  if (request.headers.get('Upgrade') !== 'websocket') {
    return Errors.badRequest('WebSocket upgrade required');
  }

  const id = env.REGION_ROOM.idFromName(regionId);
  const stub = env.REGION_ROOM.get(id);

  // Create temporary subscriber token
  const token = await signJwt(
    { sub: `sub:${apiKeyResult.meta.id}`, username: 'API Subscriber', email: '', plan_tier: 'free' },
    env.JWT_SECRET,
    3600,
  );

  const url = new URL(request.url);
  url.searchParams.set('token', token);
  url.searchParams.set('region', regionId);

  return stub.fetch(new Request(url, request));
}
