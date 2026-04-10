/**
 * Planet engine — Three.js r128 planet with custom GLSL shaders,
 * biome system, clouds, atmosphere, day/night cycle, and LOD.
 */

import * as THREE from 'three';
import planetVert from './shaders/planet.vert.glsl?raw';
import planetFrag from './shaders/planet.frag.glsl?raw';
import atmosphereVert from './shaders/atmosphere.vert.glsl?raw';
import atmosphereFrag from './shaders/atmosphere.frag.glsl?raw';
import cloudsVert from './shaders/clouds.vert.glsl?raw';
import cloudsFrag from './shaders/clouds.frag.glsl?raw';
import { PLANET_RADIUS, ATMOSPHERE_RADIUS, CLOUD_LAYER_RADIUS, DAY_CYCLE_SECONDS } from '@veltara/shared';

export class Planet {
  /** @type {THREE.Scene} */
  scene;
  /** @type {THREE.Mesh} */
  mesh;
  /** @type {THREE.Mesh} */
  atmosphere;
  /** @type {THREE.Mesh} */
  clouds;
  /** @type {THREE.ShaderMaterial} */
  planetMaterial;
  /** @type {THREE.ShaderMaterial} */
  atmosphereMaterial;
  /** @type {THREE.ShaderMaterial} */
  cloudsMaterial;

  /** @type {THREE.Vector3} */
  sunDirection = new THREE.Vector3(1, 0.5, 0.8).normalize();

  startTime = Date.now();
  dayCycleProgress = 0.5;

  /**
   * @param {THREE.Scene} scene
   * @param {number} quality - 0=low, 1=medium, 2=high
   */
  constructor(scene, quality = 2) {
    this.scene = scene;

    const segments = quality === 0 ? 64 : quality === 1 ? 128 : 256;
    this._buildPlanet(segments);
    this._buildAtmosphere();
    this._buildClouds();
    this._buildStarfield();
    this._buildSun();
  }

  _buildPlanet(segments) {
    const geometry = new THREE.SphereGeometry(PLANET_RADIUS, segments, segments);

    this.planetMaterial = new THREE.ShaderMaterial({
      vertexShader: planetVert,
      fragmentShader: planetFrag,
      uniforms: {
        uTime: { value: 0 },
        uSunDirection: { value: this.sunDirection },
        uDayCycleProgress: { value: 0.5 },
      },
    });

    this.mesh = new THREE.Mesh(geometry, this.planetMaterial);
    this.mesh.castShadow = false;
    this.mesh.name = 'planet';
    this.scene.add(this.mesh);
  }

  _buildAtmosphere() {
    const geometry = new THREE.SphereGeometry(ATMOSPHERE_RADIUS, 64, 64);

    this.atmosphereMaterial = new THREE.ShaderMaterial({
      vertexShader: atmosphereVert,
      fragmentShader: atmosphereFrag,
      uniforms: {
        uSunDirection: { value: this.sunDirection },
        uAtmosphereColor: { value: new THREE.Color(0.3, 0.6, 1.0) },
        uAtmosphereStrength: { value: 0.8 },
      },
      side: THREE.FrontSide,
      blending: THREE.AdditiveBlending,
      transparent: true,
      depthWrite: false,
    });

    this.atmosphere = new THREE.Mesh(geometry, this.atmosphereMaterial);
    this.scene.add(this.atmosphere);
  }

  _buildClouds() {
    const geometry = new THREE.SphereGeometry(CLOUD_LAYER_RADIUS, 128, 128);

    this.cloudsMaterial = new THREE.ShaderMaterial({
      vertexShader: cloudsVert,
      fragmentShader: cloudsFrag,
      uniforms: {
        uTime: { value: 0 },
        uSunDirection: { value: this.sunDirection },
      },
      transparent: true,
      depthWrite: false,
      side: THREE.FrontSide,
    });

    this.clouds = new THREE.Mesh(geometry, this.cloudsMaterial);
    this.clouds.name = 'clouds';
    this.scene.add(this.clouds);
  }

  _buildStarfield() {
    const count = 8000;
    const positions = new Float32Array(count * 3);
    const colors = new Float32Array(count * 3);

    for (let i = 0; i < count; i++) {
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(2 * Math.random() - 1);
      const r = 300 + Math.random() * 200;
      positions[i * 3] = r * Math.sin(phi) * Math.cos(theta);
      positions[i * 3 + 1] = r * Math.cos(phi);
      positions[i * 3 + 2] = r * Math.sin(phi) * Math.sin(theta);

      const brightness = 0.5 + Math.random() * 0.5;
      const hue = Math.random();
      const starColor = new THREE.Color().setHSL(hue, 0.1, brightness);
      colors[i * 3] = starColor.r;
      colors[i * 3 + 1] = starColor.g;
      colors[i * 3 + 2] = starColor.b;
    }

    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));

    const mat = new THREE.PointsMaterial({
      size: 0.6,
      vertexColors: true,
      transparent: true,
      opacity: 0.9,
      sizeAttenuation: false,
    });

    this.scene.add(new THREE.Points(geo, mat));
  }

  _buildSun() {
    // Sun directional light
    const light = new THREE.DirectionalLight(0xfff5e0, 2.0);
    light.position.copy(this.sunDirection).multiplyScalar(100);
    this.scene.add(light);

    // Ambient fill
    this.scene.add(new THREE.AmbientLight(0x111133, 0.3));

    // Create a dynamic radial gradient texture for sun glow
    const canvas = document.createElement('canvas');
    canvas.width = 256;
    canvas.height = 256;
    const ctx = canvas.getContext('2d');
    const gradient = ctx.createRadialGradient(128, 128, 18, 128, 128, 128);
    gradient.addColorStop(0, 'rgba(255, 248, 224, 0.85)');
    gradient.addColorStop(0.22, 'rgba(255, 228, 170, 0.55)');
    gradient.addColorStop(0.55, 'rgba(255, 170, 90, 0.22)');
    gradient.addColorStop(1, 'rgba(0, 0, 0, 0)');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, 256, 256);
    
    const glowTexture = new THREE.CanvasTexture(canvas);
    
    const sunMat = new THREE.SpriteMaterial({
      map: glowTexture,
      color: 0xffefc2,
      transparent: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false
    });
    
    const sunMesh = new THREE.Sprite(sunMat);
    sunMesh.scale.set(46, 46, 1);

    sunMesh.position.copy(this.sunDirection).multiplyScalar(100);
    this.scene.add(sunMesh);

    this._dirLight = light;
    this._sunMesh = sunMesh;
  }

  /**
   * Called every animation frame.
   * @param {number} elapsed - Seconds since start
   */
  update(elapsed) {
    // Day/night cycle — sun orbits slowly
    const angle = (elapsed / DAY_CYCLE_SECONDS) * Math.PI * 2;
    this.sunDirection.set(Math.cos(angle), Math.sin(angle * 0.3) * 0.5, Math.sin(angle));
    this.sunDirection.normalize();

    this.dayCycleProgress = (Math.sin(angle) + 1) / 2;

    // Update uniforms
    this.planetMaterial.uniforms.uTime.value = elapsed;
    this.planetMaterial.uniforms.uSunDirection.value.copy(this.sunDirection);
    this.planetMaterial.uniforms.uDayCycleProgress.value = this.dayCycleProgress;

    this.atmosphereMaterial.uniforms.uSunDirection.value.copy(this.sunDirection);

    this.cloudsMaterial.uniforms.uTime.value = elapsed;
    this.cloudsMaterial.uniforms.uSunDirection.value.copy(this.sunDirection);

    // Clouds rotate slightly faster than planet
    this.clouds.rotation.y = elapsed * 0.005;

    // Update sun light position
    if (this._dirLight) {
      this._dirLight.position.copy(this.sunDirection).multiplyScalar(100);
    }
    if (this._sunMesh) {
      this._sunMesh.position.copy(this.sunDirection).multiplyScalar(100);
    }
  }

  /**
   * Update LOD geometry based on camera distance.
   * @param {number} cameraDistance
   */
  updateLOD(cameraDistance) {
    const segments = cameraDistance < 12 ? 256 : cameraDistance < 25 ? 128 : 64;
    const currentSeg = this.mesh.geometry.parameters.widthSegments;
    if (currentSeg !== segments) {
      this.mesh.geometry.dispose();
      this.mesh.geometry = new THREE.SphereGeometry(PLANET_RADIUS, segments, segments);
    }
  }

  dispose() {
    this.mesh.geometry.dispose();
    this.planetMaterial.dispose();
    this.atmosphereMaterial.dispose();
    this.cloudsMaterial.dispose();
  }
}
