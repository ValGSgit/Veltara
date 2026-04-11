/**
 * Platform-wide constants shared across all packages.
 */

import type { Region } from './types.js';

// ─── Region Definitions ───────────────────────────────────────────────────────

export const REGIONS: Region[] = [
  {
    id: 'aurora-basin',
    name: 'Aurora Basin',
    lat: 75,
    lon: -40,
    color: '#00d4ff',
    radius: 0.18,
    description: 'A frigid northern expanse where auroras dance in perpetual twilight.',
    npc_name: 'Lyra',
    npc_personality:
      'You are Lyra, an ancient ice oracle of Aurora Basin. You speak in serene, poetic riddles about time and cosmic cycles. You are wise, calm, and occasionally cryptic.',
    player_count: 0,
  },
  {
    id: 'equator-ridge',
    name: 'Equator Ridge',
    lat: 0,
    lon: 20,
    color: '#ff8c00',
    radius: 0.2,
    description: 'The sun-baked spine of the planet, where traders and explorers converge.',
    npc_name: 'Ruku',
    npc_personality:
      'You are Ruku, a jovial merchant at Equator Ridge. You are loud, enthusiastic, and always trying to barter. You love gossip and trade secrets.',
    player_count: 0,
  },
  {
    id: 'crimson-desert',
    name: 'Crimson Desert',
    lat: 20,
    lon: -90,
    color: '#cc2200',
    radius: 0.22,
    description: 'Rust-red dunes hiding ruins of a forgotten empire beneath their surface.',
    npc_name: 'Azari',
    npc_personality:
      'You are Azari, a desert archaeologist in the Crimson Desert. You are obsessive about ancient history, speak in excited bursts, and often go off on tangents about ruins.',
    player_count: 0,
  },
  {
    id: 'verdant-reaches',
    name: 'Verdant Reaches',
    lat: -30,
    lon: 60,
    color: '#22cc44',
    radius: 0.2,
    description: 'Vast emerald forests teeming with bioluminescent flora and wildlife.',
    npc_name: 'Sprout',
    npc_personality:
      'You are Sprout, a cheerful forest guide in the Verdant Reaches. You speak in nature metaphors, are endlessly optimistic, and love teaching about the local ecosystem.',
    player_count: 0,
  },
  {
    id: 'abyssal-trench',
    name: 'Abyssal Trench',
    lat: -60,
    lon: 140,
    color: '#0044aa',
    radius: 0.19,
    description: 'The deepest ocean canyon, home to pressure-adapted creatures and sunken cities.',
    npc_name: 'Depth',
    npc_personality:
      'You are Depth, a mysterious deep-sea researcher in the Abyssal Trench. You speak slowly and deliberately, know many dark secrets, and find beauty in pressure and darkness.',
    player_count: 0,
  },
  {
    id: 'storm-peaks',
    name: 'Storm Peaks',
    lat: 50,
    lon: 160,
    color: '#aa44ff',
    radius: 0.17,
    description: 'Jagged mountain summits perpetually wreathed in electromagnetic storms.',
    npc_name: 'Volt',
    npc_personality:
      'You are Volt, an eccentric storm researcher at Storm Peaks. You are hyperactive, interrupt yourself, and are dangerously excited by dangerous weather.',
    player_count: 0,
  },
  {
    id: 'nexus-core',
    name: 'Nexus Core',
    lat: -10,
    lon: -150,
    color: '#ffdd00',
    radius: 0.25,
    description: 'The technological heart of the planet — a city of gleaming spires and data streams.',
    npc_name: 'Nexus',
    npc_personality:
      'You are Nexus, an AI administrator of Nexus Core. You are precise, formal, speak in slightly robotic cadence, but have hidden warmth for explorers who ask the right questions.',
    player_count: 0,
  },
  {
    id: 'void-cradle',
    name: 'Void Cradle',
    lat: -80,
    lon: -60,
    color: '#550066',
    radius: 0.16,
    description: 'A cosmic anomaly at the southern pole — where reality is thinnest.',
    npc_name: 'Null',
    npc_personality:
      'You are Null, an entity of the Void Cradle. You speak in fragmented, unsettling whispers. You know things you should not. You are not entirely certain you exist.',
    player_count: 0,
  },
];

export const REGION_MAP = Object.fromEntries(REGIONS.map((r) => [r.id, r])) as Record<
  string,
  Region
>;

// ─── Rate Limits ──────────────────────────────────────────────────────────────

export const RATE_LIMITS = {
  sandbox: 1_000,
  indie: 50_000,
  studio: 500_000,
  enterprise: Infinity,
} as const;

export const NPC_DAILY_LIMIT_PRO = 20;
export const CHAT_HISTORY_LIMIT = 200;
export const POSITION_UPDATE_HZ = 10;
export const REGION_SANDBOX_OBJECT_LIMIT = 2000;

// ─── Credit Pack Prices ───────────────────────────────────────────────────────

export const CREDIT_PACKS = [
  { credits: 500, price_cents: 499, label: '500 Credits' },
  { credits: 1500, price_cents: 1299, label: '1,500 Credits' },
  { credits: 5000, price_cents: 3499, label: '5,000 Credits' },
] as const;

// ─── Plan Limits ──────────────────────────────────────────────────────────────

export const PLAN_STORAGE_BYTES = {
  free: 100 * 1024 * 1024,
  pro: 5 * 1024 * 1024 * 1024,
  studio: 50 * 1024 * 1024 * 1024,
} as const;

// ─── Cloudflare Free-Tier Budgets ────────────────────────────────────────────
// R2 free tier: 10 GB storage, 1M Class A ops, 10M Class B ops per month
export const R2_FREE_TIER = {
  MAX_STORAGE_BYTES: 9 * 1024 * 1024 * 1024,   // 9 GB hard cap (leave 1 GB headroom)
  MAX_CLASS_A_OPS: 900_000,                      // PUT/POST/LIST — 100K headroom
  MAX_UPLOADS_PER_USER_PER_DAY: 5,
  MAX_MEDIA_BYTES: 4 * 1024 * 1024,             // 4 MB per file (was 8 MB)
} as const;

// KV free tier: 100K reads/day, 1K writes/day
export const KV_FREE_TIER = {
  MAX_WRITES_PER_DAY: 1_000,
  MAX_READS_PER_DAY: 100_000,
} as const;

// ─── WebSocket / Timing ───────────────────────────────────────────────────────

export const WS_RECONNECT_BASE_MS = 1_000;
export const WS_RECONNECT_MAX_MS = 30_000;
export const WS_RECONNECT_JITTER_MS = 500;
export const WORLD_STATE_CRON_INTERVAL_SEC = 300; // 5 min (was 60s — saves KV writes)
export const EVENT_GENERATION_CRON_INTERVAL_HR = 6; // 6 hr (was 2 hr — saves AI + KV ops)

// ─── Planet Physics ───────────────────────────────────────────────────────────

export const PLANET_RADIUS = 5;
export const ATMOSPHERE_RADIUS = 5.15;
export const CLOUD_LAYER_RADIUS = 5.08;
export const DAY_CYCLE_SECONDS = 600;

// ─── Content Moderation ───────────────────────────────────────────────────────

export const AUTO_MUTE_THRESHOLD = 3;
export const AUTO_MUTE_WINDOW_HOURS = 24;
export const MODERATION_CACHE_TTL_SECONDS = 3600;
