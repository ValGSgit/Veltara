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
    this._lights = [];
  }

  detectFormat(url) {
    const lower = String(url ?? '').toLowerCase();
    if (lower.endsWith('.fbx')) return 'fbx';
    return 'gltf';
  }

  setVisible(visible) {
    this.group.visible = Boolean(visible);
    this._lights.forEach((l) => { l.visible = Boolean(visible); });
  }

  // ─── Texture Helpers ────────────────────────────────────────────────────────

  createRadialTexture(stops, size = 512) {
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d');
    const half = size / 2;
    const gradient = ctx.createRadialGradient(half, half, 0, half, half, half);
    stops.forEach(([offset, color]) => gradient.addColorStop(offset, color));
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, size, size);
    const texture = new THREE.CanvasTexture(canvas);
    texture.needsUpdate = true;
    return texture;
  }

  createRingTexture(size = 256) {
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = 1;
    const ctx = canvas.getContext('2d');
    const gradient = ctx.createLinearGradient(0, 0, size, 0);
    gradient.addColorStop(0.0, 'rgba(255, 220, 140, 0.0)');
    gradient.addColorStop(0.15, 'rgba(255, 200, 100, 0.9)');
    gradient.addColorStop(0.3, 'rgba(255, 140, 60, 1.0)');
    gradient.addColorStop(0.5, 'rgba(200, 80, 30, 0.8)');
    gradient.addColorStop(0.7, 'rgba(120, 40, 160, 0.5)');
    gradient.addColorStop(0.85, 'rgba(60, 20, 120, 0.2)');
    gradient.addColorStop(1.0, 'rgba(20, 5, 40, 0.0)');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, size, 1);
    const texture = new THREE.CanvasTexture(canvas);
    texture.needsUpdate = true;
    return texture;
  }

  // ─── Material Enhancement ───────────────────────────────────────────────────

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
          // r128 uses encoding, not colorSpace
          material.map.encoding = THREE.sRGBEncoding;
          material.map.anisotropy = 8;
        }
        if ('emissiveMap' in material && material.emissiveMap) {
          material.emissiveMap.encoding = THREE.sRGBEncoding;
          material.emissiveMap.anisotropy = 8;
        }

        // Black hole model — make surfaces dark and emissive
        if (this.appearance === 'black-hole') {
          material.toneMapped = false;
          if (material.isMeshStandardMaterial || material.isMeshPhongMaterial) {
            material.emissiveIntensity = Math.max(material.emissiveIntensity ?? 0, 0.6);
          }
        }

        material.needsUpdate = true;
      });
    });
  }
  // ─── Black Hole Effects (overhauled) ────────────────────────────────────────

  buildBlackHoleEffects() {
    // ── 1. Dark event horizon core ──
    const coreGeo = new THREE.SphereGeometry(PLANET_RADIUS * 0.42, 48, 48);
    const coreMat = new THREE.MeshBasicMaterial({
      color: 0x000000,
      depthWrite: true,
    });
    const core = new THREE.Mesh(coreGeo, coreMat);
    core.name = 'bh-core';
    core.renderOrder = -1;

    // ── 2. Hot inner core glow ──
    const hotCoreTexture = this.createRadialTexture([
      [0.0, 'rgba(255, 255, 240, 0.95)'],
      [0.08, 'rgba(255, 220, 160, 0.7)'],
      [0.25, 'rgba(255, 140, 60, 0.3)'],
      [0.5, 'rgba(180, 60, 200, 0.08)'],
      [1.0, 'rgba(0, 0, 0, 0)'],
    ], 512);
    const hotCore = new THREE.Sprite(new THREE.SpriteMaterial({
      map: hotCoreTexture,
      color: 0xffdda0,
      transparent: true,
      opacity: 0.45,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      toneMapped: false,
    }));
    hotCore.scale.setScalar(PLANET_RADIUS * 2.2);
    hotCore.name = 'bh-hot-core';

    // ── 3. Corona glow (warm orange) ──
    const coronaTexture = this.createRadialTexture([
      [0.0, 'rgba(255, 240, 210, 0.8)'],
      [0.1, 'rgba(255, 180, 100, 0.5)'],
      [0.3, 'rgba(255, 120, 60, 0.2)'],
      [0.55, 'rgba(160, 60, 180, 0.08)'],
      [1.0, 'rgba(0, 0, 0, 0)'],
    ], 512);
    const corona = new THREE.Sprite(new THREE.SpriteMaterial({
      map: coronaTexture,
      color: 0xffb88a,
      transparent: true,
      opacity: 0.32,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      toneMapped: false,
    }));
    corona.scale.setScalar(PLANET_RADIUS * 4.8);
    corona.name = 'bh-corona';

    // ── 4. Wide purple lens flare ──
    const lensTexture = this.createRadialTexture([
      [0.0, 'rgba(140, 100, 255, 0.5)'],
      [0.2, 'rgba(100, 60, 200, 0.25)'],
      [0.5, 'rgba(60, 20, 140, 0.08)'],
      [1.0, 'rgba(0, 0, 0, 0)'],
    ], 512);
    const lens = new THREE.Sprite(new THREE.SpriteMaterial({
      map: lensTexture,
      color: 0x9070ff,
      transparent: true,
      opacity: 0.22,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      toneMapped: false,
    }));
    lens.scale.setScalar(PLANET_RADIUS * 7.0);
    lens.name = 'bh-lens';

    // ── 5. Main accretion ring with shader ──
    const ringGeo = new THREE.TorusGeometry(PLANET_RADIUS * 1.6, PLANET_RADIUS * 0.22, 4, 200);
    const ringMat = new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      side: THREE.DoubleSide,
      toneMapped: false,
      uniforms: {
        uTime: { value: 0 },
      },
      vertexShader: /* glsl */ `
        varying vec2 vUv;
        varying float vAngle;
        void main() {
          vUv = uv;
          // Compute angle around the torus for color gradient
          vAngle = atan(position.z, position.x);
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: /* glsl */ `
        uniform float uTime;
        varying vec2 vUv;
        varying float vAngle;
        void main() {
          // Radial position in tube cross-section (0=inner, 1=outer)
          float tubeDist = abs(vUv.y - 0.5) * 2.0;

          // Hot inner → cool outer color gradient
          vec3 hotColor = vec3(1.0, 0.85, 0.5);   // bright yellow-white
          vec3 midColor = vec3(1.0, 0.45, 0.15);   // orange
          vec3 coolColor = vec3(0.5, 0.15, 0.7);   // purple

          vec3 color = mix(hotColor, midColor, smoothstep(0.0, 0.5, tubeDist));
          color = mix(color, coolColor, smoothstep(0.4, 1.0, tubeDist));

          // Animated brightness variation around the ring
          float wave = sin(vAngle * 3.0 + uTime * 2.5) * 0.15 + 0.85;
          float flicker = sin(vAngle * 7.0 - uTime * 4.0) * 0.08 + 0.92;

          // Fade at tube edges
          float edgeFade = 1.0 - smoothstep(0.6, 1.0, tubeDist);

          float alpha = edgeFade * wave * flicker * 0.55;
          gl_FragColor = vec4(color * 1.4, alpha);
        }
      `,
    });
    const ring = new THREE.Mesh(ringGeo, ringMat);
    ring.rotation.x = Math.PI * 0.44;
    ring.name = 'bh-ring';

    // ── 6. Secondary thin outer ring ──
    const ring2Geo = new THREE.TorusGeometry(PLANET_RADIUS * 2.3, PLANET_RADIUS * 0.06, 3, 180);
    const ring2Mat = new THREE.MeshBasicMaterial({
      color: 0xcc70ff,
      transparent: true,
      opacity: 0.12,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      side: THREE.DoubleSide,
      toneMapped: false,
    });
    const ring2 = new THREE.Mesh(ring2Geo, ring2Mat);
    ring2.rotation.x = Math.PI * 0.44;
    ring2.name = 'bh-ring-outer';

    // ── 7. Gravitational lensing ring (bright edge halo) ──
    const lensRingGeo = new THREE.RingGeometry(PLANET_RADIUS * 0.95, PLANET_RADIUS * 1.15, 96);
    const lensRingMat = new THREE.MeshBasicMaterial({
      color: 0xffeedd,
      transparent: true,
      opacity: 0.14,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      side: THREE.DoubleSide,
      toneMapped: false,
    });
    const lensRing = new THREE.Mesh(lensRingGeo, lensRingMat);
    lensRing.name = 'bh-lens-ring';

    // ── 8. Particle streams (orbiting debris) ──
    const particleCount = 600;
    const pPositions = new Float32Array(particleCount * 3);
    const pColors = new Float32Array(particleCount * 3);
    const pSizes = new Float32Array(particleCount);
    const pAngles = new Float32Array(particleCount);   // store initial angle
    const pRadii = new Float32Array(particleCount);    // orbital radius
    const pSpeeds = new Float32Array(particleCount);   // orbital speed

    for (let i = 0; i < particleCount; i++) {
      const angle = Math.random() * Math.PI * 2;
      const r = PLANET_RADIUS * (0.9 + Math.random() * 1.8);
      const y = (Math.random() - 0.5) * PLANET_RADIUS * 0.35;

      pPositions[i * 3] = Math.cos(angle) * r;
      pPositions[i * 3 + 1] = y;
      pPositions[i * 3 + 2] = Math.sin(angle) * r;

      pAngles[i] = angle;
      pRadii[i] = r;
      // Kepler-ish: inner orbits faster
      pSpeeds[i] = (0.3 + Math.random() * 0.5) / Math.max(r / PLANET_RADIUS, 0.5);

      const t = Math.random();
      const c = new THREE.Color().lerpColors(
        new THREE.Color(0xffcc80),
        new THREE.Color(0x8844cc),
        t,
      );
      pColors[i * 3] = c.r;
      pColors[i * 3 + 1] = c.g;
      pColors[i * 3 + 2] = c.b;

      pSizes[i] = 1.0 + Math.random() * 2.5;
    }

    const pGeo = new THREE.BufferGeometry();
    pGeo.setAttribute('position', new THREE.BufferAttribute(pPositions, 3));
    pGeo.setAttribute('color', new THREE.BufferAttribute(pColors, 3));
    pGeo.setAttribute('size', new THREE.BufferAttribute(pSizes, 1));

    const pMat = new THREE.PointsMaterial({
      size: 0.12,
      vertexColors: true,
      transparent: true,
      opacity: 0.6,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      sizeAttenuation: true,
    });
    const particles = new THREE.Points(pGeo, pMat);
    particles.rotation.x = Math.PI * 0.44; // same tilt as accretion ring
    particles.name = 'bh-particles';

    // ── 9. Jet streams (polar plasma jets) ──
    const jetGeo = new THREE.ConeGeometry(PLANET_RADIUS * 0.08, PLANET_RADIUS * 3.5, 8, 1, true);
    const jetMat = new THREE.MeshBasicMaterial({
      color: 0x88aaff,
      transparent: true,
      opacity: 0.06,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      side: THREE.DoubleSide,
      toneMapped: false,
    });
    const jetUp = new THREE.Mesh(jetGeo, jetMat.clone());
    jetUp.position.y = PLANET_RADIUS * 2.0;
    jetUp.name = 'bh-jet-up';

    const jetDown = new THREE.Mesh(jetGeo, jetMat.clone());
    jetDown.position.y = -PLANET_RADIUS * 2.0;
    jetDown.rotation.z = Math.PI;
    jetDown.name = 'bh-jet-down';

    this.group.add(core, hotCore, corona, lens, ring, ring2, lensRing, particles, jetUp, jetDown);
    this._effectRoots.push(core, hotCore, corona, lens, ring, ring2, lensRing, particles, jetUp, jetDown);

    this._blackHoleEffects = {
      core, hotCore, corona, lens, ring, ringMat, ring2, lensRing,
      particles, pAngles, pRadii, pSpeeds,
      jetUp, jetDown,
    };
  }

  // ��── Black Hole Lighting ───────────��────────────────────────────────────────

  buildBlackHoleLighting() {
    // Point light inside the accretion glow
    const accretionGlow = new THREE.PointLight(0xff8844, 1.5, PLANET_RADIUS * 12);
    accretionGlow.position.set(0, 0, 0);
    accretionGlow.name = 'bh-glow-light';
    this.scene.add(accretionGlow);

    // Subtle rim light from behind
    const rim = new THREE.DirectionalLight(0x6644aa, 0.3);
    rim.position.set(-10, 5, -10);
    rim.name = 'bh-rim';
    this.scene.add(rim);

    this._lights.push(accretionGlow, rim);
  }

  // ─── Model Loading ────────────��───────────────────────���─────────────────────

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
                this.buildBlackHoleLighting();
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
        if (!result) this.loaderPromise = null;
        return result;
      });

    return this.loaderPromise;
  }

  // ─── Per-Frame Update ─────────────��─────────────────────────────────────────

  update(elapsed) {
    if (!this.group.visible || !this.isLoaded) return;
    this.group.rotation.y = elapsed * this.spinSpeed;

    if (this._blackHoleEffects) {
      this._updateBlackHole(elapsed);
    }
  }

  _updateBlackHole(elapsed) {
    const fx = this._blackHoleEffects;

    // Pulsing glow
    const pulse = 0.94 + Math.sin(elapsed * 1.8) * 0.06;
    const pulse2 = 0.97 + Math.sin(elapsed * 2.6 + 1.0) * 0.03;

    fx.hotCore.scale.setScalar(PLANET_RADIUS * 2.2 * pulse);
    fx.hotCore.material.opacity = 0.38 + Math.sin(elapsed * 3.0) * 0.08;

    fx.corona.scale.setScalar(PLANET_RADIUS * 4.8 * pulse2);
    fx.corona.material.opacity = 0.28 + Math.sin(elapsed * 2.1) * 0.06;

    fx.lens.scale.setScalar(PLANET_RADIUS * 7.0 * (1.03 - (pulse - 0.94) * 0.3));
    fx.lens.material.opacity = 0.18 + Math.cos(elapsed * 1.5) * 0.05;

    // Accretion ring rotation + shader time
    fx.ring.rotation.z = elapsed * 0.35;
    fx.ringMat.uniforms.uTime.value = elapsed;
    fx.ring2.rotation.z = elapsed * -0.18;

    // Lensing ring subtle pulse
    fx.lensRing.material.opacity = 0.10 + Math.sin(elapsed * 2.5) * 0.05;

    // Orbit particles
    const positions = fx.particles.geometry.attributes.position.array;
    const count = positions.length / 3;
    for (let i = 0; i < count; i++) {
      const angle = fx.pAngles[i] + elapsed * fx.pSpeeds[i];
      const r = fx.pRadii[i];
      const wobble = Math.sin(elapsed * 1.5 + i * 0.1) * PLANET_RADIUS * 0.03;
      positions[i * 3] = Math.cos(angle) * r;
      positions[i * 3 + 1] = wobble;
      positions[i * 3 + 2] = Math.sin(angle) * r;
    }
    fx.particles.geometry.attributes.position.needsUpdate = true;

    // Jet pulse
    const jetScale = 1.0 + Math.sin(elapsed * 2.0) * 0.15;
    fx.jetUp.scale.set(1, jetScale, 1);
    fx.jetDown.scale.set(1, jetScale, 1);
    fx.jetUp.material.opacity = 0.04 + Math.sin(elapsed * 3.2) * 0.03;
    fx.jetDown.material.opacity = 0.04 + Math.sin(elapsed * 3.2 + 0.5) * 0.03;
  }

  // ─── Cleanup ───────────────────────────────────────────���────────────────────

  dispose() {
    this._lights.forEach((l) => this.scene.remove(l));
    this._lights = [];

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
      } else if (child instanceof THREE.Points) {
        child.geometry?.dispose?.();
        child.material?.dispose?.();
      }
    });
    this.scene.remove(this.group);
  }
}
