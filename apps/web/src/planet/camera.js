/**
 * Camera controller for the planet view.
 * - Click + drag to rotate
 * - Scroll to zoom
 * - Double-click region to focus
 * - Inertia/momentum on drag release
 * - Touch support (pinch zoom, drag rotate)
 */

import * as THREE from 'three';
import { PLANET_RADIUS, latLonToXYZ } from '@veltara/shared';

const MIN_DISTANCE = 7;
const MAX_DISTANCE = 40;
const INERTIA_DECAY = 0.92;
const ZOOM_SPEED = 0.08;
const ROTATE_SPEED = 0.005;
const ANIMATE_DURATION = 1200; // ms for double-click focus

export class CameraController {
  /** @type {THREE.PerspectiveCamera} */
  camera;
  /** @type {HTMLElement} */
  canvas;

  spherical = new THREE.Spherical(18, Math.PI / 2, 0);
  targetSpherical = new THREE.Spherical(18, Math.PI / 2, 0);

  isDragging = false;
  lastMouse = { x: 0, y: 0 };
  velocity = { phi: 0, theta: 0 };

  // Touch state
  lastTouchDist = 0;
  lastTouchCenter = { x: 0, y: 0 };

  // Animation state
  animating = false;
  animStartTime = 0;
  animStartSpherical = new THREE.Spherical();
  animEndSpherical = new THREE.Spherical();

  constructor(camera, canvas) {
    this.camera = camera;
    this.canvas = canvas;
    this._bindEvents();
  }

  _bindEvents() {
    this.canvas.addEventListener('mousedown', this._onMouseDown.bind(this));
    window.addEventListener('mousemove', this._onMouseMove.bind(this));
    window.addEventListener('mouseup', this._onMouseUp.bind(this));
    this.canvas.addEventListener('wheel', this._onWheel.bind(this), { passive: true });
    this.canvas.addEventListener('dblclick', this._onDblClick.bind(this));

    // Touch events
    this.canvas.addEventListener('touchstart', this._onTouchStart.bind(this), { passive: true });
    this.canvas.addEventListener('touchmove', this._onTouchMove.bind(this), { passive: false });
    this.canvas.addEventListener('touchend', this._onTouchEnd.bind(this), { passive: true });
  }

  _onMouseDown(e) {
    if (e.button !== 0) return;
    this.isDragging = true;
    this.lastMouse = { x: e.clientX, y: e.clientY };
    this.velocity = { phi: 0, theta: 0 };
    this.animating = false;
    this.canvas.style.cursor = 'grabbing';
  }

  _onMouseMove(e) {
    if (!this.isDragging) return;
    const dx = e.clientX - this.lastMouse.x;
    const dy = e.clientY - this.lastMouse.y;

    const dTheta = -dx * ROTATE_SPEED;
    const dPhi = -dy * ROTATE_SPEED;

    this.targetSpherical.theta += dTheta;
    this.targetSpherical.phi = Math.max(0.1, Math.min(Math.PI - 0.1, this.targetSpherical.phi + dPhi));

    this.velocity.theta = dTheta;
    this.velocity.phi = dPhi;

    this.lastMouse = { x: e.clientX, y: e.clientY };
  }

  _onMouseUp() {
    this.isDragging = false;
    this.canvas.style.cursor = 'grab';
  }

  _onWheel(e) {
    const delta = e.deltaY * ZOOM_SPEED;
    this.targetSpherical.radius = Math.max(
      MIN_DISTANCE,
      Math.min(MAX_DISTANCE, this.targetSpherical.radius + delta),
    );
    this.animating = false;
  }

  _onDblClick(e) {
    // Handled by the main app when a region is double-clicked
  }

  _onTouchStart(e) {
    if (e.touches.length === 1) {
      this.isDragging = true;
      this.lastMouse = { x: e.touches[0].clientX, y: e.touches[0].clientY };
      this.velocity = { phi: 0, theta: 0 };
      this.animating = false;
    } else if (e.touches.length === 2) {
      this.isDragging = false;
      const dx = e.touches[0].clientX - e.touches[1].clientX;
      const dy = e.touches[0].clientY - e.touches[1].clientY;
      this.lastTouchDist = Math.sqrt(dx * dx + dy * dy);
    }
  }

  _onTouchMove(e) {
    if (e.touches.length === 1 && this.isDragging) {
      e.preventDefault();
      const dx = e.touches[0].clientX - this.lastMouse.x;
      const dy = e.touches[0].clientY - this.lastMouse.y;

      this.targetSpherical.theta -= dx * ROTATE_SPEED;
      this.targetSpherical.phi = Math.max(
        0.1,
        Math.min(Math.PI - 0.1, this.targetSpherical.phi - dy * ROTATE_SPEED),
      );

      this.velocity.theta = -dx * ROTATE_SPEED;
      this.lastMouse = { x: e.touches[0].clientX, y: e.touches[0].clientY };
    } else if (e.touches.length === 2) {
      e.preventDefault();
      const dx = e.touches[0].clientX - e.touches[1].clientX;
      const dy = e.touches[0].clientY - e.touches[1].clientY;
      const dist = Math.sqrt(dx * dx + dy * dy);
      const pinchDelta = (this.lastTouchDist - dist) * 0.05;
      this.targetSpherical.radius = Math.max(
        MIN_DISTANCE,
        Math.min(MAX_DISTANCE, this.targetSpherical.radius + pinchDelta),
      );
      this.lastTouchDist = dist;
    }
  }

  _onTouchEnd() {
    this.isDragging = false;
  }

  /**
   * Animate camera to focus on a lat/lon position.
   * @param {number} lat
   * @param {number} lon
   * @param {number} distance
   */
  focusOn(lat, lon, distance = 10) {
    const phi = (90 - lat) * (Math.PI / 180);
    const theta = (lon + 180) * (Math.PI / 180);

    this.animStartSpherical.copy(this.spherical);
    this.animEndSpherical.set(distance, phi, theta);
    this.animStartTime = performance.now();
    this.animating = true;
  }

  /**
   * Update camera position. Call every frame.
   * @param {number} delta
   */
  update(delta) {
    if (this.animating) {
      const t = Math.min((performance.now() - this.animStartTime) / ANIMATE_DURATION, 1);
      const ease = 1 - Math.pow(1 - t, 3); // cubic ease-out

      this.spherical.radius = THREE.MathUtils.lerp(
        this.animStartSpherical.radius,
        this.animEndSpherical.radius,
        ease,
      );
      this.spherical.phi = THREE.MathUtils.lerp(
        this.animStartSpherical.phi,
        this.animEndSpherical.phi,
        ease,
      );
      this.spherical.theta = THREE.MathUtils.lerp(
        this.animStartSpherical.theta,
        this.animEndSpherical.theta,
        ease,
      );

      if (t >= 1) this.animating = false;
    } else {
      // Apply inertia when not dragging
      if (!this.isDragging) {
        this.velocity.theta *= INERTIA_DECAY;
        this.velocity.phi *= INERTIA_DECAY;
        this.targetSpherical.theta += this.velocity.theta;
        this.targetSpherical.phi = Math.max(
          0.1,
          Math.min(Math.PI - 0.1, this.targetSpherical.phi + this.velocity.phi),
        );
      }

      // Smooth follow
      this.spherical.radius = THREE.MathUtils.lerp(this.spherical.radius, this.targetSpherical.radius, 0.1);
      this.spherical.phi = THREE.MathUtils.lerp(this.spherical.phi, this.targetSpherical.phi, 0.1);
      this.spherical.theta = THREE.MathUtils.lerp(this.spherical.theta, this.targetSpherical.theta, 0.1);
    }

    // Apply to camera
    const pos = new THREE.Vector3();
    pos.setFromSpherical(this.spherical);
    this.camera.position.copy(pos);
    this.camera.lookAt(0, 0, 0);
  }

  /** Get current mouse NDC coords from screen event. */
  static getNDC(e, canvas) {
    const rect = canvas.getBoundingClientRect();
    return new THREE.Vector2(
      ((e.clientX - rect.left) / rect.width) * 2 - 1,
      -((e.clientY - rect.top) / rect.height) * 2 + 1,
    );
  }

  get distance() {
    return this.spherical.radius;
  }
}
