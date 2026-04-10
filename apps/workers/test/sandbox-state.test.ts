import { describe, expect, it } from 'vitest';
import type { RegionWorldObject } from '@veltara/shared';
import {
  applyObjectInteraction,
  canEditOrRemoveObject,
  initializeObjectState,
  normalizeObjectSnapshot,
} from '../src/sandbox-state.js';

function makeObject(overrides: Partial<RegionWorldObject> = {}): RegionWorldObject {
  return {
    id: overrides.id ?? 'obj-1',
    region_id: overrides.region_id ?? 'nexus-core',
    owner_id: overrides.owner_id ?? 'owner-1',
    kind: overrides.kind ?? 'beacon',
    material: overrides.material ?? 'metal',
    position: overrides.position ?? { x: 1, y: 2, z: 3 },
    rotation: overrides.rotation ?? { x: 0, y: 0, z: 0 },
    scale: overrides.scale ?? { x: 1, y: 1, z: 1 },
    interactive: overrides.interactive ?? true,
    metadata: overrides.metadata,
    created_at: overrides.created_at ?? 10,
    updated_at: overrides.updated_at ?? 10,
  };
}

describe('sandbox-state permissions', () => {
  it('allows owner edit/remove and denies non-owner', () => {
    const object = makeObject({ owner_id: 'owner-1' });
    expect(canEditOrRemoveObject(object, 'owner-1')).toBe(true);
    expect(canEditOrRemoveObject(object, 'other-user')).toBe(false);
  });
});

describe('sandbox-state door interactions', () => {
  it('toggles door for owner and updates state', () => {
    const object = initializeObjectState(makeObject({ kind: 'beacon' }));
    const result = applyObjectInteraction(object, 'owner-1', 'door_toggle', undefined, 100);
    expect(result.ok).toBe(true);
    expect(result.object?.metadata?.state).toEqual({ is_open: true, is_locked: false });
    expect(result.object?.updated_at).toBe(100);
  });

  it('blocks non-owner when door is locked', () => {
    const object = initializeObjectState(
      makeObject({ kind: 'beacon', metadata: { node_type: 'door', state: { is_open: false, is_locked: true } } }),
    );
    const result = applyObjectInteraction(object, 'other-user', 'door_toggle', undefined, 100);
    expect(result.ok).toBe(false);
    expect(result.code).toBe('DOOR_LOCKED');
  });
});

describe('sandbox-state storage interactions', () => {
  it('puts and takes items from storage state', () => {
    const storageObject = initializeObjectState(makeObject({ kind: 'block' }));

    const put = applyObjectInteraction(
      storageObject,
      'owner-1',
      'storage_put',
      { item_id: 'ore', count: 3 },
      100,
    );
    expect(put.ok).toBe(true);
    expect(put.object?.metadata?.state).toEqual({ items: { ore: 3 } });

    const take = applyObjectInteraction(
      put.object!,
      'owner-1',
      'storage_take',
      { item_id: 'ore', count: 2 },
      120,
    );
    expect(take.ok).toBe(true);
    expect(take.object?.metadata?.state).toEqual({ items: { ore: 1 } });
  });
});

describe('sandbox-state crafting interactions', () => {
  it('starts craft then collects when ready', () => {
    const craftingObject = initializeObjectState(makeObject({ kind: 'platform' }));

    const started = applyObjectInteraction(
      craftingObject,
      'owner-1',
      'craft_start',
      { recipe: 'iron_ingot', duration_ms: 5000 },
      100,
    );
    expect(started.ok).toBe(true);
    expect((started.object?.metadata?.state as { queue: Array<{ status: string }> }).queue).toHaveLength(1);

    const collected = applyObjectInteraction(started.object!, 'owner-1', 'craft_collect', undefined, 7000);
    expect(collected.ok).toBe(true);
    const queue = (collected.object?.metadata?.state as { queue: Array<{ status: string }> }).queue;
    expect(queue[0]?.status).toBe('collected');
  });
});

describe('sandbox-state snapshot normalization', () => {
  it('sorts snapshots deterministically by created_at then id', () => {
    const input = [
      makeObject({ id: 'z', created_at: 20 }),
      makeObject({ id: 'a', created_at: 10 }),
      makeObject({ id: 'b', created_at: 10 }),
    ];

    const sorted = normalizeObjectSnapshot(input);
    expect(sorted.map((obj) => obj.id)).toEqual(['a', 'b', 'z']);
  });
});
