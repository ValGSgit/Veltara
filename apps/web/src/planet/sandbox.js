/**
 * Region sandbox object layer.
 * Renders persistent region objects and exposes helpers for placement/editing.
 */

import * as THREE from 'three';

const MATERIAL_COLORS = {
  stone: 0x9ba5b1,
  metal: 0xaec5d8,
  wood: 0x8a5f3d,
  glass: 0x84d4ff,
  neon: 0x43ffbf,
};

const KIND_GEOMETRY = {
  block: () => new THREE.BoxGeometry(1, 1, 1),
  platform: () => new THREE.BoxGeometry(2, 0.35, 2),
  beacon: () => new THREE.CylinderGeometry(0.4, 0.5, 2.2, 12),
  orb: () => new THREE.SphereGeometry(0.7, 16, 16),
};

export class RegionSandboxLayer {
  /** @type {THREE.Scene} */
  scene;
  /** @type {THREE.Mesh} */
  planetMesh;
  /** @type {THREE.Group} */
  group;
  /** @type {Map<string, { data: any, mesh: THREE.Mesh }>} */
  objects = new Map();

  raycaster = new THREE.Raycaster();
  selectedObjectId = null;

  constructor(scene, planetMesh) {
    this.scene = scene;
    this.planetMesh = planetMesh;
    this.placementSurface = planetMesh;
    this.group = new THREE.Group();
    this.group.name = 'region-sandbox-objects';
    this.scene.add(this.group);
  }

  setPlacementSurface(surfaceMesh) {
    this.placementSurface = surfaceMesh ?? this.planetMesh;
  }

  applySnapshot(objects) {
    const incomingIds = new Set((objects ?? []).map((obj) => obj.id));

    this.objects.forEach((_entry, id) => {
      if (!incomingIds.has(id)) {
        this.remove(id);
      }
    });

    (objects ?? []).forEach((obj) => this.upsert(obj));
  }

  upsert(objectData) {
    const existing = this.objects.get(objectData.id);

    if (!existing) {
      const mesh = this.createMesh(objectData);
      this.group.add(mesh);
      this.objects.set(objectData.id, { data: objectData, mesh });
      this.applyTransform(mesh, objectData);
      return;
    }

    existing.data = objectData;
    this.applyTransform(existing.mesh, objectData);
    this.applyMaterial(existing.mesh, objectData.material, objectData.id === this.selectedObjectId);
  }

  remove(objectId) {
    const entry = this.objects.get(objectId);
    if (!entry) return;

    entry.mesh.geometry.dispose();
    if (Array.isArray(entry.mesh.material)) {
      entry.mesh.material.forEach((m) => m.dispose());
    } else {
      entry.mesh.material.dispose();
    }
    this.group.remove(entry.mesh);
    this.objects.delete(objectId);

    if (this.selectedObjectId === objectId) {
      this.selectedObjectId = null;
    }
  }

  setSelected(objectId) {
    this.selectedObjectId = objectId;
    this.objects.forEach((entry, id) => {
      this.applyMaterial(entry.mesh, entry.data.material, id === objectId);
    });
  }

  getSelectedObject() {
    return this.selectedObjectId ? this.objects.get(this.selectedObjectId)?.data ?? null : null;
  }

  getObjectById(objectId) {
    return this.objects.get(objectId)?.data ?? null;
  }

  pickObject(mouse, camera) {
    this.raycaster.setFromCamera(mouse, camera);
    const intersects = this.raycaster.intersectObjects(this.group.children, false);
    if (intersects.length === 0) return null;

    const mesh = intersects[0].object;
    const id = mesh.userData.objectId;
    if (!id) return null;

    return this.objects.get(id)?.data ?? null;
  }

  makePlacementData(mouse, camera, ownerId, regionId, kind = 'block', material = 'stone') {
    if (!ownerId || !regionId) return null;

    this.raycaster.setFromCamera(mouse, camera);
    const surface = this.placementSurface ?? this.planetMesh;
    const intersects = this.raycaster.intersectObject(surface, false);
    if (intersects.length === 0) return null;

    const hit = intersects[0];
    const offset = hit.face?.normal?.clone()?.multiplyScalar(0.8) ?? new THREE.Vector3(0, 1, 0);
    const position = hit.point.clone().add(offset);

    return {
      kind,
      material,
      position: {
        x: Number(position.x.toFixed(3)),
        y: Number(position.y.toFixed(3)),
        z: Number(position.z.toFixed(3)),
      },
      rotation: { x: 0, y: 0, z: 0 },
      scale: { x: 1, y: 1, z: 1 },
      interactive: true,
      metadata: {
        placed_by: ownerId,
        region_id: regionId,
      },
    };
  }

  pulse(objectId) {
    const entry = this.objects.get(objectId);
    if (!entry) return;

    const baseScale = entry.mesh.scale.clone();
    entry.mesh.scale.multiplyScalar(1.08);
    setTimeout(() => {
      // Guard: object may have been removed during the timeout
      if (this.objects.has(objectId)) {
        entry.mesh.scale.copy(baseScale);
      }
    }, 180);
  }

  dispose() {
    this.objects.forEach((_entry, id) => this.remove(id));
    this.scene.remove(this.group);
  }

  createMesh(objectData) {
    const geometryFactory = KIND_GEOMETRY[objectData.kind] ?? KIND_GEOMETRY.block;
    const geometry = geometryFactory();
    const material = new THREE.MeshStandardMaterial({
      color: MATERIAL_COLORS[objectData.material] ?? MATERIAL_COLORS.stone,
      metalness: objectData.material === 'metal' ? 0.8 : 0.2,
      roughness: objectData.material === 'glass' ? 0.1 : 0.7,
      transparent: objectData.material === 'glass',
      opacity: objectData.material === 'glass' ? 0.55 : 1,
      emissive: objectData.material === 'neon' ? new THREE.Color(0x1ee5a1) : new THREE.Color(0x000000),
      emissiveIntensity: objectData.material === 'neon' ? 0.4 : 0,
    });

    const mesh = new THREE.Mesh(geometry, material);
    mesh.castShadow = false;
    mesh.receiveShadow = false;
    mesh.userData.objectId = objectData.id;

    return mesh;
  }

  applyTransform(mesh, objectData) {
    mesh.position.set(objectData.position.x, objectData.position.y, objectData.position.z);
    mesh.rotation.set(objectData.rotation.x, objectData.rotation.y, objectData.rotation.z);
    mesh.scale.set(objectData.scale.x, objectData.scale.y, objectData.scale.z);
  }

  applyMaterial(mesh, materialName, isSelected) {
    const material = mesh.material;
    if (!(material instanceof THREE.MeshStandardMaterial)) return;

    material.color.setHex(MATERIAL_COLORS[materialName] ?? MATERIAL_COLORS.stone);
    material.emissiveIntensity = isSelected ? 0.65 : (materialName === 'neon' ? 0.4 : 0.05);
  }
}
