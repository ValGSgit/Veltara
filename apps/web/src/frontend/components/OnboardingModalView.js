import { computed, ref } from 'vue';
import { REGIONS } from '@veltara/shared';
import { store } from '../../state/store.js';
import { toast } from '../../ui/toast.js';

const COLORS = ['#6c63ff', '#4fffb0', '#ff6b6b', '#ffd93d', '#00d4ff', '#ff8c00', '#cc2200', '#22cc44'];

export const OnboardingModalView = {
  name: 'OnboardingModalView',
  setup(_, { emit }) {
    const step = ref(1);
    const selectedRegion = ref(null);
    const selectedColor = ref(COLORS[0]);
    const displayName = ref(store.get('user')?.username ?? '');

    const userInitial = computed(() => (store.get('user')?.username?.[0] ?? '?').toUpperCase());

    function close() {
      emit('close');
    }

    function next() {
      if (step.value === 2 && !selectedRegion.value) return;
      if (step.value === 3) {
        finish();
        return;
      }
      step.value += 1;
    }

    function finish() {
      localStorage.setItem('onboarding_complete', '1');
      document.dispatchEvent(new CustomEvent('onboarding-complete', {
        detail: {
          regionId: selectedRegion.value,
          color: selectedColor.value,
          displayName: displayName.value.trim(),
        },
      }));
      toast.success('Welcome to Veltara! 🌍');
      close();
    }

    return {
      step,
      selectedRegion,
      selectedColor,
      displayName,
      userInitial,
      regions: REGIONS,
      colors: COLORS,
      close,
      next,
      finish,
    };
  },
  template: `
    <Teleport to="#modals">
      <div class="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-xl" @click.self="close">
        <div class="w-full max-w-4xl overflow-hidden rounded-3xl border border-white/10 bg-[#0e1020]/96 shadow-2xl">
          <div class="px-8 pt-6">
            <div class="mb-6 flex justify-center gap-2">
              <div v-for="index in [1, 2, 3]" :key="index" class="h-2 w-2 rounded-full" :class="index === step ? 'bg-veltara-accent shadow-[0_0_14px_rgba(108,99,255,0.6)]' : 'bg-veltara-border'"></div>
            </div>
          </div>

          <div v-if="step === 1" class="grid min-h-[32rem] lg:grid-cols-[0.95fr_1.05fr]">
            <div class="hidden flex-col justify-between border-r border-white/10 bg-gradient-to-br from-veltara-accent/20 via-veltara-panel to-black p-8 lg:flex">
              <div>
                <div class="text-xs uppercase tracking-[0.35em] text-veltara-muted">Welcome</div>
                <div class="mt-4 text-4xl font-bold leading-tight text-white">Enter the living planet.</div>
                <p class="mt-3 text-sm leading-relaxed text-veltara-muted">Choose a region, customize your avatar, and join the shared world in a few clear steps.</p>
              </div>
              <div class="space-y-3 text-sm text-white">
                <div class="rounded-2xl border border-white/10 bg-white/5 p-4">Region selection is now a visual map of choices, not a wall of buttons.</div>
                <div class="rounded-2xl border border-white/10 bg-white/5 p-4">The experience is designed to be fast, readable, and easy to extend later.</div>
              </div>
            </div>
            <div class="flex items-center justify-center p-8">
              <div class="max-w-md space-y-6 text-center">
                <div class="mx-auto flex h-20 w-20 items-center justify-center rounded-2xl border border-veltara-accent/30 bg-veltara-accent/10 shadow-[0_0_40px_rgba(108,99,255,0.18)]">
                  <svg class="h-10 w-10 text-veltara-accent" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945M8 3.935V5.5A2.5 2.5 0 0010.5 8h.5a2 2 0 012 2 2 2 0 104 0 2 2 0 012-2h1.064M15 20.488V18a2 2 0 012-2h3.064"/>
                  </svg>
                </div>
                <h2 class="text-3xl font-bold text-white">Welcome to Veltara</h2>
                <p class="mx-auto max-w-md leading-relaxed text-veltara-muted">A living planet shared by explorers. Connect in real-time, discover regions, and shape the world together.</p>
                <button class="btn-primary w-full max-w-sm py-3" @click="next">Begin Your Journey →</button>
              </div>
            </div>
          </div>

          <div v-else-if="step === 2" class="grid min-h-[32rem] lg:grid-cols-[0.95fr_1.05fr]">
            <div class="hidden flex-col justify-between border-r border-white/10 bg-gradient-to-br from-veltara-glow/15 via-veltara-panel to-black p-8 lg:flex">
              <div>
                <div class="text-xs uppercase tracking-[0.35em] text-veltara-muted">Step 2 of 3</div>
                <h2 class="mt-3 text-3xl font-bold text-white">Choose your region</h2>
                <p class="mt-3 text-sm leading-relaxed text-veltara-muted">Pick a landing zone based on vibe, activity, or who you want to meet first.</p>
              </div>
              <div class="rounded-2xl border border-white/10 bg-white/5 p-4 text-sm text-white">Regions are now presented as cards with live counts and quick visual cues.</div>
            </div>

            <div class="space-y-5 p-8">
              <div class="text-center lg:text-left">
                <h2 class="text-2xl font-bold text-white">Choose Your Region</h2>
                <p class="mt-1 text-sm text-veltara-muted">Where do you want to start exploring?</p>
              </div>

              <div class="grid max-h-80 gap-3 overflow-y-auto pr-1 sm:grid-cols-2">
                <button
                  v-for="region in regions"
                  :key="region.id"
                  class="rounded-2xl border bg-white/3 p-4 text-left transition-all focus:outline-none focus:ring-1 focus:ring-veltara-accent"
                  :class="selectedRegion === region.id ? 'border-veltara-accent bg-veltara-accent/5' : 'border-white/10 hover:border-veltara-accent hover:bg-veltara-accent/5'"
                  @click="selectedRegion = region.id"
                >
                  <div class="mb-2 flex items-center gap-2">
                    <div class="h-3 w-3 rounded-full shadow-[0_0_14px_currentColor]" :style="{ background: region.color }"></div>
                    <span class="text-sm font-semibold text-white">{{ region.name }}</span>
                  </div>
                  <p class="text-[11px] leading-relaxed text-veltara-muted">{{ region.description ?? 'A live sector on the planet.' }}</p>
                </button>
              </div>

              <button class="btn-primary w-full" :disabled="!selectedRegion" @click="next">Continue →</button>
            </div>
          </div>

          <div v-else class="grid min-h-[32rem] lg:grid-cols-[0.95fr_1.05fr]">
            <div class="hidden flex-col justify-between border-r border-white/10 bg-gradient-to-br from-[#1a1140] via-veltara-panel to-black p-8 lg:flex">
              <div>
                <div class="text-xs uppercase tracking-[0.35em] text-veltara-muted">Step 3 of 3</div>
                <h2 class="mt-3 text-3xl font-bold text-white">Customize your avatar</h2>
                <p class="mt-3 text-sm leading-relaxed text-veltara-muted">Choose a color now. You can always change your look later in your profile.</p>
              </div>
              <div class="rounded-2xl border border-white/10 bg-white/5 p-4 text-sm text-white">A strong profile card makes the lobby feel personal before you ever move.</div>
            </div>

            <div class="space-y-5 p-8">
              <div class="text-center lg:text-left">
                <h2 class="text-2xl font-bold text-white">Customize Your Avatar</h2>
                <p class="mt-1 text-sm text-veltara-muted">Pick a color — you can always change it later.</p>
              </div>

              <div class="flex justify-center lg:justify-start">
                <div class="flex h-20 w-20 items-center justify-center rounded-3xl border-4 border-white/15 text-3xl font-bold shadow-[0_0_36px_rgba(108,99,255,0.18)] transition-colors" :style="{ background: selectedColor }">
                  {{ userInitial }}
                </div>
              </div>

              <div>
                <p class="mb-2 text-xs uppercase tracking-[0.3em] text-veltara-muted">Choose a color</p>
                <div class="flex flex-wrap gap-2">
                  <button
                    v-for="color in colors"
                    :key="color"
                    class="h-10 w-10 rounded-full border-2 shadow-[0_0_18px_rgba(255,255,255,0.06)] transition-all"
                    :class="selectedColor === color ? 'scale-110 border-white' : 'border-transparent hover:border-white/60'"
                    :style="{ background: color }"
                    :aria-label="'Color ' + color"
                    @click="selectedColor = color"
                  ></button>
                </div>
              </div>

              <div>
                <label class="mb-1.5 block text-xs font-medium text-veltara-muted">Display Name</label>
                <input v-model="displayName" type="text" maxlength="32" class="input-field w-full" />
              </div>

              <button class="btn-primary w-full" @click="finish">Start Exploring! ✦</button>
            </div>
          </div>
        </div>
      </div>
    </Teleport>
  `,
};
