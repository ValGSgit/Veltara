/**
 * social-worker — social feed, posts, likes, follows, profiles, leaderboard
 *
 * Routes:
 * GET  /api/feed
 * POST /api/posts
 * POST /api/posts/:id/like
 * GET  /api/posts/:id/comments
 * POST /api/posts/:id/comments
 * POST /api/users/:id/follow
 * GET  /api/users/:id/profile
 * GET  /api/leaderboard
 */

import { z } from 'zod';
import { sanitizeHtml, R2_FREE_TIER } from '@veltara/shared';
import { handleCors, withCors } from './utils/cors.js';
import { Errors, jsonResponse } from './utils/errors.js';
import { requireAuth } from './middleware/auth.js';
import { createSupabaseClient } from './utils/supabase.js';

interface Env {
  JWT_SECRET: string;
  SUPABASE_URL: string;
  SUPABASE_SERVICE_KEY: string;
  R2_ASSETS: R2Bucket;
  KV_WORLD: KVNamespace;
}

// ─── R2 Free-Tier Budget Helpers ─────────────────────────────────────────────

async function checkR2StorageBudget(env: Env): Promise<boolean> {
  const raw = await env.KV_WORLD.get('r2:total_bytes');
  const totalBytes = raw ? parseInt(raw) : 0;
  return totalBytes < R2_FREE_TIER.MAX_STORAGE_BYTES;
}

async function trackR2Upload(env: Env, byteCount: number): Promise<void> {
  const raw = await env.KV_WORLD.get('r2:total_bytes');
  const current = raw ? parseInt(raw) : 0;
  await env.KV_WORLD.put('r2:total_bytes', String(current + byteCount));
}

async function checkUserDailyUploadLimit(
  userId: string,
  env: Env,
): Promise<boolean> {
  const today = new Date().toISOString().slice(0, 10);
  const key = `r2:uploads:${userId}:${today}`;
  const raw = await env.KV_WORLD.get(key);
  const count = raw ? parseInt(raw) : 0;
  return count < R2_FREE_TIER.MAX_UPLOADS_PER_USER_PER_DAY;
}

async function incrementUserDailyUpload(
  userId: string,
  env: Env,
): Promise<void> {
  const today = new Date().toISOString().slice(0, 10);
  const key = `r2:uploads:${userId}:${today}`;
  const raw = await env.KV_WORLD.get(key);
  const count = raw ? parseInt(raw) : 0;
  await env.KV_WORLD.put(key, String(count + 1), { expirationTtl: 86400 });
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const corsResponse = handleCors(request);
    if (corsResponse) return corsResponse;

    const url = new URL(request.url);
    const path = url.pathname;

    try {
      let response: Response;

      if (path === '/api/feed' && request.method === 'GET') {
        response = await handleFeed(request, env);
      } else if (path === '/api/posts' && request.method === 'POST') {
        response = await handleCreatePost(request, env);
      } else if (path.match(/^\/api\/posts\/[^/]+\/like$/) && request.method === 'POST') {
        response = await handleToggleLike(request, env, path);
      } else if (path.match(/^\/api\/posts\/[^/]+\/comments$/)) {
        if (request.method === 'GET') {
          response = await handleGetComments(request, env, path);
        } else if (request.method === 'POST') {
          response = await handleAddComment(request, env, path);
        } else {
          response = Errors.methodNotAllowed();
        }
      } else if (path.match(/^\/api\/users\/[^/]+\/follow$/) && request.method === 'POST') {
        response = await handleToggleFollow(request, env, path);
      } else if (path.match(/^\/api\/users\/[^/]+\/profile$/) && request.method === 'GET') {
        response = await handleGetProfile(request, env, path);
      } else if (path === '/api/leaderboard' && request.method === 'GET') {
        response = await handleLeaderboard(request, env);
      } else {
        response = Errors.notFound();
      }

      return withCors(response, request);
    } catch (err) {
      console.error('social-worker error:', err);
      return withCors(Errors.internalError(), request);
    }
  },
};

// ─── GET /api/feed ────────────────────────────────────────────────────────────

async function handleFeed(request: Request, env: Env): Promise<Response> {
  const result = await requireAuth(request, env);
  if (result instanceof Response) return result;

  const url = new URL(request.url);
  const page = Math.max(1, parseInt(url.searchParams.get('page') ?? '1'));
  const perPage = Math.min(50, parseInt(url.searchParams.get('per_page') ?? '20'));
  const from = (page - 1) * perPage;
  const to = from + perPage - 1;

  const db = createSupabaseClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_KEY);

  // Get posts from followed users + popular region posts
  const { data: posts } = await db
    .from('posts')
    .select(`
      id, content, media_url, region_id, likes_count, comments_count, created_at, user_id,
      users!inner(id, username, avatar_url)
    `)
    .eq('is_deleted', false)
    .order('created_at', { ascending: false })
    .range(from, to);

  if (!posts) return jsonResponse({ data: [], total: 0, page, per_page: perPage, has_more: false });

  // Check which posts the current user has liked
  const postIds = (posts as { id: string }[]).map((p) => p.id);
  const { data: likes } = await db
    .from('likes')
    .select('post_id')
    .eq('user_id', result.claims.sub)
    .in('post_id', postIds);

  const likedSet = new Set((likes as { post_id: string }[] | null ?? []).map((l) => l.post_id));

  const enriched = (posts as Record<string, unknown>[]).map((post) => ({
    ...post,
    author: post['users'],
    liked_by_me: likedSet.has(post['id'] as string),
  }));

  return jsonResponse({
    data: enriched,
    page,
    per_page: perPage,
    has_more: enriched.length === perPage,
  });
}

// ─── POST /api/posts ──────────────────────────────────────────────────────────

const ALLOWED_MEDIA_TYPES = new Set([
  'image/jpeg', 'image/png', 'image/gif', 'image/webp',
  'video/mp4', 'video/webm',
]);
const MAX_MEDIA_BASE64_LEN = Math.ceil(R2_FREE_TIER.MAX_MEDIA_BYTES * 4 / 3); // base64 overhead

const CreatePostSchema = z.object({
  content: z.string().min(1).max(5000),
  region_id: z.string().max(64).nullable().optional(),
  media_base64: z.string().max(MAX_MEDIA_BASE64_LEN).optional(),
  media_type: z.string().max(64).optional(),
});

async function handleCreatePost(request: Request, env: Env): Promise<Response> {
  const result = await requireAuth(request, env);
  if (result instanceof Response) return result;

  const body = await request.json().catch(() => null);
  const parsed = CreatePostSchema.safeParse(body);
  if (!parsed.success) return Errors.badRequest(parsed.error.message);

  const { content, region_id, media_base64, media_type } = parsed.data;
  const sanitized = sanitizeHtml(content);

  let media_url: string | null = null;

  // Upload media to R2 if provided
  if (media_base64 && media_type) {
    if (!ALLOWED_MEDIA_TYPES.has(media_type)) {
      return Errors.badRequest('Unsupported media type. Allowed: JPEG, PNG, GIF, WebP, MP4, WebM');
    }

    // Free-tier guard: check global R2 storage budget
    if (!(await checkR2StorageBudget(env))) {
      return Errors.badRequest('Media storage limit reached. Uploads are temporarily disabled.');
    }

    // Free-tier guard: per-user daily upload limit
    if (!(await checkUserDailyUploadLimit(result.claims.sub, env))) {
      return Errors.badRequest(
        `Upload limit reached (max ${R2_FREE_TIER.MAX_UPLOADS_PER_USER_PER_DAY} per day).`,
      );
    }

    let binaryStr: string;
    try {
      binaryStr = atob(media_base64);
    } catch {
      return Errors.badRequest('Invalid base64 media data');
    }

    if (binaryStr.length > R2_FREE_TIER.MAX_MEDIA_BYTES) {
      return Errors.badRequest(
        `Media file too large (max ${R2_FREE_TIER.MAX_MEDIA_BYTES / (1024 * 1024)} MB)`,
      );
    }

    const bytes = new Uint8Array(binaryStr.length);
    for (let i = 0; i < binaryStr.length; i++) {
      bytes[i] = binaryStr.charCodeAt(i);
    }

    const ext = media_type.split('/')[1] ?? 'jpg';
    const key = `posts/${result.claims.sub}/${crypto.randomUUID()}.${ext}`;

    await env.R2_ASSETS.put(key, bytes.buffer, {
      httpMetadata: { contentType: media_type },
    });
    media_url = `/assets/${key}`;

    // Track usage for free-tier budget
    await trackR2Upload(env, bytes.length);
    await incrementUserDailyUpload(result.claims.sub, env);
  }

  const db = createSupabaseClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_KEY);
  const { data: post, error } = await db
    .from('posts')
    .insert({
      user_id: result.claims.sub,
      content: sanitized,
      media_url,
      region_id: region_id ?? null,
    })
    .select('id, content, media_url, region_id, likes_count, comments_count, created_at')
    .single();

  if (error || !post) return Errors.internalError('Failed to create post');

  // Grant achievement for first post
  void db.from('achievements').upsert(
    { user_id: result.claims.sub, achievement_type: 'post_creator' },
    { onConflict: 'user_id, achievement_type' },
  );

  return jsonResponse({ post }, 201);
}

// ─── POST /api/posts/:id/like ─────────────────────────────────────────────────

async function handleToggleLike(request: Request, env: Env, path: string): Promise<Response> {
  const result = await requireAuth(request, env);
  if (result instanceof Response) return result;

  const postId = path.split('/')[3];
  if (!postId) return Errors.badRequest('Post ID required');

  const db = createSupabaseClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_KEY);

  const { data: existing } = await db
    .from('likes')
    .select('id')
    .eq('user_id', result.claims.sub)
    .eq('post_id', postId)
    .maybeSingle();

  if (existing) {
    await db.from('likes').delete().eq('user_id', result.claims.sub).eq('post_id', postId);
    return jsonResponse({ liked: false });
  } else {
    await db.from('likes').insert({ user_id: result.claims.sub, post_id: postId });
    return jsonResponse({ liked: true });
  }
}

// ─── GET /api/posts/:id/comments ──────────────────────────────────────────────

async function handleGetComments(request: Request, env: Env, path: string): Promise<Response> {
  const postId = path.split('/')[3];
  if (!postId) return Errors.badRequest('Post ID required');

  const url = new URL(request.url);
  const page = Math.max(1, parseInt(url.searchParams.get('page') ?? '1'));
  const perPage = 20;
  const from = (page - 1) * perPage;

  const db = createSupabaseClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_KEY);
  const { data: comments } = await db
    .from('comments')
    .select('id, content, created_at, user_id, users!inner(id, username, avatar_url)')
    .eq('post_id', postId)
    .eq('is_deleted', false)
    .order('created_at', { ascending: true })
    .range(from, from + perPage - 1);

  return jsonResponse({
    data: (comments ?? []).map((c: unknown) => {
      const comment = c as Record<string, unknown>;
      return { ...comment, author: comment['users'] };
    }),
    page,
    has_more: (comments?.length ?? 0) === perPage,
  });
}

// ─── POST /api/posts/:id/comments ─────────────────────────────────────────────

const CommentSchema = z.object({ content: z.string().min(1).max(1000) });

async function handleAddComment(request: Request, env: Env, path: string): Promise<Response> {
  const result = await requireAuth(request, env);
  if (result instanceof Response) return result;

  const postId = path.split('/')[3];
  if (!postId) return Errors.badRequest('Post ID required');

  const body = await request.json().catch(() => null);
  const parsed = CommentSchema.safeParse(body);
  if (!parsed.success) return Errors.badRequest(parsed.error.message);

  const db = createSupabaseClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_KEY);
  const { data: comment, error } = await db
    .from('comments')
    .insert({ user_id: result.claims.sub, post_id: postId, content: sanitizeHtml(parsed.data.content) })
    .select('id, content, created_at')
    .single();

  if (error || !comment) return Errors.internalError();

  return jsonResponse({ comment }, 201);
}

// ─── POST /api/users/:id/follow ───────────────────────────────────────────────

async function handleToggleFollow(request: Request, env: Env, path: string): Promise<Response> {
  const result = await requireAuth(request, env);
  if (result instanceof Response) return result;

  const targetId = path.split('/')[3];
  if (!targetId) return Errors.badRequest('User ID required');
  if (targetId === result.claims.sub) return Errors.badRequest('Cannot follow yourself');

  const db = createSupabaseClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_KEY);

  const { data: existing } = await db
    .from('follows')
    .select('id')
    .eq('follower_id', result.claims.sub)
    .eq('following_id', targetId)
    .maybeSingle();

  if (existing) {
    await db.from('follows').delete().eq('follower_id', result.claims.sub).eq('following_id', targetId);
    return jsonResponse({ following: false });
  } else {
    await db.from('follows').insert({ follower_id: result.claims.sub, following_id: targetId });
    return jsonResponse({ following: true });
  }
}

// ─── GET /api/users/:id/profile ───────────────────────────────────────────────

async function handleGetProfile(request: Request, env: Env, path: string): Promise<Response> {
  const userId = path.split('/')[3];
  if (!userId) return Errors.badRequest('User ID required');

  const db = createSupabaseClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_KEY);

  const [userRes, followerRes, followingRes, postCountRes, achievementsRes] = await Promise.all([
    db.from('users').select('id, username, avatar_url, bio, plan_tier, total_playtime, current_region, created_at').eq('id', userId).single(),
    db.from('follows').select('id', ).eq('following_id', userId),
    db.from('follows').select('id').eq('follower_id', userId),
    db.from('posts').select('id').eq('user_id', userId).eq('is_deleted', false),
    db.from('achievements').select('achievement_type, earned_at').eq('user_id', userId),
  ]);

  if (!userRes.data) return Errors.notFound('User not found');

  return jsonResponse({
    profile: {
      ...userRes.data as object,
      follower_count: Array.isArray(followerRes.data) ? followerRes.data.length : 0,
      following_count: Array.isArray(followingRes.data) ? followingRes.data.length : 0,
      post_count: Array.isArray(postCountRes.data) ? postCountRes.data.length : 0,
      achievements: achievementsRes.data ?? [],
    },
  });
}

// ─── GET /api/leaderboard ─────────────────────────────────────────────────────

async function handleLeaderboard(request: Request, env: Env): Promise<Response> {
  const url = new URL(request.url);
  const region = url.searchParams.get('region');
  const period = url.searchParams.get('period') ?? new Date().toISOString().slice(0, 7);

  const db = createSupabaseClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_KEY);

  let query = db
    .from('leaderboard_scores')
    .select('id, score, period, region_id, user_id, users!inner(id, username, avatar_url)')
    .eq('period', period)
    .order('score', { ascending: false })
    .limit(100);

  if (region) query = query.eq('region_id', region);

  const { data } = await query;

  return jsonResponse({
    leaderboard: (data ?? []).map((row: unknown) => {
      const r = row as Record<string, unknown>;
      return { ...r, user: r['users'] };
    }),
    period,
    region: region ?? 'global',
  });
}
