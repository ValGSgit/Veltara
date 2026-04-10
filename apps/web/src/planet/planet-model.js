import * as THREE from 'three';
import { PLANET_RADIUS } from '@veltara/shared';

export class PlanetModel {
  constructor(scene, url, options = {}) {
    this.scene = scene;
    this.url = url;
    this.format = String(options.format ?? '').toLowerCase() || this.detectFormat(url);
    this.spinSpeed = Number(options.spinSpeed ?? 0.003);
    this.group = new THREE.Group();
    this.group.name = 'planet-model-root';
    this.scene.add(this.group);
    this.isLoaded = false;
    this.loaderPromise = null;
  }

  detectFormat(url) {
    const lower = String(url ?? '').toLowerCase();
    if (lower.endsWith('.fbx')) return 'fbx';
    return 'gltf';
  }

  setVisible(visible) {
    this.group.visible = Boolean(visible);
  }

  async loadIfNeeded() {
    if (this.isLoaded) return true;
    if (this.loaderPromise) return this.loaderPromise;

    const loaderImport =
      this.format === 'fbx'
        ? import('three/examples/jsm/loaders/FBXLoader.js').then((mod) => ({ loader: new mod.FBXLoader(), type: 'fbx' }))
        : import('three/examples/jsm/loaders/GLTFLoader.js').then((mod) => ({ loader: new mod.GLTFLoader(), type: 'gltf' }));

    this.loaderPromise = loaderImport
      .then(({ loader, type }) => {
        return new Promise((resolve, reject) => {
          loader.load(
            this.url,
            (asset) => {
              const model = type === 'fbx' ? asset : asset.scene;
              model.updateMatrixWorld(true);
              const box = new THREE.Box3().setFromObject(model);
              const size = box.getSize(new THREE.Vector3());
              const maxDimension = Math.max(size.x, size.y, size.z, 1e-6);
              const scale = (PLANET_RADIUS * 2) / maxDimension;
              model.scale.setScalar(scale);

              box.setFromObject(model);
              const center = box.getCenter(new THREE.Vector3());
              model.position.sub(center);

              model.traverse((child) => {
                if (child instanceof THREE.Mesh) {
                  child.castShadow = false;
                  child.receiveShadow = false;
                }
              });

              this.group.clear();
              this.group.add(model);
              this.isLoaded = true;
              resolve(true);
            },
            undefined,
            () => resolve(false),
          );
        });
      })
      .catch(() => false);

    return this.loaderPromise;
  }

  update(elapsed) {
    if (!this.group.visible || !this.isLoaded) return;
    this.group.rotation.y = elapsed * this.spinSpeed;
  }

  dispose() {
    this.group.traverse((child) => {
      if (!(child instanceof THREE.Mesh)) return;
      child.geometry?.dispose?.();
      if (Array.isArray(child.material)) {
        child.material.forEach((m) => m?.dispose?.());
      } else {
        child.material?.dispose?.();
      }
    });
    this.scene.remove(this.group);
  }
}
