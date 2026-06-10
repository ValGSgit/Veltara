<script setup>
import PanelCard from '../components/ui/PanelCard.vue';
import PillButton from '../components/ui/PillButton.vue';
import PanelSectionHeader from '../components/ui/PanelSectionHeader.vue';
import EmptyState from '../components/ui/EmptyState.vue';

defineProps({
  shellState:    { type: Object,   required: true },
  regions:       { type: Array,    required: true },
  activeRegion:  { type: Object,   required: true },
  activeEvents:  { type: Array,    required: true },
  clock:         { type: String,   required: true },
  totalOnline:   { type: Number,   required: true },
  featuredRegion:{ type: Object,   required: true },
  teleport:      { type: Function, required: true },
  openPanel:     { type: Function, required: true },
  quickRegion:   { type: Function, required: true },
});
</script>

<template>
  <div class="lobby">

    <!-- Top strip: live world status -->
    <PanelCard as="header" class="lobby__status" compact>
      <div class="lobby__status-left">
        <span class="lobby__status-pill lobby__status-pill--glow">● {{ totalOnline }} online</span>
        <span class="lobby__status-pill">{{ regions.length }} regions</span>
        <span class="lobby__status-pill" :class="activeEvents.length ? 'lobby__status-pill--accent' : ''">
          ✦ {{ activeEvents.length }} event{{ activeEvents.length !== 1 ? 's' : '' }}
        </span>
        <span class="lobby__status-pill lobby__status-pill--mono">{{ clock }}</span>
      </div>
      <div class="lobby__status-right">
        <PillButton @click="openPanel('social')">Feed</PillButton>
        <PillButton @click="openPanel('store')">Store</PillButton>
        <PillButton @click="openPanel('profile')">Profile</PillButton>
        <PillButton class="lobby__jump-btn" @click="quickRegion">Quick jump</PillButton>
      </div>
    </PanelCard>

    <!-- Main grid -->
    <main class="lobby__grid">

      <!-- Left: region list -->
      <PanelCard as="aside" class="lobby__regions">
        <PanelSectionHeader title="Regions" copy="Tap any region to teleport." />
        <div class="lobby__region-list">
          <button
            v-for="region in regions"
            :key="region.id"
            class="region-card"
            :class="{ 'region-card--active': region.id === shellState.selfRegionId }"
            :aria-current="region.id === shellState.selfRegionId ? 'location' : undefined"
            :aria-label="`Teleport to ${region.name} (${region.users ?? 0} online)`"
            @click="teleport(region.id)"
          >
            <span class="region-card__dot" :style="{ background: region.color }"></span>
            <span class="region-card__body">
              <span class="region-card__name">{{ region.name }}</span>
              <span class="region-card__desc">{{ region.description ?? 'A live sector.' }}</span>
            </span>
            <span class="region-card__count">{{ region.users ?? 0 }}</span>
          </button>
        </div>
      </PanelCard>

      <!-- Center: world state + events/spotlight -->
      <section class="lobby__center">

        <!-- World state card -->
        <PanelCard as="article" class="lobby__world-card">
          <div class="lobby__world-header">
            <div>
              <p class="lobby__eyebrow">Live world state</p>
              <h2 class="lobby__world-title">Planet {{ activeRegion.name }}</h2>
            </div>
            <span class="lobby__conn-badge" :class="shellState.wsConnected ? 'is-synced' : 'is-offline'">
              {{ shellState.wsConnected ? '● Synced' : shellState.wsReconnecting ? '↻ Reconnecting' : '✕ Offline' }}
            </span>
          </div>

          <div class="lobby__metrics">
            <div class="metric-tile">
              <span>Current region</span>
              <strong>{{ activeRegion.name }}</strong>
            </div>
            <div class="metric-tile">
              <span>Hotspot</span>
              <strong>{{ featuredRegion.name }}</strong>
            </div>
          </div>
        </PanelCard>

        <!-- Events + spotlight row -->
        <div class="lobby__lower">
          <PanelCard as="article" class="lobby__events">
            <PanelSectionHeader title="World pulse" copy="Active system events" compact />
            <div class="event-stack">
              <EmptyState v-if="!activeEvents.length" text="No active events." />
              <div v-for="evt in activeEvents.slice(0, 4)" :key="evt.id ?? evt.title" class="event-card">
                <div class="event-card__title">{{ evt.title ?? 'World event' }}</div>
                <div class="event-card__desc">{{ evt.description ?? evt.text ?? 'A live event is active.' }}</div>
              </div>
            </div>
          </PanelCard>

          <PanelCard as="article" class="lobby__spotlight">
            <PanelSectionHeader title="Spotlight" copy="Most active region" compact />
            <div class="spotlight-region" :style="{ borderColor: featuredRegion.color + '55' }">
              <span class="spotlight-region__dot" :style="{ background: featuredRegion.color }"></span>
              <div>
                <div class="spotlight-region__name">{{ featuredRegion.name }}</div>
                <div class="spotlight-region__meta">{{ featuredRegion.users ?? 0 }} explorers</div>
              </div>
            </div>
            <div class="spotlight-actions">
              <PillButton @click="teleport(featuredRegion.id)">Teleport</PillButton>
            </div>
          </PanelCard>
        </div>
      </section>
    </main>

    <!-- Footer: player info + hints -->
    <PanelCard as="footer" class="lobby__footer" compact>
      <div class="lobby__hints">
        <span>Drag to rotate</span>
        <span>Scroll to zoom</span>
        <span>Double-click region to enter</span>
        <span>Esc to exit region land</span>
      </div>
      <div class="lobby__player">
        <div class="lobby__player-avatar" :style="{ background: shellState.user?.color ?? '#6c63ff' }">
          {{ (shellState.user?.username ?? 'E').charAt(0).toUpperCase() }}
        </div>
        <div>
          <div class="lobby__player-name">{{ shellState.user?.username ?? 'Explorer' }}</div>
          <div class="lobby__player-region">{{ activeRegion.name }}</div>
        </div>
      </div>
    </PanelCard>

  </div>
</template>

<style scoped>
.lobby {
  position: relative;
  z-index: 20;
  width: 100%;
  min-height: 100vh;
  padding: 1rem;
  display: grid;
  grid-template-rows: auto 1fr auto;
  gap: 0.85rem;
  pointer-events: none;
}

.lobby > * {
  pointer-events: auto;
}

/* ─── Status strip ──────────────────────────────────────────────────────────── */

.lobby__status {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.75rem;
  flex-wrap: wrap;
  border-radius: 1.2rem;
}

.lobby__status-left,
.lobby__status-right {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  flex-wrap: wrap;
}

.lobby__status-pill {
  padding: 0.4rem 0.75rem;
  font-size: 0.73rem;
  border-radius: 999px;
  border: 1px solid var(--glass-border);
  background: var(--glass-bg);
  color: #cfd7ee;
  white-space: nowrap;
}

.lobby__status-pill--glow {
  color: #9fffe4;
  border-color: rgba(79, 255, 176, 0.22);
}

.lobby__status-pill--accent {
  color: #ffca79;
  border-color: rgba(255, 202, 121, 0.2);
}

.lobby__status-pill--mono {
  font-family: 'IBM Plex Mono', monospace;
  letter-spacing: 0.08em;
}

.lobby__jump-btn {
  background: linear-gradient(135deg, rgba(79, 255, 176, 0.16), rgba(108, 99, 255, 0.18)) !important;
  border-color: var(--glow-border) !important;
}

/* ─── Main grid ─────────────────────────────────────────────────────────────── */

.lobby__grid {
  display: grid;
  grid-template-columns: minmax(220px, 260px) 1fr;
  gap: 0.85rem;
  min-height: 0;
}

/* ─── Regions panel ─────────────────────────────────────────────────────────── */

.lobby__regions {
  border-radius: 1.25rem;
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
  overflow: hidden;
  min-height: 0;
}

.lobby__region-list {
  display: flex;
  flex-direction: column;
  gap: 0.45rem;
  overflow-y: auto;
  padding-right: 0.2rem;
}

/* ─── Center column ─────────────────────────────────────────────────────────── */

.lobby__center {
  display: grid;
  grid-template-rows: auto 1fr;
  gap: 0.85rem;
  min-height: 0;
}

/* ─── World card ────────────────────────────────────────────────────────────── */

.lobby__world-card {
  border-radius: 1.25rem;
}

.lobby__world-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 1rem;
  margin-bottom: 1rem;
}

.lobby__eyebrow {
  margin: 0 0 4px;
  font-size: 0.68rem;
  text-transform: uppercase;
  letter-spacing: 0.2em;
  color: var(--text-muted);
}

.lobby__world-title {
  margin: 0;
  font-size: 1.25rem;
  font-weight: 700;
  color: #f4f8ff;
}

.lobby__conn-badge {
  padding: 5px 10px;
  border-radius: 999px;
  font-size: 0.72rem;
  font-weight: 600;
  white-space: nowrap;
  border: 1px solid;
}

.lobby__conn-badge.is-synced {
  color: #9cf6cd;
  border-color: rgba(112, 227, 173, 0.4);
  background: rgba(19, 54, 42, 0.4);
}

.lobby__conn-badge.is-offline {
  color: #ffd4d4;
  border-color: rgba(255, 130, 130, 0.4);
  background: rgba(64, 24, 24, 0.4);
}

.lobby__metrics {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 0.6rem;
}

/* ─── Lower row ─────────────────────────────────────────────────────────────── */

.lobby__lower {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 0.85rem;
  min-height: 0;
}

.lobby__events,
.lobby__spotlight {
  border-radius: 1.25rem;
  overflow: hidden;
}

/* ─── Footer ────────────────────────────────────────────────────────────────── */

.lobby__footer {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 1rem;
  flex-wrap: wrap;
  border-radius: 1.2rem;
}

.lobby__hints {
  display: flex;
  gap: 1.2rem;
  flex-wrap: wrap;
  font-size: 0.76rem;
  color: var(--text-muted);
}

.lobby__player {
  display: flex;
  align-items: center;
  gap: 0.65rem;
}

.lobby__player-avatar {
  width: 2.4rem;
  height: 2.4rem;
  border-radius: 50%;
  display: grid;
  place-items: center;
  font-weight: 700;
  color: #fff;
  flex-shrink: 0;
}

.lobby__player-name {
  font-size: 0.88rem;
  font-weight: 600;
  color: #f4f8ff;
}

.lobby__player-region {
  font-size: 0.7rem;
  color: var(--text-muted);
  text-transform: uppercase;
  letter-spacing: 0.12em;
}

/* ─── Responsive ────────────────────────────────────────────────────────────── */

@media (max-width: 1100px) {
  .lobby__grid {
    grid-template-columns: 1fr;
  }
}

@media (max-width: 700px) {
  .lobby__lower {
    grid-template-columns: 1fr;
  }

  .lobby__hints {
    gap: 0.7rem;
    font-size: 0.72rem;
  }
}
</style>
