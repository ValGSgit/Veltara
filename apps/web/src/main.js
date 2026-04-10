/**
 * main.js — Veltara Web App entry point
 *
 * Bootstraps Three.js renderer, planet engine, UI, networking,
 * and the main animation loop.
 */

import './styles/main.css';
import * as THREE from 'three';
import { Planet } from './planet/planet.js';
import { RegionMarkers } from './planet/regions.js';
import { PlayerDots } from './planet/players.js';
import { CameraController } from './planet/camera.js';
import { Minimap } from './planet/minimap.js';
import { initHUD } from './ui/hud.js';
import { showLoginModal, showRegisterModal } from './ui/auth.js';
import { showOnboarding } from './ui/onboarding.js';
import { toast } from './ui/toast.js';
import { store } from './state/store.js';
import { api } from './network/api.js';
import { RegionSocket } from './network/websocket.js';
import './ui/panels.js';
import { REGIONS } from '@veltara/shared';

// ─── Renderer Setup ───────────────────────────────────────────────────────────

const canvas = document.getElementById('planet-canvas');
const renderer = new THREE.WebGLRenderer({
  canvas,
  antialias: true,
  alpha: false,
  powerPreference: 'high-performance',
});
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.outputEncoding = THREE.sRGBEncoding;
renderer.toneMapping = THREE.ACESFilmicToneMapping;

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x000004);

const camera = new THREE.PerspectiveCamera(50, window.innerWidth / window.innerHeight, 0.1, 1000);
camera.position.set(0, 0, 18);

// ─── Performance + Quality ────────────────────────────────────────────────────

function getQuality() {
  const q = localStorage.getItem('quality') ?? 'medium';
  return q === 'low' ? 0 : q === 'high' ? 2 : 1;
}

// ─── Engine Objects ───────────────────────────────────────────────────────────

let quality = getQuality();
const planet = new Planet(scene, quality);
const regions = new RegionMarkers(scene);
const players = new PlayerDots(scene);
const cameraCtrl = new CameraController(camera, canvas);
const minimap = new Minimap();

// ─── HUD ──────────────────────────────────────────────────────────────────────

initHUD();

// Show loading overlay
const loadingScreen = document.createElement('div');
loadingScreen.id = 'loading-screen';
loadingScreen.innerHTML = `
  <div class="loading-ring"></div>
  <div class="text-white text-sm font-medium">Loading Veltara…</div>
`;
document.body.appendChild(loadingScreen);

// ─── WebSocket State ──────────────────────────────────────────────────────────

/** @type {RegionSocket|null} */
let socket = null;

function connectToRegion(regionId, token) {
  socket?.disconnect();
  socket = new RegionSocket(regionId, token);

  socket.on('connected', () => {
    store.set('wsConnected', true);
    store.set('wsReconnecting', false);
    toast.success('Connected to planet!');
  });

  socket.on('disconnected', () => {
    store.set('wsConnected', false);
  });

  socket.on('reconnecting', ({ attempt, delay }) => {
    store.set('wsReconnecting', true);
    toast.info(`Reconnecting… (attempt ${attempt})`, 3000);
  });

  socket.on('initial_state', (payload) => {
    store.set('selfRegionId', payload.region_id);

    // Load existing players
    const playerMap = new Map();
    payload.players.forEach((p) => {
      playerMap.set(p.id, p);
      players.addOrUpdate(p, p.id === payload.your_id);
    });
    store.set('players', playerMap);

    // Load chat history
    store.set('chatMessages', payload.chat_history ?? []);

    // Load world state
    store.set('worldState', payload.world_state);
  });

  socket.on('world_state', (payload) => {
    store.set('worldState', payload);
    store.set('activeEvents', payload.active_events ?? []);

    // Announce new events
    payload.active_events?.forEach((evt) => {
      toast.event(`🌍 ${evt.title}: ${evt.description}`, 10000);
    });
  });

  socket.on('player_joined', (payload) => {
    const map = new Map(store.get('players'));
    map.set(payload.id, payload);
    store.set('players', map);
    players.addOrUpdate(payload);
  });

  socket.on('player_left', (payload) => {
    const map = new Map(store.get('players'));
    map.delete(payload.id);
    store.set('players', map);
    players.remove(payload.id);
  });

  socket.on('position_update', (payload) => {
    const map = new Map(store.get('players'));
    const p = map.get(payload.id);
    if (p) {
      map.set(payload.id, { ...p, ...payload });
      store.set('players', map);
    }
    players.addOrUpdate({ ...p, ...payload });
  });

  socket.on('chat_message', (payload) => {
    const msgs = [...(store.get('chatMessages') ?? []), payload].slice(-200);
    store.set('chatMessages', msgs);
  });

  socket.on('global_event', (payload) => {
    toast.event(`✦ ${payload.title}: ${payload.description}`, 12000);
    const ws = store.get('worldState');
    if (ws) {
      ws.active_events = [...(ws.active_events ?? []), payload];
      store.set('worldState', { ...ws });
    }
  });

  socket.on('pong', ({ latency }) => {
    // Could display latency in HUD
  });

  socket.connect();
}

// ─── Chat sending ─────────────────────────────────────────────────────────────

document.addEventListener('send-chat', (e) => {
  const { text, is_global } = e.detail;
  if (!socket?.isConnected) {
    toast.error('Not connected to planet');
    return;
  }
  socket.send('chat_message', { text, is_global: is_global ?? false });
});

// ─── Region teleport ──────────────────────────────────────────────────────────

document.addEventListener('teleport-to-region', (e) => {
  const { regionId } = e.detail;
  const region = REGIONS.find((r) => r.id === regionId);
  if (!region) return;
  cameraCtrl.focusOn(region.lat, region.lon, 10);

  if (socket?.isConnected) {
    socket.send('position_update', { lat: region.lat, lon: region.lon, action: 'teleporting' });
    store.set('selfRegionId', regionId);
  }
});

// ─── Planet double-click → focus region ──────────────────────────────────────

canvas.addEventListener('dblclick', (e) => {
  const mouse = CameraController.getNDC(e, canvas);
  const regionId = regions.checkClick(mouse, camera);
  if (regionId) {
    document.dispatchEvent(new CustomEvent('teleport-to-region', { detail: { regionId } }));
  }
});

// ─── Mouse hover for region labels ───────────────────────────────────────────

canvas.addEventListener('mousemove', (e) => {
  const mouse = CameraController.getNDC(e, canvas);
  regions.checkHover(mouse, camera, e);
});

// ─── Quality change ───────────────────────────────────────────────────────────

document.addEventListener('quality-change', (e) => {
  quality = e.detail === 'low' ? 0 : e.detail === 'high' ? 2 : 1;
});

// ─── Onboarding complete ──────────────────────────────────────────────────────

document.addEventListener('onboarding-complete', async (e) => {
  const { regionId } = e.detail;
  if (regionId) {
    document.dispatchEvent(new CustomEvent('teleport-to-region', { detail: { regionId } }));
  }
});

// ─── Window Resize ────────────────────────────────────────────────────────────

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

// ─── Bootstrap ────────────────────────────────────────────────────────────────

async function bootstrap() {
  // Try to restore session
  const user = await api.restoreSession();

  if (user) {
    store.update({ user, isAuthenticated: true });

    // Join planet
    try {
      const { region_id } = await api.joinPlanet(0, 0);
      store.set('selfRegionId', region_id);
      connectToRegion(region_id, localStorage.getItem('access_token'));
    } catch {
      toast.error('Failed to join planet');
    }

    // Check onboarding
    if (!localStorage.getItem('onboarding_complete')) {
      showOnboarding();
    }
  } else {
    // Show auth modal
    showLoginModal((user) => {
      store.update({ user, isAuthenticated: true });
      api.joinPlanet(0, 0).then(({ region_id }) => {
        store.set('selfRegionId', region_id);
        connectToRegion(region_id, localStorage.getItem('access_token'));
        if (!localStorage.getItem('onboarding_complete')) {
          showOnboarding();
        }
      }).catch(() => toast.error('Failed to join planet'));
    });
  }

  // Load regions
  try {
    const { regions: regionData } = await api.getRegions();
    store.set('regions', regionData);
    const counts = {};
    regionData.forEach((r) => { counts[r.id] = r.player_count; });
    store.set('regionCounts', counts);
  } catch { /* non-critical */ }

  // Dismiss loading screen
  loadingScreen.style.opacity = '0';
  loadingScreen.style.transition = 'opacity 0.5s';
  setTimeout(() => loadingScreen.remove(), 500);

  // Start position update broadcast loop
  setInterval(() => {
    if (socket?.isConnected) {
      socket.send('position_update', {
        lat: store.get('selfLat') ?? 0,
        lon: store.get('selfLon') ?? 0,
        action: 'exploring',
      });
    }
  }, 100); // 10hz max
}

// ─── Animation Loop ───────────────────────────────────────────────────────────

const clock = new THREE.Clock();
let frameCount = 0;

function animate() {
  requestAnimationFrame(animate);

  const delta = clock.getDelta();
  const elapsed = clock.getElapsedTime();
  frameCount++;

  // Skip reduced motion
  const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  if (!prefersReducedMotion) {
    planet.update(elapsed);
  }

  cameraCtrl.update(delta);
  planet.updateLOD(cameraCtrl.distance);

  const counts = store.get('regionCounts') ?? {};
  regions.update(counts, elapsed);

  players.update(delta, elapsed);
  minimap.update(elapsed);

  // Update minimap player data
  const allPlayers = store.get('players') ?? new Map();
  const selfId = store.get('user')?.id;
  minimap.setPlayers(allPlayers, selfId);
  minimap.setRegionCounts(counts);

  renderer.render(scene, camera);
}

animate();
bootstrap();
