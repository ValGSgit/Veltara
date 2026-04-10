/**
 * main.js — Veltara Web App entry point
 *
 * Bootstraps Three.js renderer, planet engine, UI, networking,
 * and the main animation loop.
 */

import './styles/main.css';
import * as THREE from 'three';
import { Planet } from './planet/planet.js';
import { PlanetModel } from './planet/planet-model.js';
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
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.28;
renderer.physicallyCorrectLights = true;

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
const earthPlanet = new PlanetModel(scene, '/models/earth-00.glb', {
  appearance: 'earth',
  spinSpeed: 0.0028,
  scaleMultiplier: 1.02,
});
const blackHolePlanet = new PlanetModel(scene, '/models/black_hole/source/black%20hole.fbx', {
  format: 'fbx',
  appearance: 'black-hole',
  spinSpeed: 0.0045,
  scaleMultiplier: 1.08,
});
const regions = new RegionMarkers(scene);
const players = new PlayerDots(scene);
const sandbox = new RegionSandboxLayer(scene, planet.mesh);
const regionLand = new RegionLandScene(scene);
const cameraCtrl = new CameraController(camera, canvas);
const minimap = new Minimap();
earthPlanet.setVisible(false);
blackHolePlanet.setVisible(false);

/** @type {{ spherical: { radius: number, phi: number, theta: number }, targetSpherical: { radius: number, phi: number, theta: number } } | null} */
let planetCameraSnapshot = null;

function captureCameraState() {
  return {
    spherical: {
      radius: cameraCtrl.spherical.radius,
      phi: cameraCtrl.spherical.phi,
      theta: cameraCtrl.spherical.theta,
    },
    targetSpherical: {
      radius: cameraCtrl.targetSpherical.radius,
      phi: cameraCtrl.targetSpherical.phi,
      theta: cameraCtrl.targetSpherical.theta,
    },
  };
}

function restoreCameraState(snapshot) {
  if (!snapshot) return;

  cameraCtrl.spherical.radius = snapshot.spherical.radius;
  cameraCtrl.spherical.phi = snapshot.spherical.phi;
  cameraCtrl.spherical.theta = snapshot.spherical.theta;

  cameraCtrl.targetSpherical.radius = snapshot.targetSpherical.radius;
  cameraCtrl.targetSpherical.phi = snapshot.targetSpherical.phi;
  cameraCtrl.targetSpherical.theta = snapshot.targetSpherical.theta;
}

function playTransition(callback) {
  const overlay = document.createElement('div');
  overlay.style.position = 'fixed';
  overlay.style.inset = 0;
  overlay.style.backgroundColor = '#070a14';
  overlay.style.zIndex = 9999;
  overlay.style.opacity = 0;
  overlay.style.pointerEvents = 'none';
  overlay.style.transition = 'opacity 0.3s ease-out';
  document.body.appendChild(overlay);
  
  // force reflow
  overlay.offsetHeight;
  overlay.style.opacity = 1;
  
  setTimeout(() => {
    callback();
    overlay.style.opacity = 0;
    setTimeout(() => overlay.remove(), 300);
  }, 350);
}

function setSceneMode(nextMode, regionId = null) {
  const currentMode = store.get('sceneMode');
  if (currentMode === nextMode && (nextMode !== 'region-land' || store.get('activeRegionLandId') === regionId)) {
    return;
  }

  playTransition(() => {
    if (nextMode === 'region-land') {
      if (currentMode !== 'region-land') {
        planetCameraSnapshot = captureCameraState();
      }

      store.set('sceneMode', 'region-land');
      store.set('activeRegionLandId', regionId);

      planet.mesh.visible = false;
      planet.atmosphere.visible = false;
      planet.clouds.visible = false;
      earthPlanet.setVisible(false);
      blackHolePlanet.setVisible(false);
      regions.markers.forEach((group) => { group.visible = false; });
      players.instancedMesh.visible = false;
      minimap.canvas.style.display = 'none';

      regionLand.enter(regionId);
      regionLand.focusCamera(cameraCtrl);

      sandbox.group.visible = true;
      sandbox.setPlacementSurface(regionLand.getPlacementSurface());
      return;
    }

    store.set('sceneMode', 'planet');
    store.set('activeRegionLandId', null);

    const activePlanetId = store.get('activePlanetId') ?? 'black-hole';
    const usingEarth = activePlanetId === 'earth-test';
    const usingBlackHole = activePlanetId === 'black-hole';
    const usingVeltara = !usingEarth && !usingBlackHole;
    planet.mesh.visible = usingVeltara;
    planet.atmosphere.visible = usingVeltara;
    planet.clouds.visible = usingVeltara;
    earthPlanet.setVisible(usingEarth);
    blackHolePlanet.setVisible(usingBlackHole);
    regions.markers.forEach((group) => { group.visible = usingVeltara; });
    players.instancedMesh.visible = true;
    minimap.canvas.style.display = 'block';

    regionLand.leave();
    restoreCameraState(planetCameraSnapshot);
    planetCameraSnapshot = null;

    sandbox.setSelected(null);
    store.set('selectedSandboxObjectId', null);
    store.set('sandboxBuildMode', false);
    sandbox.group.visible = false;
    sandbox.setPlacementSurface(planet.mesh);
  });
}

async function setActivePlanet(planetId) {
  const next = planetId === 'earth-test' || planetId === 'black-hole' ? planetId : 'veltara';
  const current = store.get('activePlanetId');
  if (current !== next) {
    store.set('activePlanetId', next);
  }

  if (store.get('sceneMode') !== 'planet') return;

  if (next === 'earth-test') {
    const loaded = await earthPlanet.loadIfNeeded();
    if (!loaded) {
      store.set('activePlanetId', 'black-hole');
      toast.error('Earth model failed to load. Reverting to main menu.');
      return;
    }
  }
  if (next === 'black-hole') {
    const loaded = await blackHolePlanet.loadIfNeeded();
    if (!loaded) {
      store.set('activePlanetId', 'veltara');
      toast.error('Black hole model failed to load. Reverting to Veltara.');
      return;
    }
  }

  const usingEarth = next === 'earth-test';
  const usingBlackHole = next === 'black-hole';
  const usingVeltara = !usingEarth && !usingBlackHole;
  planet.mesh.visible = usingVeltara;
  planet.atmosphere.visible = usingVeltara;
  planet.clouds.visible = usingVeltara;
  earthPlanet.setVisible(usingEarth);
  blackHolePlanet.setVisible(usingBlackHole);
  regions.markers.forEach((group) => { group.visible = usingVeltara; });
}

function enterRegionLand(regionId) {
  store.set('currentPage', 'planet');
  setSceneMode('region-land', regionId);

  toast.info('Entered region land sandbox. Press Esc to return to planet.', 3500);
}

function leaveRegionLand() {
  setSceneMode('planet');
}

// ─── HUD / Shell ─────────────────────────────────────────────────────────────

mountLobbyShell();
sandbox.group.visible = false;

// Show loading overlay
const loadingScreen = document.createElement('div');
loadingScreen.id = 'loading-screen';
const loadingContent = document.createElement('div');
loadingContent.className = 'loading-content';
const loadingText = document.createElement('div');
loadingText.className = 'text-white text-sm font-medium';
loadingText.textContent = 'Loading Veltara…';
const loadingSubtext = document.createElement('div');
loadingSubtext.className = 'loading-subtext';
loadingSubtext.textContent = 'Preparing scene';
const loadingBar = document.createElement('div');
loadingBar.className = 'loading-bar';
const loadingBarFill = document.createElement('div');
loadingBarFill.className = 'loading-bar__fill';
loadingBar.appendChild(loadingBarFill);
const loadingPercent = document.createElement('div');
loadingPercent.className = 'loading-percent';
loadingPercent.textContent = '0%';
loadingContent.appendChild(loadingText);
loadingContent.appendChild(loadingSubtext);
loadingContent.appendChild(loadingBar);
loadingContent.appendChild(loadingPercent);
loadingScreen.appendChild(loadingContent);
document.body.appendChild(loadingScreen);

function setLoadingProgress(progress, label = null) {
  const clamped = Math.max(0, Math.min(1, Number(progress) || 0));
  loadingBarFill.style.width = `${Math.round(clamped * 100)}%`;
  loadingPercent.textContent = `${Math.round(clamped * 100)}%`;
  if (label) {
    loadingSubtext.textContent = label;
  }
}

function createBootstrapProgress() {
  const steps = {
    model: { weight: 0.75, value: 0 },
    restoreSession: { weight: 0.08, value: 0 },
    joinPlanet: { weight: 0.1, value: 0 },
    loadRegions: { weight: 0.07, value: 0 },
  };

  return {
    set(step, value, label = null) {
      if (!steps[step]) return;
      steps[step].value = Math.max(0, Math.min(1, Number(value) || 0));
      const progress = Object.values(steps).reduce((sum, item) => sum + (item.weight * item.value), 0);
      setLoadingProgress(progress, label);
    },
  };
}

function mountQuickPlanetSwitcher() {
  const root = document.createElement('div');
  root.id = 'planet-quick-switcher';
  root.style.position = 'fixed';
  root.style.top = '12px';
  root.style.right = '12px';
  root.style.zIndex = '10001';
  root.style.display = 'flex';
  root.style.gap = '6px';
  root.style.padding = '6px';
  root.style.borderRadius = '999px';
  root.style.pointerEvents = 'auto';
  root.style.background = 'rgba(8, 12, 24, 0.7)';
  root.style.border = '1px solid rgba(165, 211, 255, 0.28)';
  root.style.backdropFilter = 'blur(8px)';

  const makeButton = (id, label) => {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.textContent = label;
    btn.style.padding = '6px 10px';
    btn.style.fontSize = '12px';
    btn.style.fontWeight = '700';
    btn.style.borderRadius = '999px';
    btn.style.cursor = 'pointer';
    btn.style.color = '#eaf4ff';
    btn.style.background = 'rgba(255, 255, 255, 0.05)';
    btn.style.border = '1px solid rgba(165, 211, 255, 0.22)';
    btn.addEventListener('click', () => {
      document.dispatchEvent(new CustomEvent('planet-select', { detail: { planetId: id } }));
    });
    return btn;
  };

  const buttons = [
    ['black-hole', makeButton('black-hole', 'Black Hole')],
    ['veltara', makeButton('veltara', 'Veltara')],
    ['earth-test', makeButton('earth-test', 'Earth')],
  ];
  buttons.forEach(([, btn]) => root.appendChild(btn));
  document.body.appendChild(root);

  function updateActive(activePlanetId) {
    buttons.forEach(([id, btn]) => {
      const active = id === activePlanetId;
      btn.style.borderColor = active ? 'rgba(95, 210, 255, 0.65)' : 'rgba(165, 211, 255, 0.22)';
      btn.style.background = active
        ? 'linear-gradient(135deg, rgba(55, 203, 255, 0.32), rgba(84, 111, 255, 0.3))'
        : 'rgba(255, 255, 255, 0.05)';
    });
  }

  updateActive(store.get('activePlanetId') ?? 'black-hole');
  store.on('activePlanetId', (next) => updateActive(next ?? 'black-hole'));
}

mountQuickPlanetSwitcher();

// ─── WebSocket State ──────────────────────────────────────────────────────────

/** @type {RegionSocket|null} */
let socket = null;

function connectToRegion(regionId, token) {
  if (socket) {
    clearInterval(socket._pingInterval);
    socket.disconnect();
  }
  socket = new RegionSocket(regionId, token);

  socket.on('connected', () => {
    store.set('wsConnected', true);
    store.set('wsReconnecting', false);
    store.set('wsLatency', null);
    // Clear stale state from previous connection — fresh data arrives via initial_state
    store.set('players', new Map());
    store.set('chatMessages', []);
    sandbox.applySnapshot([]);
    store.set('sandboxObjects', new Map());
    store.set('selectedSandboxObjectId', null);
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

  socket.on('error', (payload) => {
    const msg = payload?.message ?? payload?.code ?? 'Unknown error';
    toast.error(msg);
  });

  socket.on('pong', ({ latency }) => {
    store.set('wsLatency', latency);
  });

  socket.connect();

  // Periodic ping for latency tracking and dead connection detection
  const pingInterval = setInterval(() => {
    if (socket?.isConnected) {
      socket.ping();
    }
  }, 15000);

  // Store cleanup ref so we can clear on next connect
  socket._pingInterval = pingInterval;
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

function sanitizeCreateKind(value) {
  const allowed = new Set(['block', 'platform', 'beacon', 'orb']);
  const next = String(value ?? '').trim().toLowerCase();
  return allowed.has(next) ? next : 'block';
}

function sanitizeCreateMaterial(value) {
  const allowed = new Set(['stone', 'metal', 'wood', 'glass', 'neon']);
  const next = String(value ?? '').trim().toLowerCase();
  return allowed.has(next) ? next : 'stone';
}

function sanitizeCreateModelKey(value) {
  const normalized = normalizeModelKey(value);
  return /^[a-z0-9][a-z0-9-_]{0,63}$/.test(normalized) ? normalized : '';
}

document.addEventListener('sandbox-create-settings', (e) => {
  const detail = e.detail ?? {};
  store.set('sandboxCreateKind', sanitizeCreateKind(detail.kind));
  store.set('sandboxCreateMaterial', sanitizeCreateMaterial(detail.material));
  store.set('sandboxCreateModelKey', sanitizeCreateModelKey(detail.modelKey));
});

document.addEventListener('enter-region-land', (e) => {
  const { regionId } = e.detail ?? {};
  if (!regionId) return;
  enterRegionLand(regionId);
});

document.addEventListener('leave-region-land', () => {
  leaveRegionLand();
});

document.addEventListener('planet-select', (e) => {
  const planetId = String(e.detail?.planetId ?? 'veltara');
  void setActivePlanet(planetId);
});

function sendSandboxInteraction(interactionType, payload) {
  const selectedId = store.get('selectedSandboxObjectId');
  if (!selectedId || !socket?.isConnected) return;

  const selected = sandbox.getObjectById(selectedId);
  if (!selected) return;

  socket.send('region_action', {
    type: 'object_interact',
    data: {
      object_id: selected.id,
      interaction_type: interactionType,
      payload,
    },
  });
}

function normalizeObjectName(value) {
  return String(value ?? '').trim().replace(/\s+/g, ' ').slice(0, 64);
}

function normalizeUserId(value) {
  return String(value ?? '').trim().slice(0, 64);
}

function normalizeModelKey(value) {
  return String(value ?? '').trim().toLowerCase().slice(0, 64);
}

function getMetadataValidationError(name) {
  if (!name) return null;
  if (/[<>]/.test(name)) return 'Name cannot include angle brackets.';
  if (/[\u0000-\u001F\u007F]/.test(name)) return 'Name contains unsupported control characters.';
  if (/\b(?:https?:\/\/|www\.)\S+/i.test(name)) return 'Name cannot contain links.';
  return null;
}

function getModelKeyValidationError(modelKey) {
  if (!modelKey) return null;
  if (!/^[a-z0-9][a-z0-9-_]{0,63}$/.test(modelKey)) {
    return 'Model key must use letters, numbers, dash, or underscore.';
  }
  return null;
}

function getNodeType(object) {
  const explicit = object?.metadata?.node_type;
  if (explicit === 'door' || explicit === 'storage' || explicit === 'crafting') return explicit;
  if (object?.kind === 'beacon') return 'door';
  if (object?.kind === 'platform') return 'crafting';
  return 'storage';
}

function canRepairObject(object, userId) {
  const health = object?.metadata?.health;
  const max = Number(health?.max ?? 100);
  const current = Number(health?.current ?? max);
  const role = object?.metadata?.permissions?.[userId];
  return current < max && (object?.owner_id === userId || role === 'builder');
}

function sendRepairInteraction() {
  const selectedId = store.get('selectedSandboxObjectId');
  if (!selectedId || !socket?.isConnected) return;
  const selected = sandbox.getObjectById(selectedId);
  if (!selected) return;

  const userId = store.get('user')?.id;
  if (!userId || !canRepairObject(selected, userId)) return;
  sendSandboxInteraction('repair');
}

function rotateSelectedSandboxObject() {
  const selectedId = store.get('selectedSandboxObjectId');
  if (!selectedId || !socket?.isConnected) return;

  const selected = sandbox.getObjectById(selectedId);
  if (!selected) return;

  const userId = store.get('user')?.id;
  if (selected.owner_id !== userId) return;

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
}

function removeSelectedSandboxObject() {
  const selectedId = store.get('selectedSandboxObjectId');
  if (!selectedId || !socket?.isConnected) return;

  const selected = sandbox.getObjectById(selectedId);
  if (!selected) return;

  const userId = store.get('user')?.id;
  if (selected.owner_id !== userId) return;

  socket.send('region_action', {
    type: 'object_remove',
    data: { object_id: selectedId },
  });
}

document.addEventListener('sandbox-ui-action', (e) => {
  const action = e.detail?.action;
  if (!action) return;
  const actionType = typeof action === 'string' ? action : action.type;
  const actionPayload = typeof action === 'string' ? undefined : action.payload;

  if (actionType === 'use') {
    sendSandboxInteraction('use', { scene_mode: store.get('sceneMode') });
    return;
  }

  if (actionType === 'rotate') {
    rotateSelectedSandboxObject();
    return;
  }

  if (actionType === 'remove') {
    removeSelectedSandboxObject();
    return;
  }

  if (actionType === 'lock') {
    sendSandboxInteraction('door_lock');
    return;
  }

  if (actionType === 'unlock') {
    sendSandboxInteraction('door_unlock');
    return;
  }

  if (actionType === 'put') {
    sendSandboxInteraction('storage_put', { item_id: 'ore', count: 1 });
    return;
  }

  if (actionType === 'take') {
    sendSandboxInteraction('storage_take', { item_id: 'ore', count: 1 });
    return;
  }

  if (actionType === 'start-craft') {
    sendSandboxInteraction('craft_start', { recipe: 'iron_ingot', duration_ms: 15000 });
    return;
  }

  if (actionType === 'collect-craft') {
    sendSandboxInteraction('craft_collect');
    return;
  }

  if (actionType === 'repair') {
    sendRepairInteraction();
    return;
  }

  if (actionType === 'set-name') {
    const selectedId = store.get('selectedSandboxObjectId');
    const selected = selectedId ? sandbox.getObjectById(selectedId) : null;
    if (!selected || !socket?.isConnected) return;
    const userId = store.get('user')?.id;
    if (selected.owner_id !== userId) return;
    const name = normalizeObjectName(actionPayload?.name);
    const validationError = getMetadataValidationError(name);
    if (validationError) {
      toast.error(validationError);
      return;
    }
    socket.send('region_action', {
      type: 'object_upsert',
      data: {
        id: selected.id,
        kind: selected.kind,
        material: selected.material,
        position: selected.position,
        rotation: selected.rotation,
        scale: selected.scale,
        interactive: selected.interactive,
        metadata: { ...(selected.metadata ?? {}), name },
        version: selected.version,
      },
    });
    return;
  }

  if (actionType === 'set-model-key') {
    const selectedId = store.get('selectedSandboxObjectId');
    const selected = selectedId ? sandbox.getObjectById(selectedId) : null;
    if (!selected || !socket?.isConnected) return;
    const userId = store.get('user')?.id;
    if (selected.owner_id !== userId) return;

    const modelKey = normalizeModelKey(actionPayload?.model_key);
    const validationError = getModelKeyValidationError(modelKey);
    if (validationError) {
      toast.error(validationError);
      return;
    }

    const nextMetadata = { ...(selected.metadata ?? {}) };
    if (modelKey) {
      nextMetadata.model_key = modelKey;
    } else {
      delete nextMetadata.model_key;
    }

    socket.send('region_action', {
      type: 'object_upsert',
      data: {
        id: selected.id,
        kind: selected.kind,
        material: selected.material,
        position: selected.position,
        rotation: selected.rotation,
        scale: selected.scale,
        interactive: selected.interactive,
        metadata: nextMetadata,
        version: selected.version,
      },
    });
    return;
  }

  if (actionType === 'grant-builder' || actionType === 'revoke-builder') {
    const selectedId = store.get('selectedSandboxObjectId');
    const selected = selectedId ? sandbox.getObjectById(selectedId) : null;
    if (!selected || !socket?.isConnected) return;
    const userId = store.get('user')?.id;
    if (selected.owner_id !== userId) return;
    const targetUserId = normalizeUserId(actionPayload?.user_id);
    if (!targetUserId || targetUserId === userId) return;
    const permissions = { ...(selected.metadata?.permissions ?? {}) };
    if (actionType === 'grant-builder') {
      permissions[targetUserId] = 'builder';
    } else {
      delete permissions[targetUserId];
    }
    socket.send('region_action', {
      type: 'object_upsert',
      data: {
        id: selected.id,
        kind: selected.kind,
        material: selected.material,
        position: selected.position,
        rotation: selected.rotation,
        scale: selected.scale,
        interactive: selected.interactive,
        metadata: { ...(selected.metadata ?? {}), permissions },
        version: selected.version,
      },
    });
  }
});

// ─── Planet double-click → focus region ──────────────────────────────────────

canvas.addEventListener('dblclick', (e) => {
  if (store.get('sceneMode') === 'region-land') return;
  if (store.get('activePlanetId') !== 'veltara') return;

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
  if (store.get('activePlanetId') !== 'veltara') return;

  const mouse = CameraController.getNDC(e, canvas);
  regions.checkHover(mouse, camera, e);
});

canvas.addEventListener('click', (e) => {
  if (store.get('sceneMode') !== 'region-land') return;

  const mouse = CameraController.getNDC(e, canvas);
  const selectedObject = sandbox.pickObject(mouse, camera);

  if (selectedObject) {
    sandbox.setSelected(selectedObject.id);
    store.set('selectedSandboxObjectId', selectedObject.id);
    return;
  }

  // Click on empty space deselects
  if (store.get('selectedSandboxObjectId')) {
    sandbox.setSelected(null);
    store.set('selectedSandboxObjectId', null);
  }

  if (!store.get('sandboxBuildMode')) return;
  if (!e.shiftKey) return;

  const placementData = sandbox.makePlacementData(
    mouse,
    camera,
    store.get('user')?.id,
    store.get('activeRegionLandId') ?? store.get('selfRegionId'),
    store.get('sandboxCreateKind') ?? 'block',
    store.get('sandboxCreateMaterial') ?? 'stone',
    store.get('sandboxCreateModelKey') ?? '',
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
  if (store.get('sceneMode') !== 'region-land') {
    if (e.key === '1') {
      document.dispatchEvent(new CustomEvent('planet-select', { detail: { planetId: 'black-hole' } }));
      return;
    }
    if (e.key === '2') {
      document.dispatchEvent(new CustomEvent('planet-select', { detail: { planetId: 'veltara' } }));
      return;
    }
    if (e.key === '3') {
      document.dispatchEvent(new CustomEvent('planet-select', { detail: { planetId: 'earth-test' } }));
      return;
    }
  }

  if (e.key === 'Escape' && store.get('sceneMode') === 'region-land') {
    leaveRegionLand();
    return;
  }

  // Don't hijack keys when the user is typing in an input or textarea
  const tag = e.target?.tagName;
  if (tag === 'INPUT' || tag === 'TEXTAREA' || e.target?.isContentEditable) return;

  if (store.get('sceneMode') !== 'region-land') return;

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
  const nodeType = getNodeType(selected);

  if (e.key === 'Delete') {
    if (!isOwner) return;
    removeSelectedSandboxObject();
    return;
  }

  if (e.key.toLowerCase() === 'r') {
    if (!isOwner) return;
    rotateSelectedSandboxObject();
    return;
  }

  if (e.key.toLowerCase() === 'l') {
    if (!isOwner || nodeType !== 'door') return;
    sendSandboxInteraction('door_lock');
    return;
  }

  if (e.key.toLowerCase() === 'u') {
    if (!isOwner || nodeType !== 'door') return;
    sendSandboxInteraction('door_unlock');
    return;
  }

  if (e.key.toLowerCase() === 'p') {
    if (nodeType !== 'storage') return;
    sendSandboxInteraction('storage_put', { item_id: 'ore', count: 1 });
    return;
  }

  if (e.key.toLowerCase() === 't') {
    if (nodeType !== 'storage') return;
    sendSandboxInteraction('storage_take', { item_id: 'ore', count: 1 });
    return;
  }

  if (e.key.toLowerCase() === 'c') {
    if (nodeType !== 'crafting') return;
    sendSandboxInteraction('craft_start', { recipe: 'iron_ingot', duration_ms: 15000 });
    return;
  }

  if (e.key.toLowerCase() === 'g') {
    if (nodeType !== 'crafting') return;
    sendSandboxInteraction('craft_collect');
    return;
  }

  if (e.key.toLowerCase() === 'h') {
    sendRepairInteraction();
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
  const progress = createBootstrapProgress();
  const startupPlanetId = store.get('activePlanetId') ?? 'black-hole';
  const startupPlanet =
    startupPlanetId === 'earth-test'
      ? earthPlanet
      : startupPlanetId === 'black-hole'
        ? blackHolePlanet
        : null;
  if (startupPlanet) {
    progress.set('model', 0, `Loading ${startupPlanetId === 'earth-test' ? 'Earth' : 'Black Hole'} model`);
    const loaded = await startupPlanet.loadIfNeeded({
      onProgress: ({ ratio, loaded: bytesLoaded, total: bytesTotal }) => {
        if (ratio != null) {
          progress.set('model', ratio, `Loading model (${Math.round(ratio * 100)}%)`);
          return;
        }
        if (bytesTotal > 0) {
          const computed = Math.min(1, Math.max(0, bytesLoaded / bytesTotal));
          progress.set('model', computed, `Loading model (${Math.round(computed * 100)}%)`);
          return;
        }
        progress.set('model', 0, 'Loading model');
      },
    });
    if (!loaded) {
      progress.set('model', 1, 'Model load failed, using Veltara');
      store.set('activePlanetId', 'veltara');
    } else {
      progress.set('model', 1, 'Model loaded');
    }
  } else {
    progress.set('model', 1, 'Preparing Veltara');
  }

  await setActivePlanet(store.get('activePlanetId'));
  progress.set('restoreSession', 0, 'Restoring session');

  // Try to restore session
  const user = await api.restoreSession();
  progress.set('restoreSession', 1, 'Session restored');

  if (user) {
    store.update({ user, isAuthenticated: true });

    progress.set('joinPlanet', 0, 'Joining planet');
    // Join planet
    try {
      const { region_id } = await api.joinPlanet(0, 0);
      store.set('selfRegionId', region_id);
      connectToRegion(region_id, localStorage.getItem('access_token'));
    } catch {
      toast.error('Failed to join planet');
    }
    progress.set('joinPlanet', 1, 'Planet joined');

    // Check onboarding
    if (!localStorage.getItem('onboarding_complete')) {
      showOnboarding();
    }
  } else {
    progress.set('joinPlanet', 1, 'Awaiting sign in');
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

  progress.set('loadRegions', 0, 'Loading regions');
  // Load regions
  try {
    const { regions: regionData } = await api.getRegions();
    store.set('regions', regionData);
    const counts = {};
    regionData.forEach((r) => { counts[r.id] = r.player_count; });
    store.set('regionCounts', counts);
  } catch { /* non-critical */ }
  progress.set('loadRegions', 1, 'Ready');

  // Dismiss loading screen
  setLoadingProgress(1, 'Ready');
  loadingScreen.style.opacity = '0';
  loadingScreen.style.transition = 'opacity 0.5s';
  setTimeout(() => loadingScreen.remove(), 500);

  // Start position update broadcast loop — only send when position changes
  let lastSentLat = null;
  let lastSentLon = null;
  setInterval(() => {
    if (!socket?.isConnected) return;
    const lat = store.get('selfLat') ?? 0;
    const lon = store.get('selfLon') ?? 0;
    if (lat === lastSentLat && lon === lastSentLon) return;
    lastSentLat = lat;
    lastSentLon = lon;
    socket.send('position_update', { lat, lon, action: 'exploring' });
  }, 500); // 2hz — fast enough for smooth region assignment, light on bandwidth
}

// ─── Animation Loop ───────────────────────────────────────────────────────────

const clock = new THREE.Clock();
let frameCount = 0;

const reducedMotionQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
let prefersReducedMotion = reducedMotionQuery.matches;
reducedMotionQuery.addEventListener('change', (e) => { prefersReducedMotion = e.matches; });

function animate() {
  requestAnimationFrame(animate);

  const delta = clock.getDelta();
  const elapsed = clock.getElapsedTime();
  frameCount++;

  if (!prefersReducedMotion && store.get('sceneMode') !== 'region-land') {
    planet.update(elapsed);
  }

  if (store.get('sceneMode') !== 'region-land') {
    earthPlanet.update(elapsed);
    blackHolePlanet.update(elapsed);
  }

  if (store.get('sceneMode') === 'region-land') {
    regionLand.update(elapsed);
  }

  cameraCtrl.update(delta);

  const inRegionLand = store.get('sceneMode') === 'region-land';
  const counts = store.get('regionCounts') ?? {};

  if (!inRegionLand) {
    planet.updateLOD(cameraCtrl.distance);
    regions.update(counts, elapsed);
    minimap.update(elapsed);

    // Update minimap player data (skip in region-land — minimap is hidden)
    const allPlayers = store.get('players') ?? new Map();
    const selfId = store.get('user')?.id;
    minimap.setPlayers(allPlayers, selfId);
    minimap.setRegionCounts(counts);
  }

  players.update(delta, elapsed);

  renderer.render(scene, camera);
}

animate();
bootstrap();
