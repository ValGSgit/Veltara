/**
 * ProceduralEarth — fully procedural Earth, no model download required.
 *
 * Replaces the 56 MB earth-00.glb. All textures are generated at load time from
 * seeded 3D value noise sampled on the sphere (so there is no seam at the
 * texture wrap). Implements the same interface as PlanetModel:
 *   group, isLoaded, setVisible(), loadIfNeeded({ onProgress }), update(elapsed), setSunDirection(dir)
 */

import * as THREE from 'three';
import { PLANET_RADIUS } from '@veltara/shared';

// ─── Seeded 3D value noise ────────────────────────────────────────────────────

function hash3(ix, iy, iz, seed) {
  let h = Math.imul(ix, 374761393) ^ Math.imul(iy, 668265263) ^ Math.imul(iz, 1440662683) ^ Math.imul(seed, 144665);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967295;
}

function smooth(t) {
  return t * t * (3 - 2 * t);
}

function valueNoise3(x, y, z, seed) {
  const ix = Math.floor(x); const iy = Math.floor(y); const iz = Math.floor(z);
  const fx = smooth(x - ix); const fy = smooth(y - iy); const fz = smooth(z - iz);

  const c000 = hash3(ix, iy, iz, seed);
  const c100 = hash3(ix + 1, iy, iz, seed);
  const c010 = hash3(ix, iy + 1, iz, seed);
  const c110 = hash3(ix + 1, iy + 1, iz, seed);
  const c001 = hash3(ix, iy, iz + 1, seed);
  const c101 = hash3(ix + 1, iy, iz + 1, seed);
  const c011 = hash3(ix, iy + 1, iz + 1, seed);
  const c111 = hash3(ix + 1, iy + 1, iz + 1, seed);

  const x00 = c000 + (c100 - c000) * fx;
  const x10 = c010 + (c110 - c010) * fx;
  const x01 = c001 + (c101 - c001) * fx;
  const x11 = c011 + (c111 - c011) * fx;
  const y0 = x00 + (x10 - x00) * fy;
  const y1 = x01 + (x11 - x01) * fy;
  return y0 + (y1 - y0) * fz;
}

function fbm3(x, y, z, seed, octaves = 5, lacunarity = 2.0, gain = 0.5) {
  let sum = 0;
  let amp = 0.5;
  let freq = 1;
  for (let i = 0; i < octaves; i++) {
    sum += valueNoise3(x * freq, y * freq, z * freq, seed + i * 131) * amp;
    amp *= gain;
    freq *= lacunarity;
  }
  return sum; // ~[0, 1)
}

// ─── Texture generation ──────────────────────────────────────────────────────

const TEX_W = 1024;
const TEX_H = 512;
const SEED = 1337;

/**
 * Generates day map (land/ocean in RGB, land mask in alpha for ocean specular),
 * night map (city lights), and cloud map in a single pass over the pixels.
 * Chunked by rows via setTimeout so the loading bar can animate.
 *
 * Uses DataTexture rather than canvas: canvas putImageData premultiplies alpha,
 * which would zero out ocean RGB (ocean has alpha 0 in the land-mask channel).
 */
async function generateEarthTextures(onRowProgress) {
  const dayData = new Uint8Array(TEX_W * TEX_H * 4);
  const nightData = new Uint8Array(TEX_W * TEX_H * 4);
  const cloudData = new Uint8Array(TEX_W * TEX_H * 4);

  const ROWS_PER_CHUNK = 32;

  for (let yStart = 0; yStart < TEX_H; yStart += ROWS_PER_CHUNK) {
    const yEnd = Math.min(yStart + ROWS_PER_CHUNK, TEX_H);

    for (let y = yStart; y < yEnd; y++) {
      const v = y / (TEX_H - 1);
      const lat = (v - 0.5) * Math.PI; // row 0 = south pole (UV v=0 is the bottom)
      const cosLat = Math.cos(lat);
      const sinLat = Math.sin(lat);

      for (let x = 0; x < TEX_W; x++) {
        const u = x / TEX_W;
        const lon = (u - 0.5) * Math.PI * 2;
        // Unit sphere direction — sampling noise in 3D avoids the wrap seam
        const px = cosLat * Math.cos(lon);
        const py = sinLat;
        const pz = cosLat * Math.sin(lon);

        // Continents: broad fbm + finer detail for coastlines
        const continent = fbm3(px * 1.7, py * 1.7, pz * 1.7, SEED, 4)
          + 0.35 * fbm3(px * 5.0, py * 5.0, pz * 5.0, SEED + 7, 4)
          - 0.18;
        const isLand = continent > 0.52;
        const elevation = fbm3(px * 6.0, py * 6.0, pz * 6.0, SEED + 23, 4);
        const moisture = fbm3(px * 3.1, py * 3.1, pz * 3.1, SEED + 51, 4);

        // Polar ice with a noisy edge
        const iceEdge = 0.86 + 0.08 * (fbm3(px * 4.0, py * 4.0, pz * 4.0, SEED + 99, 3) - 0.5);
        const isIce = Math.abs(sinLat) > iceEdge;

        let r; let g; let b;
        if (isIce) {
          const shade = 235 + elevation * 20;
          r = shade; g = shade + 4; b = 255;
        } else if (isLand) {
          // Lowlands green → highlands brown → peaks grey, drier = more tan
          const dry = Math.max(0, 0.6 - moisture);
          if (elevation > 0.62) {
            const t = (elevation - 0.62) / 0.38;
            r = 120 + t * 90; g = 110 + t * 85; b = 100 + t * 90;
          } else {
            r = 52 + dry * 150 + elevation * 40;
            g = 96 + dry * 80 + elevation * 30;
            b = 44 + dry * 50;
          }
        } else {
          // Ocean: deeper = darker; shallows near coastlines
          const depth = Math.min(1, (0.52 - continent) * 6);
          r = 12 + (1 - depth) * 38;
          g = 36 + (1 - depth) * 70;
          b = 84 + (1 - depth) * 110;
        }

        const i = (y * TEX_W + x) * 4;
        dayData[i] = r;
        dayData[i + 1] = g;
        dayData[i + 2] = b;
        // Alpha channel = land mask (255 land/ice, 0 ocean) → ocean-only specular
        dayData[i + 3] = isLand || isIce ? 255 : 0;

        // City lights: warm clusters on temperate, non-ice land
        let lights = 0;
        if (isLand && !isIce && elevation < 0.62) {
          const cluster = fbm3(px * 9.0, py * 9.0, pz * 9.0, SEED + 401, 4);
          const speckle = hash3(x, y, 0, SEED + 777);
          lights = Math.max(0, cluster - 0.58) * 5.5;
          if (lights > 0.05 && speckle > 0.82) lights += 0.5; // individual bright spots
          lights = Math.min(1, lights);
        }
        nightData[i] = 255 * lights;
        nightData[i + 1] = 214 * lights;
        nightData[i + 2] = 145 * lights;
        nightData[i + 3] = 255;

        // Clouds: banded fbm, thinned out so continents stay readable
        const cloudBand = 1 - Math.abs(sinLat) * 0.35;
        const cloud = fbm3(px * 2.6 + 13.7, py * 2.6, pz * 2.6, SEED + 303, 5);
        const coverage = Math.max(0, (cloud * cloudBand - 0.52) * 3.2);
        const alpha = Math.min(1, coverage);
        cloudData[i] = 255;
        cloudData[i + 1] = 255;
        cloudData[i + 2] = 255;
        cloudData[i + 3] = 255 * alpha;
      }
    }

    onRowProgress?.(yEnd / TEX_H);
    // Yield to the event loop so the loading screen can repaint
    await new Promise((resolve) => setTimeout(resolve, 0));
  }

  const toTexture = (data) => {
    const texture = new THREE.DataTexture(data, TEX_W, TEX_H, THREE.RGBAFormat);
    texture.wrapS = THREE.RepeatWrapping;
    texture.magFilter = THREE.LinearFilter;
    texture.minFilter = THREE.LinearMipmapLinearFilter;
    texture.generateMipmaps = true;
    texture.anisotropy = 8;
    texture.needsUpdate = true;
    return texture;
  };

  return {
    dayMap: toTexture(dayData),
    nightMap: toTexture(nightData),
    cloudMap: toTexture(cloudData),
  };
}

// ─── Shared shader chunks ─────────────────────────────────────────────────────

const WORLD_VERTEX_SHADER = /* glsl */ `
  varying vec3 vWorldPos;
  varying vec3 vWorldNormal;
  varying vec2 vUv;
  void main() {
    vec4 worldPos = modelMatrix * vec4(position, 1.0);
    vWorldPos = worldPos.xyz;
    vWorldNormal = normalize(mat3(modelMatrix) * normal);
    vUv = uv;
    gl_Position = projectionMatrix * viewMatrix * worldPos;
  }
`;

// ─── ProceduralEarth ──────────────────────────────────────────────────────────

export class ProceduralEarth {
  constructor(scene, options = {}) {
    this.scene = scene;
    this.spinSpeed = Number(options.spinSpeed ?? 0.0028);
    this.cloudDrift = Number(options.cloudDrift ?? 0.35); // relative extra cloud spin
    this.group = new THREE.Group();
    this.group.name = 'procedural-earth-root';
    this.scene.add(this.group);
    this.isLoaded = false;
    this.loaderPromise = null;
    this.sunDirection = new THREE.Vector3(1, 0.3, 0.5).normalize();
    this._surface = null;
    this._cloudMesh = null;
    this._uniformsHolders = [];
  }

  setVisible(visible) {
    this.group.visible = Boolean(visible);
  }

  setSunDirection(dir) {
    this.sunDirection.copy(dir).normalize();
    this._uniformsHolders.forEach((uniforms) => {
      uniforms.uSunDirection.value.copy(this.sunDirection);
    });
  }

  async loadIfNeeded(options = {}) {
    const onProgress = typeof options.onProgress === 'function' ? options.onProgress : null;
    if (this.isLoaded) return true;
    if (this.loaderPromise) return this.loaderPromise;

    this.loaderPromise = this._build(onProgress)
      .then(() => {
        this.isLoaded = true;
        onProgress?.({ loaded: 1, total: 1, ratio: 1 });
        return true;
      })
      .catch(() => {
        this.loaderPromise = null;
        return false;
      });

    return this.loaderPromise;
  }

  async _build(onProgress) {
    const { dayMap, nightMap, cloudMap } = await generateEarthTextures((ratio) => {
      onProgress?.({ loaded: ratio, total: 1, ratio: ratio * 0.95 });
    });

    this._buildSurface(dayMap, nightMap);
    this._buildClouds(cloudMap);
    this._buildAtmosphere();
  }

  _buildSurface(dayMap, nightMap) {
    const geometry = new THREE.SphereGeometry(PLANET_RADIUS, 96, 96);
    const uniforms = {
      uDayMap: { value: dayMap },
      uNightMap: { value: nightMap },
      uSunDirection: { value: this.sunDirection.clone() },
    };
    const material = new THREE.ShaderMaterial({
      uniforms,
      vertexShader: WORLD_VERTEX_SHADER,
      fragmentShader: /* glsl */ `
        uniform sampler2D uDayMap;
        uniform sampler2D uNightMap;
        uniform vec3 uSunDirection;
        varying vec3 vWorldPos;
        varying vec3 vWorldNormal;
        varying vec2 vUv;
        void main() {
          vec3 n = normalize(vWorldNormal);
          vec3 sunDir = normalize(uSunDirection);
          vec3 viewDir = normalize(cameraPosition - vWorldPos);

          vec4 day = texture2D(uDayMap, vUv);
          vec3 lights = texture2D(uNightMap, vUv).rgb;

          float sunDot = dot(n, sunDir);
          float dayMix = smoothstep(-0.12, 0.18, sunDot);

          // Ocean-only specular glint (land mask stored in day alpha)
          vec3 halfDir = normalize(viewDir + sunDir);
          float spec = pow(max(dot(n, halfDir), 0.0), 48.0)
            * (1.0 - day.a) * max(sunDot, 0.0) * 0.55;

          vec3 dayColor = day.rgb * (0.16 + 1.05 * max(sunDot, 0.0))
            + vec3(1.0, 0.95, 0.82) * spec;
          vec3 nightColor = day.rgb * 0.035 + lights * 1.7;
          vec3 color = mix(nightColor, dayColor, dayMix);

          // Warm tint along the terminator
          float twilight = exp(-pow(sunDot * 4.0, 2.0));
          color += vec3(0.45, 0.18, 0.04) * twilight * 0.22;

          gl_FragColor = vec4(color, 1.0);
        }
      `,
    });
    this._surface = new THREE.Mesh(geometry, material);
    this._surface.name = 'earth-surface';
    this.group.add(this._surface);
    this._uniformsHolders.push(uniforms);
  }

  _buildClouds(cloudMap) {
    const geometry = new THREE.SphereGeometry(PLANET_RADIUS * 1.015, 96, 96);
    const uniforms = {
      uCloudMap: { value: cloudMap },
      uSunDirection: { value: this.sunDirection.clone() },
    };
    const material = new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      uniforms,
      vertexShader: WORLD_VERTEX_SHADER,
      fragmentShader: /* glsl */ `
        uniform sampler2D uCloudMap;
        uniform vec3 uSunDirection;
        varying vec3 vWorldNormal;
        varying vec2 vUv;
        void main() {
          vec3 n = normalize(vWorldNormal);
          float sunDot = dot(n, normalize(uSunDirection));
          float dayMix = smoothstep(-0.15, 0.2, sunDot);

          float cover = texture2D(uCloudMap, vUv).a;
          vec3 color = mix(vec3(0.06, 0.07, 0.1), vec3(1.0), dayMix);
          gl_FragColor = vec4(color, cover * (0.25 + 0.6 * dayMix));
        }
      `,
    });
    this._cloudMesh = new THREE.Mesh(geometry, material);
    this._cloudMesh.name = 'earth-clouds';
    this.group.add(this._cloudMesh);
    this._uniformsHolders.push(uniforms);
  }

  _buildAtmosphere() {
    // Outer wide halo + tight inner rim — same two-layer recipe the previous
    // GLB Earth shipped with, so the in-game look stays consistent.
    const outer = this._makeAtmosphereLayer({
      radius: PLANET_RADIUS * 1.08,
      rimPower: 1.6,
      strength: 0.9,
      twilight: true,
      name: 'earth-atmosphere-outer',
    });
    const inner = this._makeAtmosphereLayer({
      radius: PLANET_RADIUS * 1.025,
      rimPower: 3.4,
      strength: 0.5,
      twilight: false,
      name: 'earth-atmosphere-inner',
    });
    this.group.add(outer, inner);
  }

  _makeAtmosphereLayer({ radius, rimPower, strength, twilight, name }) {
    const geometry = new THREE.SphereGeometry(radius, 96, 96);
    const uniforms = {
      uSunDirection: { value: this.sunDirection.clone() },
      uRimPower: { value: rimPower },
      uStrength: { value: strength },
      uTwilight: { value: twilight ? 1.0 : 0.0 },
    };
    const material = new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      side: THREE.BackSide,
      uniforms,
      vertexShader: WORLD_VERTEX_SHADER,
      fragmentShader: /* glsl */ `
        uniform vec3 uSunDirection;
        uniform float uRimPower;
        uniform float uStrength;
        uniform float uTwilight;
        varying vec3 vWorldPos;
        varying vec3 vWorldNormal;
        void main() {
          vec3 viewDir = normalize(cameraPosition - vWorldPos);
          vec3 n = normalize(vWorldNormal);
          vec3 sunDir = normalize(uSunDirection);

          float facing = max(dot(viewDir, n), 0.0);
          float rim = pow(1.0 - facing, uRimPower);

          float sunDot = dot(n, sunDir);
          float sunSide = sunDot * 0.5 + 0.5;
          float terminator = exp(-pow(sunDot + 0.1, 2.0) * 8.0);

          vec3 color = mix(vec3(0.18, 0.45, 0.95), vec3(0.45, 0.72, 1.0), clamp(rim, 0.0, 1.0));
          color = mix(color, vec3(1.0, 0.38, 0.14), clamp(terminator, 0.0, 1.0) * uTwilight);

          float alpha = rim * uStrength * (0.3 + sunSide * 0.7);
          gl_FragColor = vec4(color, clamp(alpha, 0.0, 1.0));
        }
      `,
    });
    const mesh = new THREE.Mesh(geometry, material);
    mesh.name = name;
    this._uniformsHolders.push(uniforms);
    return mesh;
  }

  update(elapsed) {
    if (!this.group.visible || !this.isLoaded) return;
    if (this._surface) this._surface.rotation.y = elapsed * this.spinSpeed;
    if (this._cloudMesh) this._cloudMesh.rotation.y = elapsed * this.spinSpeed * (1 + this.cloudDrift);
  }

  dispose() {
    this.group.traverse((child) => {
      if (child instanceof THREE.Mesh) {
        child.geometry?.dispose?.();
        const materials = Array.isArray(child.material) ? child.material : [child.material];
        materials.forEach((m) => {
          Object.values(m?.uniforms ?? {}).forEach((u) => u?.value?.dispose?.());
          m?.dispose?.();
        });
      }
    });
    this.scene.remove(this.group);
    this._uniformsHolders = [];
  }
}
