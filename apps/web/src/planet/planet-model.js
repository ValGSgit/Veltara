import * as THREE from 'three';
import { PLANET_RADIUS } from '@veltara/shared';

export class PlanetModel {
  constructor(scene, url, options = {}) {
    this.scene = scene;
    this.url = url;
    this.format = String(options.format ?? '').toLowerCase() || this.detectFormat(url);
    this.spinSpeed = Number(options.spinSpeed ?? 0.003);
    this.appearance = String(options.appearance ?? 'default').toLowerCase();
    this.scaleMultiplier = Number(options.scaleMultiplier ?? 1);
    this.group = new THREE.Group();
    this.group.name = 'planet-model-root';
    this.scene.add(this.group);
    this.isLoaded = false;
    this.loaderPromise = null;
    this.lastProgress = null;
    this._effectRoots = [];
    this._blackHoleEffects = null;
  }

  detectFormat(url) {
    const lower = String(url ?? '').toLowerCase();
    if (lower.endsWith('.fbx')) return 'fbx';
    return 'gltf';
  }

  setVisible(visible) {
    this.group.visible = Boolean(visible);
  }

  createRadialTexture(stops) {
    const canvas = document.createElement('canvas');
    canvas.width = 256;
    canvas.height = 256;
    const ctx = canvas.getContext('2d');
    const gradient = ctx.createRadialGradient(128, 128, 0, 128, 128, 128);
    stops.forEach(([offset, color]) => gradient.addColorStop(offset, color));
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, 256, 256);
    const texture = new THREE.CanvasTexture(canvas);
    texture.needsUpdate = true;
    return texture;
  }

  applyMaterialProfile(model) {
    model.traverse((child) => {
      if (!(child instanceof THREE.Mesh)) return;
      child.castShadow = false;
      child.receiveShadow = false;

      const materials = Array.isArray(child.material) ? child.material : [child.material];
      materials.forEach((material) => {
        if (!material) return;
        material.depthWrite = true;
        material.depthTest = true;
        material.toneMapped = true;
        if ('map' in material && material.map) {
          material.map.colorSpace = THREE.SRGBColorSpace;
          material.map.anisotropy = 8;
        }
        if ('emissiveMap' in material && material.emissiveMap) {
          material.emissiveMap.colorSpace = THREE.SRGBColorSpace;
          material.emissiveMap.anisotropy = 8;
        }
        material.needsUpdate = true;
      });
    });
  }

  buildEarthAtmosphere() {
    const geometry = new THREE.SphereGeometry(PLANET_RADIUS * 1.042, 72, 72);
    const material = new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      side: THREE.BackSide,
      uniforms: {
        uColorA: { value: new THREE.Color('#58b9ff') },
        uColorB: { value: new THREE.Color('#9fe1ff') },
        uStrength: { value: 0.85 },
      },
      vertexShader: `
        varying vec3 vWorldPos;
        varying vec3 vWorldNormal;
        void main() {
          vec4 worldPos = modelMatrix * vec4(position, 1.0);
          vWorldPos = worldPos.xyz;
          vWorldNormal = normalize(mat3(modelMatrix) * normal);
          gl_Position = projectionMatrix * viewMatrix * worldPos;
        }
      `,
      fragmentShader: `
        uniform vec3 uColorA;
        uniform vec3 uColorB;
        uniform float uStrength;
        varying vec3 vWorldPos;
        varying vec3 vWorldNormal;
        void main() {
          vec3 viewDir = normalize(cameraPosition - vWorldPos);
          float rim = pow(1.0 - max(dot(viewDir, normalize(vWorldNormal)), 0.0), 2.4);
          vec3 color = mix(uColorA, uColorB, clamp(rim * 1.1, 0.0, 1.0));
          gl_FragColor = vec4(color, rim * uStrength);
        }
      `,
    });
    const atmosphere = new THREE.Mesh(geometry, material);
    atmosphere.name = 'earth-atmosphere';
    this.group.add(atmosphere);
    this._effectRoots.push(atmosphere);
  }

  buildBlackHoleEffects() {
    const outerTexture = this.createRadialTexture([
      [0.0, 'rgba(255, 244, 220, 0.86)'],
      [0.15, 'rgba(255, 170, 100, 0.45)'],
      [0.45, 'rgba(109, 54, 182, 0.14)'],
      [1.0, 'rgba(0, 0, 0, 0)'],
    ]);

    const corona = new THREE.Sprite(new THREE.SpriteMaterial({
      map: outerTexture,
      color: 0xffb07a,
      transparent: true,
      opacity: 0.28,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      toneMapped: true,
    }));
    corona.scale.setScalar(PLANET_RADIUS * 4.4);

    const lens = new THREE.Sprite(new THREE.SpriteMaterial({
      map: outerTexture,
      color: 0x8a63ff,
      transparent: true,
      opacity: 0.2,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      toneMapped: true,
    }));
    lens.scale.setScalar(PLANET_RADIUS * 6.2);

    const ring = new THREE.Mesh(
      new THREE.TorusGeometry(PLANET_RADIUS * 0.9, PLANET_RADIUS * 0.09, 24, 160),
      new THREE.MeshBasicMaterial({
        color: 0xff9a5f,
        transparent: true,
        opacity: 0.18,
        side: THREE.DoubleSide,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        toneMapped: true,
      }),
    );
    ring.rotation.x = Math.PI * 0.42;

    this.group.add(corona, lens, ring);
    this._effectRoots.push(corona, lens, ring);
    this._blackHoleEffects = { corona, lens, ring };
  }

  async loadIfNeeded(options = {}) {
    const onProgress = typeof options.onProgress === 'function' ? options.onProgress : null;
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
              const scale = ((PLANET_RADIUS * 2) / maxDimension) * this.scaleMultiplier;
              model.scale.setScalar(scale);

              box.setFromObject(model);
              const center = box.getCenter(new THREE.Vector3());
              model.position.sub(center);

              this.applyMaterialProfile(model);

              this.group.clear();
              this.group.add(model);
              this._effectRoots = [];
              this._blackHoleEffects = null;
              if (this.appearance === 'black-hole') {
                this.buildBlackHoleEffects();
              }
              this.isLoaded = true;
              this.lastProgress = { loaded: 1, total: 1, ratio: 1 };
              onProgress?.(this.lastProgress);
              resolve(true);
            },
            (event) => {
              const loaded = Number(event?.loaded ?? 0);
              const total = Number(event?.total ?? 0);
              const ratio = total > 0 ? Math.min(1, loaded / total) : null;
              this.lastProgress = { loaded, total, ratio };
              onProgress?.(this.lastProgress);
            },
            () => resolve(false),
          );
        });
      })
      .catch(() => false)
      .then((result) => {
        if (!result) this.loaderPromise = null; // allow retry on failure
        return result;
      });

    return this.loaderPromise;
  }

  update(elapsed) {
    if (!this.group.visible || !this.isLoaded) return;
    this.group.rotation.y = elapsed * this.spinSpeed;

    if (this._blackHoleEffects) {
      const pulse = 0.96 + Math.sin(elapsed * 1.8) * 0.04;
      this._blackHoleEffects.corona.scale.setScalar((PLANET_RADIUS * 4.4) * pulse);
      this._blackHoleEffects.lens.scale.setScalar((PLANET_RADIUS * 6.2) * (1.02 - (pulse - 0.96)));
      this._blackHoleEffects.ring.rotation.z = elapsed * 0.2;
      this._blackHoleEffects.corona.material.opacity = 0.24 + Math.sin(elapsed * 2.1) * 0.05;
      this._blackHoleEffects.lens.material.opacity = 0.17 + Math.cos(elapsed * 1.5) * 0.04;
    }
  }

  dispose() {
    this.group.traverse((child) => {
      if (child instanceof THREE.Mesh) {
        child.geometry?.dispose?.();
        if (Array.isArray(child.material)) {
          child.material.forEach((m) => {
            m?.map?.dispose?.();
            m?.dispose?.();
          });
        } else {
          child.material?.map?.dispose?.();
          child.material?.dispose?.();
        }
      } else if (child instanceof THREE.Sprite) {
        child.material?.map?.dispose?.();
        child.material?.dispose?.();
      }
    });
    this.scene.remove(this.group);
  }
}
