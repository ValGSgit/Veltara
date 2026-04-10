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
    this._appearanceLights = [];
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

        if ('metalness' in material && 'roughness' in material) {
          if (this.appearance === 'earth') {
            material.metalness = 0;
            material.roughness = Math.min(1, Math.max(0.2, material.roughness * 0.82));
            if ('color' in material && material.color instanceof THREE.Color) {
              material.color.offsetHSL(0, 0.14, 0.02);
            }
            if ('emissive' in material && material.emissive instanceof THREE.Color) {
              material.emissive.setRGB(0.045, 0.09, 0.12);
            }
            if ('emissiveIntensity' in material) {
              material.emissiveIntensity = 0.24;
            }
            if ('envMapIntensity' in material) {
              material.envMapIntensity = 1.45;
            }
          } else if (this.appearance === 'black-hole') {
            material.metalness = 0;
            material.roughness = 0.95;
            if ('color' in material && material.color instanceof THREE.Color) {
              material.color.multiplyScalar(0.5);
            }
            if ('emissive' in material && material.emissive instanceof THREE.Color) {
              material.emissive.setRGB(0.48, 0.24, 0.86);
            }
            if ('emissiveIntensity' in material) {
              material.emissiveIntensity = 1.25;
            }
            material.toneMapped = false;
          }
        }
        material.needsUpdate = true;
      });
    });
  }

  clearAppearanceLights() {
    this._appearanceLights.forEach((light) => this.group.remove(light));
    this._appearanceLights = [];
  }

  buildAppearanceLights() {
    this.clearAppearanceLights();
    if (this.appearance === 'earth') {
      const hemi = new THREE.HemisphereLight(0xb5dcff, 0x1b2a3d, 1.1);
      const key = new THREE.DirectionalLight(0xffffff, 2.1);
      key.position.set(16, 8, 10);
      const fill = new THREE.DirectionalLight(0x8ec6ff, 0.75);
      fill.position.set(-8, -3, -7);
      this.group.add(hemi, key, fill);
      this._appearanceLights.push(hemi, key, fill);
      return;
    }
    if (this.appearance === 'black-hole') {
      const rimA = new THREE.PointLight(0xff8b4a, 1.4, PLANET_RADIUS * 14, 2);
      rimA.position.set(0, PLANET_RADIUS * 1.8, PLANET_RADIUS * 1.4);
      const rimB = new THREE.PointLight(0x7f53ff, 1.2, PLANET_RADIUS * 15, 2);
      rimB.position.set(0, -PLANET_RADIUS * 1.6, -PLANET_RADIUS * 1.2);
      this.group.add(rimA, rimB);
      this._appearanceLights.push(rimA, rimB);
    }
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
      [0.0, 'rgba(255, 244, 220, 0.95)'],
      [0.1, 'rgba(255, 170, 100, 0.8)'],
      [0.32, 'rgba(255, 112, 56, 0.42)'],
      [0.58, 'rgba(109, 54, 182, 0.22)'],
      [1.0, 'rgba(0, 0, 0, 0)'],
    ]);

    const corona = new THREE.Sprite(new THREE.SpriteMaterial({
      map: outerTexture,
      color: 0xff9347,
      transparent: true,
      opacity: 0.76,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      toneMapped: false,
    }));
    corona.scale.setScalar(PLANET_RADIUS * 5.6);

    const hotCoreTexture = this.createRadialTexture([
      [0.0, 'rgba(255, 245, 220, 1)'],
      [0.2, 'rgba(255, 154, 76, 0.95)'],
      [0.45, 'rgba(255, 107, 45, 0.6)'],
      [1.0, 'rgba(0, 0, 0, 0)'],
    ]);
    const hotCore = new THREE.Sprite(new THREE.SpriteMaterial({
      map: hotCoreTexture,
      color: 0xff9f5c,
      transparent: true,
      opacity: 0.58,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      toneMapped: false,
    }));
    hotCore.scale.setScalar(PLANET_RADIUS * 2.3);

    const lens = new THREE.Sprite(new THREE.SpriteMaterial({
      map: outerTexture,
      color: 0x7f4dff,
      transparent: true,
      opacity: 0.46,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      toneMapped: false,
    }));
    lens.scale.setScalar(PLANET_RADIUS * 8.2);

    const eventHorizon = new THREE.Mesh(
      new THREE.SphereGeometry(PLANET_RADIUS * 0.48, 48, 48),
      new THREE.MeshBasicMaterial({
        color: 0x020106,
        side: THREE.FrontSide,
        toneMapped: false,
      }),
    );

    const ring = new THREE.Mesh(
      new THREE.TorusGeometry(PLANET_RADIUS * 0.74, PLANET_RADIUS * 0.16, 24, 160),
      new THREE.MeshBasicMaterial({
        color: 0xff9a5f,
        transparent: true,
        opacity: 0.52,
        side: THREE.DoubleSide,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        toneMapped: false,
      }),
    );
    ring.rotation.x = Math.PI * 0.37;

    const ringSecondary = new THREE.Mesh(
      new THREE.TorusGeometry(PLANET_RADIUS * 0.86, PLANET_RADIUS * 0.07, 20, 160),
      new THREE.MeshBasicMaterial({
        color: 0x8d57ff,
        transparent: true,
        opacity: 0.3,
        side: THREE.DoubleSide,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        toneMapped: false,
      }),
    );
    ringSecondary.rotation.x = Math.PI * 0.37;

    this.group.add(corona, hotCore, lens, eventHorizon, ring, ringSecondary);
    this._effectRoots.push(corona, hotCore, lens, eventHorizon, ring, ringSecondary);
    this._blackHoleEffects = { corona, hotCore, lens, eventHorizon, ring, ringSecondary };
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
              this.buildAppearanceLights();
              if (this.appearance === 'earth') {
                this.buildEarthAtmosphere();
              } else if (this.appearance === 'black-hole') {
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
      const pulse = 0.92 + Math.sin(elapsed * 2.2) * 0.08;
      this._blackHoleEffects.corona.scale.setScalar((PLANET_RADIUS * 5.6) * pulse);
      this._blackHoleEffects.hotCore.scale.setScalar((PLANET_RADIUS * 2.3) * (0.96 + Math.sin(elapsed * 3.1) * 0.07));
      this._blackHoleEffects.lens.scale.setScalar((PLANET_RADIUS * 8.2) * (1.04 - (pulse - 0.92)));
      this._blackHoleEffects.ring.rotation.z = elapsed * 0.32;
      this._blackHoleEffects.ringSecondary.rotation.z = -elapsed * 0.46;
      this._blackHoleEffects.corona.material.opacity = 0.66 + Math.sin(elapsed * 2.1) * 0.09;
      this._blackHoleEffects.hotCore.material.opacity = 0.52 + Math.cos(elapsed * 2.8) * 0.08;
      this._blackHoleEffects.lens.material.opacity = 0.37 + Math.cos(elapsed * 1.7) * 0.07;
      this._blackHoleEffects.eventHorizon.scale.setScalar(0.98 + Math.sin(elapsed * 1.3) * 0.01);
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
