/**
 * Core domain types for Veltara platform.
 * Shared across frontend, workers, and SDK.
 */

// ─── Plan Tiers ───────────────────────────────────────────────────────────────

export type PlanTier = 'free' | 'pro' | 'studio';

export type ApiKeyTier = 'sandbox' | 'indie' | 'studio' | 'enterprise';

// ─── Users ────────────────────────────────────────────────────────────────────

export interface User {
  id: string;
  username: string;
  email: string;
  avatar_url: string | null;
  bio: string | null;
  created_at: string;
  plan_tier: PlanTier;
  credits: number;
  total_playtime: number;
  current_region: string | null;
  embedding?: number[] | null;
}

export interface PublicUser {
  id: string;
  username: string;
  avatar_url: string | null;
  bio: string | null;
  created_at: string;
  plan_tier: PlanTier;
  total_playtime: number;
  current_region: string | null;
}

export interface UserProfile extends PublicUser {
  follower_count: number;
  following_count: number;
  post_count: number;
  achievements: Achievement[];
  inventory: InventoryItem[];
}

export interface JwtClaims {
  sub: string;
  username: string;
  email: string;
  plan_tier: PlanTier;
  iat: number;
  exp: number;
}

// ─── Regions ──────────────────────────────────────────────────────────────────

export type RegionId =
  | 'aurora-basin'
  | 'equator-ridge'
  | 'crimson-desert'
  | 'verdant-reaches'
  | 'abyssal-trench'
  | 'storm-peaks'
  | 'nexus-core'
  | 'void-cradle';

export interface Region {
  id: RegionId;
  name: string;
  lat: number;
  lon: number;
  color: string;
  radius: number;
  description: string;
  npc_name: string;
  npc_personality: string;
  player_count: number;
}

// ─── Players ──────────────────────────────────────────────────────────────────

export interface Player {
  id: string;
  username: string;
  avatar_url: string | null;
  lat: number;
  lon: number;
  action: string;
  region_id: RegionId;
  color_tint: string;
  connected_at: number;
}

export interface PlayerUpdate {
  id: string;
  lat: number;
  lon: number;
  action: string;
}

// ─── Region Sandbox ──────────────────────────────────────────────────────────

export type RegionObjectKind = 'block' | 'platform' | 'beacon' | 'orb';
export type RegionObjectMaterial = 'stone' | 'metal' | 'wood' | 'glass' | 'neon';

export interface RegionWorldObjectTransform {
  x: number;
  y: number;
  z: number;
}

export interface RegionWorldObject {
  id: string;
  region_id: RegionId;
  owner_id: string;
  version: number;
  kind: RegionObjectKind;
  material: RegionObjectMaterial;
  position: RegionWorldObjectTransform;
  rotation: RegionWorldObjectTransform;
  scale: RegionWorldObjectTransform;
  interactive: boolean;
  metadata?: Record<string, unknown>;
  created_at: number;
  updated_at: number;
}

export interface RegionObjectInteraction {
  object_id: string;
  interaction_type: string;
  data?: Record<string, unknown>;
}

// ─── Social ───────────────────────────────────────────────────────────────────

export interface Post {
  id: string;
  user_id: string;
  content: string;
  media_url: string | null;
  region_id: RegionId | null;
  likes_count: number;
  comments_count: number;
  created_at: string;
  author?: PublicUser;
  liked_by_me?: boolean;
}

export interface Comment {
  id: string;
  user_id: string;
  post_id: string;
  content: string;
  created_at: string;
  author?: PublicUser;
}

export interface Follow {
  id: string;
  follower_id: string;
  following_id: string;
  created_at: string;
}

// ─── Items + Inventory ────────────────────────────────────────────────────────

export type ItemType = 'cosmetic' | 'marker' | 'frame' | 'emote';
export type ItemRarity = 'common' | 'uncommon' | 'rare' | 'epic' | 'legendary';

export interface Item {
  id: string;
  name: string;
  type: ItemType;
  rarity: ItemRarity;
  price_credits: number;
  asset_url: string;
  created_at: string;
}

export interface InventoryItem {
  id: string;
  user_id: string;
  item_id: string;
  acquired_at: string;
  item?: Item;
}

// ─── Achievements ─────────────────────────────────────────────────────────────

export type AchievementType =
  | 'first_login'
  | 'region_explorer'
  | 'social_butterfly'
  | 'post_creator'
  | 'chat_enthusiast'
  | 'marketplace_seller'
  | 'pro_subscriber'
  | 'global_traveler'
  | 'npc_friend'
  | 'event_participant';

export interface Achievement {
  id: string;
  user_id: string;
  achievement_type: AchievementType;
  earned_at: string;
}

// ─── Leaderboard ──────────────────────────────────────────────────────────────

export interface LeaderboardScore {
  id: string;
  user_id: string;
  region_id: RegionId | null;
  score: number;
  period: string;
  created_at: string;
  user?: PublicUser;
}

// ─── API Keys ─────────────────────────────────────────────────────────────────

export interface ApiKey {
  id: string;
  user_id: string;
  key_prefix: string;
  name: string;
  tier: ApiKeyTier;
  requests_today: number;
  requests_total: number;
  rate_limit: number;
  created_at: string;
  last_used_at: string | null;
}

export interface ApiKeyWithHash extends ApiKey {
  key_hash: string;
}

// ─── World State ──────────────────────────────────────────────────────────────

export type WeatherType =
  | 'clear'
  | 'cloudy'
  | 'stormy'
  | 'aurora'
  | 'solar_flare'
  | 'void_mist';

export interface WorldState {
  planet_time: number;
  day_cycle_progress: number;
  weather: WeatherType;
  active_events: WorldEvent[];
  total_online: number;
  updated_at: number;
}

export type WorldEventType =
  | 'meteor_shower'
  | 'trade_caravan'
  | 'void_rift'
  | 'ancient_discovery'
  | 'faction_war'
  | 'weather_phenomenon';

export interface WorldEvent {
  id: string;
  type: WorldEventType;
  title: string;
  description: string;
  region_id: RegionId | null;
  starts_at: number;
  ends_at: number;
  active: boolean;
}

// ─── Marketplace ──────────────────────────────────────────────────────────────

export interface MarketplaceListing {
  id: string;
  seller_id: string;
  item_id: string;
  price_credits: number;
  stripe_connect_id: string | null;
  created_at: string;
  item?: Item;
  seller?: PublicUser;
}

// ─── Billing ──────────────────────────────────────────────────────────────────

export interface BillingStatus {
  plan_tier: PlanTier;
  stripe_customer_id: string | null;
  stripe_subscription_id: string | null;
  subscription_status: string | null;
  current_period_end: string | null;
  credits: number;
}

// ─── API Responses ────────────────────────────────────────────────────────────

export interface ApiError {
  error: {
    code: string;
    message: string;
    status: number;
  };
}

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  per_page: number;
  has_more: boolean;
}

// ─── Embed / SDK ──────────────────────────────────────────────────────────────

export interface EmbedSession {
  token: string;
  region_id: RegionId;
  expires_at: number;
  tier: ApiKeyTier;
  show_watermark: boolean;
}
