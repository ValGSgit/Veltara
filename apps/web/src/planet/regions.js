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
  markerEntries = [];
  /** @type {THREE.Raycaster} */
  raycaster = new THREE.Raycaster();
  /** @type {THREE.Raycaster} */
  occlusionRaycaster = new THREE.Raycaster();
  /** @type {THREE.Mesh[]} */
  planetMeshes = [];

  /** @type {HTMLElement} */
  labelEl;

  /** @type {string|null} */
  hoveredRegion = null;

  constructor(scene) {
    this.scene = scene;
    this.planetMeshes = this.scene.children.filter(
      (obj) => obj instanceof THREE.Mesh && obj.name === 'planet',
    );
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
      const [x, y, z] = latLonToXYZ(region.lat, region.lon, PLANET_RADIUS + 0.075);
      const group = new THREE.Group();
      group.position.set(x, y, z);
      const outward = group.position.clone().normalize();
      group.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), outward);

      const color = new THREE.Color(region.color);

      // Outer glow ring
      const glowGeo = new THREE.RingGeometry(0.05, 0.115, 44);
      const glowMat = new THREE.MeshBasicMaterial({
        color,
        transparent: true,
        opacity: 0.28,
        side: THREE.DoubleSide,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
      });
      const glowMesh = new THREE.Mesh(glowGeo, glowMat);
      group.add(glowMesh);

      // Secondary aura ring for better visibility at distance
      const auraGeo = new THREE.RingGeometry(0.12, 0.2, 44);
      const auraMat = new THREE.MeshBasicMaterial({
        color,
        transparent: true,
        opacity: 0.12,
        side: THREE.DoubleSide,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
      });
      const auraMesh = new THREE.Mesh(auraGeo, auraMat);
      group.add(auraMesh);

      // Inner solid dot
      const dotGeo = new THREE.CircleGeometry(0.042, 32);
      const dotMat = new THREE.MeshBasicMaterial({ color, side: THREE.DoubleSide });
      const dotMesh = new THREE.Mesh(dotGeo, dotMat);
      group.add(dotMesh);

      // Core sparkle
      const coreGeo = new THREE.CircleGeometry(0.018, 24);
      const coreMat = new THREE.MeshBasicMaterial({
        color: 0xffffff,
        transparent: true,
        opacity: 0.7,
        side: THREE.DoubleSide,
        depthWrite: false,
      });
      const coreMesh = new THREE.Mesh(coreGeo, coreMat);
      coreMesh.position.z = 0.0015;
      group.add(coreMesh);

      // Spike pointing outward
      const spikeGeo = new THREE.ConeGeometry(0.012, 0.16, 8);
      const spikeMat = new THREE.MeshBasicMaterial({ color });
      const spikeMesh = new THREE.Mesh(spikeGeo, spikeMat);
      spikeMesh.rotation.x = Math.PI;
      spikeMesh.position.z = -0.11;
      group.add(spikeMesh);

      const pulseOffset = Math.random() * Math.PI * 2;

      group.userData = { regionId: region.id, regionName: region.name, color, pulseOffset };
      this.markers.set(region.id, group);
      this.markerEntries.push({
        regionId: region.id,
        group,
        glowMesh,
        auraMesh,
        dotMesh,
        coreMesh,
      });
      this.scene.add(group);
    });
  }

  _isOccludedByPlanet(intersect, camera) {
    // Region marker should not be interactable when it's on the far side of the planet.
    // We raycast against planet meshes first and compare hit distance.
    if (!this.planetMeshes.length) return false;

    const origin = camera.position;
    const direction = intersect.point.clone().sub(origin).normalize();
    this.occlusionRaycaster.set(origin, direction);
    const planetHits = this.occlusionRaycaster.intersectObjects(this.planetMeshes, false);
    if (!planetHits.length) return false;
    return planetHits[0].distance + 0.001 < intersect.distance;
  }

  /**
   * Update marker scale and pulse based on player count.
   * @param {Record<string, number>} playerCounts
   * @param {number} elapsed
   */
  update(playerCounts, elapsed) {
    this.markerEntries.forEach(({ regionId, group, glowMesh, auraMesh, dotMesh, coreMesh }) => {
      const count = playerCounts[regionId] ?? 0;
      const baseScale = 1.0 + Math.min(count / 90, 0.6);
      const pulse = Math.sin(elapsed * 2.4 + (group.userData.pulseOffset ?? 0)) * 0.12 + 1;
      const scale = baseScale * pulse;
      group.scale.setScalar(scale);

      // Update glow opacity and aura response to activity
      if (glowMesh.material instanceof THREE.MeshBasicMaterial) {
        glowMesh.material.opacity = 0.2 + Math.min(0.35, count * 0.01) + (Math.sin(elapsed * 2.0) * 0.06);
      }
      if (auraMesh.material instanceof THREE.MeshBasicMaterial) {
        auraMesh.material.opacity = 0.08 + Math.min(0.24, count * 0.006) + (Math.cos(elapsed * 1.4) * 0.04);
      }
      if (dotMesh.material instanceof THREE.MeshBasicMaterial) {
        const intensity = 0.78 + Math.sin(elapsed * 3.1 + (group.userData.pulseOffset ?? 0)) * 0.12;
        dotMesh.material.color.copy(group.userData.color).multiplyScalar(intensity);
      }
      if (coreMesh.material instanceof THREE.MeshBasicMaterial) {
        coreMesh.material.opacity = 0.55 + Math.sin(elapsed * 4.6 + (group.userData.pulseOffset ?? 0)) * 0.2;
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
      if (this._isOccludedByPlanet(intersects[0], camera)) {
        this.hoveredRegion = null;
        this.labelEl.classList.add('hidden');
        document.body.style.cursor = 'default';
        return null;
      }

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
      if (this._isOccludedByPlanet(intersects[0], camera)) return null;
      return intersects[0].object.parent?.userData?.regionId ?? null;
    }
    return null;
  }

  setPlayerCounts(counts) {
    // stored for use in update()
    this._counts = counts;
  }
}
