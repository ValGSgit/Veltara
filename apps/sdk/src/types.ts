/**
 * Public types for the @veltara/sdk package.
 */

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
  color: string;
  player_count: number;
}

export interface Player {
  id: string;
  username: string;
  lat: number;
  lon: number;
  region_id: RegionId;
}

export interface RegionEvent {
  id: string;
  type: string;
  title: string;
  description: string;
  region_id: RegionId | null;
  starts_at: number;
  ends_at: number;
}

export interface WorldState {
  planet_time: number;
  day_cycle_progress: number;
  weather: string;
  active_events: RegionEvent[];
  total_online: number;
}

export type ApiKeyTier = 'sandbox' | 'indie' | 'studio' | 'enterprise';

export interface EmbedSession {
  token: string;
  region_id: RegionId;
  expires_at: number;
  tier: ApiKeyTier;
  show_watermark: boolean;
}

export interface VeltaraTheme {
  /** Primary accent color (hex) */
  primaryColor?: string;
  /** Show the HUD overlay */
  showUI?: boolean;
  /** Show the chat panel */
  showChat?: boolean;
  /** Show "Powered by Veltara" watermark (forced on sandbox tier) */
  watermark?: boolean;
}

export interface VeltaraOptions {
  /** Your API key (starts with vlt_) */
  apiKey: string;
  /** CSS selector string or HTMLElement to mount into */
  container: string | HTMLElement;
  /** Starting region ID (defaults to nexus-core) */
  region?: RegionId;
  /** Visual theme overrides */
  theme?: VeltaraTheme;
  /** Fired when the planet is ready to display */
  onReady?: () => void;
  /** Fired when a player joins the region */
  onPlayerJoin?: (player: Player) => void;
  /** Fired when a player leaves the region */
  onPlayerLeave?: (player: Player) => void;
  /** Fired when a region event occurs */
  onRegionEvent?: (event: RegionEvent) => void;
  /** Fired on SDK errors */
  onError?: (error: Error) => void;
}

export type VeltaraEventMap = {
  ready: undefined;
  player_join: Player;
  player_leave: Player;
  region_event: RegionEvent;
  world_state: WorldState;
  error: Error;
  connected: undefined;
  disconnected: undefined;
};
