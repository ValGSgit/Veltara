/**
 * Region sandbox object layer.
 * Renders persistent region objects and exposes helpers for placement/editing.
 */

import * as THREE from 'three';
import { ModelLibrary, applySurfaceMaterials } from './models.js';

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
  /** @type {Map<string, { data: any, mesh: THREE.Object3D }>} */
  objects = new Map();
  /** @type {Map<string, number>} */
  pendingModelLoads = new Map();

  raycaster = new THREE.Raycaster();
  selectedObjectId = null;

  constructor(scene, planetMesh) {
    this.scene = scene;
    this.planetMesh = planetMesh;
    this.placementSurface = planetMesh;
    this.group = new THREE.Group();
    this.group.name = 'region-sandbox-objects';
    this.scene.add(this.group);
    this.models = new ModelLibrary();
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
      const mesh = this.createPrimitiveMesh(objectData);
      this.group.add(mesh);
      this.objects.set(objectData.id, { data: objectData, mesh });
      this.applyTransform(mesh, objectData);
      this.tryUpgradeToModel(objectData.id);
      
      // Spawn animation - start scaled down and pop up
      mesh.userData.spawnScale = 0.01;
      mesh.userData.targetScale = new THREE.Vector3(objectData.scale.x, objectData.scale.y, objectData.scale.z);
      mesh.scale.setScalar(0.01);
      
      return;
    }

    const previousModelKey = this.getModelKey(existing.data);
    const nextModelKey = this.getModelKey(objectData);
    existing.data = objectData;
    if (previousModelKey !== nextModelKey) {
      if (nextModelKey && this.models.hasModel(nextModelKey)) {
        this.tryUpgradeToModel(objectData.id);
      } else if (existing.mesh.userData?.isModelMesh) {
        this.replaceWithPrimitive(objectData.id);
      }
    }
    const active = this.objects.get(objectData.id);
    if (!active) return;
    
    // Instead of instantly teleporting, we update the target transform
    // so `update()` can lerp it smoothly.
    active.mesh.userData.targetPosition = new THREE.Vector3(objectData.position.x, objectData.position.y, objectData.position.z);
    active.mesh.userData.targetRotation = new THREE.Vector3(objectData.rotation.x, objectData.rotation.y, objectData.rotation.z);
    active.mesh.userData.targetScale = new THREE.Vector3(objectData.scale.x, objectData.scale.y, objectData.scale.z);
    
    this.applyMaterial(active.mesh, objectData.material, objectData.id === this.selectedObjectId);
  }

  remove(objectId) {
    const entry = this.objects.get(objectId);
    if (!entry) return;

    this.disposeObject(entry.mesh);
    this.group.remove(entry.mesh);
    this.objects.delete(objectId);
    this.pendingModelLoads.delete(objectId);

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
    const intersects = this.raycaster.intersectObjects(this.group.children, true);
    if (intersects.length === 0) return null;

    const mesh = intersects[0].object;
    let target = mesh;
    let id = target.userData?.objectId;
    while (!id && target.parent) {
      target = target.parent;
      id = target.userData?.objectId;
    }
    if (!id) return null;

    return this.objects.get(id)?.data ?? null;
  }

  makePlacementData(
    mouse,
    camera,
    ownerId,
    regionId,
    kind = 'block',
    material = 'stone',
    modelKey = '',
  ) {
    if (!ownerId || !regionId) return null;

    this.raycaster.setFromCamera(mouse, camera);
    const surface = this.placementSurface ?? this.planetMesh;
    const intersects = this.raycaster.intersectObject(surface, false);
    if (intersects.length === 0) return null;

    const hit = intersects[0];
    const offset = hit.face?.normal?.clone()?.multiplyScalar(0.8) ?? new THREE.Vector3(0, 1, 0);
    const position = hit.point.clone().add(offset);

    const normalizedModelKey = String(modelKey ?? '').trim().toLowerCase();
    const metadata = {
      placed_by: ownerId,
      region_id: regionId,
    };
    if (/^[a-z0-9][a-z0-9-_]{0,63}$/.test(normalizedModelKey)) {
      metadata.model_key = normalizedModelKey;
    }

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
      metadata,
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

  createPrimitiveMesh(objectData) {
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
    mesh.userData.isModelMesh = false;

    return mesh;
  }

  getModelKey(objectData) {
    const key = objectData?.metadata?.model_key;
    if (!key) return null;
    const normalized = String(key).trim().toLowerCase();
    return normalized || null;
  }

  async tryUpgradeToModel(objectId) {
    const entry = this.objects.get(objectId);
    if (!entry) return;

    const modelKey = this.getModelKey(entry.data);
    if (!modelKey || !this.models.hasModel(modelKey)) return;

    const loadVersion = (this.pendingModelLoads.get(objectId) ?? 0) + 1;
    this.pendingModelLoads.set(objectId, loadVersion);

    const model = await this.models.getModel(modelKey);
    const current = this.objects.get(objectId);
    if (!model || !current) return;
    if (this.pendingModelLoads.get(objectId) !== loadVersion) return;

    model.userData.objectId = objectId;
    model.userData.isModelMesh = true;
    model.userData.modelKey = modelKey;
    model.traverse((child) => {
      if (child instanceof THREE.Mesh) {
        child.userData.objectId = objectId;
      }
    });
    this.applyTransform(model, current.data);
    this.applyMaterial(model, current.data.material, objectId === this.selectedObjectId);

    this.group.remove(current.mesh);
    this.disposeObject(current.mesh);
    this.group.add(model);
    this.objects.set(objectId, { data: current.data, mesh: model });
  }

  replaceWithPrimitive(objectId) {
    const current = this.objects.get(objectId);
    if (!current) return;

    const primitive = this.createPrimitiveMesh(current.data);
    this.applyTransform(primitive, current.data);
    this.applyMaterial(primitive, current.data.material, objectId === this.selectedObjectId);

    this.group.remove(current.mesh);
    this.disposeObject(current.mesh);
    this.group.add(primitive);
    this.objects.set(objectId, { data: current.data, mesh: primitive });
  }

  applyTransform(mesh, objectData) {
    mesh.position.set(objectData.position.x, objectData.position.y, objectData.position.z);
    mesh.rotation.set(objectData.rotation.x, objectData.rotation.y, objectData.rotation.z);
    mesh.scale.set(objectData.scale.x, objectData.scale.y, objectData.scale.z);
    
    mesh.userData.targetPosition = mesh.position.clone();
    mesh.userData.targetRotation = mesh.rotation.clone();
    mesh.userData.targetScale = mesh.scale.clone();
  }

  update(delta, elapsed) {
    // Add smooth lerping and idle animations to sandbox objects
    this.objects.forEach(({ data, mesh }, id) => {
      // Handle spawn pop-in animation
      if (mesh.userData.spawnScale !== undefined) {
        mesh.userData.spawnScale += delta * 5.0; // scale up quickly
        if (mesh.userData.spawnScale >= 1.0) {
          mesh.userData.spawnScale = undefined;
        } else {
          // Overshoot slightly for a "pop" bounce effect
          const bounce = Math.sin(mesh.userData.spawnScale * Math.PI) * 1.2;
          mesh.scale.copy(mesh.userData.targetScale).multiplyScalar(Math.min(bounce, 1.0));
        }
      }

      // Smooth Position / Scale Interpolation (except when spawning)
      if (!mesh.userData.spawnScale) {
        if (mesh.userData.targetPosition) {
          mesh.position.lerp(mesh.userData.targetPosition, Math.min(delta * 10.0, 1));
        }
        if (mesh.userData.targetScale) {
          mesh.scale.lerp(mesh.userData.targetScale, Math.min(delta * 10.0, 1));
        }
      }

      // Idle animations based on object type
      if (data.kind === 'orb') {
        mesh.rotation.y += delta * 1.5;
        // gentle bobbing
        if (mesh.userData.targetPosition) {
          const bob = Math.sin(elapsed * 2.0 + parseInt(id, 16) % 100) * 0.15;
          mesh.position.y = mesh.userData.targetPosition.y + bob;
        }
      } else if (mesh.userData.targetRotation) {
        // Linear interpolation for euler angles on other non-rotating objects
        const t = Math.min(delta * 8.0, 1);
        mesh.rotation.x += (mesh.userData.targetRotation.x - mesh.rotation.x) * t;
        mesh.rotation.y += (mesh.userData.targetRotation.y - mesh.rotation.y) * t;
        mesh.rotation.z += (mesh.userData.targetRotation.z - mesh.rotation.z) * t;
      }
    });
  }

  applyMaterial(mesh, materialName, isSelected) {
    if (mesh instanceof THREE.Mesh && mesh.material instanceof THREE.MeshStandardMaterial) {
      mesh.material.color.setHex(MATERIAL_COLORS[materialName] ?? MATERIAL_COLORS.stone);
      mesh.material.emissiveIntensity = isSelected ? 0.65 : (materialName === 'neon' ? 0.4 : 0.05);
      return;
    }

    applySurfaceMaterials(mesh, materialName, isSelected);
  }

  disposeObject(root) {
    root.traverse((child) => {
      if (!(child instanceof THREE.Mesh)) return;
      child.geometry?.dispose?.();
      if (Array.isArray(child.material)) {
        child.material.forEach((m) => m?.dispose?.());
      } else {
        child.material?.dispose?.();
      }
    });
  }
}
