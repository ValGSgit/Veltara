import { store } from '../state/store.js';

let authSuccessCallback = null;

export function showLoginModal(onSuccess) {
  authSuccessCallback = onSuccess ?? null;
  store.set('authModal', 'login');
}

export function showRegisterModal(onSuccess) {
  authSuccessCallback = onSuccess ?? null;
  store.set('authModal', 'register');
}

export function handleAuthSuccess(user) {
  authSuccessCallback?.(user);
}
