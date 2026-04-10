export const HomeView = {
  name: 'HomeView',
  props: {
    activeRegion: { type: Object, required: true },
    featuredRegion: { type: Object, required: true },
    totalOnline: { type: Number, required: true },
    clock: { type: String, required: true },
    activeEvents: { type: Array, required: true },
    quickRegion: { type: Function, required: true },
    openPanel: { type: Function, required: true },
    goPlanet: { type: Function, required: true },
  },
  template: `
    <section class="home-shell">
      <article class="home-hero glass-panel">
        <div class="home-hero__content">
          <p class="home-eyebrow">Welcome to Veltara</p>
          <h1>Explore a living shared planet in real time.</h1>
          <p>
            Jump into active regions, chat with players, and build inside region land instances with live persistence.
          </p>
          <div class="home-hero__actions">
            <button class="cta-button" @click="goPlanet">Enter Planet</button>
            <button class="cta-button cta-button--ghost" @click="quickRegion">Quick Jump</button>
            <button class="cta-button cta-button--ghost" @click="openPanel('social')">Open Feed</button>
          </div>
        </div>
        <div class="home-hero__stats">
          <div class="metric-tile"><span>Online</span><strong>{{ totalOnline }}</strong></div>
          <div class="metric-tile"><span>Current region</span><strong>{{ activeRegion.name }}</strong></div>
          <div class="metric-tile"><span>Hotspot</span><strong>{{ featuredRegion.name }}</strong></div>
          <div class="metric-tile"><span>Cycle</span><strong>{{ clock }}</strong></div>
        </div>
      </article>

      <article class="glass-panel home-events">
        <div class="panel-title">Live events</div>
        <div v-if="!activeEvents.length" class="empty-state">No active world events.</div>
        <div v-for="event in activeEvents.slice(0, 4)" :key="event.id ?? event.title" class="event-card">
          <div class="event-card__title">{{ event.title ?? 'World event' }}</div>
          <div class="event-card__desc">{{ event.description ?? event.text ?? 'A live system event is active.' }}</div>
        </div>
      </article>
    </section>
  `,
};
