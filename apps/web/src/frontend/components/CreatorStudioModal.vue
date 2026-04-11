<script setup>
import { computed, ref } from 'vue';
import { store } from '../../state/store.js';

const props = defineProps({
  open: { type: Boolean, required: true },
});

const emit = defineEmits(['close', 'open-model-lab']);

const sceneName = ref('My Scene');
const mapName = ref('my-scene-map');
const seed = ref('veltara-seed-01');
const biome = ref('temperate');
const planet = ref('earth-test');
const lighting = ref('studio-soft');
const notes = ref('');

const sceneJson = computed(() => {
  return JSON.stringify(
    {
      version: 1,
      scene: {
        name: sceneName.value.trim() || 'My Scene',
        map: mapName.value.trim() || 'my-scene-map',
        seed: seed.value.trim() || 'veltara-seed-01',
        biome: biome.value,
        previewPlanet: planet.value,
        lighting: lighting.value,
        notes: notes.value.trim() || undefined,
      },
      createdAt: new Date().toISOString(),
    },
    null,
    2,
  );
});

function close() {
  emit('close');
}

function openModelLab() {
  emit('open-model-lab');
}

async function copySpec() {
  try {
    await navigator.clipboard.writeText(sceneJson.value);
  } catch {
    // best-effort only
  }
}

function downloadSpec() {
  const blob = new Blob([sceneJson.value], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  const safeName = (mapName.value || 'scene-spec').replace(/[^a-z0-9-_]+/gi, '-').toLowerCase();
  a.download = `${safeName}.scene.json`;
  a.click();
  URL.revokeObjectURL(url);
}

function applyPlanetPreview() {
  const allowed = ['veltara', 'black-hole', 'earth-test'];
  const selected = allowed.includes(planet.value) ? planet.value : 'veltara';
  document.dispatchEvent(new CustomEvent('planet-select', { detail: { planetId: selected } }));
  store.set('currentPage', 'planet');
}
</script>

<template>
  <div v-if="open" class="creator-studio-backdrop" @click.self="close">
    <section class="creator-studio glass-panel" role="dialog" aria-modal="true" aria-label="Creator Hub">
      <header class="creator-studio__header">
        <div>
          <p class="creator-studio__eyebrow">Creator Workspace</p>
          <h3>Creator Hub</h3>
          <p class="creator-studio__hint">Dedicated tools for model upload and map or scene authoring.</p>
        </div>
        <button type="button" class="creator-studio__close" @click="close">Close</button>
      </header>

      <div class="creator-studio__grid">
        <article class="creator-card">
          <h4>Model Upload Lab</h4>
          <p>
            Open the isolated model upload sandbox to validate GLB, GLTF, and FBX assets without impacting
            gameplay rendering.
          </p>
          <p class="creator-card__note">Recommended asset location: apps/web/public/models/custom/</p>
          <button type="button" class="creator-card__btn" @click="openModelLab">Open Model Upload Lab</button>
        </article>

        <article class="creator-card creator-card--wide">
          <h4>Map and Scene Composer</h4>
          <div class="creator-form">
            <label>Scene Name <input v-model="sceneName" type="text" maxlength="80" /></label>
            <label>Map Key <input v-model="mapName" type="text" maxlength="80" /></label>
            <label>Seed <input v-model="seed" type="text" maxlength="80" /></label>
            <label>Biome
              <select v-model="biome">
                <option value="temperate">Temperate</option>
                <option value="arid">Arid</option>
                <option value="volcanic">Volcanic</option>
                <option value="ice">Ice</option>
                <option value="void">Void</option>
              </select>
            </label>
            <label>Preview Planet
              <select v-model="planet">
                <option value="veltara">Veltara</option>
                <option value="earth-test">Earth</option>
                <option value="black-hole">Black Hole</option>
              </select>
            </label>
            <label>Lighting
              <select v-model="lighting">
                <option value="studio-soft">Studio Soft</option>
                <option value="day-clear">Day Clear</option>
                <option value="sunset-warm">Sunset Warm</option>
                <option value="night-neon">Night Neon</option>
              </select>
            </label>
            <label class="creator-form__full">Notes
              <textarea v-model="notes" rows="3" maxlength="240"></textarea>
            </label>
          </div>

          <div class="creator-actions">
            <button type="button" class="creator-card__btn" @click="applyPlanetPreview">Apply Planet Preview</button>
            <button type="button" class="creator-card__btn" @click="copySpec">Copy Spec JSON</button>
            <button type="button" class="creator-card__btn" @click="downloadSpec">Download Spec</button>
          </div>

          <pre class="creator-spec">{{ sceneJson }}</pre>
        </article>
      </div>
    </section>
  </div>
</template>

<style scoped>
.creator-studio-backdrop {
  position: fixed;
  inset: 0;
  z-index: 1200;
  background: rgba(5, 8, 18, 0.65);
  backdrop-filter: blur(4px);
  display: grid;
  place-items: center;
  padding: 1rem;
}

.creator-studio {
  width: min(980px, 96vw);
  max-height: 92vh;
  overflow: auto;
  padding: 1rem;
}

.creator-studio__header {
  display: flex;
  justify-content: space-between;
  gap: 1rem;
  align-items: start;
}

.creator-studio__eyebrow {
  margin: 0;
  font-size: 0.72rem;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  color: #8ea4cc;
}

.creator-studio__hint {
  margin: 0.35rem 0 0;
  color: #b8c6e0;
  font-size: 0.86rem;
}

.creator-studio__close {
  border: 1px solid #2d446f;
  background: #0d172a;
  color: #dbe7ff;
  border-radius: 0.55rem;
  padding: 0.45rem 0.75rem;
  cursor: pointer;
}

.creator-studio__grid {
  display: grid;
  grid-template-columns: 1fr;
  gap: 0.85rem;
  margin-top: 0.9rem;
}

.creator-card {
  border: 1px solid #24395f;
  border-radius: 0.7rem;
  background: #0a1222;
  padding: 0.85rem;
}

.creator-card h4 {
  margin: 0;
}

.creator-card p {
  margin: 0.55rem 0;
  color: #b8c6e0;
  font-size: 0.88rem;
}

.creator-card__note {
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, Liberation Mono, monospace;
  font-size: 0.8rem;
  color: #8ec3ff;
}

.creator-card__btn {
  border: 1px solid #3564a5;
  background: linear-gradient(180deg, #1e4270 0%, #143156 100%);
  color: #f1f6ff;
  border-radius: 0.55rem;
  padding: 0.5rem 0.8rem;
  cursor: pointer;
}

.creator-card--wide {
  display: grid;
  gap: 0.7rem;
}

.creator-form {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 0.55rem;
}

.creator-form label {
  display: grid;
  gap: 0.3rem;
  color: #d8e4f8;
  font-size: 0.8rem;
}

.creator-form input,
.creator-form select,
.creator-form textarea {
  width: 100%;
  border: 1px solid #24406a;
  border-radius: 0.45rem;
  background: #0f1a2f;
  color: #eaf1ff;
  padding: 0.45rem 0.55rem;
}

.creator-form__full {
  grid-column: 1 / -1;
}

.creator-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
}

.creator-spec {
  margin: 0;
  max-height: 240px;
  overflow: auto;
  border: 1px solid #21375b;
  border-radius: 0.55rem;
  background: #071022;
  color: #bad4ff;
  font-size: 0.76rem;
  padding: 0.65rem;
}

@media (max-width: 740px) {
  .creator-form {
    grid-template-columns: 1fr;
  }
}
</style>
