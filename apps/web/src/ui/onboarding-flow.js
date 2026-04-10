import { store } from '../state/store.js';

export function showOnboarding() {
  store.set('showOnboarding', true);
}
