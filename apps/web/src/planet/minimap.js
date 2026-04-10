/**
 * Minimap — circular canvas in the bottom-left corner.
 * Orthographic top-down projection showing regions and player positions.
 * Updates every 3 frames for performance.
 */

import { REGIONS, latLonToXYZ } from '@veltara/shared';

export class Minimap {
  /** @type {HTMLCanvasElement} */
  canvas;
  /** @type {CanvasRenderingContext2D} */
  ctx;

  frameCount = 0;
  UPDATE_EVERY = 3;

  SIZE = 140;
  RADIUS = 65;

  /** @type {string|null} */
  selfPlayerId = null;
  /** @type {Map<string, { lat: number, lon: number, regionId: string }>} */
  players = new Map();
  /** @type {Record<string, number>} */
  regionCounts = {};

  selfLat = 0;
  selfLon = 0;
  pulse = 0;

  constructor() {
    this.canvas = document.createElement('canvas');
    this.canvas.width = this.SIZE;
    this.canvas.height = this.SIZE;
    this.canvas.style.cssText = `
      position: fixed;
      bottom: 80px;
      left: 16px;
      border-radius: 50%;
      border: 2px solid rgba(108, 99, 255, 0.4);
      background: rgba(10, 10, 18, 0.85);
      backdrop-filter: blur(8px);
      z-index: 40;
      box-shadow: 0 0 20px rgba(108, 99, 255, 0.2);
    `;
    this.canvas.setAttribute('aria-label', 'Planet minimap');
    this.ctx = this.canvas.getContext('2d');
    document.body.appendChild(this.canvas);
  }

  /**
   * Project lat/lon to minimap 2D coords.
   * @param {number} lat
   * @param {number} lon
   */
  project(lat, lon) {
    // Simple equirectangular projection
    const cx = this.SIZE / 2;
    const cy = this.SIZE / 2;
    const x = cx + (lon / 180) * this.RADIUS;
    const y = cy - (lat / 90) * this.RADIUS;
    return { x, y };
  }

  /**
   * Update player positions.
   * @param {Map<string, { lat: number, lon: number, region_id: string }>} players
   * @param {string} selfId
   */
  setPlayers(players, selfId) {
    this.players = players;
    this.selfPlayerId = selfId;
    const player = players.get(selfId);
    if (player) {
      this.selfLat = player.lat;
      this.selfLon = player.lon;
    }
  }

  setRegionCounts(counts) {
    this.regionCounts = counts;
  }

  /** @param {number} elapsed */
  update(elapsed) {
    this.frameCount++;
    if (this.frameCount % this.UPDATE_EVERY !== 0) return;

    this.pulse = (Math.sin(elapsed * 4) + 1) / 2;
    this._draw();
  }

  _draw() {
    const { ctx, canvas, SIZE, RADIUS } = this;
    const cx = SIZE / 2;
    const cy = SIZE / 2;

    ctx.clearRect(0, 0, SIZE, SIZE);

    // Clip to circle
    ctx.save();
    ctx.beginPath();
    ctx.arc(cx, cy, RADIUS, 0, Math.PI * 2);
    ctx.clip();

    // Background
    ctx.fillStyle = 'rgba(10, 10, 18, 0.6)';
    ctx.fillRect(0, 0, SIZE, SIZE);

    // Grid lines
    ctx.strokeStyle = 'rgba(255,255,255,0.05)';
    ctx.lineWidth = 0.5;
    for (let lat = -90; lat <= 90; lat += 30) {
      const { y } = this.project(lat, 0);
      ctx.beginPath();
      ctx.moveTo(cx - RADIUS, y);
      ctx.lineTo(cx + RADIUS, y);
      ctx.stroke();
    }
    for (let lon = -180; lon <= 180; lon += 60) {
      const { x } = this.project(0, lon);
      ctx.beginPath();
      ctx.moveTo(x, cy - RADIUS);
      ctx.lineTo(x, cy + RADIUS);
      ctx.stroke();
    }

    // Region dots
    REGIONS.forEach((region) => {
      const { x, y } = this.project(region.lat, region.lon);
      const count = this.regionCounts[region.id] ?? 0;
      const size = 3 + Math.min(count / 10, 6);

      ctx.beginPath();
      ctx.arc(x, y, size, 0, Math.PI * 2);
      ctx.fillStyle = region.color + 'aa';
      ctx.fill();
      ctx.strokeStyle = region.color;
      ctx.lineWidth = 1;
      ctx.stroke();
    });

    // Other players
    this.players.forEach((player, id) => {
      if (id === this.selfPlayerId) return;
      const { x, y } = this.project(player.lat, player.lon);
      ctx.beginPath();
      ctx.arc(x, y, 1.5, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(255,255,255,0.6)';
      ctx.fill();
    });

    // Self — pulsing bright dot
    const self = this.players.get(this.selfPlayerId ?? '');
    if (self) {
      const { x, y } = this.project(self.lat, self.lon);
      const pulseSize = 3 + this.pulse * 2;

      ctx.beginPath();
      ctx.arc(x, y, pulseSize + 2, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(79, 255, 176, ${0.2 * this.pulse})`;
      ctx.fill();

      ctx.beginPath();
      ctx.arc(x, y, 3, 0, Math.PI * 2);
      ctx.fillStyle = '#4fffb0';
      ctx.fill();
    }

    ctx.restore();
  }

  destroy() {
    this.canvas.remove();
  }
}
