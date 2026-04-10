<script setup>
defineProps({
  shellState: { type: Object, required: true },
  regions: { type: Array, required: true },
  activeRegion: { type: Object, required: true },
  nearbyPlayers: { type: Array, required: true },
  activeEvents: { type: Array, required: true },
  clock: { type: String, required: true },
  totalOnline: { type: Number, required: true },
  featuredRegion: { type: Object, required: true },
  chatMessages: { type: Array, required: true },
  teleport: { type: Function, required: true },
  openPanel: { type: Function, required: true },
  setChatTab: { type: Function, required: true },
  sendChat: { type: Function, required: true },
  quickRegion: { type: Function, required: true },
  playerName: { type: Function, required: true },
  playerAction: { type: Function, required: true },
  playerRegion: { type: Function, required: true },
});
</script>

<template>
  <div class="lobby-shell">
    <header class="lobby-topbar glass-panel">
      <div class="brand-block">
        <div class="brand-mark">V</div>
        <div>
          <div class="brand-name">VELTARA</div>
          <div class="brand-subtitle">Shared planet command center</div>
        </div>
      </div>

      <div class="topbar-stats">
        <div class="status-pill status-pill--glow">● {{ totalOnline }} online</div>
        <div class="status-pill">{{ regions.length }} regions</div>
        <div class="status-pill" :class="{ 'status-pill--accent': activeEvents.length }">✦ {{ activeEvents.length }} events</div>
        <div class="status-pill status-pill--mono">{{ clock }}</div>
      </div>

      <div class="topbar-actions">
        <button class="icon-button" @click="openPanel('social')">Feed</button>
        <button class="icon-button" @click="openPanel('store')">Store</button>
        <button class="icon-button" @click="openPanel('profile')">Profile</button>
        <button class="icon-button icon-button--primary" @click="quickRegion">Jump</button>
      </div>
    </header>

    <main class="lobby-grid">
      <aside class="glass-panel region-rail">
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
      </aside>

      <section class="center-stack">
        <article class="glass-panel hero-card">
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
            <button class="cta-button" @click="openPanel('profile')">Open profile</button>
            <button class="cta-button cta-button--ghost" @click="openPanel('social')">Open feed</button>
            <button class="cta-button cta-button--ghost" @click="openPanel('settings')">Settings</button>
          </div>
        </article>

        <div class="middle-grid">
          <article class="glass-panel feed-panel">
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
          </article>

          <article class="glass-panel spotlight-panel">
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
              <button class="mini-chip" @click="teleport(featuredRegion.id)">Teleport</button>
              <button class="mini-chip" @click="openPanel('store')">Cosmetics</button>
              <button class="mini-chip" @click="openPanel('social')">Social feed</button>
            </div>
          </article>
        </div>
      </section>

      <aside class="right-stack">
        <article class="glass-panel people-panel">
          <div class="panel-heading panel-heading--compact">
            <div>
              <div class="panel-title">Nearby players</div>
              <div class="panel-copy">Who is close to your region</div>
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

        <article class="glass-panel chat-panel-vue">
          <div class="panel-heading panel-heading--compact">
            <div>
              <div class="panel-title">Global chat</div>
              <div class="panel-copy">Switch between local and global conversations</div>
            </div>
          </div>

          <div class="chat-tabs">
            <button class="chat-tab-vue" :class="{ 'chat-tab-vue--active': shellState.chatTab === 'local' }" @click="setChatTab('local')">Local</button>
            <button class="chat-tab-vue" :class="{ 'chat-tab-vue--active': shellState.chatTab === 'global' }" @click="setChatTab('global')">Global</button>
          </div>

          <div class="chat-stream" role="log" aria-label="Chat messages" aria-live="polite">
            <div v-if="!chatMessages.length" class="empty-state">No messages yet.</div>
            <div v-for="msg in chatMessages" :key="msg.id ?? msg.timestamp ?? msg.text" class="chat-message-vue">
              <span class="chat-message-vue__author" :class="msg.is_npc ? 'chat-message-vue__author--npc' : ''">
                {{ msg.is_npc ? '🤖 ' : '' }}{{ msg.username ?? msg.author ?? 'Explorer' }}
              </span>
              <span class="chat-message-vue__text">{{ msg.text }}</span>
            </div>
          </div>

          <div class="chat-input-row">
            <input class="chat-input-vue" type="text" maxlength="500" placeholder="Message the world…" @keydown="sendChat" />
          </div>
        </article>
      </aside>
    </main>

    <footer class="lobby-footer glass-panel">
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
    </footer>
  </div>
</template>
