<script setup>
defineProps({
  isAuthenticated: { type: Boolean, required: true },
  openAuth: { type: Function, required: true },
  goHome: { type: Function, required: true },
  goPlanet: { type: Function, required: true },
});
</script>

<template>
  <section class="home-shell">
    <article class="home-hero glass-panel">
      <div class="home-hero__content">
        <p class="home-eyebrow">Veltara Planet Network</p>
        <h1>Start with a clean hub before entering the live world.</h1>
        <p>
          Create an account, learn what Veltara offers, then move into Planet view when you are ready.
          This avoids auth overlays competing with the core planet controls.
        </p>
        <div class="home-hero__actions">
          <button v-if="!isAuthenticated" class="cta-button" @click="openAuth('register')">Create account</button>
          <button v-if="!isAuthenticated" class="cta-button cta-button--ghost" @click="openAuth('login')">Sign in</button>
          <button class="cta-button cta-button--ghost" @click="goHome">Explore Home</button>
          <button class="cta-button cta-button--ghost" @click="goPlanet">Enter Planet</button>
        </div>
      </div>
      <div class="home-hero__stats">
        <div class="metric-tile"><span>Flow</span><strong>Welcome → Home → Planet</strong></div>
        <div class="metric-tile"><span>Auth UX</span><strong>Dedicated entry point</strong></div>
        <div class="metric-tile"><span>Discoverability</span><strong>Improved first-run clarity</strong></div>
        <div class="metric-tile"><span>Readability</span><strong>No modal overlap pressure</strong></div>
      </div>
    </article>
  </section>
</template>
