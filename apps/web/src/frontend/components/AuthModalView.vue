<script setup>
import { computed, ref } from 'vue';
import { api } from '../../network/api.js';
import { store } from '../../state/store.js';
import { toast } from '../../ui/toast.js';

const props = defineProps({
  mode: { type: String, required: true },
  onSuccess: { type: Function, default: null },
});

const emit = defineEmits(['close', 'switch-mode', 'success']);

const loading = ref(false);
const error = ref('');
const email = ref('');
const password = ref('');
const username = ref('');

const isLogin = computed(() => props.mode === 'login');

function close() {
  emit('close');
  error.value = '';
  loading.value = false;
}

async function submit() {
  if (loading.value) return;
  loading.value = true;
  error.value = '';

  const normalizedEmail = String(email.value ?? '').trim().toLowerCase();
  const normalizedUsername = String(username.value ?? '').trim();
  const normalizedPassword = String(password.value ?? '');

  if (!normalizedEmail || !normalizedPassword || (!isLogin.value && !normalizedUsername)) {
    error.value = 'Please complete all required fields.';
    loading.value = false;
    return;
  }

  try {
    const payload = isLogin.value
      ? await api.login(normalizedEmail, normalizedPassword)
      : await api.register(normalizedUsername, normalizedEmail, normalizedPassword);

    store.update({ user: payload.user, isAuthenticated: true });
    toast.success(isLogin.value ? `Welcome back, ${payload.user.username}!` : 'Welcome to Veltara!');
    emit('success', payload.user);
    props.onSuccess?.(payload.user);
    close();
  } catch (err) {
    error.value = err.message ?? 'Unable to authenticate.';
  } finally {
    loading.value = false;
  }
}

function switchMode() {
  emit('switch-mode', isLogin.value ? 'register' : 'login');
  error.value = '';
}
</script>

<template>
  <Teleport to="#modals">
    <div class="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-md" @click.self="close">
      <div class="relative w-full max-w-4xl overflow-hidden rounded-3xl border border-white/10 bg-[#0e1020]/95 shadow-2xl">
        <button
          class="modal-close absolute right-3 top-3 text-veltara-muted transition-colors hover:text-white"
          aria-label="Close modal"
          @click="close"
        >
          <svg class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/>
          </svg>
        </button>

        <div class="grid min-h-[28rem] lg:grid-cols-[0.95fr_1.05fr]">
          <div class="hidden flex-col justify-between border-r border-white/10 bg-gradient-to-br from-veltara-accent/20 via-veltara-panel to-black p-8 lg:flex">
            <div>
              <div class="text-xs uppercase tracking-[0.35em] text-veltara-muted">Veltara</div>
              <div class="mt-4 text-3xl font-bold leading-tight text-white">A shared planet, structured for play.</div>
              <p class="mt-3 text-sm leading-relaxed text-veltara-muted">
                Live regions, fast social access, and a clean control surface that makes adding future features easier.
              </p>
            </div>
            <div class="space-y-3 text-sm text-white">
              <div class="rounded-2xl border border-white/10 bg-white/5 p-4">Planet view and social tools stay separate, so the interface remains easy to extend.</div>
              <div class="rounded-2xl border border-white/10 bg-white/5 p-4">This layout is designed for responsive dashboards, side panels, and future Vue components.</div>
            </div>
          </div>

          <div class="space-y-6 p-6 sm:p-8 lg:p-10">
            <div>
              <p class="text-xs uppercase tracking-[0.35em] text-veltara-muted">{{ isLogin ? 'Secure access' : 'Join the planet' }}</p>
              <h2 class="mt-2 text-3xl font-bold text-white">
                {{ isLogin ? 'Sign in to Veltara' : 'Create your explorer account' }}
              </h2>
              <p class="mt-2 text-sm leading-relaxed text-veltara-muted">
                {{
                  isLogin
                    ? 'Resume your explorer profile, sync your region, and jump back into the planet.'
                    : 'Pick a name, connect your identity, and step into a shared world built for social play.'
                }}
              </p>
            </div>

            <form class="space-y-4" @submit.prevent="submit" novalidate>
              <div v-if="!isLogin">
                <label for="auth-username" class="mb-1.5 block text-xs font-medium text-veltara-muted">Username</label>
                <input id="auth-username" v-model="username" type="text" required minlength="3" maxlength="32" autocomplete="username" class="input-field w-full" placeholder="explorer_42" />
              </div>

              <div>
                <label for="auth-email" class="mb-1.5 block text-xs font-medium text-veltara-muted">Email</label>
                <input id="auth-email" v-model="email" type="email" required autocomplete="email" class="input-field w-full" placeholder="you@example.com" />
              </div>

              <div>
                <label for="auth-password" class="mb-1.5 block text-xs font-medium text-veltara-muted">Password</label>
                <input
                  id="auth-password"
                  v-model="password"
                  type="password"
                  required
                  :minlength="isLogin ? 1 : 8"
                  :autocomplete="isLogin ? 'current-password' : 'new-password'"
                  class="input-field w-full"
                  :placeholder="isLogin ? '••••••••' : '8+ characters'"
                />
              </div>

              <button type="submit" class="btn-primary w-full py-3" :disabled="loading">
                {{ loading ? (isLogin ? 'Signing in…' : 'Creating account…') : (isLogin ? 'Sign In' : 'Create Account') }}
              </button>

              <p class="text-center text-xs text-veltara-muted">
                {{ isLogin ? 'No account?' : 'Have an account?' }}
                <button type="button" class="text-veltara-accent hover:underline" @click="switchMode">
                  {{ isLogin ? 'Create one' : 'Sign in' }}
                </button>
              </p>
            </form>

            <div v-if="error" class="mt-2 text-xs text-red-400">{{ error }}</div>
          </div>
        </div>
      </div>
    </div>
  </Teleport>
</template>
