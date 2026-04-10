<script setup>
const props = defineProps({
  currentPage: {
    type: String,
    default: 'home',
  },
  isAuthenticated: {
    type: Boolean,
    default: false,
  },
  username: {
    type: String,
    default: '',
  },
  wsConnected: {
    type: Boolean,
    default: false,
  },
  sceneMode: {
    type: String,
    default: 'planet',
  },
  sandboxBuildMode: {
    type: Boolean,
    default: false,
  },
  activeRegionName: {
    type: String,
    default: '',
  },
});

const emit = defineEmits(['navigate', 'open-panel', 'auth']);
</script>

<template>
  <nav class="app-nav glass-panel" aria-label="Main navigation">
    <button class="app-nav__brand" type="button" @click="emit('navigate', 'home')" aria-label="Go to home">
      <span class="app-nav__logo" aria-hidden="true">V</span>
      <span class="app-nav__title">VELTARA</span>
    </button>

    <div class="app-nav__links">
      <button class="app-nav__link" :class="{ 'is-active': currentPage === 'home' }" @click="emit('navigate', 'home')">
        Home
      </button>
      <button class="app-nav__link" :class="{ 'is-active': currentPage === 'planet' }" @click="emit('navigate', 'planet')">
        Planet
      </button>
    </div>

    <div class="app-nav__actions">
      <button class="app-nav__pill" @click="emit('open-panel', 'social')">Feed</button>
      <button class="app-nav__pill" @click="emit('open-panel', 'store')">Store</button>
      <button class="app-nav__pill" @click="emit('open-panel', 'profile')">Profile</button>
      <span class="app-nav__status" :class="wsConnected ? 'is-online' : 'is-offline'">
        {{ wsConnected ? 'Online' : 'Offline' }}
      </span>
      <span v-if="sceneMode === 'region-land'" class="app-nav__status app-nav__status--mode">
        {{ sandboxBuildMode ? 'Build Mode' : 'Region Land' }} · {{ activeRegionName || 'Active Region' }}
      </span>
      <button v-if="!isAuthenticated" class="app-nav__cta" @click="emit('auth', 'login')">Sign in</button>
      <span v-else class="app-nav__user">{{ username || 'Explorer' }}</span>
    </div>
  </nav>
</template>
