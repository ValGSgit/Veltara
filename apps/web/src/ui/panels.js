import { store } from '../state/store.js';

export function openPanel(name) {
  store.set('activePanel', name);
}

export function closePanel() {
  store.set('activePanel', null);
}

document.addEventListener('open-panel', (e) => {
  openPanel(e.detail);
});
