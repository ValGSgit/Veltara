<script setup>
import PanelCard from '../components/ui/PanelCard.vue';
import EmptyState from '../components/ui/EmptyState.vue';

defineProps({
  shellState:     { type: Object,   required: true },
  activeRegion:   { type: Object,   required: true },
  regions:        { type: Array,    required: true },
  featuredRegion: { type: Object,   required: true },
  nearbyPlayers:  { type: Array,    required: true },
  chatMessages:   { type: Array,    required: true },
  totalOnline:    { type: Number,   required: true },
  clock:          { type: String,   required: true },
  activeEvents:   { type: Array,    required: true },
  quickRegion:    { type: Function, required: true },
  teleport:       { type: Function, required: true },
  openPanel:      { type: Function, required: true },
  setChatTab:     { type: Function, required: true },
  sendChat:       { type: Function, required: true },
  goPlanet:       { type: Function, required: true },
  isAuthenticated:{ type: Boolean,  required: true },
  playerName:     { type: Function, required: true },
  playerAction:   { type: Function, required: true },
  playerRegion:   { type: Function, required: true },
});
</script>

<template>
  <section class="home">
    <PanelCard as="article" class="home__hero">
      <p class="home__eyebrow">Veltara lobby</p>
      <h1 class="home__title">Step into a shared, living planet.</h1>
      <p class="home__sub">
        Use the lobby to pick a region, check live activity, and jump into the world with other explorers.
      </p>
      <div class="home__actions">
        <button class="home-btn home-btn--primary" @click="goPlanet">Enter planet</button>
        <button class="home-btn home-btn--ghost" @click="quickRegion">Quick jump</button>
        <button class="home-btn home-btn--ghost" @click="openPanel('social')">Open social</button>
        <button v-if="!isAuthenticated" class="home-btn home-btn--ghost" @click="openPanel('settings')">Get started</button>
      </div>
      <div class="home__stats">
        <div class="home__stat">
          <strong class="home__stat-value home__stat-value--glow">{{ totalOnline }}</strong>
          <span class="home__stat-label">Online now</span>
        </div>
        <div class="home__stat">
          <strong class="home__stat-value">{{ activeRegion.name }}</strong>
          <span class="home__stat-label">Your region</span>
        </div>
        <div class="home__stat">
          <strong class="home__stat-value">{{ featuredRegion.name }}</strong>
          <span class="home__stat-label">Hotspot</span>
        </div>
        <div class="home__stat">
          <strong class="home__stat-value home__stat-value--mono">{{ clock }}</strong>
          <span class="home__stat-label">World cycle</span>
        </div>
      </div>
    </PanelCard>

    <div class="home__grid">
      <PanelCard as="article" class="home__regions">
        <p class="home__section-label">Region lobby</p>
        <div class="home__region-list">
          <button
            v-for="region in regions"
            :key="region.id"
            class="home__region"
            :class="{ 'home__region--active': region.id === shellState.selfRegionId }"
            :aria-current="region.id === shellState.selfRegionId ? 'location' : undefined"
            :aria-label="`Teleport to ${region.name} (${region.users ?? 0} online)`"
            @click="teleport(region.id)"
          >
            <span class="home__region-name">{{ region.name }}</span>
            <span class="home__region-meta">{{ region.users ?? 0 }} online</span>
          </button>
        </div>
      </PanelCard>

      <PanelCard as="article" class="home__activity">
        <p class="home__section-label">Live activity</p>
        <div class="home__players">
          <EmptyState v-if="!nearbyPlayers.length" text="No nearby players yet." />
          <div v-for="player in nearbyPlayers.slice(0, 4)" :key="player.id" class="home__player">
            <strong>{{ playerName(player) }}</strong>
            <span>{{ playerAction(player) }} · {{ playerRegion(player) }}</span>
          </div>
        </div>
        <div class="home__events">
          <EmptyState v-if="!activeEvents.length" text="No active events." />
          <div v-for="evt in activeEvents.slice(0, 3)" :key="evt.id ?? evt.title" class="event-card">
            <div class="event-card__title">{{ evt.title ?? 'World event' }}</div>
            <div class="event-card__desc">{{ evt.description ?? evt.text ?? 'A live system event is active.' }}</div>
          </div>
        </div>
        <div class="home__chat">
          <div class="home__chat-tabs">
            <button class="home__chat-tab" :class="{ 'home__chat-tab--active': shellState.chatTab === 'local' }" @click="setChatTab('local')">Local</button>
            <button class="home__chat-tab" :class="{ 'home__chat-tab--active': shellState.chatTab === 'global' }" @click="setChatTab('global')">Global</button>
          </div>
          <div class="home__chat-stream" role="log" aria-label="Chat messages" aria-live="polite">
            <EmptyState v-if="!chatMessages.length" text="No messages yet." />
            <div v-for="msg in chatMessages" :key="msg.id ?? msg.timestamp ?? msg.text" class="home__chat-message">
              <strong>{{ msg.is_npc ? 'AI ' : '' }}{{ msg.username ?? msg.author ?? 'Explorer' }}</strong>
              <span>{{ msg.text }}</span>
            </div>
          </div>
          <input class="home__chat-input" type="text" maxlength="500" placeholder="Message the world..." @keydown="sendChat" />
        </div>
      </PanelCard>
    </div>
  </section>
</template>

<style scoped>
.home {
  width: min(1180px, calc(100vw - 24px));
  margin: 88px auto 0;
  display: grid;
  gap: 12px;
}

.home__hero {
  display: grid;
  gap: 16px;
  padding: 24px 26px;
  border-radius: 1.4rem;
  animation: homeFadeIn 220ms ease both;
}

.home__eyebrow {
  margin: 0;
  font-size: 0.7rem;
  text-transform: uppercase;
  letter-spacing: 0.16em;
  color: var(--text-muted);
}

.home__title {
  margin: 0;
  font-size: clamp(1.6rem, 3vw, 2.4rem);
  line-height: 1.1;
  color: #f4f8ff;
}

.home__sub {
  margin: 0;
  color: var(--text-muted);
  font-size: 0.88rem;
  line-height: 1.55;
  max-width: 52ch;
}

.home__actions {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
}

.home__stats {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 8px;
}

.home-btn {
  padding: 9px 18px;
  border-radius: 999px;
  font-size: 0.82rem;
  font-weight: 600;
  cursor: pointer;
  transition: var(--pill-transition);
  border: 1px solid transparent;
}

.home-btn--primary {
  background: linear-gradient(135deg, rgba(108, 99, 255, 0.85), rgba(79, 255, 176, 0.65));
  color: #fff;
}

.home-btn--primary:hover {
  transform: translateY(-1px);
  box-shadow: 0 6px 20px rgba(108, 99, 255, 0.3);
}

.home-btn--ghost {
  background: var(--glass-bg);
  color: #d4e4ff;
  border-color: var(--glass-border);
}

.home-btn--ghost:hover {
  border-color: var(--glow-border);
  transform: translateY(-1px);
}

.home__stat {
  padding: 10px 14px;
  border-radius: 0.9rem;
  border: 1px solid var(--glass-border);
  background: var(--glass-bg);
}

.home__stat-value {
  display: block;
  font-size: 0.92rem;
  font-weight: 700;
  color: #f4f8ff;
}

.home__stat-value--glow { color: #9fffe4; }
.home__stat-value--mono {
  font-family: 'IBM Plex Mono', monospace;
  font-size: 0.82rem;
}

.home__stat-label {
  display: block;
  margin-top: 2px;
  font-size: 0.67rem;
  text-transform: uppercase;
  letter-spacing: 0.1em;
  color: var(--text-muted);
}

.home__grid {
  display: grid;
  grid-template-columns: 1fr 1.2fr;
  gap: 12px;
}

.home__regions,
.home__activity {
  border-radius: 1.25rem;
  display: grid;
  gap: 10px;
}

.home__section-label {
  margin: 0;
  font-size: 0.7rem;
  text-transform: uppercase;
  letter-spacing: 0.2em;
  color: var(--text-muted);
}

.home__region-list,
.home__players,
.home__events {
  display: grid;
  gap: 8px;
}

.home__region-list {
  max-height: 320px;
  overflow-y: auto;
  padding-right: 2px;
}

.home__region {
  border: 1px solid var(--glass-border);
  border-radius: 0.9rem;
  background: var(--glass-bg);
  color: #f4f8ff;
  text-align: left;
  padding: 10px 12px;
  display: flex;
  justify-content: space-between;
  gap: 10px;
  transition: var(--pill-transition);
  cursor: pointer;
}

.home__region:hover,
.home__region--active {
  border-color: var(--glow-border);
  background: var(--glow-bg);
}

.home__region-name {
  font-weight: 600;
}

.home__region-meta {
  font-size: 0.74rem;
  color: var(--text-muted);
}

.home__player {
  border: 1px solid var(--glass-border);
  border-radius: 0.9rem;
  padding: 10px 12px;
  background: var(--glass-bg);
}

.home__player strong {
  display: block;
  font-size: 0.82rem;
  color: #f4f8ff;
}

.home__player span {
  display: block;
  margin-top: 2px;
  font-size: 0.76rem;
  color: var(--text-muted);
}

.home__chat {
  display: grid;
  gap: 8px;
}

.home__chat-tabs {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 8px;
}

.home__chat-tab {
  border-radius: 999px;
  border: 1px solid var(--glass-border);
  background: var(--glass-bg);
  color: #d4e4ff;
  cursor: pointer;
  padding: 8px 12px;
  font-size: 0.75rem;
  transition: var(--pill-transition);
}

.home__chat-tab--active {
  border-color: var(--glow-border);
  background: var(--glow-bg);
  color: #f4f8ff;
}

.home__chat-stream {
  display: grid;
  gap: 8px;
  max-height: 180px;
  overflow-y: auto;
  padding-right: 2px;
}

.home__chat-message {
  border: 1px solid var(--glass-border);
  border-radius: 0.9rem;
  padding: 9px 11px;
  background: var(--glass-bg);
}

.home__chat-message strong {
  display: block;
  font-size: 0.78rem;
  color: #f4f8ff;
  margin-bottom: 2px;
}

.home__chat-message span {
  display: block;
  font-size: 0.76rem;
  color: var(--text-muted);
}

.home__chat-input {
  width: 100%;
  border-radius: 0.9rem;
  border: 1px solid var(--glass-border);
  background: var(--glass-bg);
  color: #fff;
  padding: 10px 12px;
  outline: none;
}

.home__chat-input::placeholder {
  color: var(--text-muted);
}

.home__events .event-card {
  transition: border-color 0.2s ease, background 0.2s ease, transform 0.2s ease;
}

.home__events .event-card:hover {
  border-color: var(--glow-border);
  background: var(--glow-bg);
  transform: translateY(-1px);
}

@media (max-width: 900px) {
  .home__grid {
    grid-template-columns: 1fr;
  }
  .home__stats {
    grid-template-columns: repeat(4, 1fr);
  }
}

@media (max-width: 560px) {
  .home__stats {
    grid-template-columns: repeat(2, 1fr);
  }
}

@keyframes homeFadeIn {
  from { opacity: 0; transform: translateY(6px); }
  to   { opacity: 1; transform: translateY(0); }
}
</style>
