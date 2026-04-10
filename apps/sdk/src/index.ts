/**
 * @veltara/sdk — Official Veltara Embed SDK
 *
 * @example
 * ```ts
 * import { VeltaraEngine } from '@veltara/sdk';
 *
 * const engine = new VeltaraEngine({
 *   apiKey: 'vlt_your_key_here',
 *   container: '#planet-container',
 *   region: 'nexus-core',
 *   theme: { primaryColor: '#6c63ff' },
 *   onReady: () => console.log('Planet loaded!'),
 *   onPlayerJoin: (player) => console.log(`${player.username} joined`),
 * });
 *
 * await engine.mount();
 * ```
 */

export { VeltaraEngine } from './engine.js';
export type {
  VeltaraOptions,
  VeltaraTheme,
  VeltaraEventMap,
  Region,
  Player,
  RegionEvent,
  RegionId,
  WorldState,
  EmbedSession,
  ApiKeyTier,
} from './types.js';

export const VERSION = '1.0.0';
