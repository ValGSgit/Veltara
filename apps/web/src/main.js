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
import { RegionSandboxLayer } from './planet/sandbox.js';
import { RegionLandScene } from './planet/region-land.js';
import { CameraController } from './planet/camera.js';
import { Minimap } from './planet/minimap.js';
import { showLoginModal } from './ui/auth.js';
import { showOnboarding } from './ui/onboarding-flow.js';
import { toast } from './ui/toast.js';
import { store } from './state/store.js';
import { api } from './network/api.js';
import { RegionSocket } from './network/websocket.js';
import './ui/panels.js';
import { mountLobbyShell } from './ui/lobby-shell.js';
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
const sandbox = new RegionSandboxLayer(scene, planet.mesh);
const regionLand = new RegionLandScene(scene);
const cameraCtrl = new CameraController(camera, canvas);
const minimap = new Minimap();

function enterRegionLand(regionId) {
  store.set('sceneMode', 'region-land');
  store.set('activeRegionLandId', regionId);

  planet.mesh.visible = false;
  planet.atmosphere.visible = false;
  planet.clouds.visible = false;
  regions.markers.forEach((group) => { group.visible = false; });
  players.instancedMesh.visible = false;
  minimap.canvas.style.display = 'none';

  regionLand.enter(regionId);
  regionLand.focusCamera(cameraCtrl);
  sandbox.setPlacementSurface(regionLand.getPlacementSurface());

  toast.info('Entered region land sandbox. Press Esc to return to planet.', 3500);
}

function leaveRegionLand() {
  store.set('sceneMode', 'planet');
  store.set('activeRegionLandId', null);

  planet.mesh.visible = true;
  planet.atmosphere.visible = true;
  planet.clouds.visible = true;
  regions.markers.forEach((group) => { group.visible = true; });
  players.instancedMesh.visible = true;
  minimap.canvas.style.display = 'block';

  regionLand.leave();
  sandbox.setPlacementSurface(planet.mesh);
}

// ─── HUD / Shell ─────────────────────────────────────────────────────────────

mountLobbyShell();

// Show loading overlay
const loadingScreen = document.createElement('div');
loadingScreen.id = 'loading-screen';
const loadingRing = document.createElement('div');
loadingRing.className = 'loading-ring';
const loadingText = document.createElement('div');
loadingText.className = 'text-white text-sm font-medium';
loadingText.textContent = 'Loading Veltara…';
loadingScreen.appendChild(loadingRing);
loadingScreen.appendChild(loadingText);
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

    // Load region sandbox objects
    const incoming = payload.region_objects ?? [];
    sandbox.applySnapshot(incoming);
    store.set('sandboxObjects', new Map(incoming.map((obj) => [obj.id, obj])));
  });

  socket.on('region_objects_snapshot', (payload) => {
    const incoming = payload.objects ?? [];
    sandbox.applySnapshot(incoming);
    store.set('sandboxObjects', new Map(incoming.map((obj) => [obj.id, obj])));
  });

  socket.on('region_object_upsert', (payload) => {
    sandbox.upsert(payload.object);
    const map = new Map(store.get('sandboxObjects') ?? new Map());
    map.set(payload.object.id, payload.object);
    store.set('sandboxObjects', map);
  });

  socket.on('region_object_remove', (payload) => {
    sandbox.remove(payload.object_id);
    const map = new Map(store.get('sandboxObjects') ?? new Map());
    map.delete(payload.object_id);
    store.set('sandboxObjects', map);
    if (store.get('selectedSandboxObjectId') === payload.object_id) {
      store.set('selectedSandboxObjectId', null);
    }
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

  socket.on('region_event', (payload) => {
    if (payload.event_type !== 'object_interact') return;
    const objectId = payload?.data?.object_id;
    if (typeof objectId === 'string') {
      sandbox.pulse(objectId);
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

document.addEventListener('sandbox-build-mode', (e) => {
  const enabled = Boolean(e.detail?.enabled);
  store.set('sandboxBuildMode', enabled);
  toast.info(enabled ? 'Sandbox build mode enabled (Shift + Click to place).' : 'Sandbox build mode disabled.', 2500);
});

document.addEventListener('enter-region-land', (e) => {
  const { regionId } = e.detail ?? {};
  if (!regionId) return;
  enterRegionLand(regionId);
});

document.addEventListener('leave-region-land', () => {
  leaveRegionLand();
});

// ─── Planet double-click → focus region ──────────────────────────────────────

canvas.addEventListener('dblclick', (e) => {
  if (store.get('sceneMode') === 'region-land') return;

  const mouse = CameraController.getNDC(e, canvas);
  const regionId = regions.checkClick(mouse, camera);
  if (regionId) {
    document.dispatchEvent(new CustomEvent('teleport-to-region', { detail: { regionId } }));
    setTimeout(() => {
      document.dispatchEvent(new CustomEvent('enter-region-land', { detail: { regionId } }));
    }, 450);
  }
});

// ─── Mouse hover for region labels ───────────────────────────────────────────

canvas.addEventListener('mousemove', (e) => {
  if (store.get('sceneMode') === 'region-land') return;

  const mouse = CameraController.getNDC(e, canvas);
  regions.checkHover(mouse, camera, e);
});

canvas.addEventListener('click', (e) => {
  const mouse = CameraController.getNDC(e, canvas);
  const selectedObject = sandbox.pickObject(mouse, camera);

  if (selectedObject) {
    sandbox.setSelected(selectedObject.id);
    store.set('selectedSandboxObjectId', selectedObject.id);

    if (socket?.isConnected) {
      socket.send('region_action', {
        type: 'object_interact',
        data: {
          object_id: selectedObject.id,
          interaction_type: 'use',
          payload: {
            scene_mode: store.get('sceneMode'),
          },
        },
      });
    }
    return;
  }

  if (!store.get('sandboxBuildMode')) return;
  if (!e.shiftKey) return;

  const placementData = sandbox.makePlacementData(
    mouse,
    camera,
    store.get('user')?.id,
    store.get('selfRegionId'),
  );
  if (!placementData) return;

  if (!socket?.isConnected) {
    toast.error('Connect to a region before building.');
    return;
  }

  socket.send('region_action', {
    type: 'object_upsert',
    data: placementData,
  });
});

window.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && store.get('sceneMode') === 'region-land') {
    leaveRegionLand();
    return;
  }

  if (e.key.toLowerCase() === 'b') {
    const next = !store.get('sandboxBuildMode');
    store.set('sandboxBuildMode', next);
    toast.info(next ? 'Sandbox build mode enabled (Shift + Click to place).' : 'Sandbox build mode disabled.', 2500);
    return;
  }

  const selectedId = store.get('selectedSandboxObjectId');
  if (!selectedId || !socket?.isConnected) return;

  const selected = sandbox.getObjectById(selectedId);
  if (!selected) return;

  const userId = store.get('user')?.id;
  const isOwner = selected.owner_id === userId;
  if (!isOwner) return;

  if (e.key === 'Delete') {
    socket.send('region_action', {
      type: 'object_remove',
      data: { object_id: selectedId },
    });
    return;
  }

  if (e.key.toLowerCase() === 'r') {
    socket.send('region_action', {
      type: 'object_upsert',
      data: {
        id: selected.id,
        kind: selected.kind,
        material: selected.material,
        position: selected.position,
        rotation: {
          x: selected.rotation.x,
          y: Number((selected.rotation.y + 0.25).toFixed(3)),
          z: selected.rotation.z,
        },
        scale: selected.scale,
        interactive: selected.interactive,
        metadata: selected.metadata,
      },
    });
    return;
  }

  if (e.key.toLowerCase() === 'l') {
    socket.send('region_action', {
      type: 'object_interact',
      data: {
        object_id: selected.id,
        interaction_type: 'door_lock',
      },
    });
    return;
  }

  if (e.key.toLowerCase() === 'u') {
    socket.send('region_action', {
      type: 'object_interact',
      data: {
        object_id: selected.id,
        interaction_type: 'door_unlock',
      },
    });
    return;
  }

  if (e.key.toLowerCase() === 'p') {
    socket.send('region_action', {
      type: 'object_interact',
      data: {
        object_id: selected.id,
        interaction_type: 'storage_put',
        payload: { item_id: 'ore', count: 1 },
      },
    });
    return;
  }

  if (e.key.toLowerCase() === 't') {
    socket.send('region_action', {
      type: 'object_interact',
      data: {
        object_id: selected.id,
        interaction_type: 'storage_take',
        payload: { item_id: 'ore', count: 1 },
      },
    });
    return;
  }

  if (e.key.toLowerCase() === 'c') {
    socket.send('region_action', {
      type: 'object_interact',
      data: {
        object_id: selected.id,
        interaction_type: 'craft_start',
        payload: { recipe: 'iron_ingot', duration_ms: 15000 },
      },
    });
    return;
  }

  if (e.key.toLowerCase() === 'g') {
    socket.send('region_action', {
      type: 'object_interact',
      data: {
        object_id: selected.id,
        interaction_type: 'craft_collect',
      },
    });
  }
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

  if (!prefersReducedMotion && store.get('sceneMode') !== 'region-land') {
    planet.update(elapsed);
  }

  if (store.get('sceneMode') === 'region-land') {
    regionLand.update(elapsed);
  }

  cameraCtrl.update(delta);
  planet.updateLOD(cameraCtrl.distance);

  const counts = store.get('regionCounts') ?? {};
  if (store.get('sceneMode') !== 'region-land') {
    regions.update(counts, elapsed);
  }

  players.update(delta, elapsed);
  if (store.get('sceneMode') !== 'region-land') {
    minimap.update(elapsed);
  }

  // Update minimap player data
  const allPlayers = store.get('players') ?? new Map();
  const selfId = store.get('user')?.id;
  minimap.setPlayers(allPlayers, selfId);
  minimap.setRegionCounts(counts);

  renderer.render(scene, camera);
}

animate();
bootstrap();
