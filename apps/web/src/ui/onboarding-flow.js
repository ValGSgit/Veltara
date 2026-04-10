import { store } from '../state/store.js';
import { REGIONS } from '@veltara/shared';

const STEPS = [
  {
    title: 'Welcome to Veltara',
    body: 'A shared planet where players explore regions, chat, build, and shape the world together.',
  },
  {
    title: 'Pick Your Region',
    body: 'Choose a starting region to call home. You can teleport between regions at any time.',
    isRegionPicker: true,
  },
  {
    title: 'You\'re Ready',
    body: 'Double-click a region marker on the planet to teleport. Press B inside a region to build. Have fun exploring!',
  },
];

export function showOnboarding() {
  store.set('showOnboarding', true);

  let step = 0;
  let selectedRegion = null;

  const overlay = document.createElement('div');
  overlay.className = 'onboarding-overlay';
  overlay.style.cssText =
    'position:fixed;inset:0;z-index:200;display:flex;align-items:center;justify-content:center;' +
    'background:rgba(5,5,15,0.85);backdrop-filter:blur(6px);';

  function render() {
    const s = STEPS[step];
    const isLast = step === STEPS.length - 1;

    overlay.innerHTML = `
      <div style="width:min(460px,90vw);padding:2rem;border-radius:1.2rem;
        background:linear-gradient(165deg,rgba(16,20,38,0.95),rgba(8,10,22,0.92));
        border:1px solid rgba(148,163,184,0.16);box-shadow:0 24px 80px rgba(0,0,0,0.5);">
        <p style="margin:0 0 6px;font-size:0.68rem;text-transform:uppercase;letter-spacing:0.22em;color:#8ca4c7;">
          Step ${step + 1} of ${STEPS.length}
        </p>
        <h2 style="margin:0 0 0.6rem;font-size:1.35rem;color:#f0f4ff;">${s.title}</h2>
        <p style="margin:0 0 1.2rem;color:#8b9ec5;font-size:0.88rem;line-height:1.55;">${s.body}</p>
        ${s.isRegionPicker ? renderRegionPicker() : ''}
        <div style="display:flex;gap:0.6rem;justify-content:flex-end;">
          ${step > 0 ? '<button class="ob-back" style="padding:0.55rem 1rem;border-radius:0.7rem;border:1px solid rgba(148,163,184,0.2);background:transparent;color:#cfd7ee;cursor:pointer;font-size:0.82rem;">Back</button>' : ''}
          <button class="ob-next" style="padding:0.55rem 1.1rem;border-radius:0.7rem;border:none;background:linear-gradient(135deg,rgba(79,255,176,0.22),rgba(108,99,255,0.25));color:#eaf4ff;cursor:pointer;font-weight:600;font-size:0.82rem;border:1px solid rgba(95,210,255,0.4);">${isLast ? 'Start Exploring' : 'Next'}</button>
        </div>
      </div>
    `;

    overlay.querySelector('.ob-back')?.addEventListener('click', () => { step--; render(); });
    overlay.querySelector('.ob-next')?.addEventListener('click', () => {
      if (isLast) {
        finish();
      } else {
        step++;
        render();
      }
    });

    if (s.isRegionPicker) {
      overlay.querySelectorAll('.ob-region').forEach((btn) => {
        btn.addEventListener('click', () => {
          selectedRegion = btn.dataset.regionId;
          overlay.querySelectorAll('.ob-region').forEach((b) => {
            b.style.borderColor = b.dataset.regionId === selectedRegion
              ? 'rgba(95,210,255,0.6)'
              : 'rgba(148,163,184,0.14)';
            b.style.background = b.dataset.regionId === selectedRegion
              ? 'rgba(55,203,255,0.12)'
              : 'rgba(255,255,255,0.025)';
          });
        });
      });
    }
  }

  function renderRegionPicker() {
    return `<div style="display:grid;grid-template-columns:1fr 1fr;gap:0.5rem;margin-bottom:1.2rem;">
      ${REGIONS.map((r) => `
        <button class="ob-region" data-region-id="${r.id}" style="text-align:left;padding:0.65rem 0.75rem;border-radius:0.75rem;border:1px solid rgba(148,163,184,0.14);background:rgba(255,255,255,0.025);cursor:pointer;color:#f0f4ff;">
          <span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:${r.color};margin-right:6px;box-shadow:0 0 8px ${r.color};"></span>
          <strong style="font-size:0.82rem;">${r.name}</strong>
          <div style="font-size:0.72rem;color:#8b9ec5;margin-top:2px;">${r.description.slice(0, 60)}…</div>
        </button>
      `).join('')}
    </div>`;
  }

  function finish() {
    localStorage.setItem('onboarding_complete', '1');
    store.set('showOnboarding', false);
    overlay.style.opacity = '0';
    overlay.style.transition = 'opacity 0.3s ease';
    setTimeout(() => overlay.remove(), 300);

    if (selectedRegion) {
      document.dispatchEvent(new CustomEvent('onboarding-complete', { detail: { regionId: selectedRegion } }));
    }
  }

  document.body.appendChild(overlay);
  render();
}
