import type { RegionWorldObject } from '@veltara/shared';

export type InteractionNodeType = 'door' | 'storage' | 'crafting';

interface DoorState {
  is_open: boolean;
  is_locked: boolean;
}

interface StorageState {
  items: Record<string, number>;
}

interface CraftingJob {
  id: string;
  recipe: string;
  started_by: string;
  started_at: number;
  completes_at: number;
  status: 'active' | 'ready' | 'collected';
}

interface CraftingState {
  queue: CraftingJob[];
}

export interface InteractionApplyResult {
  ok: boolean;
  code?: string;
  message?: string;
  object?: RegionWorldObject;
  data?: Record<string, unknown>;
}

function getNodeType(object: RegionWorldObject): InteractionNodeType {
  const explicitType = object.metadata?.node_type;
  if (explicitType === 'door' || explicitType === 'storage' || explicitType === 'crafting') {
    return explicitType;
  }

  if (object.kind === 'beacon') return 'door';
  if (object.kind === 'platform') return 'crafting';
  return 'storage';
}

function ensureDoorState(object: RegionWorldObject): DoorState {
  const state = object.metadata?.state as Partial<DoorState> | undefined;
  return {
    is_open: Boolean(state?.is_open),
    is_locked: Boolean(state?.is_locked),
  };
}

function ensureStorageState(object: RegionWorldObject): StorageState {
  const state = object.metadata?.state as Partial<StorageState> | undefined;
  return {
    items: { ...(state?.items ?? {}) },
  };
}

function ensureCraftingState(object: RegionWorldObject): CraftingState {
  const state = object.metadata?.state as Partial<CraftingState> | undefined;
  return {
    queue: Array.isArray(state?.queue) ? [...state.queue] : [],
  };
}

export function initializeObjectState(object: RegionWorldObject): RegionWorldObject {
  const nodeType = getNodeType(object);

  let initialState: Record<string, unknown>;
  if (nodeType === 'door') {
    initialState = ensureDoorState(object);
  } else if (nodeType === 'crafting') {
    initialState = ensureCraftingState(object) as unknown as Record<string, unknown>;
  } else {
    initialState = ensureStorageState(object) as unknown as Record<string, unknown>;
  }

  return {
    ...object,
    metadata: {
      ...(object.metadata ?? {}),
      node_type: nodeType,
      state: initialState,
    },
  };
}

export function canEditOrRemoveObject(object: RegionWorldObject, actorId: string): boolean {
  return object.owner_id === actorId;
}

export function applyObjectInteraction(
  object: RegionWorldObject,
  actorId: string,
  interactionType: string,
  payload: Record<string, unknown> | undefined,
  now = Date.now(),
): InteractionApplyResult {
  const withState = initializeObjectState(object);
  const nodeType = withState.metadata?.node_type as InteractionNodeType;

  if (!withState.interactive) {
    return { ok: false, code: 'OBJECT_NOT_INTERACTIVE', message: 'This object is not interactive.' };
  }

  if (nodeType === 'door') {
    const state = ensureDoorState(withState);

    if (interactionType === 'door_toggle' || interactionType === 'use') {
      if (state.is_locked && actorId !== withState.owner_id) {
        return { ok: false, code: 'DOOR_LOCKED', message: 'Door is locked.' };
      }
      state.is_open = !state.is_open;
      const updated = {
        ...withState,
        metadata: {
          ...(withState.metadata ?? {}),
          state,
        },
        updated_at: now,
      };
      return { ok: true, object: updated, data: { node_type: 'door', state } };
    }

    if (interactionType === 'door_lock' || interactionType === 'door_unlock') {
      if (actorId !== withState.owner_id) {
        return { ok: false, code: 'OBJECT_PERMISSION_DENIED', message: 'Only the owner can lock this door.' };
      }
      state.is_locked = interactionType === 'door_lock';
      const updated = {
        ...withState,
        metadata: {
          ...(withState.metadata ?? {}),
          state,
        },
        updated_at: now,
      };
      return { ok: true, object: updated, data: { node_type: 'door', state } };
    }

    return { ok: false, code: 'UNSUPPORTED_INTERACTION', message: 'Interaction not supported for door node.' };
  }

  if (nodeType === 'storage') {
    const state = ensureStorageState(withState);

    if (interactionType === 'storage_put') {
      const itemId = String(payload?.item_id ?? '').trim();
      const count = Math.max(1, Math.floor(Number(payload?.count ?? 1)));
      if (!itemId) {
        return { ok: false, code: 'INVALID_STORAGE_ITEM', message: 'Missing item_id for storage_put.' };
      }
      state.items[itemId] = (state.items[itemId] ?? 0) + count;
      const updated = {
        ...withState,
        metadata: {
          ...(withState.metadata ?? {}),
          state,
        },
        updated_at: now,
      };
      return { ok: true, object: updated, data: { node_type: 'storage', state } };
    }

    if (interactionType === 'storage_take') {
      const itemId = String(payload?.item_id ?? '').trim();
      const count = Math.max(1, Math.floor(Number(payload?.count ?? 1)));
      if (!itemId) {
        return { ok: false, code: 'INVALID_STORAGE_ITEM', message: 'Missing item_id for storage_take.' };
      }

      const existing = state.items[itemId] ?? 0;
      if (existing < count) {
        return { ok: false, code: 'INSUFFICIENT_STORAGE_ITEM', message: 'Not enough items in storage.' };
      }

      const remaining = existing - count;
      if (remaining <= 0) {
        delete state.items[itemId];
      } else {
        state.items[itemId] = remaining;
      }

      const updated = {
        ...withState,
        metadata: {
          ...(withState.metadata ?? {}),
          state,
        },
        updated_at: now,
      };
      return { ok: true, object: updated, data: { node_type: 'storage', state } };
    }

    if (interactionType === 'use') {
      return { ok: true, object: withState, data: { node_type: 'storage', state } };
    }

    return { ok: false, code: 'UNSUPPORTED_INTERACTION', message: 'Interaction not supported for storage node.' };
  }

  const state = ensureCraftingState(withState);

  // Mark completed jobs ready.
  state.queue = state.queue.map((job) => {
    if (job.status === 'active' && job.completes_at <= now) {
      return { ...job, status: 'ready' };
    }
    return job;
  });

  if (interactionType === 'craft_start') {
    const recipe = String(payload?.recipe ?? '').trim();
    const durationMs = Math.max(5000, Math.min(120000, Math.floor(Number(payload?.duration_ms ?? 30000))));
    if (!recipe) {
      return { ok: false, code: 'INVALID_RECIPE', message: 'Missing recipe for craft_start.' };
    }

    const activeCount = state.queue.filter((job) => job.status === 'active').length;
    if (activeCount >= 3) {
      return { ok: false, code: 'CRAFT_QUEUE_FULL', message: 'Crafting queue is full.' };
    }

    const newJob: CraftingJob = {
      id: crypto.randomUUID(),
      recipe,
      started_by: actorId,
      started_at: now,
      completes_at: now + durationMs,
      status: 'active',
    };
    state.queue.push(newJob);

    const updated = {
      ...withState,
      metadata: {
        ...(withState.metadata ?? {}),
        state,
      },
      updated_at: now,
    };

    return { ok: true, object: updated, data: { node_type: 'crafting', state, started_job: newJob.id } };
  }

  if (interactionType === 'craft_collect') {
    const readyJobs = state.queue.filter((job) => job.status === 'ready');
    if (readyJobs.length === 0) {
      return { ok: false, code: 'NO_READY_CRAFTS', message: 'No completed crafts ready to collect.' };
    }

    // Remove collected jobs to prevent unbounded queue growth
    state.queue = state.queue.filter((job) => job.status !== 'ready' && job.status !== 'collected');

    const updated = {
      ...withState,
      metadata: {
        ...(withState.metadata ?? {}),
        state,
      },
      updated_at: now,
    };

    return {
      ok: true,
      object: updated,
      data: { node_type: 'crafting', state, collected_count: readyJobs.length },
    };
  }

  if (interactionType === 'use') {
    const updated = {
      ...withState,
      metadata: {
        ...(withState.metadata ?? {}),
        state,
      },
      updated_at: now,
    };
    return { ok: true, object: updated, data: { node_type: 'crafting', state } };
  }

  return { ok: false, code: 'UNSUPPORTED_INTERACTION', message: 'Interaction not supported for crafting node.' };
}

export function normalizeObjectSnapshot(objects: RegionWorldObject[]): RegionWorldObject[] {
  return [...objects].sort((a, b) => {
    if (a.created_at !== b.created_at) return a.created_at - b.created_at;
    return a.id.localeCompare(b.id);
  });
}
