<script setup>
import { computed, ref } from 'vue';
import PanelCard from './ui/PanelCard.vue';
import PillButton from './ui/PillButton.vue';

const props = defineProps({
  shellState: { type: Object, required: true },
  regions: { type: Array, required: true },
  nearbyPlayers: { type: Array, required: true },
  chatMessages: { type: Array, required: true },
  teleport: { type: Function, required: true },
  setChatTab: { type: Function, required: true },
  sendChat: { type: Function, required: true },
  playerName: { type: Function, required: true },
  playerAction: { type: Function, required: true },
  playerRegion: { type: Function, required: true },
});

const activeTab = ref('regions');
const tabs = [
  { key: 'regions', label: 'Regions' },
  { key: 'nearby', label: 'Nearby' },
  { key: 'chat', label: 'Chat' },
];
const isActive = (name) => activeTab.value === name;
const SOCIAL_HUB_COMPACT_KEY = 'social_hub_compact_mode';
const compactMode = ref(false);

try {
  compactMode.value = localStorage.getItem(SOCIAL_HUB_COMPACT_KEY) === '1';
} catch {
  // ignore storage access issues
}

function toggleCompactMode() {
  compactMode.value = !compactMode.value;
  try {
    localStorage.setItem(SOCIAL_HUB_COMPACT_KEY, compactMode.value ? '1' : '0');
  } catch {
    // ignore storage failures
  }
}

function setTab(name) {
  activeTab.value = name;
}

const filteredMessages = computed(() => {
  const currentTab = props.shellState.chatTab ?? 'local';
  return (props.chatMessages ?? []).filter((m) => (currentTab === 'global' ? m.is_global : !m.is_global));
});
</script>

<template>
  <section class="social-hub" :class="{ 'social-hub--compact': compactMode }">
    <div class="social-hub__controls">
      <div class="social-hub__tabs" role="tablist" aria-label="Social sections">
        <PillButton
          v-for="tab in tabs"
          :key="tab.key"
          :active="isActive(tab.key)"
          :aria-selected="isActive(tab.key)"
          @click="setTab(tab.key)"
        >
          {{ tab.label }}
        </PillButton>
      </div>
      <PillButton size="sm" :active="compactMode" :aria-pressed="compactMode" @click="toggleCompactMode">
        {{ compactMode ? 'Expanded' : 'Compact' }}
      </PillButton>
    </div>

    <div class="social-hub__grid">
      <PanelCard as="aside" :compact="compactMode" class="region-rail" :class="{ 'social-hub__panel--hidden-mobile': !isActive('regions') }">
        <div class="panel-heading panel-heading--compact">
          <div>
            <div class="panel-title">Regions</div>
            <div class="panel-copy">Main social travel index</div>
          </div>
        </div>
        <div class="region-list">
          <button
            v-for="region in regions"
            :key="region.id"
            class="region-card"
            :class="{ 'region-card--active': region.id === shellState.selfRegionId }"
            @click="teleport(region.id)"
          >
            <span class="region-card__dot" :style="{ background: region.color }"></span>
            <span class="region-card__body">
              <span class="region-card__name">{{ region.name }}</span>
              <span class="region-card__desc">{{ region.users ?? 0 }} online</span>
            </span>
          </button>
        </div>
      </PanelCard>

      <PanelCard as="article" :compact="compactMode" class="people-panel" :class="{ 'social-hub__panel--hidden-mobile': !isActive('nearby') }">
        <div class="panel-heading panel-heading--compact">
          <div>
            <div class="panel-title">Nearby Players</div>
            <div class="panel-copy">Social presence around your region</div>
          </div>
        </div>
        <div>
          <div v-if="!nearbyPlayers.length" class="empty-state">No nearby players yet.</div>
          <TransitionGroup name="social-list" tag="div" class="player-stack">
          <div v-for="player in nearbyPlayers" :key="player.id" class="player-row-vue">
            <div class="player-avatar-vue" :style="{ background: player.color ?? '#6c63ff' }">
              {{ playerName(player).charAt(0).toUpperCase() }}
            </div>
            <div class="player-row-vue__body">
              <strong>{{ playerName(player) }}</strong>
              <span>{{ playerAction(player) }} · {{ playerRegion(player) }}</span>
            </div>
          </div>
          </TransitionGroup>
        </div>
      </PanelCard>

      <PanelCard as="article" :compact="compactMode" class="chat-panel-vue" :class="{ 'social-hub__panel--hidden-mobile': !isActive('chat') }">
        <div class="panel-heading panel-heading--compact">
          <div>
            <div class="panel-title">Planet Chat</div>
            <div class="panel-copy">Main social channel from Home</div>
          </div>
        </div>

        <div class="chat-tabs">
          <PillButton class="chat-tab-vue" :active="shellState.chatTab === 'local'" @click="setChatTab('local')">Local</PillButton>
          <PillButton class="chat-tab-vue" :active="shellState.chatTab === 'global'" @click="setChatTab('global')">Global</PillButton>
        </div>

        <div role="log" aria-label="Chat messages" aria-live="polite">
          <div v-if="!filteredMessages.length" class="empty-state">No messages yet.</div>
          <TransitionGroup name="social-list" tag="div" class="chat-stream">
          <div v-for="msg in filteredMessages" :key="msg.id ?? msg.timestamp ?? msg.text" class="chat-message-vue">
            <span class="chat-message-vue__author" :class="msg.is_npc ? 'chat-message-vue__author--npc' : ''">
              {{ msg.is_npc ? 'AI ' : '' }}{{ msg.username ?? msg.author ?? 'Explorer' }}
            </span>
            <span class="chat-message-vue__text">{{ msg.text }}</span>
          </div>
          </TransitionGroup>
        </div>

        <div class="chat-input-row">
          <input class="chat-input-vue" type="text" maxlength="500" placeholder="Message the world..." @keydown="sendChat" />
        </div>
      </PanelCard>
    </div>
  </section>
</template>

<style scoped>
.social-hub__controls {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 0.55rem;
}

.social-hub__tabs {
  display: flex;
  gap: 0.5rem;
  flex-wrap: wrap;
}

.social-hub--compact :deep(.region-card) {
  padding: 0.6rem 0.7rem;
}

.social-hub--compact :deep(.event-card),
.social-hub--compact :deep(.player-row-vue),
.social-hub--compact :deep(.chat-message-vue) {
  padding: 0.58rem 0.65rem;
}

.social-hub--compact :deep(.chat-stream) {
  max-height: 12.5rem;
}

.social-list-enter-active,
.social-list-leave-active {
  transition: all 0.22s ease;
}

.social-list-enter-from,
.social-list-leave-to {
  opacity: 0;
  transform: translateY(4px);
}

.social-hub__grid {
  display: grid;
  grid-template-columns: minmax(250px, 0.95fr) minmax(280px, 1fr) minmax(320px, 1.1fr);
  gap: 0.9rem;
}

@media (max-width: 1024px) {
  .social-hub__grid {
    grid-template-columns: 1fr;
  }

  .social-hub__panel--hidden-mobile {
    display: none;
  }
}

@media (max-width: 640px) {
  .social-hub__controls {
    flex-direction: column;
    align-items: stretch;
    gap: 0.45rem;
  }

  .social-hub__controls :deep(.pill-btn) {
    width: 100%;
  }
}
</style>
