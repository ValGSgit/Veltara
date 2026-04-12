<script setup>
defineProps({
  isAuthenticated: { type: Boolean, required: true },
  openAuth:        { type: Function, required: true },
  goHome:          { type: Function, required: true },
  goPlanet:        { type: Function, required: true },
});

const FEATURES = [
  { icon: '🌍', title: 'Shared Planet', body: 'One persistent world where every region is a live, persistent sandbox you can enter and build in.' },
  { icon: '⚡', title: 'Real-time Presence', body: 'See other explorers moving across the planet surface as it happens. Position updates at 2 Hz.' },
  { icon: '🔨', title: 'Region Builder', body: 'Drop into region land and place, rotate, or remove objects. Changes persist and are visible to all players.' },
  { icon: '💬', title: 'Planet Chat', body: 'Local and global chat channels. Talk to players in your region or broadcast planet-wide.' },
];
</script>

<template>
  <div class="welcome">
    <!-- Hero -->
    <section class="welcome__hero">
      <div class="welcome__hero-content">
        <p class="welcome__eyebrow">Live multiplayer · 3D planet · Persistent world</p>
        <h1 class="welcome__title">A shared planet you can explore<br><span class="welcome__title-glow">and build in together.</span></h1>
        <p class="welcome__sub">
          Veltara is a persistent shared world with live player presence, region sandbox building,
          and real-time events. Sign up or sign in to join.
        </p>

        <div class="welcome__actions">
          <template v-if="!isAuthenticated">
            <button class="welcome-btn welcome-btn--primary" @click="openAuth('register')">
              Create free account
            </button>
            <button class="welcome-btn welcome-btn--ghost" @click="openAuth('login')">
              Sign in
            </button>
          </template>
          <template v-else>
            <button class="welcome-btn welcome-btn--primary" @click="goPlanet">
              Enter the planet
            </button>
            <button class="welcome-btn welcome-btn--ghost" @click="goHome">
              Go to home
            </button>
          </template>
        </div>
      </div>

      <div class="welcome__hero-badge">
        <div class="welcome__badge-ring"></div>
        <div class="welcome__badge-core">V</div>
      </div>
    </section>

    <!-- Feature grid -->
    <section class="welcome__features">
      <div
        v-for="feat in FEATURES"
        :key="feat.title"
        class="welcome__feature-card"
      >
        <span class="welcome__feature-icon">{{ feat.icon }}</span>
        <h3 class="welcome__feature-title">{{ feat.title }}</h3>
        <p class="welcome__feature-body">{{ feat.body }}</p>
      </div>
    </section>
  </div>
</template>

<style scoped>
.welcome {
  width: min(1080px, calc(100vw - 24px));
  margin: 96px auto 48px;
  display: grid;
  gap: 24px;
}

/* ─── Hero ─────────────────────────────────────────────────────────────────── */

.welcome__hero {
  display: grid;
  grid-template-columns: 1fr auto;
  align-items: center;
  gap: 32px;
  padding: 36px 40px;
  border-radius: 1.4rem;
  border: 1px solid var(--glass-border);
  background:
    radial-gradient(900px 600px at 0% 0%, rgba(108, 99, 255, 0.12), transparent 60%),
    radial-gradient(700px 500px at 100% 100%, rgba(79, 255, 176, 0.08), transparent 60%),
    rgba(255, 255, 255, 0.02);
  backdrop-filter: blur(20px);
  animation: welcomeFadeIn 280ms ease both;
}

.welcome__eyebrow {
  margin: 0 0 14px;
  font-size: 0.72rem;
  letter-spacing: 0.16em;
  text-transform: uppercase;
  color: var(--text-muted);
}

.welcome__title {
  margin: 0 0 16px;
  font-size: clamp(2rem, 4vw, 3rem);
  line-height: 1.08;
  color: #f5f8ff;
}

.welcome__title-glow {
  background: linear-gradient(135deg, #6fffca, #7b8eff);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
}

.welcome__sub {
  margin: 0 0 28px;
  color: var(--text-muted);
  max-width: 56ch;
  line-height: 1.6;
  font-size: 0.95rem;
}

.welcome__actions {
  display: flex;
  gap: 10px;
  flex-wrap: wrap;
}

.welcome-btn {
  padding: 12px 22px;
  border-radius: 999px;
  font-size: 0.85rem;
  font-weight: 600;
  cursor: pointer;
  transition: var(--pill-transition);
  border: 1px solid transparent;
}

.welcome-btn--primary {
  background: linear-gradient(135deg, rgba(108, 99, 255, 0.9), rgba(79, 255, 176, 0.7));
  color: #fff;
  border-color: transparent;
}

.welcome-btn--primary:hover {
  transform: translateY(-2px);
  box-shadow: 0 8px 24px rgba(108, 99, 255, 0.35);
}

.welcome-btn--ghost {
  background: var(--glass-bg);
  color: #d8e8ff;
  border-color: var(--glass-border);
}

.welcome-btn--ghost:hover {
  border-color: var(--glow-border);
  transform: translateY(-1px);
}

/* ─── Badge ────────────────────────────────────────────────────────────────── */

.welcome__hero-badge {
  position: relative;
  width: 120px;
  height: 120px;
  display: grid;
  place-items: center;
  flex-shrink: 0;
}

.welcome__badge-ring {
  position: absolute;
  inset: 0;
  border-radius: 50%;
  border: 2px solid rgba(79, 255, 176, 0.3);
  animation: badgePulse 3s ease-in-out infinite;
}

.welcome__badge-core {
  width: 72px;
  height: 72px;
  border-radius: 50%;
  display: grid;
  place-items: center;
  font-size: 2rem;
  font-weight: 700;
  color: #fff;
  background: linear-gradient(145deg, rgba(102, 112, 255, 0.9), rgba(79, 255, 176, 0.7));
  box-shadow: 0 0 40px rgba(79, 255, 176, 0.25);
}

@keyframes badgePulse {
  0%, 100% { transform: scale(1); opacity: 0.5; }
  50% { transform: scale(1.08); opacity: 1; }
}

/* ─── Feature grid ─────────────────────────────────────────────────────────── */

.welcome__features {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 12px;
  animation: welcomeFadeIn 280ms 80ms ease both;
}

.welcome__feature-card {
  padding: 20px;
  border-radius: 1.1rem;
  border: 1px solid var(--glass-border);
  background: var(--glass-bg);
  transition: border-color 0.2s ease, transform 0.2s ease;
}

.welcome__feature-card:hover {
  border-color: var(--glow-border);
  transform: translateY(-2px);
}

.welcome__feature-icon {
  font-size: 1.5rem;
  display: block;
  margin-bottom: 10px;
}

.welcome__feature-title {
  margin: 0 0 6px;
  font-size: 0.9rem;
  font-weight: 600;
  color: #f0f4ff;
}

.welcome__feature-body {
  margin: 0;
  font-size: 0.8rem;
  color: var(--text-muted);
  line-height: 1.5;
}

/* ─── Responsive ───────────────────────────────────────────────────────────── */

@media (max-width: 900px) {
  .welcome__hero {
    grid-template-columns: 1fr;
    padding: 28px 24px;
  }

  .welcome__hero-badge {
    display: none;
  }

  .welcome__features {
    grid-template-columns: repeat(2, 1fr);
  }
}

@media (max-width: 560px) {
  .welcome__features {
    grid-template-columns: 1fr;
  }
}

@keyframes welcomeFadeIn {
  from { opacity: 0; transform: translateY(10px); }
  to   { opacity: 1; transform: translateY(0); }
}
</style>
