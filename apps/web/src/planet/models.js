import * as THREE from 'three';

const MODEL_REGISTRY = {
  beacon_tower: '/models/beacon-tower.glb',
  storage_crate: '/models/storage-crate.glb',
  crafting_forge: '/models/crafting-forge.glb',
  orb_core: '/models/orb-core.glb',
};

const MODEL_KEY_PATTERN = /^[a-z0-9][a-z0-9-_]{0,63}$/;

function normalizeModelKey(value) {
  const key = String(value ?? '').trim().toLowerCase();
  if (!key || !MODEL_KEY_PATTERN.test(key)) return null;
  return key;
}

export class ModelLibrary {
  constructor() {
    this.loader = null;
    this.loaderPromise = null;
    this.cache = new Map();
  }

  async ensureLoader() {
    if (this.loader) return this.loader;
    if (!this.loaderPromise) {
      this.loaderPromise = import('three/examples/jsm/loaders/GLTFLoader.js')
        .then((mod) => {
          this.loader = new mod.GLTFLoader();
          return this.loader;
        })
        .catch(() => null);
    }
    return this.loaderPromise;
  }

  hasModel(modelKey) {
    const key = normalizeModelKey(modelKey);
    return Boolean(key && MODEL_REGISTRY[key]);
  }

  async getModel(modelKey) {
    const key = normalizeModelKey(modelKey);
    if (!key) return null;
    const url = MODEL_REGISTRY[key];
    if (!url) return null;
    const loader = await this.ensureLoader();
    if (!loader) return null;

    if (!this.cache.has(key)) {
      this.cache.set(
        key,
        new Promise((resolve, reject) => {
          loader.load(
            url,
            (gltf) => {
              const source = gltf.scene;
              source.updateMatrixWorld(true);
              resolve(source);
            },
            undefined,
            (error) => reject(error),
          );
        }),
      );
    }

    try {
      const source = await this.cache.get(key);
      return source.clone(true);
    } catch {
      this.cache.delete(key);
      return null;
    }
  }
}

export function applySurfaceMaterials(root, materialName, isSelected) {
  const tintByMaterial = {
    stone: 0x9ba5b1,
    metal: 0xaec5d8,
    wood: 0x8a5f3d,
    glass: 0x84d4ff,
    neon: 0x43ffbf,
  };

  const tint = tintByMaterial[materialName] ?? tintByMaterial.stone;
  root.traverse((child) => {
    if (!(child instanceof THREE.Mesh)) return;

    const materials = Array.isArray(child.material) ? child.material : [child.material];
    materials.forEach((mat) => {
      if (!mat) return;
      if ('color' in mat && mat.color instanceof THREE.Color) {
        mat.color.setHex(tint);
      }
      if ('emissiveIntensity' in mat) {
        mat.emissiveIntensity = isSelected ? 0.55 : (materialName === 'neon' ? 0.3 : 0.05);
      }
      if ('transparent' in mat && materialName === 'glass') {
        mat.transparent = true;
      }
      if ('opacity' in mat && materialName === 'glass') {
        mat.opacity = 0.7;
      }
    });
  });
}
