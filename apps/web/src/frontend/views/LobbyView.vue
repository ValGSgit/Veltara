<script setup>
import PanelCard from '../components/ui/PanelCard.vue';
import PillButton from '../components/ui/PillButton.vue';

defineProps({
  shellState: { type: Object, required: true },
  lobbyViewOptions: { type: Object, required: true },
  regions: { type: Array, required: true },
  activeRegion: { type: Object, required: true },
  activeEvents: { type: Array, required: true },
  clock: { type: String, required: true },
  totalOnline: { type: Number, required: true },
  featuredRegion: { type: Object, required: true },
  teleport: { type: Function, required: true },
  openPanel: { type: Function, required: true },
  quickRegion: { type: Function, required: true },
  setLobbyViewOption: { type: Function, required: true },
});
</script>

<template>
  <div class="lobby-shell">
    <PanelCard as="header" class="lobby-topbar" compact>
      <div class="brand-block">
        <div class="brand-mark">V</div>
        <div>
          <div class="brand-name">VELTARA</div>
          <div class="brand-subtitle">Shared planet command center</div>
        </div>
      </div>

      <div class="topbar-stats">
        <template v-if="lobbyViewOptions.showTopStats">
        <div class="status-pill status-pill--glow">● {{ totalOnline }} online</div>
        <div class="status-pill">{{ regions.length }} regions</div>
        <div class="status-pill" :class="{ 'status-pill--accent': activeEvents.length }">✦ {{ activeEvents.length }} events</div>
        <div class="status-pill status-pill--mono">{{ clock }}</div>
        </template>
      </div>

      <div class="topbar-actions">
        <PillButton class="icon-button" @click="openPanel('social')">Feed</PillButton>
        <PillButton class="icon-button" @click="openPanel('store')">Store</PillButton>
        <PillButton class="icon-button" @click="openPanel('profile')">Profile</PillButton>
        <PillButton class="icon-button icon-button--primary" @click="quickRegion">Jump</PillButton>
      </div>
    </PanelCard>

    <main class="lobby-grid">
      <PanelCard v-if="lobbyViewOptions.showRegions" as="aside" class="region-rail">
        <div class="panel-heading">
          <div>
            <div class="panel-title">Regions</div>
            <div class="panel-copy">Tap a destination to teleport instantly.</div>
          </div>
        </div>

        <div class="region-list">
          <button
            v-for="region in regions"
            :key="region.id"
            class="region-card"
            :class="{ 'region-card--active': region.id === shellState.selfRegionId }"
            :aria-current="region.id === shellState.selfRegionId ? 'location' : undefined"
            :aria-label="'Teleport to ' + region.name + ' (' + (region.users ?? 0) + ' online)'"
            @click="teleport(region.id)"
          >
            <span class="region-card__dot" :style="{ background: region.color }"></span>
            <span class="region-card__body">
              <span class="region-card__name">{{ region.name }}</span>
              <span class="region-card__desc">{{ region.description ?? 'A live sector on the planet.' }}</span>
            </span>
            <span class="region-card__count">{{ region.users ?? 0 }}</span>
          </button>
        </div>
      </PanelCard>

      <section class="center-stack">
        <PanelCard as="article">
          <div class="panel-heading panel-heading--compact">
            <div>
              <div class="panel-title">Lobby Layout</div>
              <div class="panel-copy">Hide or show interface sections.</div>
            </div>
          </div>
          <div class="flex flex-wrap gap-2 p-3">
            <PillButton as="label" class="mini-chip"><input type="checkbox" :checked="lobbyViewOptions.showTopStats" @change="setLobbyViewOption('showTopStats', $event.target.checked)" /> Stats</PillButton>
            <PillButton as="label" class="mini-chip"><input type="checkbox" :checked="lobbyViewOptions.showRegions" @change="setLobbyViewOption('showRegions', $event.target.checked)" /> Regions</PillButton>
            <PillButton as="label" class="mini-chip"><input type="checkbox" :checked="lobbyViewOptions.showWorldPulse" @change="setLobbyViewOption('showWorldPulse', $event.target.checked)" /> World Pulse</PillButton>
            <PillButton as="label" class="mini-chip"><input type="checkbox" :checked="lobbyViewOptions.showSpotlight" @change="setLobbyViewOption('showSpotlight', $event.target.checked)" /> Spotlight</PillButton>
            <PillButton as="label" class="mini-chip"><input type="checkbox" :checked="lobbyViewOptions.showFooterHints" @change="setLobbyViewOption('showFooterHints', $event.target.checked)" /> Footer</PillButton>
            <PillButton class="mini-chip" @click="openPanel('social')">Social on Home</PillButton>
          </div>
        </PanelCard>

        <PanelCard as="article" class="hero-card">
          <div class="hero-card__copy">
            <div class="eyebrow">Live world state</div>
            <h1>Explore the planet with a clearer command layout.</h1>
            <p>
              The planet engine stays in the background while the interface surfaces the right actions,
              active regions, and social signals in a more readable layout.
            </p>
          </div>

          <div class="hero-card__metrics">
            <div class="metric-tile">
              <span>Current region</span>
              <strong>{{ activeRegion.name }}</strong>
            </div>
            <div class="metric-tile">
              <span>Featured hotspot</span>
              <strong>{{ featuredRegion.name }}</strong>
            </div>
            <div class="metric-tile">
              <span>Connection</span>
              <strong :class="shellState.wsConnected ? 'metric-ok' : 'metric-warn'">
                {{ shellState.wsConnected ? 'Synced' : shellState.wsReconnecting ? 'Reconnecting' : 'Offline' }}
              </strong>
            </div>
            <div class="metric-tile">
              <span>Cycle</span>
              <strong>{{ clock }}</strong>
            </div>
          </div>

          <div class="hero-card__actions">
            <PillButton size="md" class="cta-button" @click="openPanel('profile')">Open profile</PillButton>
            <PillButton size="md" class="cta-button cta-button--ghost" @click="openPanel('social')">Open feed</PillButton>
            <PillButton size="md" class="cta-button cta-button--ghost" @click="openPanel('settings')">Settings</PillButton>
          </div>
        </PanelCard>

        <div class="middle-grid">
          <PanelCard v-if="lobbyViewOptions.showWorldPulse" as="article" class="feed-panel">
            <div class="panel-heading panel-heading--compact">
              <div>
                <div class="panel-title">World pulse</div>
                <div class="panel-copy">Events and live world highlights</div>
              </div>
            </div>
            <div class="event-stack">
              <div v-if="!activeEvents.length" class="empty-state">No active world events.</div>
              <div v-for="event in activeEvents.slice(0, 4)" :key="event.id ?? event.title" class="event-card">
                <div class="event-card__title">{{ event.title ?? 'World event' }}</div>
                <div class="event-card__desc">{{ event.description ?? event.text ?? 'A live system event is active.' }}</div>
              </div>
            </div>
          </PanelCard>

          <PanelCard v-if="lobbyViewOptions.showSpotlight" as="article" class="spotlight-panel">
            <div class="panel-heading panel-heading--compact">
              <div>
                <div class="panel-title">Spotlight</div>
                <div class="panel-copy">Most active region right now</div>
              </div>
            </div>
            <div class="spotlight-region" :style="{ borderColor: featuredRegion.color + '55' }">
              <span class="spotlight-region__dot" :style="{ background: featuredRegion.color }"></span>
              <div>
                <div class="spotlight-region__name">{{ featuredRegion.name }}</div>
                <div class="spotlight-region__meta">{{ featuredRegion.users ?? 0 }} explorers · {{ featuredRegion.id }}</div>
              </div>
            </div>
            <div class="spotlight-actions">
              <PillButton class="mini-chip" @click="teleport(featuredRegion.id)">Teleport</PillButton>
              <PillButton class="mini-chip" @click="openPanel('store')">Cosmetics</PillButton>
              <PillButton class="mini-chip" @click="openPanel('social')">Social feed</PillButton>
            </div>
          </PanelCard>
          <PanelCard v-if="!lobbyViewOptions.showWorldPulse && !lobbyViewOptions.showSpotlight" as="article" class="feed-panel">
            <div class="empty-state">Both center panels are hidden. Enable sections in Lobby Layout.</div>
          </PanelCard>
        </div>
      </section>
    </main>

    <PanelCard v-if="lobbyViewOptions.showFooterHints" as="footer" class="lobby-footer" compact>
      <div class="footer-hints">
        <span>Drag to rotate</span>
        <span>Scroll to zoom</span>
        <span>Double-click region to focus</span>
      </div>
      <div class="footer-player">
        <div class="footer-player__avatar" :style="{ background: shellState.user?.color ?? '#6c63ff' }">
          {{ (shellState.user?.username ?? 'E').charAt(0).toUpperCase() }}
        </div>
        <div>
          <div class="footer-player__name">{{ shellState.user?.username ?? 'Not logged in' }}</div>
          <div class="footer-player__region">{{ activeRegion.name }}</div>
        </div>
      </div>
    </PanelCard>
  </div>
</template>
