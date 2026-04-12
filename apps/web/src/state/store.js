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

    /** Set multiple keys at once. Per-key listeners fire for each key;
     *  the wildcard '*' listener fires once per key as well (same as set),
     *  but all state mutations happen before any listener fires. */
    update(updates) {
      const entries = Object.entries(updates);
      const prev = {};
      // Apply all mutations first
      entries.forEach(([k, v]) => {
        prev[k] = state[k];
        state[k] = v;
      });
      // Then fire per-key listeners
      entries.forEach(([k, v]) => {
        listeners.get(k)?.forEach((fn) => fn(v, prev[k]));
        listeners.get('*')?.forEach((fn) => fn({ key: k, value: v, prev: prev[k] }));
      });
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
  currentPage: 'welcome', // 'welcome' | 'home' | 'planet'
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
  // Connection
  wsConnected: false,
  wsReconnecting: false,
  wsLatency: null,

  // Notifications
  activeEvents: [],
});
