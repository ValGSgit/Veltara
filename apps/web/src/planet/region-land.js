/**
 * Dedicated per-region ground scene runtime.
 * This is the local "inside region" sandbox layer distinct from planet lobby view.
 */

import * as THREE from 'three';
import { REGION_MAP } from '@veltara/shared';

const REGION_TINT = {
  skyTop: 0x070f21,
  skyBottom: 0x0c162f,
};

export class RegionLandScene {
  /** @type {THREE.Scene} */
  scene;
  /** @type {THREE.Group} */
  root;
  /** @type {THREE.Mesh|null} */
  ground = null;
  /** @type {THREE.Mesh|null} */
  sky = null;
  /** @type {THREE.AmbientLight|null} */
  ambient = null;
  /** @type {THREE.DirectionalLight|null} */
  sun = null;
  /** @type {HTMLElement} */
  badge;

  activeRegionId = null;
  enabled = false;

  constructor(scene) {
    this.scene = scene;
    this.root = new THREE.Group();
    this.root.visible = false;
    this.root.name = 'region-land-root';
    this.scene.add(this.root);

    this.buildScene();
    this.badge = this.createBadge();
  }

  buildScene() {
    const groundGeometry = new THREE.CircleGeometry(30, 64);
    const groundMaterial = new THREE.MeshStandardMaterial({
      color: 0x2a3754,
      roughness: 0.95,
      metalness: 0.05,
      emissive: 0x050812,
      emissiveIntensity: 0.2,
    });
    this.ground = new THREE.Mesh(groundGeometry, groundMaterial);
    this.ground.rotation.x = -Math.PI / 2;
    this.ground.position.set(0, -2.2, 0);
    this.ground.userData.isSandboxGround = true;
    this.root.add(this.ground);

    const ringGeometry = new THREE.TorusGeometry(20, 0.2, 16, 120);
    const ringMaterial = new THREE.MeshBasicMaterial({ color: 0x6fd3ff, transparent: true, opacity: 0.4 });
    const ring = new THREE.Mesh(ringGeometry, ringMaterial);
    ring.rotation.x = Math.PI / 2;
    ring.position.set(0, -2.1, 0);
    this.root.add(ring);

    const skyGeometry = new THREE.SphereGeometry(90, 48, 32);
    const skyMaterial = new THREE.ShaderMaterial({
      side: THREE.BackSide,
      uniforms: {
        topColor: { value: new THREE.Color(REGION_TINT.skyTop) },
        bottomColor: { value: new THREE.Color(REGION_TINT.skyBottom) },
      },
      vertexShader: `
        varying vec3 vWorldPosition;
        void main() {
          vec4 worldPosition = modelMatrix * vec4(position, 1.0);
          vWorldPosition = worldPosition.xyz;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: `
        uniform vec3 topColor;
        uniform vec3 bottomColor;
        varying vec3 vWorldPosition;
        void main() {
          float h = normalize(vWorldPosition).y * 0.5 + 0.5;
          gl_FragColor = vec4(mix(bottomColor, topColor, h), 1.0);
        }
      `,
    });
    this.sky = new THREE.Mesh(skyGeometry, skyMaterial);
    this.root.add(this.sky);

    this.ambient = new THREE.AmbientLight(0x7aa0d8, 0.55);
    this.root.add(this.ambient);

    this.sun = new THREE.DirectionalLight(0xd3e8ff, 1.1);
    this.sun.position.set(12, 16, 8);
    this.root.add(this.sun);
  }

  createBadge() {
    const el = document.createElement('div');
    el.className =
      'pointer-events-none fixed left-1/2 top-6 z-40 hidden -translate-x-1/2 rounded-full border border-white/15 bg-black/45 px-4 py-1.5 text-xs font-medium tracking-wide text-white backdrop-blur-sm';
    document.body.appendChild(el);
    return el;
  }

  enter(regionId) {
    this.activeRegionId = regionId;
    this.enabled = true;
    this.root.visible = true;

    const region = REGION_MAP[regionId];
    if (region) {
      this.badge.textContent = `${region.name} Sandbox • Esc to return to Planet`;
      this.badge.classList.remove('hidden');

      const color = new THREE.Color(region.color);
      if (this.ground?.material instanceof THREE.MeshStandardMaterial) {
        this.ground.material.color.copy(color.clone().multiplyScalar(0.45));
        this.ground.material.emissive.copy(color.clone().multiplyScalar(0.1));
      }
    }
  }

  leave() {
    this.activeRegionId = null;
    this.enabled = false;
    this.root.visible = false;
    this.badge.classList.add('hidden');
  }

  focusCamera(cameraCtrl) {
    cameraCtrl.targetSpherical.radius = 11;
    cameraCtrl.targetSpherical.phi = Math.PI / 2.35;
    cameraCtrl.targetSpherical.theta = 0;
    cameraCtrl.spherical.radius = 11;
    cameraCtrl.spherical.phi = Math.PI / 2.35;
    cameraCtrl.spherical.theta = 0;
  }

  update(elapsed) {
    if (!this.enabled) return;

    if (this.sun) {
      this.sun.position.x = Math.cos(elapsed * 0.2) * 12;
      this.sun.position.z = Math.sin(elapsed * 0.2) * 10;
    }
  }

  getPlacementSurface() {
    return this.ground;
  }
}
