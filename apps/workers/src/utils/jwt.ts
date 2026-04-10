/**
 * JWT utilities for Cloudflare Workers (uses Web Crypto API).
 */

import type { JwtClaims } from '@veltara/shared';

const ALG = { name: 'HMAC', hash: 'SHA-256' };

function base64urlEncode(buf: ArrayBuffer): string {
  return btoa(String.fromCharCode(...new Uint8Array(buf)))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=/g, '');
}

function base64urlDecode(str: string): Uint8Array {
  const padded = str.replace(/-/g, '+').replace(/_/g, '/');
  const pad = (4 - (padded.length % 4)) % 4;
  const b64 = padded + '='.repeat(pad);
  return Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
}

async function getKey(secret: string, usage: KeyUsage[]): Promise<CryptoKey> {
  const enc = new TextEncoder();
  return crypto.subtle.importKey('raw', enc.encode(secret), ALG, false, usage);
}

/**
 * Signs a JWT with HS256.
 */
export async function signJwt(
  payload: Omit<JwtClaims, 'iat' | 'exp'> & { iat?: number; exp?: number },
  secret: string,
  expiresInSec = 3600,
): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  const claims: JwtClaims = {
    ...payload,
    iat: now,
    exp: now + expiresInSec,
  };

  const header = { alg: 'HS256', typ: 'JWT' };
  const enc = new TextEncoder();

  const headerB64 = base64urlEncode(enc.encode(JSON.stringify(header)));
  const payloadB64 = base64urlEncode(enc.encode(JSON.stringify(claims)));
  const signing = `${headerB64}.${payloadB64}`;

  const key = await getKey(secret, ['sign']);
  const sig = await crypto.subtle.sign(ALG, key, enc.encode(signing));

  return `${signing}.${base64urlEncode(sig)}`;
}

/**
 * Verifies and decodes a JWT. Throws if invalid or expired.
 */
export async function verifyJwt(token: string, secret: string): Promise<JwtClaims> {
  const parts = token.split('.');
  if (parts.length !== 3) throw new Error('Invalid JWT format');
  const [headerB64, payloadB64, sigB64] = parts as [string, string, string];

  const enc = new TextEncoder();
  const signing = `${headerB64}.${payloadB64}`;

  const key = await getKey(secret, ['verify']);
  const valid = await crypto.subtle.verify(ALG, key, base64urlDecode(sigB64), enc.encode(signing));
  if (!valid) throw new Error('Invalid JWT signature');

  const claims = JSON.parse(new TextDecoder().decode(base64urlDecode(payloadB64))) as JwtClaims;
  if (claims.exp < Math.floor(Date.now() / 1000)) throw new Error('JWT expired');

  return claims;
}

/**
 * Decodes a JWT without verifying (for reading claims only — don't trust without verifying).
 */
export function decodeJwtUnsafe(token: string): JwtClaims | null {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return null;
    return JSON.parse(new TextDecoder().decode(base64urlDecode(parts[1]!))) as JwtClaims;
  } catch {
    return null;
  }
}

/**
 * Extracts and verifies the JWT from an Authorization: Bearer header.
 */
export async function extractBearerJwt(request: Request, secret: string): Promise<JwtClaims | null> {
  const auth = request.headers.get('Authorization');
  if (!auth?.startsWith('Bearer ')) return null;
  try {
    return await verifyJwt(auth.slice(7), secret);
  } catch {
    return null;
  }
}

/**
 * Generates a secure random token (hex string).
 */
export function generateToken(bytes = 32): string {
  const buf = new Uint8Array(bytes);
  crypto.getRandomValues(buf);
  return Array.from(buf).map((b) => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Hashes a value with SHA-256 and returns hex string.
 */
export async function sha256Hex(value: string): Promise<string> {
  const enc = new TextEncoder();
  const buf = await crypto.subtle.digest('SHA-256', enc.encode(value));
  return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, '0')).join('');
}
