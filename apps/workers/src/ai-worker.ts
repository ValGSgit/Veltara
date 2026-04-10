/**
 * ai-worker — all AI features:
 * 1. Content moderation (chat + posts)
 * 2. Player recommendations via embeddings
 * 3. GET /api/recommendations
 * 4. POST /api/ai/moderate  (internal use)
 * 5. POST /api/ai/embed     (internal use)
 */

import { z } from 'zod';
import {
  AUTO_MUTE_THRESHOLD,
  MODERATION_CACHE_TTL_SECONDS,
} from '@veltara/shared';
import { handleCors, withCors } from './utils/cors.js';
import { Errors, jsonResponse } from './utils/errors.js';
import { requireAuth } from './middleware/auth.js';
import { createSupabaseClient } from './utils/supabase.js';

interface Env {
  AI: Ai;
  KV_MODERATION: KVNamespace;
  KV_SESSIONS: KVNamespace;
  JWT_SECRET: string;
  SUPABASE_URL: string;
  SUPABASE_SERVICE_KEY: string;
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const corsResponse = handleCors(request);
    if (corsResponse) return corsResponse;

    const url = new URL(request.url);
    const path = url.pathname;

    try {
      let response: Response;

      if (path === '/api/ai/moderate' && request.method === 'POST') {
        response = await handleModerate(request, env);
      } else if (path === '/api/recommendations' && request.method === 'GET') {
        response = await handleRecommendations(request, env);
      } else if (path === '/api/ai/embed' && request.method === 'POST') {
        response = await handleEmbed(request, env);
      } else {
        response = Errors.notFound();
      }

      return withCors(response, request);
    } catch (err) {
      console.error('ai-worker error:', err);
      return withCors(Errors.internalError(), request);
    }
  },
};

// ─── Content Moderation ───────────────────────────────────────────────────────

const ModerateSchema = z.object({
  text: z.string().min(1).max(5000),
  user_id: z.string(),
  context: z.enum(['chat', 'post', 'comment']).default('chat'),
});

export async function moderateContent(
  text: string,
  userId: string,
  env: Env,
): Promise<{ safe: boolean; reason?: string }> {
  // Check KV cache first
  const cacheKey = `mod:${await hashText(text)}`;
  const cached = await env.KV_MODERATION.get(cacheKey, 'json') as { safe: boolean; reason?: string } | null;
  if (cached) return cached;

  try {
    const ai = env.AI as unknown as {
      run: (model: string, opts: unknown) => Promise<{ response: string }>;
    };

    const result = await ai.run('@cf/meta/llama-3.1-8b-instruct', {
      messages: [
        {
          role: 'system',
          content: `You are a content moderation system. Analyze the following text and respond with ONLY a JSON object: {"safe": true/false, "reason": "brief reason if unsafe or null if safe"}.
          Flag content that contains: hate speech, harassment, explicit sexual content, graphic violence, spam, or illegal content.
          Be balanced — normal game chat and mild language is safe.`,
        },
        { role: 'user', content: `Moderate this text: "${text}"` },
      ],
      max_tokens: 100,
    });

    let parsed: { safe: boolean; reason?: string };
    try {
      parsed = JSON.parse(result.response) as { safe: boolean; reason?: string };
    } catch {
      // If AI doesn't return valid JSON, default to safe
      parsed = { safe: true };
    }

    // Cache result
    await env.KV_MODERATION.put(cacheKey, JSON.stringify(parsed), {
      expirationTtl: MODERATION_CACHE_TTL_SECONDS,
    });

    // If unsafe, increment user's violation count
    if (!parsed.safe) {
      await trackViolation(userId, env);
    }

    return parsed;
  } catch {
    // If AI fails, default to safe to avoid blocking content
    return { safe: true };
  }
}

async function trackViolation(userId: string, env: Env): Promise<void> {
  const today = new Date().toISOString().slice(0, 10);
  const violationKey = `violations:${userId}:${today}`;
  const countStr = await env.KV_MODERATION.get(violationKey);
  const count = countStr ? parseInt(countStr) : 0;
  const newCount = count + 1;

  await env.KV_MODERATION.put(violationKey, String(newCount), { expirationTtl: 86400 });

  if (newCount >= AUTO_MUTE_THRESHOLD) {
    // Mute user for 24 hours in Supabase
    const db = createSupabaseClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_KEY);
    const muteUntil = new Date(Date.now() + 86400_000).toISOString();
    await db.from('users').update({ muted_until: muteUntil, mute_count: newCount }).eq('id', userId);
  }
}

async function handleModerate(request: Request, env: Env): Promise<Response> {
  const body = await request.json().catch(() => null);
  const parsed = ModerateSchema.safeParse(body);
  if (!parsed.success) return Errors.badRequest(parsed.error.message);

  const result = await moderateContent(parsed.data.text, parsed.data.user_id, env);
  return jsonResponse(result);
}

// ─── Player Recommendations ───────────────────────────────────────────────────

async function handleRecommendations(request: Request, env: Env): Promise<Response> {
  const result = await requireAuth(request, env);
  if (result instanceof Response) return result;

  const db = createSupabaseClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_KEY);

  // Get current user's embedding
  const { data: currentUser } = await db
    .from('users')
    .select('embedding, bio, current_region')
    .eq('id', result.claims.sub)
    .single() as { data: { embedding: number[] | null; bio: string | null; current_region: string | null } | null };

  // If no embedding, generate one from bio
  if (!currentUser?.embedding && currentUser?.bio) {
    await generateAndStoreEmbedding(result.claims.sub, currentUser.bio, env);
  }

  // Use Supabase vector similarity search
  const { data: recommendations } = await db.rpc('match_users', {
    query_embedding: currentUser?.embedding ?? [],
    match_threshold: 0.5,
    match_count: 5,
    exclude_user_id: result.claims.sub,
  });

  return jsonResponse({ recommendations: recommendations ?? [] });
}

export async function generateAndStoreEmbedding(
  userId: string,
  text: string,
  env: Env,
): Promise<void> {
  try {
    const ai = env.AI as unknown as {
      run: (model: string, opts: unknown) => Promise<{ data: number[][] }>;
    };

    const result = await ai.run('@cf/baai/bge-small-en-v1.5', {
      text: [text.slice(0, 512)],
    });

    const embedding = result.data[0];
    if (!embedding) return;

    const db = createSupabaseClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_KEY);
    await db.from('users').update({ embedding }).eq('id', userId);
  } catch {
    // Embedding generation failed — non-critical
  }
}

async function handleEmbed(request: Request, env: Env): Promise<Response> {
  const body = await request.json().catch(() => null) as { text?: string; user_id?: string } | null;
  if (!body?.text || !body?.user_id) return Errors.badRequest('text and user_id required');

  await generateAndStoreEmbedding(body.user_id, body.text, env);
  return jsonResponse({ ok: true });
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

async function hashText(text: string): Promise<string> {
  const enc = new TextEncoder();
  const buf = await crypto.subtle.digest('SHA-256', enc.encode(text));
  return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, '0')).join('');
}
