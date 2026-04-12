/**
 * socket-handler — WebSocket connection lifecycle + event routing.
 * Extracted from main.js for maintainability.
 */

import { RegionSocket } from '../network/websocket.js';
import { store } from '../state/store.js';
import { toast } from '../ui/toast.js';

/** @type {RegionSocket|null} */
let socket = null;

/** @type {number|null} */
let pingInterval = null;

export function getSocket() {
  return socket;
}

export function isConnected() {
  return socket?.isConnected === true;
}

export function sendMessage(type, payload) {
  if (!isConnected()) return false;
  socket.send(type, payload);
  return true;
}

/**
 * Connect to a region's WebSocket.
 * @param {string} regionId
 * @param {string} token
 * @param {{ sandbox: { applySnapshot: Function, upsert: Function, remove: Function, pulse: Function }, players: { addOrUpdate: Function, remove: Function } }} deps
 */
export function connectToRegion(regionId, token, deps) {
  if (socket) {
    clearInterval(pingInterval);
    socket.disconnect();
  }

  socket = new RegionSocket(regionId, token);

  socket.on('connected', () => {
    store.update({
      wsConnected: true,
      wsReconnecting: false,
      wsLatency: null,
      players: new Map(),
      chatMessages: [],
      sandboxObjects: new Map(),
      selectedSandboxObjectId: null,
    });
    deps.sandbox.applySnapshot([]);
    toast.success('Connected to planet!');
  });

  socket.on('disconnected', () => {
    store.set('wsConnected', false);
  });

  socket.on('reconnecting', ({ attempt }) => {
    store.set('wsReconnecting', true);
    toast.info(`Reconnecting\u2026 (attempt ${attempt})`, 3000);
  });

  socket.on('initial_state', (payload) => {
    store.set('selfRegionId', payload.region_id);

    const playerMap = new Map();
    payload.players.forEach((p) => {
      playerMap.set(p.id, p);
      deps.players.addOrUpdate(p, p.id === payload.your_id);
    });
    store.set('players', playerMap);
    store.set('chatMessages', payload.chat_history ?? []);
    store.set('worldState', payload.world_state);

    const incoming = payload.region_objects ?? [];
    deps.sandbox.applySnapshot(incoming);
    store.set('sandboxObjects', new Map(incoming.map((obj) => [obj.id, obj])));
  });

  socket.on('region_objects_snapshot', (payload) => {
    const incoming = payload.objects ?? [];
    deps.sandbox.applySnapshot(incoming);
    store.set('sandboxObjects', new Map(incoming.map((obj) => [obj.id, obj])));
  });

  socket.on('region_object_upsert', (payload) => {
    deps.sandbox.upsert(payload.object);
    const map = new Map(store.get('sandboxObjects') ?? new Map());
    map.set(payload.object.id, payload.object);
    store.set('sandboxObjects', map);
  });

  socket.on('region_object_remove', (payload) => {
    deps.sandbox.remove(payload.object_id);
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
    payload.active_events?.forEach((evt) => {
      toast.event(`\ud83c\udf0d ${evt.title}: ${evt.description}`, 10000);
    });
  });

  socket.on('player_joined', (payload) => {
    const map = new Map(store.get('players'));
    map.set(payload.id, payload);
    store.set('players', map);
    deps.players.addOrUpdate(payload);
  });

  socket.on('player_left', (payload) => {
    const map = new Map(store.get('players'));
    map.delete(payload.id);
    store.set('players', map);
    deps.players.remove(payload.id);
  });

  socket.on('position_update', (payload) => {
    const map = new Map(store.get('players'));
    const p = map.get(payload.id);
    const merged = p ? { ...p, ...payload } : payload;
    map.set(payload.id, merged);
    store.set('players', map);
    deps.players.addOrUpdate(merged);
  });

  socket.on('chat_message', (payload) => {
    const msgs = [...(store.get('chatMessages') ?? []), payload].slice(-200);
    store.set('chatMessages', msgs);
  });

  socket.on('global_event', (payload) => {
    toast.event(`\u2726 ${payload.title}: ${payload.description}`, 12000);
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
      deps.sandbox.pulse(objectId);
    }
  });

  socket.on('error', (payload) => {
    toast.error(payload?.message ?? payload?.code ?? 'Unknown error');
  });

  socket.on('pong', ({ latency }) => {
    store.set('wsLatency', latency);
  });

  socket.connect();

  pingInterval = setInterval(() => {
    if (socket?.isConnected) socket.ping();
  }, 15000);
}

/** Start position broadcast loop (2 Hz, only on change). */
export function startPositionBroadcast() {
  let lastLat = null;
  let lastLon = null;
  setInterval(() => {
    if (!isConnected()) return;
    const lat = store.get('selfLat') ?? 0;
    const lon = store.get('selfLon') ?? 0;
    if (lat === lastLat && lon === lastLon) return;
    lastLat = lat;
    lastLon = lon;
    sendMessage('position_update', { lat, lon, action: 'exploring' });
  }, 500);
}
