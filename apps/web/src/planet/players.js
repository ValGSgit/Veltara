/**
 * Player avatars on planet surface.
 * Uses InstancedMesh for up to 500 players.
 * Smooth interpolation on position updates.
 */

import * as THREE from 'three';
import { latLonToXYZ, PLANET_RADIUS, REGION_MAP } from '@veltara/shared';

const MAX_PLAYERS = 500;

export class PlayerDots {
  /** @type {THREE.Scene} */
  scene;
  /** @type {THREE.InstancedMesh} */
  instancedMesh;

  /** @type {Map<string, { target: THREE.Vector3, current: THREE.Vector3, color: THREE.Color, index: number }>} */
  players = new Map();

  /** @type {number[]} free instance indices */
  freeIndices = [];

  tempMatrix = new THREE.Matrix4();
  tempColor = new THREE.Color();

  constructor(scene) {
    this.scene = scene;
    this.freeIndices = Array.from({ length: MAX_PLAYERS }, (_, i) => i);

    const geo = new THREE.SphereGeometry(0.04, 8, 8);
    const mat = new THREE.MeshBasicMaterial({ vertexColors: true });

    this.instancedMesh = new THREE.InstancedMesh(geo, mat, MAX_PLAYERS);
    this.instancedMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.instancedMesh.count = 0;

    // Initialize all instances as invisible (scale 0)
    for (let i = 0; i < MAX_PLAYERS; i++) {
      this.tempMatrix.makeScale(0, 0, 0);
      this.instancedMesh.setMatrixAt(i, this.tempMatrix);
    }
    this.instancedMesh.instanceMatrix.needsUpdate = true;
    this.scene.add(this.instancedMesh);
  }

  /**
   * Add or update a player.
   * @param {import('@veltara/shared').Player} player
   * @param {boolean} isSelf
   */
  addOrUpdate(player, isSelf = false) {
    const [x, y, z] = latLonToXYZ(player.lat, player.lon, PLANET_RADIUS + 0.08);
    const target = new THREE.Vector3(x, y, z);
    const color = new THREE.Color(isSelf ? '#4fffb0' : (REGION_MAP[player.region_id]?.color ?? '#ffffff'));

    if (this.players.has(player.id)) {
      const data = this.players.get(player.id);
      data.target.copy(target);
      data.color.copy(color);
    } else {
      if (this.freeIndices.length === 0) return; // At capacity

      const index = this.freeIndices.pop();
      this.players.set(player.id, {
        target,
        current: target.clone(),
        color,
        index,
      });
      this.instancedMesh.count = Math.min(this.players.size, MAX_PLAYERS);
    }
  }

  /**
   * Remove a player.
   * @param {string} playerId
   */
  remove(playerId) {
    const data = this.players.get(playerId);
    if (!data) return;

    // Hide the instance
    this.tempMatrix.makeScale(0, 0, 0);
    this.instancedMesh.setMatrixAt(data.index, this.tempMatrix);
    this.instancedMesh.instanceMatrix.needsUpdate = true;

    this.freeIndices.push(data.index);
    this.players.delete(playerId);
    this.instancedMesh.count = Math.max(this.players.size, 0);
  }

  /**
   * Update all player positions with interpolation.
   * @param {number} delta - Frame delta time in seconds
   * @param {number} elapsed
   */
  update(delta, elapsed) {
    const lerpSpeed = 8.0; // Higher = snappier
    const selfPulse = (Math.sin(elapsed * 4) + 1) * 0.5;

    this.players.forEach((data) => {
      // Smooth interpolation toward target
      data.current.lerp(data.target, Math.min(delta * lerpSpeed, 1));

      // Position on planet surface
      this.tempMatrix.makeTranslation(data.current.x, data.current.y, data.current.z);
      this.instancedMesh.setMatrixAt(data.index, this.tempMatrix);

      // Color with optional pulse for self
      const baseColor = data.color.clone();
      if (data.isSelf) {
        baseColor.lerp(new THREE.Color(1, 1, 1), selfPulse * 0.3);
      }
      this.instancedMesh.setColorAt(data.index, baseColor);
    });

    this.instancedMesh.instanceMatrix.needsUpdate = true;
    if (this.instancedMesh.instanceColor) {
      this.instancedMesh.instanceColor.needsUpdate = true;
    }
  }

  /** Returns total player count. */
  get count() {
    return this.players.size;
  }

  dispose() {
    this.instancedMesh.geometry.dispose();
    if (Array.isArray(this.instancedMesh.material)) {
      this.instancedMesh.material.forEach((m) => m.dispose());
    } else {
      this.instancedMesh.material.dispose();
    }
  }
}
