/**
 * Global client-side state store.
 * Simple event-emitter based reactive store — no framework needed.
 */

function createStore(initial) {
  let state = { ...initial };
  const listeners = new Map();

  return {
    get(key) { return state[key]; },
    getAll() { return { ...state }; },

    set(key, value) {
      const prev = state[key];
      state[key] = value;
      listeners.get(key)?.forEach((fn) => fn(value, prev));
      listeners.get('*')?.forEach((fn) => fn({ key, value, prev }));
    },

    update(updates) {
      Object.entries(updates).forEach(([k, v]) => this.set(k, v));
    },

    on(key, fn) {
      if (!listeners.has(key)) listeners.set(key, new Set());
      listeners.get(key).add(fn);
      return () => listeners.get(key).delete(fn);
    },

    once(key, fn) {
      const unsubscribe = this.on(key, (val, prev) => { fn(val, prev); unsubscribe(); });
    },
  };
}

export const store = createStore({
  // Auth
  user: null,
  isAuthenticated: false,

  // Planet
  worldState: null,
  regions: [],
  regionCounts: {},
  players: new Map(),
  selfRegionId: null,
  selfLat: 0,
  selfLon: 0,
  sandboxObjects: new Map(),
  sandboxBuildMode: false,
  sandboxCreateKind: 'block',
  sandboxCreateMaterial: 'stone',
  sandboxCreateModelKey: '',
  selectedSandboxObjectId: null,
  sceneMode: 'planet', // 'planet' | 'region-land'
  activeRegionLandId: null,
  currentPage: 'home', // 'home' | 'planet'
  activePlanetId: 'black-hole', // 'black-hole' | 'veltara' | 'earth-test'

  // Chat
  chatMessages: [],
  chatTab: 'local', // 'local' | 'global'

  // UI panels
  activePanel: null, // 'profile' | 'social' | 'store' | 'settings' | null
  authModal: null, // 'login' | 'register' | null
  showOnboarding: false,
  modelLabOpen: false,
  creatorStudioOpen: false,
  lobbyViewOptions: {
    showTopStats: true,
    showRegions: true,
    showWorldPulse: true,
    showSpotlight: true,
    showFooterHints: true,
  },

  // Connection
  wsConnected: false,
  wsReconnecting: false,
  wsLatency: null,

  // Notifications
  activeEvents: [],
});
