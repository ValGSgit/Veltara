/**
 * JWT auth middleware for Veltara Workers.
 * Attaches verified JwtClaims to request context.
 */

import type { JwtClaims } from '@veltara/shared';
import { extractBearerJwt } from '../utils/jwt.js';
import { Errors } from '../utils/errors.js';

export interface AuthEnv {
  JWT_SECRET: string;
}

/**
 * Verifies JWT from Authorization header and returns claims.
 * Returns null if missing or invalid (does not throw).
 */
export async function getAuthClaims(
  request: Request,
  env: AuthEnv,
): Promise<JwtClaims | null> {
  return extractBearerJwt(request, env.JWT_SECRET);
}

/**
 * Requires a valid JWT. Returns error Response if auth fails.
 */
export async function requireAuth(
  request: Request,
  env: AuthEnv,
): Promise<{ claims: JwtClaims } | Response> {
  const claims = await getAuthClaims(request, env);
  if (!claims) return Errors.unauthorized();
  return { claims };
}

/**
 * Requires a valid JWT with at least the given plan tier.
 */
export async function requirePlan(
  request: Request,
  env: AuthEnv,
  minTier: 'free' | 'pro' | 'studio',
): Promise<{ claims: JwtClaims } | Response> {
  const result = await requireAuth(request, env);
  if (result instanceof Response) return result;

  const tierOrder = { free: 0, pro: 1, studio: 2 };
  const userTier = tierOrder[result.claims.plan_tier] ?? 0;
  const required = tierOrder[minTier];

  if (userTier < required) {
    return Errors.forbidden(`This feature requires the ${minTier} plan or higher`);
  }

  return result;
}
