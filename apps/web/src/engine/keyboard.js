/**
 * keyboard — Centralized keyboard shortcut handling.
 * Extracted from main.js for maintainability.
 */

import { REGIONS } from '@veltara/shared';
import { store } from '../state/store.js';
import { toast } from '../ui/toast.js';
import { isConnected, sendMessage } from './socket-handler.js';
import {
  rotateSelected,
  removeSelected,
  repairSelected,
  getNodeType,
} from './sandbox-actions.js';

/**
 * @param {{ sandbox: object, leaveRegionLand: Function }} deps
 */
export function initKeyboardShortcuts(deps) {
  const { sandbox, leaveRegionLand } = deps;

  function sendInteraction(interactionType, payload) {
    const selectedId = store.get('selectedSandboxObjectId');
    if (!selectedId || !isConnected()) return;
    const selected = sandbox.getObjectById(selectedId);
    if (!selected) return;
    sendMessage('region_action', {
      type: 'object_interact',
      data: { object_id: selected.id, interaction_type: interactionType, payload },
    });
  }

  window.addEventListener('keydown', (e) => {
    // Planet view shortcuts
    if (store.get('sceneMode') !== 'region-land') {
      if (e.key === '1') {
        document.dispatchEvent(new CustomEvent('planet-select', { detail: { planetId: 'black-hole' } }));
        return;
      }
      if (e.key === '2') {
        document.dispatchEvent(new CustomEvent('planet-select', { detail: { planetId: 'veltara' } }));
        return;
      }
      if (e.key === '3') {
        document.dispatchEvent(new CustomEvent('planet-select', { detail: { planetId: 'earth-test' } }));
        return;
      }
    }

    // Escape exits region land
    if (e.key === 'Escape' && store.get('sceneMode') === 'region-land') {
      leaveRegionLand();
      return;
    }

    // Don't hijack keys when typing
    const tag = e.target?.tagName;
    if (tag === 'INPUT' || tag === 'TEXTAREA' || e.target?.isContentEditable) return;
    if (store.get('sceneMode') !== 'region-land') return;

    // B = toggle build mode
    if (e.key.toLowerCase() === 'b') {
      const next = !store.get('sandboxBuildMode');
      store.set('sandboxBuildMode', next);
      toast.info(next ? 'Sandbox build mode enabled (Shift + Click to place).' : 'Sandbox build mode disabled.', 2500);
      return;
    }

    // Object-specific shortcuts
    const selectedId = store.get('selectedSandboxObjectId');
    if (!selectedId || !isConnected()) return;
    const selected = sandbox.getObjectById(selectedId);
    if (!selected) return;

    const userId = store.get('user')?.id;
    const isOwner = selected.owner_id === userId;
    const nodeType = getNodeType(selected);
    const key = e.key.toLowerCase();

    const shortcuts = {
      'delete': () => isOwner && removeSelected(sandbox),
      'r': () => isOwner && rotateSelected(sandbox),
      'l': () => isOwner && nodeType === 'door' && sendInteraction('door_lock'),
      'u': () => isOwner && nodeType === 'door' && sendInteraction('door_unlock'),
      'p': () => nodeType === 'storage' && sendInteraction('storage_put', { item_id: 'ore', count: 1 }),
      't': () => nodeType === 'storage' && sendInteraction('storage_take', { item_id: 'ore', count: 1 }),
      'c': () => nodeType === 'crafting' && sendInteraction('craft_start', { recipe: 'iron_ingot', duration_ms: 15000 }),
      'g': () => nodeType === 'crafting' && sendInteraction('craft_collect'),
      'h': () => repairSelected(sandbox),
    };

    const handler = shortcuts[e.key === 'Delete' ? 'delete' : key];
    if (handler) handler();
  });
}
