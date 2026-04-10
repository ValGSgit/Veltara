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
  /** @type {THREE.Mesh|null} */
  ring = null;
  /** @type {THREE.Group|null} */
  crystalField = null;
  /** @type {THREE.Group|null} */
  lightColumns = null;

  activeRegionId = null;
  enabled = false;

  constructor(scene) {
    this.scene = scene;
    this.root = new THREE.Group();
    this.root.visible = false;
    this.root.name = 'region-land-root';
    this.scene.add(this.root);

    this.buildScene();
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

    const innerGroundGeometry = new THREE.CircleGeometry(20, 56);
    const innerGroundMaterial = new THREE.MeshStandardMaterial({
      color: 0x465e87,
      roughness: 0.82,
      metalness: 0.18,
      emissive: 0x0a142a,
      emissiveIntensity: 0.22,
      transparent: true,
      opacity: 0.95,
    });
    const innerGround = new THREE.Mesh(innerGroundGeometry, innerGroundMaterial);
    innerGround.rotation.x = -Math.PI / 2;
    innerGround.position.set(0, -2.18, 0);
    this.root.add(innerGround);

    const ringGeometry = new THREE.TorusGeometry(20, 0.2, 16, 120);
    const ringMaterial = new THREE.MeshBasicMaterial({ color: 0x6fd3ff, transparent: true, opacity: 0.4 });
    this.ring = new THREE.Mesh(ringGeometry, ringMaterial);
    this.ring.rotation.x = Math.PI / 2;
    this.ring.position.set(0, -2.1, 0);
    this.root.add(this.ring);

    const secondaryRingGeo = new THREE.TorusGeometry(12, 0.1, 12, 80);
    const secondaryRingMat = new THREE.MeshBasicMaterial({ color: 0x8de8ff, transparent: true, opacity: 0.35 });
    const secondaryRing = new THREE.Mesh(secondaryRingGeo, secondaryRingMat);
    secondaryRing.rotation.x = Math.PI / 2;
    secondaryRing.position.set(0, -2.15, 0);
    this.root.add(secondaryRing);

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

    this.crystalField = new THREE.Group();
    this.crystalField.name = 'region-land-crystals';
    for (let i = 0; i < 28; i++) {
      const h = 0.8 + Math.random() * 2.6;
      const geo = new THREE.ConeGeometry(0.22 + Math.random() * 0.28, h, 6);
      const mat = new THREE.MeshStandardMaterial({
        color: 0x78b9ff,
        roughness: 0.18,
        metalness: 0.25,
        emissive: 0x0d2046,
        emissiveIntensity: 0.35,
      });

      const mesh = new THREE.Mesh(geo, mat);
      const angle = (i / 28) * Math.PI * 2;
      const radius = 8 + Math.random() * 9;
      mesh.position.set(
        Math.cos(angle) * radius,
        -2.2 + h / 2,
        Math.sin(angle) * radius,
      );
      mesh.rotation.y = Math.random() * Math.PI;
      mesh.userData.baseY = mesh.position.y;
      mesh.userData.waveOffset = Math.random() * Math.PI * 2;
      this.crystalField.add(mesh);
    }
    this.root.add(this.crystalField);

    this.lightColumns = new THREE.Group();
    this.lightColumns.name = 'region-land-columns';
    for (let i = 0; i < 6; i++) {
      const geo = new THREE.CylinderGeometry(0.15, 0.15, 5.5, 12);
      const mat = new THREE.MeshBasicMaterial({ color: 0x68e1ff, transparent: true, opacity: 0.22 });
      const mesh = new THREE.Mesh(geo, mat);
      const angle = (i / 6) * Math.PI * 2;
      mesh.position.set(Math.cos(angle) * 13, 0.5, Math.sin(angle) * 13);
      this.lightColumns.add(mesh);
    }
    this.root.add(this.lightColumns);
  }

  enter(regionId) {
    this.activeRegionId = regionId;
    this.enabled = true;
    this.root.visible = true;

    const region = REGION_MAP[regionId];
    if (region) {
      const color = new THREE.Color(region.color);
      if (this.ground?.material instanceof THREE.MeshStandardMaterial) {
        this.ground.material.color.copy(color.clone().multiplyScalar(0.45));
        this.ground.material.emissive.copy(color.clone().multiplyScalar(0.1));
      }

      if (this.ring?.material instanceof THREE.MeshBasicMaterial) {
        this.ring.material.color.copy(color.clone().lerp(new THREE.Color(0xffffff), 0.25));
      }

      this.crystalField?.children.forEach((child, index) => {
        if (!(child instanceof THREE.Mesh)) return;
        if (!(child.material instanceof THREE.MeshStandardMaterial)) return;
        const tint = color.clone().offsetHSL((index % 4) * 0.02, 0.05, 0.08);
        child.material.color.copy(tint);
        child.material.emissive.copy(tint.clone().multiplyScalar(0.18));
      });

      this.lightColumns?.children.forEach((child) => {
        if (!(child instanceof THREE.Mesh)) return;
        if (!(child.material instanceof THREE.MeshBasicMaterial)) return;
        child.material.color.copy(color.clone().lerp(new THREE.Color(0xb6f4ff), 0.35));
      });
    }
  }

  leave() {
    this.activeRegionId = null;
    this.enabled = false;
    this.root.visible = false;
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

    if (this.ring) {
      this.ring.rotation.z = elapsed * 0.08;
    }

    this.crystalField?.children.forEach((child) => {
      if (!(child instanceof THREE.Mesh)) return;
      child.position.y = child.userData.baseY + Math.sin(elapsed * 1.2 + child.userData.waveOffset) * 0.06;
    });

    this.lightColumns?.children.forEach((child, index) => {
      if (!(child instanceof THREE.Mesh)) return;
      if (!(child.material instanceof THREE.MeshBasicMaterial)) return;
      child.material.opacity = 0.16 + (Math.sin(elapsed * 1.8 + index) + 1) * 0.08;
    });
  }

  getPlacementSurface() {
    return this.ground;
  }
}
