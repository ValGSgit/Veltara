/**
 * 3-step onboarding flow for first-time users.
 * Step 1: Welcome  Step 2: Pick region  Step 3: Customize avatar
 */

import { REGIONS } from '@veltara/shared';
import { store } from '../state/store.js';
import { api } from '../network/api.js';
import { toast } from './toast.js';

export function showOnboarding() {
  const container = document.createElement('div');
  container.id = 'onboarding';
  container.className = 'fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-md';
  container.setAttribute('role', 'dialog');
  container.setAttribute('aria-modal', 'true');
  container.setAttribute('aria-label', 'Welcome to Veltara');

  document.getElementById('modals').appendChild(container);
  showStep(container, 1, {});
}

function showStep(container, step, data) {
  container.innerHTML = '';
  const panel = document.createElement('div');
  panel.className = 'w-full max-w-lg bg-veltara-panel border border-veltara-border rounded-2xl p-8 shadow-2xl';

  // Progress dots
  const dots = [1, 2, 3].map((i) =>
    `<div class="w-2 h-2 rounded-full ${i === step ? 'bg-veltara-accent' : 'bg-veltara-border'}"></div>`
  ).join('');

  let stepContent = '';

  if (step === 1) {
    stepContent = `
      <div class="text-center space-y-6">
        <div class="w-20 h-20 mx-auto rounded-full bg-veltara-accent/10 border border-veltara-accent/30
                    flex items-center justify-center animate-pulse">
          <svg class="w-10 h-10 text-veltara-accent" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5"
              d="M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945M8 3.935V5.5A2.5 2.5 0 0010.5 8h.5a2 2 0 012 2 2 2 0 104 0 2 2 0 012-2h1.064M15 20.488V18a2 2 0 012-2h3.064"/>
          </svg>
        </div>
        <h2 class="text-3xl font-bold text-white">Welcome to Veltara</h2>
        <p class="text-veltara-muted leading-relaxed">
          A living planet shared by thousands of explorers. Connect in real-time,
          discover unique regions, and shape the world together.
        </p>
        <button id="onboarding-next" class="btn-primary w-full text-base py-3">
          Begin Your Journey →
        </button>
      </div>
    `;
  } else if (step === 2) {
    stepContent = `
      <div class="space-y-5">
        <div class="text-center">
          <h2 class="text-2xl font-bold text-white">Choose Your Region</h2>
          <p class="text-veltara-muted text-sm mt-1">Where do you want to start exploring?</p>
        </div>
        <div id="region-grid" class="grid grid-cols-2 gap-2 max-h-72 overflow-y-auto pr-1">
          ${REGIONS.map((r) => `
            <button data-region="${r.id}" class="region-choice text-left p-3 rounded-lg border border-veltara-border
              hover:border-veltara-accent hover:bg-veltara-accent/5 transition-all focus:outline-none
              focus:ring-1 focus:ring-veltara-accent">
              <div class="flex items-center gap-2 mb-1">
                <div class="w-3 h-3 rounded-full" style="background:${r.color}"></div>
                <span class="text-xs font-semibold text-white">${r.name}</span>
              </div>
              <p class="text-[11px] text-veltara-muted leading-relaxed line-clamp-2">${r.description}</p>
            </button>
          `).join('')}
        </div>
        <button id="onboarding-next" class="btn-primary w-full" disabled>
          Continue →
        </button>
      </div>
    `;
  } else if (step === 3) {
    const colors = ['#6c63ff', '#4fffb0', '#ff6b6b', '#ffd93d', '#00d4ff', '#ff8c00', '#cc2200', '#22cc44'];
    stepContent = `
      <div class="space-y-5">
        <div class="text-center">
          <h2 class="text-2xl font-bold text-white">Customize Your Avatar</h2>
          <p class="text-veltara-muted text-sm mt-1">Pick a color — you can always change it later.</p>
        </div>
        <!-- Preview -->
        <div class="flex justify-center">
          <div id="avatar-preview" class="w-16 h-16 rounded-full border-4 border-white/20
            flex items-center justify-center text-2xl font-bold transition-colors"
            style="background: ${colors[0]}">
            ${(store.get('user')?.username?.[0] ?? '?').toUpperCase()}
          </div>
        </div>
        <!-- Color picker -->
        <div>
          <p class="text-xs text-veltara-muted mb-2">Choose a color:</p>
          <div class="flex gap-2 flex-wrap">
            ${colors.map((c, i) => `
              <button data-color="${c}" class="color-btn w-8 h-8 rounded-full border-2
                ${i === 0 ? 'border-white scale-110' : 'border-transparent hover:border-white/60'}
                transition-all" style="background:${c}"
                aria-label="Color ${c}"></button>
            `).join('')}
          </div>
        </div>
        <!-- Display name confirmation -->
        <div>
          <label class="text-xs font-medium text-veltara-muted block mb-1.5">Display Name</label>
          <input id="display-name" type="text" value="${store.get('user')?.username ?? ''}"
            maxlength="32" class="input-field w-full" />
        </div>
        <button id="onboarding-next" class="btn-primary w-full">
          Start Exploring! ✦
        </button>
      </div>
    `;
  }

  panel.innerHTML = `
    <div class="flex justify-center gap-2 mb-6">${dots}</div>
    ${stepContent}
  `;
  container.appendChild(panel);

  // Step-specific bindings
  if (step === 1) {
    panel.querySelector('#onboarding-next').addEventListener('click', () => showStep(container, 2, data));
  } else if (step === 2) {
    let selectedRegion = null;
    panel.querySelectorAll('.region-choice').forEach((btn) => {
      btn.addEventListener('click', () => {
        panel.querySelectorAll('.region-choice').forEach((b) => {
          b.classList.remove('border-veltara-accent', 'bg-veltara-accent/5');
        });
        btn.classList.add('border-veltara-accent', 'bg-veltara-accent/5');
        selectedRegion = btn.dataset.region;
        panel.querySelector('#onboarding-next').disabled = false;
      });
    });

    panel.querySelector('#onboarding-next').addEventListener('click', () => {
      if (!selectedRegion) return;
      showStep(container, 3, { ...data, regionId: selectedRegion });
    });
  } else if (step === 3) {
    let selectedColor = colors[0];

    panel.querySelectorAll('.color-btn').forEach((btn) => {
      btn.addEventListener('click', () => {
        panel.querySelectorAll('.color-btn').forEach((b) => b.classList.replace('border-white', 'border-transparent'));
        btn.classList.replace('border-transparent', 'border-white');
        selectedColor = btn.dataset.color;
        panel.querySelector('#avatar-preview').style.background = selectedColor;
      });
    });

    panel.querySelector('#onboarding-next').addEventListener('click', async () => {
      const displayName = panel.querySelector('#display-name').value.trim();
      container.remove();

      // Complete onboarding
      localStorage.setItem('onboarding_complete', '1');
      document.dispatchEvent(new CustomEvent('onboarding-complete', {
        detail: { regionId: data.regionId, color: selectedColor, displayName },
      }));
      toast.success('Welcome to Veltara! 🌍');
    });
  }
}
