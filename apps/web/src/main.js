/**
 * main.js — Veltara Web App entry point
 *
 * Orchestrates Three.js renderer, planet engine, UI, and the main animation loop.
 * Business logic lives in engine/ modules; this file wires them together.
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
import { toast } from './ui/toast.js';
import { store } from './state/store.js';
import { REGIONS } from '@veltara/shared';
import './ui/panels.js';
import { mountLobbyShell } from './ui/lobby-shell.js';

import { connectToRegion, sendMessage, isConnected, startPositionBroadcast } from './engine/socket-handler.js';
import { handleSandboxAction, sanitizeCreateKind, sanitizeCreateMaterial, sanitizeCreateModelKey } from './engine/sandbox-actions.js';
import { initKeyboardShortcuts } from './engine/keyboard.js';
import { createLoadingScreen, bootstrap } from './engine/bootstrap.js';

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

// ─── Camera Snapshot / Transitions ────────────────────────────────────────────

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

// ─── Scene Mode Switching ─────────────────────────────────────────────────────

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
    players.instancedMesh.visible = usingVeltara;
    minimap.canvas.style.display = usingVeltara ? 'block' : 'none';

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
  players.instancedMesh.visible = usingVeltara;
  minimap.canvas.style.display = usingVeltara ? 'block' : 'none';
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
createLoadingScreen();

// ─── Event Listeners ─────────────────────────────────────────────────────────

document.addEventListener('send-chat', (e) => {
  const { text, is_global } = e.detail;
  if (!isConnected()) {
    toast.error('Not connected to planet');
    return;
  }
  sendMessage('chat_message', { text, is_global: is_global ?? false });
});

document.addEventListener('teleport-to-region', (e) => {
  const { regionId } = e.detail;
  const region = REGIONS.find((r) => r.id === regionId);
  if (!region) return;
  cameraCtrl.focusOn(region.lat, region.lon, 10);

  if (isConnected()) {
    sendMessage('position_update', { lat: region.lat, lon: region.lon, action: 'teleporting' });
    store.set('selfRegionId', regionId);
  }
});

document.addEventListener('sandbox-build-mode', (e) => {
  const enabled = Boolean(e.detail?.enabled);
  store.set('sandboxBuildMode', enabled);
  toast.info(enabled ? 'Sandbox build mode enabled (Shift + Click to place).' : 'Sandbox build mode disabled.', 2500);
});

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

document.addEventListener('sandbox-ui-action', (e) => {
  const action = e.detail?.action;
  if (!action) return;
  handleSandboxAction(action, sandbox);
});

document.addEventListener('quality-change', (e) => {
  quality = e.detail === 'low' ? 0 : e.detail === 'high' ? 2 : 1;
});

document.addEventListener('onboarding-complete', async (e) => {
  const { regionId } = e.detail;
  if (regionId) {
    document.dispatchEvent(new CustomEvent('teleport-to-region', { detail: { regionId } }));
  }
});

// ─── Canvas Events ───────────────────────────────────────────────────────────

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

  if (!isConnected()) {
    toast.error('Connect to a region before building.');
    return;
  }

  sendMessage('region_action', {
    type: 'object_upsert',
    data: placementData,
  });
});

// ─── Keyboard + Resize ───────────────────────────────────────────────────────

initKeyboardShortcuts({ sandbox, leaveRegionLand });

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

// ─── Animation Loop ──────────────────────────────────────────────────────────

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

    if (earthPlanet.group.visible) {
      earthPlanet.setSunDirection(planet.sunDirection);
    }
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

    const allPlayers = store.get('players') ?? new Map();
    const selfId = store.get('user')?.id;
    minimap.setPlayers(allPlayers, selfId);
    minimap.setRegionCounts(counts);
  }

  players.update(delta, elapsed);
  renderer.render(scene, camera);
}

animate();
bootstrap({ earthPlanet, blackHolePlanet, setActivePlanet, sandbox, players });
