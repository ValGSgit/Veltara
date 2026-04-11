<script setup>
import { computed, ref } from 'vue';

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
const tabs = ['regions', 'nearby', 'chat'];
const isActive = (name) => activeTab.value === name;

const filteredMessages = computed(() => {
  const currentTab = props.shellState.chatTab ?? 'local';
  return (props.chatMessages ?? []).filter((m) => (currentTab === 'global' ? m.is_global : !m.is_global));
});
</script>

<template>
  <section class="social-hub">
    <div class="social-hub__tabs" role="tablist" aria-label="Social sections">
      <button
        v-for="tab in tabs"
        :key="tab"
        class="social-hub__tab"
        :class="{ 'is-active': isActive(tab) }"
        :aria-selected="isActive(tab)"
        @click="activeTab = tab"
      >
        {{ tab }}
      </button>
    </div>

    <div class="social-hub__grid">
      <aside class="glass-panel region-rail" :class="{ 'social-hub__panel--hidden-mobile': !isActive('regions') }">
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
      </aside>

      <article class="glass-panel people-panel" :class="{ 'social-hub__panel--hidden-mobile': !isActive('nearby') }">
        <div class="panel-heading panel-heading--compact">
          <div>
            <div class="panel-title">Nearby Players</div>
            <div class="panel-copy">Social presence around your region</div>
          </div>
        </div>
        <div class="player-stack">
          <div v-if="!nearbyPlayers.length" class="empty-state">No nearby players yet.</div>
          <div v-for="player in nearbyPlayers" :key="player.id" class="player-row-vue">
            <div class="player-avatar-vue" :style="{ background: player.color ?? '#6c63ff' }">
              {{ playerName(player).charAt(0).toUpperCase() }}
            </div>
            <div class="player-row-vue__body">
              <strong>{{ playerName(player) }}</strong>
              <span>{{ playerAction(player) }} · {{ playerRegion(player) }}</span>
            </div>
          </div>
        </div>
      </article>

      <article class="glass-panel chat-panel-vue" :class="{ 'social-hub__panel--hidden-mobile': !isActive('chat') }">
        <div class="panel-heading panel-heading--compact">
          <div>
            <div class="panel-title">Planet Chat</div>
            <div class="panel-copy">Main social channel from Home</div>
          </div>
        </div>

        <div class="chat-tabs">
          <button class="chat-tab-vue" :class="{ 'chat-tab-vue--active': shellState.chatTab === 'local' }" @click="setChatTab('local')">Local</button>
          <button class="chat-tab-vue" :class="{ 'chat-tab-vue--active': shellState.chatTab === 'global' }" @click="setChatTab('global')">Global</button>
        </div>

        <div class="chat-stream" role="log" aria-label="Chat messages" aria-live="polite">
          <div v-if="!filteredMessages.length" class="empty-state">No messages yet.</div>
          <div v-for="msg in filteredMessages" :key="msg.id ?? msg.timestamp ?? msg.text" class="chat-message-vue">
            <span class="chat-message-vue__author" :class="msg.is_npc ? 'chat-message-vue__author--npc' : ''">
              {{ msg.is_npc ? 'AI ' : '' }}{{ msg.username ?? msg.author ?? 'Explorer' }}
            </span>
            <span class="chat-message-vue__text">{{ msg.text }}</span>
          </div>
        </div>

        <div class="chat-input-row">
          <input class="chat-input-vue" type="text" maxlength="500" placeholder="Message the world..." @keydown="sendChat" />
        </div>
      </article>
    </div>
  </section>
</template>

<style scoped>
.social-hub__tabs {
  display: none;
}

.social-hub__grid {
  display: grid;
  grid-template-columns: minmax(250px, 0.95fr) minmax(280px, 1fr) minmax(320px, 1.1fr);
  gap: 0.9rem;
}

@media (max-width: 1024px) {
  .social-hub__tabs {
    display: flex;
    gap: 0.5rem;
    margin-bottom: 0.65rem;
  }

  .social-hub__tab {
    border: 1px solid #263f68;
    border-radius: 999px;
    background: #0c1830;
    color: #c5d4ec;
    font-size: 0.76rem;
    text-transform: capitalize;
    padding: 0.3rem 0.65rem;
  }

  .social-hub__tab.is-active {
    border-color: #4f86ce;
    background: #12345f;
    color: #f2f7ff;
  }

  .social-hub__grid {
    grid-template-columns: 1fr;
  }

  .social-hub__panel--hidden-mobile {
    display: none;
  }
}
</style>
