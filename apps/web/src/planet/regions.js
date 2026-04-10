/**
 * Region markers on the planet surface.
 * Glowing pulsing markers with labels on hover.
 * Scale with player count.
 */

import * as THREE from 'three';
import { REGIONS, latLonToXYZ, PLANET_RADIUS } from '@veltara/shared';

export class RegionMarkers {
  /** @type {THREE.Scene} */
  scene;
  /** @type {Map<string, THREE.Group>} */
  markers = new Map();
  /** @type {THREE.Raycaster} */
  raycaster = new THREE.Raycaster();

  /** @type {HTMLElement} */
  labelEl;

  /** @type {string|null} */
  hoveredRegion = null;

  constructor(scene) {
    this.scene = scene;
    this._createLabel();
    this._buildMarkers();
  }

  _createLabel() {
    this.labelEl = document.createElement('div');
    this.labelEl.className =
      'pointer-events-none fixed hidden z-50 px-3 py-1.5 rounded-lg text-sm font-medium text-white bg-black/80 border border-white/10 backdrop-blur-sm';
    document.body.appendChild(this.labelEl);
  }

  _buildMarkers() {
    REGIONS.forEach((region) => {
      const [x, y, z] = latLonToXYZ(region.lat, region.lon, PLANET_RADIUS + 0.05);
      const group = new THREE.Group();
      group.position.set(x, y, z);
      group.lookAt(0, 0, 0);
      group.rotateX(Math.PI); // Flip to face outward

      const color = new THREE.Color(region.color);

      // Outer glow ring
      const glowGeo = new THREE.RingGeometry(0.06, 0.12, 32);
      const glowMat = new THREE.MeshBasicMaterial({
        color,
        transparent: true,
        opacity: 0.3,
        side: THREE.DoubleSide,
        depthWrite: false,
      });
      const glowMesh = new THREE.Mesh(glowGeo, glowMat);
      group.add(glowMesh);

      // Inner solid dot
      const dotGeo = new THREE.CircleGeometry(0.05, 24);
      const dotMat = new THREE.MeshBasicMaterial({ color, side: THREE.DoubleSide });
      const dotMesh = new THREE.Mesh(dotGeo, dotMat);
      group.add(dotMesh);

      // Spike pointing outward
      const spikeGeo = new THREE.ConeGeometry(0.015, 0.2, 8);
      const spikeMat = new THREE.MeshBasicMaterial({ color });
      const spikeMesh = new THREE.Mesh(spikeGeo, spikeMat);
      spikeMesh.rotation.x = Math.PI;
      spikeMesh.position.z = -0.12;
      group.add(spikeMesh);

      group.userData = { regionId: region.id, regionName: region.name, color };
      this.markers.set(region.id, group);
      this.scene.add(group);
    });
  }

  /**
   * Update marker scale and pulse based on player count.
   * @param {Record<string, number>} playerCounts
   * @param {number} elapsed
   */
  update(playerCounts, elapsed) {
    this.markers.forEach((group, regionId) => {
      const count = playerCounts[regionId] ?? 0;
      const baseScale = 1.0 + Math.min(count / 50, 1.0);
      const pulse = Math.sin(elapsed * 2.5 + REGIONS.findIndex((r) => r.id === regionId) * 0.8) * 0.1 + 1;
      const scale = baseScale * pulse;
      group.scale.setScalar(scale);

      // Update glow opacity
      /** @type {THREE.Mesh} */
      const glowMesh = group.children[0];
      if (glowMesh.material instanceof THREE.MeshBasicMaterial) {
        glowMesh.material.opacity = 0.2 + (count / 100) * 0.5 + Math.sin(elapsed * 2.0) * 0.1;
      }
    });
  }

  /**
   * Raycast to find hovered region marker.
   * @param {THREE.Vector2} mouse
   * @param {THREE.Camera} camera
   * @param {MouseEvent} event
   * @returns {string|null} regionId
   */
  checkHover(mouse, camera, event) {
    this.raycaster.setFromCamera(mouse, camera);
    const meshes = [];
    this.markers.forEach((group) => {
      group.children.forEach((child) => {
        if (child instanceof THREE.Mesh) meshes.push(child);
      });
    });

    const intersects = this.raycaster.intersectObjects(meshes);

    if (intersects.length > 0) {
      const obj = intersects[0].object;
      const group = obj.parent;
      if (group?.userData?.regionId) {
        const rid = group.userData.regionId;
        if (rid !== this.hoveredRegion) {
          this.hoveredRegion = rid;
        }
        this.labelEl.textContent = group.userData.regionName;
        this.labelEl.style.left = `${event.clientX + 12}px`;
        this.labelEl.style.top = `${event.clientY - 4}px`;
        this.labelEl.classList.remove('hidden');
        document.body.style.cursor = 'pointer';
        return rid;
      }
    }

    this.hoveredRegion = null;
    this.labelEl.classList.add('hidden');
    document.body.style.cursor = 'default';
    return null;
  }

  /**
   * Get which region was clicked.
   * @param {THREE.Vector2} mouse
   * @param {THREE.Camera} camera
   * @returns {string|null}
   */
  checkClick(mouse, camera) {
    this.raycaster.setFromCamera(mouse, camera);
    const meshes = [];
    this.markers.forEach((group) => {
      group.children.forEach((child) => {
        if (child instanceof THREE.Mesh) meshes.push(child);
      });
    });

    const intersects = this.raycaster.intersectObjects(meshes);
    if (intersects.length > 0) {
      return intersects[0].object.parent?.userData?.regionId ?? null;
    }
    return null;
  }

  setPlayerCounts(counts) {
    // stored for use in update()
    this._counts = counts;
  }
}
