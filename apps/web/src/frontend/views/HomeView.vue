<script setup>
import SocialHubView from '../components/SocialHubView.vue';
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

    <!-- Hero -->
    <PanelCard as="article" class="home__hero">
      <div class="home__hero-content">
        <p class="home__eyebrow">Veltara · Live world</p>
        <h1 class="home__title">Explore a shared planet,<br>live with others.</h1>
        <p class="home__sub">
          Jump into active regions, chat with nearby explorers, and build persistent structures in region land.
          Everything happens in real time.
        </p>
        <div class="home__actions">
          <button class="home-btn home-btn--primary" @click="goPlanet">Enter planet</button>
          <button class="home-btn home-btn--ghost" @click="quickRegion">Quick jump</button>
          <button class="home-btn home-btn--ghost" @click="openPanel('social')">Social feed</button>
          <button v-if="!isAuthenticated" class="home-btn home-btn--ghost" @click="openPanel('settings')">Get started</button>
        </div>
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

    <!-- Events row -->
    <PanelCard v-if="activeEvents.length" as="article" class="home__events">
      <p class="home__section-label">Live events</p>
      <div class="home__events-list">
        <div
          v-for="evt in activeEvents.slice(0, 4)"
          :key="evt.id ?? evt.title"
          class="event-card"
        >
          <div class="event-card__title">{{ evt.title ?? 'World event' }}</div>
          <div class="event-card__desc">{{ evt.description ?? evt.text ?? 'A live system event is active.' }}</div>
        </div>
      </div>
    </PanelCard>

    <!-- Social hub -->
    <SocialHubView
      :shell-state="shellState"
      :regions="regions"
      :nearby-players="nearbyPlayers"
      :chat-messages="chatMessages"
      :teleport="teleport"
      :set-chat-tab="setChatTab"
      :send-chat="sendChat"
      :player-name="playerName"
      :player-action="playerAction"
      :player-region="playerRegion"
    />

  </section>
</template>

<style scoped>
.home {
  width: min(1180px, calc(100vw - 24px));
  margin: 88px auto 0;
  display: grid;
  gap: 14px;
}

/* ─── Hero ─────────────────────────────────────────────────────────────────── */

.home__hero {
  display: grid;
  grid-template-columns: 1fr auto;
  gap: 24px;
  align-items: start;
  padding: 28px 32px;
  border-radius: 1.4rem;
  animation: homeFadeIn 220ms ease both;
}

.home__hero-content {
  min-width: 0;
}

.home__eyebrow {
  margin: 0 0 10px;
  font-size: 0.7rem;
  text-transform: uppercase;
  letter-spacing: 0.16em;
  color: var(--text-muted);
}

.home__title {
  margin: 0 0 12px;
  font-size: clamp(1.6rem, 3vw, 2.4rem);
  line-height: 1.1;
  color: #f4f8ff;
}

.home__sub {
  margin: 0 0 20px;
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

/* ─── Stats ────────────────────────────────────────────────────────────────── */

.home__stats {
  display: grid;
  grid-template-columns: 1fr;
  grid-template-rows: repeat(4, 1fr);
  gap: 8px;
  min-width: 140px;
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

/* ─── Events ───────────────────────────────────────────────────────────────── */

.home__events {
  border-radius: 1.25rem;
  animation: homeFadeIn 220ms 40ms ease both;
}

.home__section-label {
  margin: 0 0 10px;
  font-size: 0.7rem;
  text-transform: uppercase;
  letter-spacing: 0.2em;
  color: var(--text-muted);
}

.home__events-list {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(240px, 1fr));
  gap: 8px;
}

.home__events .event-card {
  transition: border-color 0.2s ease, background 0.2s ease, transform 0.2s ease;
}

.home__events .event-card:hover {
  border-color: var(--glow-border);
  background: var(--glow-bg);
  transform: translateY(-1px);
}

/* ─── Responsive ───────────────────────────────────────────────────────────── */

@media (max-width: 860px) {
  .home__hero {
    grid-template-columns: 1fr;
    padding: 22px 20px;
  }

  .home__stats {
    grid-template-columns: repeat(4, 1fr);
    grid-template-rows: 1fr;
  }
}

@media (max-width: 560px) {
  .home__stats {
    grid-template-columns: repeat(2, 1fr);
    grid-template-rows: repeat(2, 1fr);
  }
}

@keyframes homeFadeIn {
  from { opacity: 0; transform: translateY(6px); }
  to   { opacity: 1; transform: translateY(0); }
}
</style>
