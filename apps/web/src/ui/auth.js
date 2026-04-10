/**
 * Auth modals — login and register.
 */

import { api } from '../network/api.js';
import { store } from '../state/store.js';
import { toast } from './toast.js';

export function showLoginModal(onSuccess) {
  const modal = createModal('login', `
    <h2 class="text-xl font-bold text-white mb-6">Sign In to Veltara</h2>
    <form id="login-form" class="space-y-4" novalidate>
      <div>
        <label for="login-email" class="block text-xs font-medium text-veltara-muted mb-1.5">Email</label>
        <input id="login-email" type="email" required autocomplete="email"
          class="input-field w-full" placeholder="you@example.com" />
      </div>
      <div>
        <label for="login-password" class="block text-xs font-medium text-veltara-muted mb-1.5">Password</label>
        <input id="login-password" type="password" required autocomplete="current-password"
          class="input-field w-full" placeholder="••••••••" />
      </div>
      <button type="submit" class="btn-primary w-full">Sign In</button>
      <p class="text-center text-xs text-veltara-muted">
        No account?
        <button type="button" id="switch-to-register" class="text-veltara-accent hover:underline">Create one</button>
      </p>
    </form>
    <div id="login-error" class="mt-3 text-xs text-red-400 hidden"></div>
  `);

  document.getElementById('switch-to-register').addEventListener('click', () => {
    closeModal(modal);
    showRegisterModal(onSuccess);
  });

  document.getElementById('login-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = document.getElementById('login-email').value;
    const password = document.getElementById('login-password').value;
    const btn = e.target.querySelector('button[type="submit"]');
    btn.disabled = true;
    btn.textContent = 'Signing in…';

    try {
      const data = await api.login(email, password);
      store.update({ user: data.user, isAuthenticated: true });
      toast.success(`Welcome back, ${data.user.username}!`);
      closeModal(modal);
      onSuccess?.(data.user);
    } catch (err) {
      document.getElementById('login-error').textContent = err.message;
      document.getElementById('login-error').classList.remove('hidden');
      btn.disabled = false;
      btn.textContent = 'Sign In';
    }
  });
}

export function showRegisterModal(onSuccess) {
  const modal = createModal('register', `
    <h2 class="text-xl font-bold text-white mb-6">Join Veltara</h2>
    <form id="register-form" class="space-y-4" novalidate>
      <div>
        <label for="reg-username" class="block text-xs font-medium text-veltara-muted mb-1.5">Username</label>
        <input id="reg-username" type="text" required minlength="3" maxlength="32" autocomplete="username"
          class="input-field w-full" placeholder="explorer_42" />
      </div>
      <div>
        <label for="reg-email" class="block text-xs font-medium text-veltara-muted mb-1.5">Email</label>
        <input id="reg-email" type="email" required autocomplete="email"
          class="input-field w-full" placeholder="you@example.com" />
      </div>
      <div>
        <label for="reg-password" class="block text-xs font-medium text-veltara-muted mb-1.5">Password</label>
        <input id="reg-password" type="password" required minlength="8" autocomplete="new-password"
          class="input-field w-full" placeholder="8+ characters" />
      </div>
      <button type="submit" class="btn-primary w-full">Create Account</button>
      <p class="text-center text-xs text-veltara-muted">
        Have an account?
        <button type="button" id="switch-to-login" class="text-veltara-accent hover:underline">Sign in</button>
      </p>
    </form>
    <div id="register-error" class="mt-3 text-xs text-red-400 hidden"></div>
  `);

  document.getElementById('switch-to-login').addEventListener('click', () => {
    closeModal(modal);
    showLoginModal(onSuccess);
  });

  document.getElementById('register-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const username = document.getElementById('reg-username').value;
    const email = document.getElementById('reg-email').value;
    const password = document.getElementById('reg-password').value;
    const btn = e.target.querySelector('button[type="submit"]');
    btn.disabled = true;
    btn.textContent = 'Creating account…';

    try {
      const data = await api.register(username, email, password);
      store.update({ user: data.user, isAuthenticated: true });
      toast.success('Welcome to Veltara!');
      closeModal(modal);
      onSuccess?.(data.user);
    } catch (err) {
      document.getElementById('register-error').textContent = err.message;
      document.getElementById('register-error').classList.remove('hidden');
      btn.disabled = false;
      btn.textContent = 'Create Account';
    }
  });
}

function createModal(id, content) {
  const overlay = document.createElement('div');
  overlay.id = `modal-${id}`;
  overlay.className = 'fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm';
  overlay.setAttribute('role', 'dialog');
  overlay.setAttribute('aria-modal', 'true');

  const panel = document.createElement('div');
  panel.className = 'relative w-full max-w-sm bg-veltara-panel border border-veltara-border rounded-xl p-6 shadow-2xl';
  panel.innerHTML = `
    <button class="modal-close absolute top-3 right-3 text-veltara-muted hover:text-white transition-colors"
      aria-label="Close modal">
      <svg class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/>
      </svg>
    </button>
    ${content}
  `;

  overlay.appendChild(panel);
  document.getElementById('modals').appendChild(overlay);

  // Close on overlay click
  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) closeModal(overlay);
  });

  // Close button
  panel.querySelector('.modal-close').addEventListener('click', () => closeModal(overlay));

  // Keyboard trap
  overlay.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') closeModal(overlay);
  });

  // Focus first input
  setTimeout(() => overlay.querySelector('input')?.focus(), 50);

  return overlay;
}

function closeModal(modal) {
  modal.remove();
}
