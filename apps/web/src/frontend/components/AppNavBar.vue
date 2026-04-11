<script setup>
import PillButton from './ui/PillButton.vue';

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
      <PillButton class="app-nav__link" :active="currentPage === 'home'" @click="emit('navigate', 'home')">
        Home
      </PillButton>
      <PillButton class="app-nav__link" :active="currentPage === 'planet'" @click="emit('navigate', 'planet')">
        Planet
      </PillButton>
      <PillButton class="app-nav__link" :active="currentPage === 'profile'" @click="emit('navigate', 'profile')">
        Profile
      </PillButton>
      <PillButton class="app-nav__link" :active="currentPage === 'shop'" @click="emit('navigate', 'shop')">
        Shop
      </PillButton>
    </div>

    <div class="app-nav__actions">
      <span class="app-nav__status" :class="wsConnected ? 'is-online' : 'is-offline'">
        {{ wsConnected ? 'Online' : 'Offline' }}
      </span>
      <span v-if="sceneMode === 'region-land'" class="app-nav__status app-nav__status--mode">
        {{ sandboxBuildMode ? 'Build Mode' : 'Region Land' }} · {{ activeRegionName || 'Active Region' }}
      </span>
      <PillButton v-if="!isAuthenticated" size="md" class="app-nav__cta" @click="emit('auth', 'login')">Sign in</PillButton>
      <span v-else class="app-nav__user">{{ username || 'Explorer' }}</span>
    </div>
  </nav>
</template>
