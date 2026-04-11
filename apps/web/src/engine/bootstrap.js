/**
 * bootstrap — Loading screen, progress tracking, and startup sequence.
 * Extracted from main.js for maintainability.
 */

import { store } from '../state/store.js';
import { api } from '../network/api.js';
import { toast } from '../ui/toast.js';
import { showLoginModal } from '../ui/auth.js';
import { showOnboarding } from '../ui/onboarding-flow.js';
import { connectToRegion, startPositionBroadcast } from './socket-handler.js';

// ─── Loading Screen ───────────────────────────────────────────────────────────

let loadingScreen, loadingBarFill, loadingSubtext, loadingPercent;

export function createLoadingScreen() {
  loadingScreen = document.createElement('div');
  loadingScreen.id = 'loading-screen';

  const content = document.createElement('div');
  content.className = 'loading-content';

  const title = document.createElement('div');
  title.className = 'text-white text-sm font-medium';
  title.textContent = 'Loading Veltara\u2026';

  loadingSubtext = document.createElement('div');
  loadingSubtext.className = 'loading-subtext';
  loadingSubtext.textContent = 'Preparing scene';

  const bar = document.createElement('div');
  bar.className = 'loading-bar';
  loadingBarFill = document.createElement('div');
  loadingBarFill.className = 'loading-bar__fill';
  bar.appendChild(loadingBarFill);

  loadingPercent = document.createElement('div');
  loadingPercent.className = 'loading-percent';
  loadingPercent.textContent = '0%';

  content.append(title, loadingSubtext, bar, loadingPercent);
  loadingScreen.appendChild(content);
  document.body.appendChild(loadingScreen);
}

function setProgress(progress, label = null) {
  const pct = Math.round(Math.max(0, Math.min(1, Number(progress) || 0)) * 100);
  loadingBarFill.style.width = `${pct}%`;
  loadingPercent.textContent = `${pct}%`;
  if (label) loadingSubtext.textContent = label;
}

function createProgressTracker() {
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
      const total = Object.values(steps).reduce((sum, s) => sum + s.weight * s.value, 0);
      setProgress(total, label);
    },
  };
}

function dismissLoadingScreen() {
  setProgress(1, 'Ready');
  loadingScreen.style.opacity = '0';
  loadingScreen.style.transition = 'opacity 0.5s';
  setTimeout(() => loadingScreen.remove(), 500);
}

// ─── Bootstrap ────────────────────────────────────────────────────────────────

/**
 * @param {{ earthPlanet: object, blackHolePlanet: object, setActivePlanet: Function, sandbox: object, players: object }} deps
 */
export async function bootstrap(deps) {
  const { earthPlanet, blackHolePlanet, setActivePlanet, sandbox, players } = deps;
  const progress = createProgressTracker();

  // 1. Load startup model
  const startupPlanetId = store.get('activePlanetId') ?? 'black-hole';
  const startupPlanet =
    startupPlanetId === 'earth-test' ? earthPlanet
      : startupPlanetId === 'black-hole' ? blackHolePlanet
        : null;

  if (startupPlanet) {
    const label = startupPlanetId === 'earth-test' ? 'Earth' : 'Black Hole';
    progress.set('model', 0, `Loading ${label} model`);

    const loaded = await startupPlanet.loadIfNeeded({
      onProgress: ({ ratio, loaded: bytesLoaded, total: bytesTotal }) => {
        const r = ratio ?? (bytesTotal > 0 ? Math.min(1, bytesLoaded / bytesTotal) : 0);
        progress.set('model', r, `Loading model (${Math.round(r * 100)}%)`);
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

  // 2. Restore session
  progress.set('restoreSession', 0, 'Restoring session');
  const user = await api.restoreSession();
  progress.set('restoreSession', 1, 'Session restored');

  const socketDeps = { sandbox, players };

  if (user) {
    store.update({ user, isAuthenticated: true });
    progress.set('joinPlanet', 0, 'Joining planet');
    try {
      const { region_id } = await api.joinPlanet(0, 0);
      store.set('selfRegionId', region_id);
      connectToRegion(region_id, localStorage.getItem('access_token'), socketDeps);
    } catch {
      toast.error('Failed to join planet');
    }
    progress.set('joinPlanet', 1, 'Planet joined');

    if (!localStorage.getItem('onboarding_complete')) showOnboarding();
  } else {
    progress.set('joinPlanet', 1, 'Awaiting sign in');
    showLoginModal((u) => {
      store.update({ user: u, isAuthenticated: true });
      api.joinPlanet(0, 0).then(({ region_id }) => {
        store.set('selfRegionId', region_id);
        connectToRegion(region_id, localStorage.getItem('access_token'), socketDeps);
        if (!localStorage.getItem('onboarding_complete')) showOnboarding();
      }).catch(() => toast.error('Failed to join planet'));
    });
  }

  // 3. Load regions
  progress.set('loadRegions', 0, 'Loading regions');
  try {
    const { regions: regionData } = await api.getRegions();
    store.set('regions', regionData);
    const counts = {};
    regionData.forEach((r) => { counts[r.id] = r.player_count; });
    store.set('regionCounts', counts);
  } catch { /* non-critical */ }
  progress.set('loadRegions', 1, 'Ready');

  dismissLoadingScreen();
  startPositionBroadcast();
}
