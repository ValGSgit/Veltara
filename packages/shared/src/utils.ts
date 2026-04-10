/**
 * Shared utility functions used across all Veltara packages.
 */

import type { RegionId } from './types.js';
import { REGIONS } from './constants.js';

// ─── Geo Utilities ────────────────────────────────────────────────────────────

/**
 * Converts latitude/longitude (degrees) to a 3D Cartesian point
 * on a sphere of the given radius.
 */
export function latLonToXYZ(lat: number, lon: number, radius: number): [number, number, number] {
  const phi = (90 - lat) * (Math.PI / 180);
  const theta = (lon + 180) * (Math.PI / 180);
  const x = -(radius * Math.sin(phi) * Math.cos(theta));
  const y = radius * Math.cos(phi);
  const z = radius * Math.sin(phi) * Math.sin(theta);
  return [x, y, z];
}

/**
 * Converts a 3D point on a sphere to latitude/longitude.
 */
export function xyzToLatLon(x: number, y: number, z: number): [number, number] {
  const r = Math.sqrt(x * x + y * y + z * z);
  const lat = 90 - Math.acos(y / r) * (180 / Math.PI);
  const lon = Math.atan2(z, -x) * (180 / Math.PI) - 180;
  return [lat, lon];
}

/**
 * Calculates the great-circle distance (in degrees) between two lat/lon points.
 */
export function greatCircleDistance(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number,
): number {
  const dLat = (lat2 - lat1) * (Math.PI / 180);
  const dLon = (lon2 - lon1) * (Math.PI / 180);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * (Math.PI / 180)) *
      Math.cos(lat2 * (Math.PI / 180)) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  return 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)) * (180 / Math.PI);
}

/**
 * Returns the region that contains the given lat/lon position,
 * or the closest one if none strictly contains it.
 */
export function getRegionForPosition(lat: number, lon: number): RegionId {
  let closest: RegionId = 'nexus-core';
  let minDist = Infinity;

  for (const region of REGIONS) {
    const dist = greatCircleDistance(lat, lon, region.lat, region.lon);
    if (dist < minDist) {
      minDist = dist;
      closest = region.id;
    }
  }

  return closest;
}

// ─── String Utilities ─────────────────────────────────────────────────────────

/**
 * Sanitizes a string for safe HTML rendering (prevents XSS).
 */
export function sanitizeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

/**
 * Truncates a string to the given max length with an ellipsis.
 */
export function truncate(str: string, maxLen: number): string {
  if (str.length <= maxLen) return str;
  return str.slice(0, maxLen - 3) + '...';
}

/**
 * Generates a random hex color string.
 */
export function randomColor(): string {
  return '#' + Math.floor(Math.random() * 0xffffff).toString(16).padStart(6, '0');
}

// ─── Time Utilities ───────────────────────────────────────────────────────────

/**
 * Formats milliseconds of playtime as a human-readable string.
 */
export function formatPlaytime(ms: number): string {
  const h = Math.floor(ms / 3_600_000);
  const m = Math.floor((ms % 3_600_000) / 60_000);
  if (h === 0) return `${m}m`;
  return `${h}h ${m}m`;
}

/**
 * Formats a UTC timestamp as a relative time string (e.g. "3 minutes ago").
 */
export function relativeTime(timestamp: string | number): string {
  const now = Date.now();
  const then = typeof timestamp === 'string' ? new Date(timestamp).getTime() : timestamp;
  const diff = now - then;

  const seconds = Math.floor(diff / 1000);
  if (seconds < 60) return `${seconds}s ago`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

/**
 * Computes the current day/night cycle progress (0 = midnight, 0.5 = noon)
 * from a planet_time value (seconds elapsed since epoch).
 */
export function getDayCycleProgress(planetTime: number, cycleDurationSec: number): number {
  return (planetTime % cycleDurationSec) / cycleDurationSec;
}

// ─── Crypto Utilities ─────────────────────────────────────────────────────────

/**
 * Encodes a Uint8Array to a hex string.
 */
export function uint8ToHex(buf: Uint8Array): string {
  return Array.from(buf)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

/**
 * Calculates the cosine similarity between two equal-length vectors.
 */
export function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length) throw new Error('Vectors must have equal length');
  let dot = 0;
  let normA = 0;
  let normB = 0;
  for (let i = 0; i < a.length; i++) {
    dot += (a[i] ?? 0) * (b[i] ?? 0);
    normA += (a[i] ?? 0) ** 2;
    normB += (b[i] ?? 0) ** 2;
  }
  const denom = Math.sqrt(normA) * Math.sqrt(normB);
  return denom === 0 ? 0 : dot / denom;
}

// ─── Exponential Backoff ──────────────────────────────────────────────────────

/**
 * Returns the next reconnection delay in milliseconds using exponential backoff
 * with optional jitter.
 */
export function exponentialBackoff(
  attempt: number,
  baseMs = 1000,
  maxMs = 30_000,
  jitterMs = 500,
): number {
  const exp = Math.min(baseMs * 2 ** attempt, maxMs);
  const jitter = Math.random() * jitterMs;
  return exp + jitter;
}
