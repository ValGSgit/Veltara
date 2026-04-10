/**
 * Main HUD — top bar, left region panel, right player list + chat,
 * bottom bar with player card and controls.
 */

import { store } from '../state/store.js';
import { REGIONS, sanitizeHtml, relativeTime } from '@veltara/shared';

export function initHUD() {
  const hud = document.getElementById('hud');
  hud.innerHTML = buildHUD();
  bindHUDEvents();
  subscribeToState();
  return hud;
}

function buildHUD() {
  return `
    <!-- Top Bar -->
    <div id="top-bar" role="banner"
      class="fixed top-0 left-0 right-0 z-40 flex items-center justify-between px-4 h-12
             bg-veltara-bg/80 backdrop-blur-md border-b border-veltara-border">
      <div class="flex items-center gap-4">
        <span class="text-white font-bold text-lg tracking-wider">VELTARA</span>
        <span id="online-count" class="text-xs text-veltara-glow font-mono">● 0 online</span>
        <span id="active-events-count" class="text-xs text-purple-400 font-mono hidden">✦ 0 events</span>
      </div>
      <div id="planet-clock" class="text-xs font-mono text-veltara-muted tabular-nums">00:00 ☀</div>
      <div class="flex items-center gap-2">
        <button id="btn-social" aria-label="Social feed"
          class="px-2.5 py-1 text-xs rounded border border-veltara-border text-veltara-muted hover:text-white hover:border-veltara-accent transition-colors">
          Feed
        </button>
        <button id="btn-store" aria-label="Cosmetics store"
          class="px-2.5 py-1 text-xs rounded border border-veltara-border text-veltara-muted hover:text-white hover:border-veltara-accent transition-colors">
          Store
        </button>
        <button id="btn-profile" aria-label="Your profile"
          class="w-8 h-8 rounded-full bg-veltara-panel border border-veltara-border flex items-center justify-center text-veltara-muted hover:text-white hover:border-veltara-accent transition-colors">
          <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"/></svg>
        </button>
      </div>
    </div>

    <!-- Left Panel — Regions -->
    <div id="region-panel" role="navigation" aria-label="Planet regions"
      class="fixed top-12 left-0 bottom-12 z-30 w-48 bg-veltara-bg/80 backdrop-blur-md
             border-r border-veltara-border overflow-y-auto scrollbar-thin">
      <div class="p-3 text-xs font-semibold text-veltara-muted uppercase tracking-widest">Regions</div>
      <ul id="region-list" class="space-y-0.5 px-2 pb-2" role="list">
        ${REGIONS.map((r) => `
          <li>
            <button data-region-id="${r.id}"
              class="region-btn w-full text-left px-2.5 py-2 rounded-md text-xs hover:bg-veltara-panel
                     transition-colors flex items-center gap-2 focus:outline-none focus:ring-1 focus:ring-veltara-accent"
              aria-label="Teleport to ${r.name}">
              <span class="w-2 h-2 rounded-full shrink-0" style="background:${r.color}"></span>
              <span class="flex-1 truncate text-veltara-text">${r.name}</span>
              <span class="text-veltara-muted tabular-nums" data-region-count="${r.id}">0</span>
            </button>
          </li>
        `).join('')}
      </ul>
    </div>

    <!-- Right Top — Nearby Players -->
    <div id="nearby-panel"
      class="fixed top-12 right-0 z-30 w-52 bg-veltara-bg/80 backdrop-blur-md
             border-l border-veltara-border p-3 max-h-64 overflow-y-auto">
      <div class="text-xs font-semibold text-veltara-muted uppercase tracking-widest mb-2">Nearby</div>
      <ul id="nearby-list" class="space-y-1" role="list" aria-label="Nearby players"></ul>
    </div>

    <!-- Right Bottom — Chat -->
    <div id="chat-panel"
      class="fixed bottom-12 right-0 z-30 w-72 bg-veltara-bg/90 backdrop-blur-md
             border-l border-t border-veltara-border flex flex-col"
      style="height: 280px;">
      <!-- Chat tabs -->
      <div class="flex border-b border-veltara-border">
        <button id="tab-local" data-tab="local"
          class="chat-tab flex-1 py-1.5 text-xs font-medium text-veltara-accent border-b-2 border-veltara-accent"
          aria-selected="true">Local</button>
        <button id="tab-global" data-tab="global"
          class="chat-tab flex-1 py-1.5 text-xs font-medium text-veltara-muted hover:text-white transition-colors border-b-2 border-transparent"
          aria-selected="false">Global</button>
      </div>
      <!-- Messages -->
      <div id="chat-messages" class="flex-1 overflow-y-auto p-2 space-y-1" role="log" aria-live="polite" aria-label="Chat messages"></div>
      <!-- Input -->
      <form id="chat-form" class="flex items-center gap-1.5 p-2 border-t border-veltara-border">
        <input id="chat-input" type="text" maxlength="500" placeholder="Say something…" autocomplete="off"
          class="flex-1 bg-veltara-panel border border-veltara-border rounded px-2.5 py-1 text-xs text-white
                 placeholder-veltara-muted focus:outline-none focus:border-veltara-accent"
          aria-label="Chat message input" />
        <button type="submit" aria-label="Send message"
          class="px-2.5 py-1 bg-veltara-accent text-white text-xs rounded hover:bg-violet-500 transition-colors">
          Send
        </button>
      </form>
    </div>

    <!-- Bottom Bar -->
    <div id="bottom-bar" role="contentinfo"
      class="fixed bottom-0 left-0 right-0 z-40 flex items-center justify-between px-4 h-12
             bg-veltara-bg/80 backdrop-blur-md border-t border-veltara-border">
      <div class="text-xs text-veltara-muted hidden md:block">
        Drag to rotate · Scroll to zoom · Double-click region to focus
      </div>
      <div id="player-card" class="flex items-center gap-2.5">
        <div id="player-avatar" class="w-7 h-7 rounded-full bg-veltara-panel border border-veltara-border"></div>
        <div class="hidden sm:block">
          <div id="player-name" class="text-xs font-medium text-white">Not logged in</div>
          <div id="player-region" class="text-[10px] text-veltara-muted"></div>
        </div>
      </div>
      <div class="flex items-center gap-2">
        <button id="btn-settings" aria-label="Settings"
          class="p-1.5 text-veltara-muted hover:text-white transition-colors focus:outline-none focus:ring-1 focus:ring-veltara-accent rounded">
          <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"/><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"/></svg>
        </button>
      </div>
    </div>
  `;
}

function bindHUDEvents() {
  // Region teleport
  document.querySelectorAll('.region-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      const regionId = btn.dataset.regionId;
      document.dispatchEvent(new CustomEvent('teleport-to-region', { detail: { regionId } }));
    });

    btn.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') btn.click();
    });
  });

  // Chat tabs
  document.querySelectorAll('.chat-tab').forEach((tab) => {
    tab.addEventListener('click', () => {
      const tabName = tab.dataset.tab;
      store.set('chatTab', tabName);
      document.querySelectorAll('.chat-tab').forEach((t) => {
        t.classList.toggle('text-veltara-accent', t.dataset.tab === tabName);
        t.classList.toggle('border-veltara-accent', t.dataset.tab === tabName);
        t.classList.toggle('text-veltara-muted', t.dataset.tab !== tabName);
        t.classList.toggle('border-transparent', t.dataset.tab !== tabName);
        t.setAttribute('aria-selected', t.dataset.tab === tabName);
      });
    });
  });

  // Chat send
  document.getElementById('chat-form').addEventListener('submit', (e) => {
    e.preventDefault();
    const input = document.getElementById('chat-input');
    const text = input.value.trim();
    if (!text) return;
    const isGlobal = store.get('chatTab') === 'global';
    document.dispatchEvent(new CustomEvent('send-chat', { detail: { text, is_global: isGlobal } }));
    input.value = '';
  });

  // Panel buttons
  document.getElementById('btn-profile').addEventListener('click', () => {
    document.dispatchEvent(new CustomEvent('open-panel', { detail: 'profile' }));
  });
  document.getElementById('btn-social').addEventListener('click', () => {
    document.dispatchEvent(new CustomEvent('open-panel', { detail: 'social' }));
  });
  document.getElementById('btn-store').addEventListener('click', () => {
    document.dispatchEvent(new CustomEvent('open-panel', { detail: 'store' }));
  });
  document.getElementById('btn-settings').addEventListener('click', () => {
    document.dispatchEvent(new CustomEvent('open-panel', { detail: 'settings' }));
  });
}

function subscribeToState() {
  // Online count
  store.on('players', (players) => {
    document.getElementById('online-count').textContent = `● ${players.size} online`;
  });

  // World state
  store.on('worldState', (ws) => {
    if (!ws) return;
    const el = document.getElementById('active-events-count');
    const count = ws.active_events?.length ?? 0;
    if (count > 0) {
      el.textContent = `✦ ${count} event${count > 1 ? 's' : ''}`;
      el.classList.remove('hidden');
    } else {
      el.classList.add('hidden');
    }

    // Planet clock
    const progress = ws.day_cycle_progress ?? 0.5;
    const hours = Math.floor(progress * 24);
    const mins = Math.floor((progress * 24 - hours) * 60);
    const isDay = progress > 0.25 && progress < 0.75;
    document.getElementById('planet-clock').textContent =
      `${String(hours).padStart(2, '0')}:${String(mins).padStart(2, '0')} ${isDay ? '☀' : '☾'}`;
  });

  // Region counts
  store.on('regionCounts', (counts) => {
    Object.entries(counts).forEach(([id, count]) => {
      const el = document.querySelector(`[data-region-count="${id}"]`);
      if (el) el.textContent = count;
    });
  });

  // Nearby players
  store.on('players', (players) => {
    const list = document.getElementById('nearby-list');
    const arr = Array.from(players.values()).slice(0, 8);
    list.innerHTML = arr.map((p) => `
      <li class="flex items-center gap-1.5 px-1">
        <div class="w-5 h-5 rounded-full bg-veltara-panel border border-veltara-border shrink-0"></div>
        <div class="flex-1 min-w-0">
          <div class="text-[11px] text-veltara-text truncate">${sanitizeHtml(p.username)}</div>
          <div class="text-[10px] text-veltara-muted truncate">${sanitizeHtml(p.action ?? 'idle')}</div>
        </div>
      </li>
    `).join('') || '<li class="text-xs text-veltara-muted px-1">No players nearby</li>';
  });

  // Chat messages
  store.on('chatMessages', (messages) => {
    const tab = store.get('chatTab');
    const el = document.getElementById('chat-messages');
    const filtered = tab === 'global'
      ? messages.filter((m) => m.is_global)
      : messages.filter((m) => !m.is_global);

    el.innerHTML = filtered.slice(-50).map((m) => `
      <div class="text-[11px] leading-relaxed ${m.is_npc ? 'text-purple-300' : 'text-veltara-text'}">
        <span class="font-medium ${m.is_npc ? 'text-purple-400' : 'text-veltara-accent'}">
          ${m.is_npc ? '🤖 ' : ''}${sanitizeHtml(m.username)}:
        </span>
        ${sanitizeHtml(m.text)}
      </div>
    `).join('');

    // Auto scroll to bottom
    el.scrollTop = el.scrollHeight;
  });

  // User info
  store.on('user', (user) => {
    if (!user) return;
    document.getElementById('player-name').textContent = user.username;
  });

  store.on('selfRegionId', (regionId) => {
    const region = REGIONS.find((r) => r.id === regionId);
    document.getElementById('player-region').textContent = region?.name ?? '';

    // Highlight active region
    document.querySelectorAll('.region-btn').forEach((btn) => {
      btn.classList.toggle('bg-veltara-panel', btn.dataset.regionId === regionId);
    });
  });
}
