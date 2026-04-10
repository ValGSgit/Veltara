/**
 * API key authentication + rate limiting middleware.
 * Handles: vlt_xxx keys, tier-based rate limits, KV caching.
 */

import type { ApiKeyTier } from '@veltara/shared';
import { RATE_LIMITS } from '@veltara/shared';
import { sha256Hex } from '../utils/jwt.js';
import { Errors, jsonResponse } from '../utils/errors.js';
import { createSupabaseClient } from '../utils/supabase.js';

export interface ApiKeyMeta {
  id: string;
  user_id: string;
  tier: ApiKeyTier;
  rate_limit: number;
  show_watermark: boolean;
}

export interface ApiKeyEnv {
  KV_API_KEYS: KVNamespace;
  SUPABASE_URL: string;
  SUPABASE_SERVICE_KEY: string;
}

const CACHE_TTL_SEC = 60;
const DAY_COUNTER_TTL_SEC = 86_400;

/**
 * Extracts, validates, and rate-limits an API key from the request.
 * Returns the key metadata or an error Response.
 */
export async function requireApiKey(
  request: Request,
  env: ApiKeyEnv,
): Promise<{ meta: ApiKeyMeta } | Response> {
  const auth = request.headers.get('Authorization');
  if (!auth?.startsWith('Bearer vlt_')) {
    return Errors.unauthorized();
  }

  const rawKey = auth.slice(7);
  const keyHash = await sha256Hex(rawKey);
  const cacheKey = `apikey:${keyHash}`;

  // Try KV cache first (60s TTL)
  let meta: ApiKeyMeta | null = null;
  const cached = await env.KV_API_KEYS.get(cacheKey, 'json');
  if (cached) {
    meta = cached as ApiKeyMeta;
  } else {
    const db = createSupabaseClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_KEY);
    const { data, error } = await db
      .from('api_keys')
      .select('id, user_id, tier, rate_limit, is_active')
      .eq('key_hash', keyHash)
      .eq('is_active', true)
      .single();

    if (error || !data) return Errors.unauthorized();

    const row = data as { id: string; user_id: string; tier: ApiKeyTier; rate_limit: number };
    meta = {
      id: row.id,
      user_id: row.user_id,
      tier: row.tier,
      rate_limit: row.rate_limit,
      show_watermark: row.tier === 'sandbox',
    };

    await env.KV_API_KEYS.put(cacheKey, JSON.stringify(meta), {
      expirationTtl: CACHE_TTL_SEC,
    });
  }

  // Rate limit check — use atomic KV counter per key per UTC day
  const today = new Date().toISOString().slice(0, 10);
  const counterKey = `ratelimit:${meta.id}:${today}`;
  const countStr = await env.KV_API_KEYS.get(counterKey);
  const count = countStr ? parseInt(countStr) : 0;

  const limit = meta.tier === 'enterprise' ? Infinity : (RATE_LIMITS[meta.tier] ?? 1000);

  if (count >= limit) {
    return new Response(
      JSON.stringify({
        error: {
          code: 'RATE_LIMITED',
          message: `Daily limit of ${limit} requests exceeded`,
          status: 429,
        },
      }),
      {
        status: 429,
        headers: {
          'Content-Type': 'application/json',
          'X-RateLimit-Limit': String(limit),
          'X-RateLimit-Remaining': '0',
          'X-RateLimit-Reset': String(getNextMidnightUnix()),
        },
      },
    );
  }

  // Increment counter atomically
  await env.KV_API_KEYS.put(counterKey, String(count + 1), {
    expirationTtl: DAY_COUNTER_TTL_SEC,
  });

  // Fire-and-forget: update last_used_at in Supabase (don't await)
  const db = createSupabaseClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_KEY);
  void db
    .from('api_keys')
    .update({ last_used_at: new Date().toISOString(), requests_total: count + 1 })
    .eq('id', meta.id);

  return { meta };
}

function getNextMidnightUnix(): number {
  const now = new Date();
  const midnight = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1));
  return Math.floor(midnight.getTime() / 1000);
}
