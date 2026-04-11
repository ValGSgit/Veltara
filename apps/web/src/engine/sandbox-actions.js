/**
 * sandbox-actions — All sandbox interaction logic, validation, and event dispatch.
 * Extracted from main.js for maintainability.
 */

import { store } from '../state/store.js';
import { toast } from '../ui/toast.js';
import { sendMessage, isConnected } from './socket-handler.js';

// ─── Validation Helpers ───────────────────────────────────────────────────────

export function normalizeObjectName(value) {
  return String(value ?? '').trim().replace(/\s+/g, ' ').slice(0, 64);
}

export function normalizeUserId(value) {
  return String(value ?? '').trim().slice(0, 64);
}

export function normalizeModelKey(value) {
  return String(value ?? '').trim().toLowerCase().slice(0, 64);
}

export function sanitizeCreateKind(value) {
  const allowed = new Set(['block', 'platform', 'beacon', 'orb']);
  const next = String(value ?? '').trim().toLowerCase();
  return allowed.has(next) ? next : 'block';
}

export function sanitizeCreateMaterial(value) {
  const allowed = new Set(['stone', 'metal', 'wood', 'glass', 'neon']);
  const next = String(value ?? '').trim().toLowerCase();
  return allowed.has(next) ? next : 'stone';
}

export function sanitizeCreateModelKey(value) {
  const normalized = normalizeModelKey(value);
  return /^[a-z0-9][a-z0-9-_]{0,63}$/.test(normalized) ? normalized : '';
}

export function getMetadataValidationError(name) {
  if (!name) return null;
  if (/[<>]/.test(name)) return 'Name cannot include angle brackets.';
  if (/[\u0000-\u001F\u007F]/.test(name)) return 'Name contains unsupported control characters.';
  if (/\b(?:https?:\/\/|www\.)\S+/i.test(name)) return 'Name cannot contain links.';
  return null;
}

export function getModelKeyValidationError(modelKey) {
  if (!modelKey) return null;
  if (!/^[a-z0-9][a-z0-9-_]{0,63}$/.test(modelKey)) {
    return 'Model key must use letters, numbers, dash, or underscore.';
  }
  return null;
}

export function getNodeType(object) {
  const explicit = object?.metadata?.node_type;
  if (explicit === 'door' || explicit === 'storage' || explicit === 'crafting') return explicit;
  if (object?.kind === 'beacon') return 'door';
  if (object?.kind === 'platform') return 'crafting';
  return 'storage';
}

export function canRepairObject(object, userId) {
  const health = object?.metadata?.health;
  const max = Number(health?.max ?? 100);
  const current = Number(health?.current ?? max);
  const role = object?.metadata?.permissions?.[userId];
  return current < max && (object?.owner_id === userId || role === 'builder');
}

// ─── Socket Interaction Senders ───────────────────────────────────────────────

function sendInteraction(sandbox, interactionType, payload) {
  const selectedId = store.get('selectedSandboxObjectId');
  if (!selectedId || !isConnected()) return;
  const selected = sandbox.getObjectById(selectedId);
  if (!selected) return;
  sendMessage('region_action', {
    type: 'object_interact',
    data: { object_id: selected.id, interaction_type: interactionType, payload },
  });
}

export function rotateSelected(sandbox) {
  const selectedId = store.get('selectedSandboxObjectId');
  if (!selectedId || !isConnected()) return;
  const selected = sandbox.getObjectById(selectedId);
  if (!selected) return;
  if (selected.owner_id !== store.get('user')?.id) return;
  sendMessage('region_action', {
    type: 'object_upsert',
    data: {
      id: selected.id, kind: selected.kind, material: selected.material,
      position: selected.position,
      rotation: { x: selected.rotation.x, y: Number((selected.rotation.y + 0.25).toFixed(3)), z: selected.rotation.z },
      scale: selected.scale, interactive: selected.interactive, metadata: selected.metadata,
    },
  });
}

export function removeSelected(sandbox) {
  const selectedId = store.get('selectedSandboxObjectId');
  if (!selectedId || !isConnected()) return;
  const selected = sandbox.getObjectById(selectedId);
  if (!selected || selected.owner_id !== store.get('user')?.id) return;
  sendMessage('region_action', { type: 'object_remove', data: { object_id: selectedId } });
}

export function repairSelected(sandbox) {
  const selectedId = store.get('selectedSandboxObjectId');
  if (!selectedId || !isConnected()) return;
  const selected = sandbox.getObjectById(selectedId);
  if (!selected) return;
  const userId = store.get('user')?.id;
  if (!userId || !canRepairObject(selected, userId)) return;
  sendInteraction(sandbox, 'repair');
}

// ─── Unified Action Dispatcher ────────────────────────────────────────────────

/**
 * Handle a sandbox UI action. Replaces the massive if-chain in main.js.
 * @param {string|{type:string, payload?:any}} action
 * @param {object} sandbox
 */
export function handleSandboxAction(action, sandbox) {
  const actionType = typeof action === 'string' ? action : action.type;
  const actionPayload = typeof action === 'string' ? undefined : action.payload;

  const simpleInteractions = {
    'use': () => sendInteraction(sandbox, 'use', { scene_mode: store.get('sceneMode') }),
    'rotate': () => rotateSelected(sandbox),
    'remove': () => removeSelected(sandbox),
    'lock': () => sendInteraction(sandbox, 'door_lock'),
    'unlock': () => sendInteraction(sandbox, 'door_unlock'),
    'put': () => sendInteraction(sandbox, 'storage_put', { item_id: 'ore', count: 1 }),
    'take': () => sendInteraction(sandbox, 'storage_take', { item_id: 'ore', count: 1 }),
    'start-craft': () => sendInteraction(sandbox, 'craft_start', { recipe: 'iron_ingot', duration_ms: 15000 }),
    'collect-craft': () => sendInteraction(sandbox, 'craft_collect'),
    'repair': () => repairSelected(sandbox),
  };

  if (simpleInteractions[actionType]) {
    simpleInteractions[actionType]();
    return;
  }

  const selectedId = store.get('selectedSandboxObjectId');
  const selected = selectedId ? sandbox.getObjectById(selectedId) : null;
  if (!selected || !isConnected()) return;
  const userId = store.get('user')?.id;
  if (selected.owner_id !== userId) return;

  if (actionType === 'set-name') {
    const name = normalizeObjectName(actionPayload?.name);
    const error = getMetadataValidationError(name);
    if (error) { toast.error(error); return; }
    sendMessage('region_action', {
      type: 'object_upsert',
      data: {
        id: selected.id, kind: selected.kind, material: selected.material,
        position: selected.position, rotation: selected.rotation, scale: selected.scale,
        interactive: selected.interactive,
        metadata: { ...(selected.metadata ?? {}), name },
        version: selected.version,
      },
    });
    return;
  }

  if (actionType === 'set-model-key') {
    const modelKey = normalizeModelKey(actionPayload?.model_key);
    const error = getModelKeyValidationError(modelKey);
    if (error) { toast.error(error); return; }
    const nextMetadata = { ...(selected.metadata ?? {}) };
    if (modelKey) nextMetadata.model_key = modelKey;
    else delete nextMetadata.model_key;
    sendMessage('region_action', {
      type: 'object_upsert',
      data: {
        id: selected.id, kind: selected.kind, material: selected.material,
        position: selected.position, rotation: selected.rotation, scale: selected.scale,
        interactive: selected.interactive, metadata: nextMetadata, version: selected.version,
      },
    });
    return;
  }

  if (actionType === 'grant-builder' || actionType === 'revoke-builder') {
    const targetUserId = normalizeUserId(actionPayload?.user_id);
    if (!targetUserId || targetUserId === userId) return;
    const permissions = { ...(selected.metadata?.permissions ?? {}) };
    if (actionType === 'grant-builder') permissions[targetUserId] = 'builder';
    else delete permissions[targetUserId];
    sendMessage('region_action', {
      type: 'object_upsert',
      data: {
        id: selected.id, kind: selected.kind, material: selected.material,
        position: selected.position, rotation: selected.rotation, scale: selected.scale,
        interactive: selected.interactive,
        metadata: { ...(selected.metadata ?? {}), permissions },
        version: selected.version,
      },
    });
  }
}
