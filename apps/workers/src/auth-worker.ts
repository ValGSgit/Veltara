/**
 * auth-worker — handles all authentication:
 * register, login, refresh, logout, /me
 *
 * Passwords hashed with PBKDF2 (bcrypt not available in Workers runtime).
 * JWTs signed with HS256 using JWT_SECRET.
 * Refresh tokens stored in both KV and Supabase.
 */

import { z } from 'zod';
import { handleCors, withCors } from './utils/cors.js';
import { Errors, jsonResponse } from './utils/errors.js';
import { signJwt, verifyJwt, generateToken, sha256Hex } from './utils/jwt.js';
import { createSupabaseClient } from './utils/supabase.js';
import { requireAuth } from './middleware/auth.js';

interface Env {
  JWT_SECRET: string;
  KV_SESSIONS: KVNamespace;
  SUPABASE_URL: string;
  SUPABASE_SERVICE_KEY: string;
  DEV_BOOTSTRAP_ACCOUNT?: string;
  DEV_BOOTSTRAP_USERNAME?: string;
  DEV_BOOTSTRAP_EMAIL?: string;
  DEV_BOOTSTRAP_PASSWORD?: string;
}

const JWT_EXPIRY_SEC = 3600;         // 1 hour
const REFRESH_EXPIRY_SEC = 2592000;  // 30 days

// ─── Auth Rate Limiting ──────────────────────────────────────────────────────

const AUTH_RATE_WINDOW_SEC = 900;    // 15-minute window
const AUTH_MAX_ATTEMPTS = 10;        // max attempts per IP per window

function isEnabled(value?: string): boolean {
  const normalized = String(value ?? '').trim().toLowerCase();
  return normalized === '1' || normalized === 'true' || normalized === 'yes' || normalized === 'on';
}

async function checkAuthRateLimit(ip: string, kv: KVNamespace): Promise<boolean> {
  const key = `auth_rl:${ip}`;
  const current = parseInt(await kv.get(key) ?? '0');
  if (current >= AUTH_MAX_ATTEMPTS) return false;
  await kv.put(key, String(current + 1), { expirationTtl: AUTH_RATE_WINDOW_SEC });
  return true;
}

function getDevBootstrapConfig(env: Env) {
  return {
    enabled: isEnabled(env.DEV_BOOTSTRAP_ACCOUNT),
    username: String(env.DEV_BOOTSTRAP_USERNAME ?? 'dev'),
    email: String(env.DEV_BOOTSTRAP_EMAIL ?? 'dev@veltara.local').toLowerCase(),
    password: String(env.DEV_BOOTSTRAP_PASSWORD ?? 'devpassword123!'),
  };
}

async function getOrCreateDevBootstrapUser(env: Env) {
  if (!env.SUPABASE_URL || !env.SUPABASE_SERVICE_KEY) {
    throw new Error('Missing SUPABASE_URL or SUPABASE_SERVICE_KEY');
  }
  const db = createSupabaseClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_KEY);
  const config = getDevBootstrapConfig(env);

  const { data: existingByEmail } = await db
    .from('users')
    .select('id, username, email, password_hash, plan_tier, avatar_url, bio, credits, muted_until')
    .eq('email', config.email)
    .maybeSingle();

  if (existingByEmail) {
    return existingByEmail as {
      id: string; username: string; email: string; password_hash: string;
      plan_tier: 'free' | 'pro' | 'studio'; muted_until: string | null;
    };
  }

  const passwordHash = await hashPassword(config.password);
  const { data: created, error } = await db
    .from('users')
    .insert({
      username: config.username,
      email: config.email,
      password_hash: passwordHash,
      plan_tier: 'free',
      credits: 0,
    })
    .select('id, username, email, password_hash, plan_tier, avatar_url, bio, credits, muted_until')
    .single();

  if (error || !created) return null;
  return created as {
    id: string; username: string; email: string; password_hash: string;
    plan_tier: 'free' | 'pro' | 'studio'; muted_until: string | null;
  };
}

// ─── Password Hashing via PBKDF2 ─────────────────────────────────────────────

async function hashPassword(password: string): Promise<string> {
  const enc = new TextEncoder();
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const keyMaterial = await crypto.subtle.importKey('raw', enc.encode(password), 'PBKDF2', false, ['deriveBits']);
  const bits = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', salt, iterations: 100_000, hash: 'SHA-256' },
    keyMaterial,
    256,
  );
  const saltHex = Array.from(salt).map((b) => b.toString(16).padStart(2, '0')).join('');
  const hashHex = Array.from(new Uint8Array(bits)).map((b) => b.toString(16).padStart(2, '0')).join('');
  return `pbkdf2:${saltHex}:${hashHex}`;
}

async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const parts = stored.split(':');
  if (parts.length !== 3 || parts[0] !== 'pbkdf2') return false;
  const salt = new Uint8Array(parts[1]!.match(/.{2}/g)!.map((h) => parseInt(h, 16)));
  const expected = parts[2]!;
  const enc = new TextEncoder();
  const keyMaterial = await crypto.subtle.importKey('raw', enc.encode(password), 'PBKDF2', false, ['deriveBits']);
  const bits = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', salt, iterations: 100_000, hash: 'SHA-256' },
    keyMaterial,
    256,
  );
  const hashHex = Array.from(new Uint8Array(bits)).map((b) => b.toString(16).padStart(2, '0')).join('');
  return timingSafeEqual(hashHex, expected);
}

/** Constant-time string comparison to prevent timing attacks. */
function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let mismatch = 0;
  for (let i = 0; i < a.length; i++) {
    mismatch |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return mismatch === 0;
}

// ─── Schemas ──────────────────────────────────────────────────────────────────

const RegisterSchema = z.object({
  username: z.string().min(3).max(32).regex(/^[a-zA-Z0-9_-]+$/),
  email: z.string().email().max(255),
  password: z.string().min(8).max(128),
});

const LoginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

const RefreshSchema = z.object({
  refresh_token: z.string().min(1),
});

// ─── Handler ──────────────────────────────────────────────────────────────────

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const corsResponse = handleCors(request);
    if (corsResponse) return corsResponse;

    const url = new URL(request.url);
    const path = url.pathname;

    try {
      let response: Response;

      if (path === '/api/auth/register' && request.method === 'POST') {
        response = await handleRegister(request, env);
      } else if (path === '/api/auth/login' && request.method === 'POST') {
        response = await handleLogin(request, env);
      } else if (path === '/api/auth/refresh' && request.method === 'POST') {
        response = await handleRefresh(request, env);
      } else if (path === '/api/auth/logout' && request.method === 'POST') {
        response = await handleLogout(request, env);
      } else if (path === '/api/auth/me' && request.method === 'GET') {
        response = await handleMe(request, env);
      } else {
        response = Errors.notFound();
      }

      return withCors(response, request);
    } catch (err) {
      console.error('Auth worker error:', err);
      return withCors(Errors.internalError(), request);
    }
  },
};

// ─── Register ─────────────────────────────────────────────────────────────────

async function handleRegister(request: Request, env: Env): Promise<Response> {
  if (!env.SUPABASE_URL || !env.SUPABASE_SERVICE_KEY) {
    return Errors.internalError('Auth is not configured: SUPABASE_URL/SUPABASE_SERVICE_KEY missing');
  }
  const ip = request.headers.get('CF-Connecting-IP') ?? 'unknown';
  if (!(await checkAuthRateLimit(ip, env.KV_SESSIONS))) {
    return Errors.tooManyRequests('Too many auth attempts. Try again in 15 minutes.');
  }

  const body = await request.json().catch(() => null);
  const parsed = RegisterSchema.safeParse(body);
  if (!parsed.success) {
    return Errors.badRequest(parsed.error.errors.map((e) => e.message).join(', '));
  }

  const { username, email, password } = parsed.data;
  const db = createSupabaseClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_KEY);

  // Check uniqueness
  const { data: existing } = await db
    .from('users')
    .select('id')
    .eq('email', email)
    .maybeSingle();

  if (existing) return Errors.conflict('Email already registered');

  const { data: existingUsername } = await db
    .from('users')
    .select('id')
    .eq('username', username)
    .maybeSingle();

  if (existingUsername) return Errors.conflict('Username already taken');

  const passwordHash = await hashPassword(password);

  const { data: user, error } = await db
    .from('users')
    .insert({ username, email, password_hash: passwordHash, plan_tier: 'free', credits: 0 })
    .select('id, username, email, plan_tier, credits, avatar_url, bio, created_at')
    .single();

  if (error || !user) return Errors.internalError('Failed to create user');

  const u = user as { id: string; username: string; email: string; plan_tier: 'free' | 'pro' | 'studio' };

  const accessToken = await signJwt(
    { sub: u.id, username: u.username, email: u.email, plan_tier: u.plan_tier },
    env.JWT_SECRET,
    JWT_EXPIRY_SEC,
  );

  const refreshToken = generateToken(32);
  const refreshHash = await sha256Hex(refreshToken);

  // Store refresh token in KV
  await env.KV_SESSIONS.put(`refresh:${refreshHash}`, JSON.stringify({
    user_id: u.id,
    created_at: Date.now(),
  }), { expirationTtl: REFRESH_EXPIRY_SEC });

  // Grant first_login achievement
  void db.from('achievements').insert({
    user_id: u.id,
    achievement_type: 'first_login',
  });

  return jsonResponse({ access_token: accessToken, refresh_token: refreshToken, user }, 201);
}

// ─── Login ────────────────────────────────────────────────────────────────────

async function handleLogin(request: Request, env: Env): Promise<Response> {
  if (!env.SUPABASE_URL || !env.SUPABASE_SERVICE_KEY) {
    return Errors.internalError('Auth is not configured: SUPABASE_URL/SUPABASE_SERVICE_KEY missing');
  }
  const ip = request.headers.get('CF-Connecting-IP') ?? 'unknown';
  if (!(await checkAuthRateLimit(ip, env.KV_SESSIONS))) {
    return Errors.tooManyRequests('Too many login attempts. Try again in 15 minutes.');
  }

  const body = await request.json().catch(() => null);
  const parsed = LoginSchema.safeParse(body);
  if (!parsed.success) return Errors.badRequest('Invalid email or password format');

  const { email, password } = parsed.data;
  const normalizedEmail = email.toLowerCase();
  const devBootstrap = getDevBootstrapConfig(env);

  if (
    devBootstrap.enabled
    && normalizedEmail === devBootstrap.email
    && password === devBootstrap.password
  ) {
    const devUser = await getOrCreateDevBootstrapUser(env);
    if (!devUser) return Errors.internalError('Failed to bootstrap dev account');

    const accessToken = await signJwt(
      { sub: devUser.id, username: devUser.username, email: devUser.email, plan_tier: devUser.plan_tier },
      env.JWT_SECRET,
      JWT_EXPIRY_SEC,
    );

    const refreshToken = generateToken(32);
    const refreshHash = await sha256Hex(refreshToken);
    await env.KV_SESSIONS.put(`refresh:${refreshHash}`, JSON.stringify({
      user_id: devUser.id,
      created_at: Date.now(),
    }), { expirationTtl: REFRESH_EXPIRY_SEC });

    const { password_hash: _devHash, ...safeDevUser } = devUser;
    return jsonResponse({ access_token: accessToken, refresh_token: refreshToken, user: safeDevUser });
  }

  const db = createSupabaseClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_KEY);

  const { data: user } = await db
    .from('users')
    .select('id, username, email, password_hash, plan_tier, avatar_url, bio, credits, muted_until')
    .eq('email', normalizedEmail)
    .single();

  if (!user) return Errors.unauthorized();

  const u = user as {
    id: string; username: string; email: string; password_hash: string;
    plan_tier: 'free' | 'pro' | 'studio'; muted_until: string | null;
  };

  const valid = await verifyPassword(password, u.password_hash);
  if (!valid) return Errors.unauthorized();

  const accessToken = await signJwt(
    { sub: u.id, username: u.username, email: u.email, plan_tier: u.plan_tier },
    env.JWT_SECRET,
    JWT_EXPIRY_SEC,
  );

  const refreshToken = generateToken(32);
  const refreshHash = await sha256Hex(refreshToken);

  await env.KV_SESSIONS.put(`refresh:${refreshHash}`, JSON.stringify({
    user_id: u.id,
    created_at: Date.now(),
  }), { expirationTtl: REFRESH_EXPIRY_SEC });

  const { password_hash: _ph, ...safeUser } = u;

  return jsonResponse({ access_token: accessToken, refresh_token: refreshToken, user: safeUser });
}

// ─── Refresh ──────────────────────────────────────────────────────────────────

async function handleRefresh(request: Request, env: Env): Promise<Response> {
  if (!env.SUPABASE_URL || !env.SUPABASE_SERVICE_KEY) {
    return Errors.internalError('Auth is not configured: SUPABASE_URL/SUPABASE_SERVICE_KEY missing');
  }
  const body = await request.json().catch(() => null);
  const parsed = RefreshSchema.safeParse(body);
  if (!parsed.success) return Errors.badRequest('refresh_token required');

  const refreshHash = await sha256Hex(parsed.data.refresh_token);
  const stored = await env.KV_SESSIONS.get(`refresh:${refreshHash}`, 'json') as {
    user_id: string;
  } | null;

  if (!stored) return Errors.unauthorized();

  const db = createSupabaseClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_KEY);
  const { data: user } = await db
    .from('users')
    .select('id, username, email, plan_tier')
    .eq('id', stored.user_id)
    .single();

  if (!user) return Errors.unauthorized();

  const u = user as { id: string; username: string; email: string; plan_tier: 'free' | 'pro' | 'studio' };

  // Rotate refresh token
  await env.KV_SESSIONS.delete(`refresh:${refreshHash}`);
  const newRefreshToken = generateToken(32);
  const newRefreshHash = await sha256Hex(newRefreshToken);
  await env.KV_SESSIONS.put(`refresh:${newRefreshHash}`, JSON.stringify({ user_id: u.id, created_at: Date.now() }), {
    expirationTtl: REFRESH_EXPIRY_SEC,
  });

  const accessToken = await signJwt(
    { sub: u.id, username: u.username, email: u.email, plan_tier: u.plan_tier },
    env.JWT_SECRET,
    JWT_EXPIRY_SEC,
  );

  return jsonResponse({ access_token: accessToken, refresh_token: newRefreshToken });
}

// ─── Logout ───────────────────────────────────────────────────────────────────

async function handleLogout(request: Request, env: Env): Promise<Response> {
  const body = await request.json().catch(() => ({})) as { refresh_token?: string };
  if (body.refresh_token) {
    const hash = await sha256Hex(body.refresh_token);
    await env.KV_SESSIONS.delete(`refresh:${hash}`);
  }
  return jsonResponse({ ok: true });
}

// ─── Me ───────────────────────────────────────────────────────────────────────

async function handleMe(request: Request, env: Env): Promise<Response> {
  if (!env.SUPABASE_URL || !env.SUPABASE_SERVICE_KEY) {
    return Errors.internalError('Auth is not configured: SUPABASE_URL/SUPABASE_SERVICE_KEY missing');
  }
  const result = await requireAuth(request, env);
  if (result instanceof Response) return result;

  const db = createSupabaseClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_KEY);
  const { data: user } = await db
    .from('users')
    .select('id, username, email, avatar_url, bio, plan_tier, credits, total_playtime, current_region, created_at')
    .eq('id', result.claims.sub)
    .single();

  if (!user) return Errors.notFound('User not found');

  return jsonResponse({ user });
}
