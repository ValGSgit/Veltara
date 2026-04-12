<script setup>
import PillButton from './ui/PillButton.vue';

const props = defineProps({
  currentPage:       { type: String,  default: 'welcome' },
  isAuthenticated:   { type: Boolean, default: false },
  username:          { type: String,  default: '' },
  wsConnected:       { type: Boolean, default: false },
  wsReconnecting:    { type: Boolean, default: false },
  wsLatency:         { type: Number,  default: null },
  sceneMode:         { type: String,  default: 'planet' },
  sandboxBuildMode:  { type: Boolean, default: false },
  activeRegionName:  { type: String,  default: '' },
});

const emit = defineEmits(['navigate', 'open-panel', 'auth']);

function onBrandClick() {
  emit('navigate', props.isAuthenticated ? 'home' : 'welcome');
}

function statusLabel() {
  if (props.wsReconnecting) return '↻ Reconnecting';
  if (props.wsConnected)    return '● Online';
  return '✕ Offline';
}

function statusClass() {
  if (props.wsReconnecting) return 'is-reconnecting';
  if (props.wsConnected)    return 'is-online';
  return 'is-offline';
}
</script>

<template>
  <nav class="app-nav glass-panel" aria-label="Main navigation">

    <!-- Brand -->
    <button
      class="app-nav__brand"
      type="button"
      :aria-label="isAuthenticated ? 'Go to home' : 'Go to welcome'"
      @click="onBrandClick"
    >
      <span class="app-nav__logo" aria-hidden="true">V</span>
      <span class="app-nav__title">VELTARA</span>
    </button>

    <!-- Page links -->
    <div class="app-nav__links" role="list">
      <PillButton
        v-for="link in [
          { page: 'home',    label: 'Home'    },
          { page: 'planet',  label: 'Planet'  },
          { page: 'profile', label: 'Profile' },
          { page: 'shop',    label: 'Shop'    },
        ]"
        :key="link.page"
        role="listitem"
        class="app-nav__link"
        :active="currentPage === link.page"
        @click="emit('navigate', link.page)"
      >{{ link.label }}</PillButton>
    </div>

    <!-- Right: status + context + user -->
    <div class="app-nav__actions">

      <!-- Region-land context badge -->
      <span
        v-if="sceneMode === 'region-land'"
        class="app-nav__context-badge"
        aria-live="polite"
      >
        {{ sandboxBuildMode ? 'Build' : 'Region' }} · {{ activeRegionName || 'Active Region' }}
      </span>

      <!-- WS status + latency -->
      <span
        class="app-nav__status"
        :class="statusClass()"
        aria-live="polite"
        :aria-label="`Connection status: ${statusLabel()}`"
      >
        {{ statusLabel() }}
        <span v-if="wsConnected && wsLatency !== null" class="app-nav__latency">
          {{ wsLatency }}ms
        </span>
      </span>

      <!-- Auth -->
      <PillButton
        v-if="!isAuthenticated"
        size="md"
        class="app-nav__cta"
        @click="emit('auth', 'login')"
      >Sign in</PillButton>
      <button
        v-else
        class="app-nav__user"
        type="button"
        :aria-label="`Open profile for ${username || 'Explorer'}`"
        @click="emit('open-panel', 'profile')"
      >
        <span class="app-nav__user-avatar">{{ (username || 'E').charAt(0).toUpperCase() }}</span>
        <span class="app-nav__user-name">{{ username || 'Explorer' }}</span>
      </button>

    </div>
  </nav>
</template>

<style scoped>
.app-nav {
  position: fixed;
  top: 12px;
  left: 50%;
  translate: -50% 0;
  z-index: 100;
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.45rem 0.65rem;
  border-radius: 1.2rem;
  width: min(900px, calc(100vw - 24px));
  pointer-events: auto;
}

/* ─── Brand ─────────────────────────────────────────────────────────────────── */

.app-nav__brand {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 4px 10px 4px 6px;
  border-radius: 0.9rem;
  background: transparent;
  border: none;
  cursor: pointer;
  transition: var(--pill-transition);
  flex-shrink: 0;
  color: inherit;
}

.app-nav__brand:hover {
  background: var(--glass-bg);
}

.app-nav__logo {
  width: 26px;
  height: 26px;
  border-radius: 50%;
  background: linear-gradient(145deg, rgba(102, 112, 255, 0.9), rgba(79, 255, 176, 0.7));
  display: grid;
  place-items: center;
  font-size: 0.75rem;
  font-weight: 700;
  color: #fff;
  flex-shrink: 0;
}

.app-nav__title {
  font-size: 0.78rem;
  font-weight: 700;
  letter-spacing: 0.12em;
  color: #e8f0ff;
}

/* ─── Nav links ──────────────────────────────────────────────────────────────── */

.app-nav__links {
  display: flex;
  align-items: center;
  gap: 0.25rem;
  flex: 1;
}

.app-nav__link {
  font-size: 0.8rem;
}

/* ─── Right side ─────────────────────────────────────────────────────────────── */

.app-nav__actions {
  display: flex;
  align-items: center;
  gap: 0.45rem;
  flex-shrink: 0;
}

.app-nav__context-badge {
  padding: 4px 10px;
  border-radius: 999px;
  font-size: 0.72rem;
  font-weight: 500;
  white-space: nowrap;
  border: 1px solid var(--glow-border);
  background: var(--glow-bg);
  color: #9fffe4;
}

.app-nav__status {
  display: flex;
  align-items: center;
  gap: 5px;
  padding: 4px 10px;
  border-radius: 999px;
  font-size: 0.72rem;
  font-weight: 600;
  white-space: nowrap;
  border: 1px solid;
  transition: var(--pill-transition);
}

.app-nav__status.is-online {
  color: #9fffe4;
  border-color: rgba(79, 255, 176, 0.28);
  background: rgba(19, 54, 42, 0.35);
}

.app-nav__status.is-reconnecting {
  color: #ffca79;
  border-color: rgba(255, 202, 121, 0.28);
  background: rgba(54, 42, 10, 0.35);
}

.app-nav__status.is-offline {
  color: #ffa0a0;
  border-color: rgba(255, 100, 100, 0.28);
  background: rgba(54, 20, 20, 0.35);
}

.app-nav__latency {
  font-family: 'IBM Plex Mono', monospace;
  font-size: 0.66rem;
  opacity: 0.7;
}

.app-nav__user {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 4px 10px 4px 4px;
  border-radius: 999px;
  border: 1px solid var(--glass-border);
  background: var(--glass-bg);
  cursor: pointer;
  transition: var(--pill-transition);
  color: inherit;
}

.app-nav__user:hover {
  border-color: var(--glow-border);
  background: var(--glow-bg);
}

.app-nav__user-avatar {
  width: 22px;
  height: 22px;
  border-radius: 50%;
  background: linear-gradient(145deg, rgba(102, 112, 255, 0.85), rgba(79, 255, 176, 0.65));
  display: grid;
  place-items: center;
  font-size: 0.65rem;
  font-weight: 700;
  color: #fff;
  flex-shrink: 0;
}

.app-nav__user-name {
  font-size: 0.78rem;
  font-weight: 600;
  color: #e8f0ff;
}

/* ─── Responsive ─────────────────────────────────────────────────────────────── */

@media (max-width: 680px) {
  .app-nav__links {
    display: none;
  }
}

@media (max-width: 440px) {
  .app-nav__title {
    display: none;
  }

  .app-nav__user-name {
    display: none;
  }
}
</style>
