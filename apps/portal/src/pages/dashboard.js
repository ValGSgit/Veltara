/**
 * Dashboard — API key management, usage charts, plan info.
 */

import { portalApi } from '../api.js';

export function dashboardPage() {
  return `
    <div class="min-h-screen pt-14">
      <div class="max-w-5xl mx-auto px-6 py-10 space-y-8">
        <div class="flex items-center justify-between">
          <div>
            <h1 class="text-2xl font-bold text-white">Dashboard</h1>
            <p class="text-sm text-gray-500 mt-0.5">Manage your API keys and monitor usage</p>
          </div>
          <div id="plan-badge" class="px-3 py-1 rounded-full text-xs border border-gray-700 text-gray-400">
            Loading plan…
          </div>
        </div>

        <!-- Alert -->
        <div id="dashboard-alert" class="hidden"></div>

        <!-- API Keys -->
        <section>
          <div class="flex items-center justify-between mb-4">
            <h2 class="font-semibold text-white">API Keys</h2>
            <button id="create-key-btn"
              class="px-3 py-1.5 text-sm bg-violet-600 text-white rounded-lg hover:bg-violet-500 transition-colors">
              + New Key
            </button>
          </div>

          <!-- Create key form (hidden by default) -->
          <div id="create-key-form" class="hidden mb-4 p-4 rounded-xl border border-gray-800 bg-gray-900">
            <div class="flex gap-3">
              <input id="key-name" type="text" placeholder="Key name (e.g. My App Prod)"
                class="flex-1 bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white
                       placeholder-gray-500 focus:outline-none focus:border-violet-500" />
              <button id="submit-key" class="px-4 py-2 text-sm bg-violet-600 text-white rounded-lg hover:bg-violet-500 transition-colors">
                Create
              </button>
              <button id="cancel-key" class="px-4 py-2 text-sm border border-gray-700 text-gray-400 rounded-lg hover:text-white">
                Cancel
              </button>
            </div>
          </div>

          <!-- New key reveal -->
          <div id="new-key-reveal" class="hidden mb-4 p-4 rounded-xl border border-green-500/30 bg-green-500/5">
            <div class="text-xs font-semibold text-green-400 mb-2">✓ Key created — copy it now, it won't be shown again!</div>
            <div class="flex items-center gap-2">
              <code id="new-key-value" class="flex-1 font-mono text-xs text-white bg-gray-800 px-3 py-2 rounded break-all"></code>
              <button id="copy-key" class="px-3 py-2 text-xs border border-gray-700 text-gray-400 rounded hover:text-white">
                Copy
              </button>
            </div>
          </div>

          <!-- Keys list -->
          <div id="keys-list" class="space-y-2">
            <div class="text-sm text-gray-500 text-center py-8">Loading keys…</div>
          </div>
        </section>

        <!-- Usage chart -->
        <section>
          <h2 class="font-semibold text-white mb-4">Usage (Last 7 Days)</h2>
          <div id="usage-section" class="p-4 rounded-xl border border-gray-800 bg-gray-900">
            <canvas id="usage-chart" height="120"></canvas>
          </div>
        </section>

        <!-- Quick links -->
        <section>
          <h2 class="font-semibold text-white mb-4">Quick Links</h2>
          <div class="grid grid-cols-2 md:grid-cols-4 gap-3">
            ${[
              { href: '#/docs', icon: '📖', label: 'Documentation' },
              { href: '#/playground', icon: '🛝', label: 'Playground' },
              { href: '#/docs#rate-limits', icon: '⚡', label: 'Rate Limits' },
              { href: '#/docs#changelog', icon: '📋', label: 'Changelog' },
            ].map(l => `
              <a href="${l.href}" class="p-3 rounded-xl border border-gray-800 hover:border-gray-600
                        bg-gray-900 text-center transition-colors group">
                <div class="text-2xl mb-1">${l.icon}</div>
                <div class="text-xs text-gray-400 group-hover:text-white transition-colors">${l.label}</div>
              </a>
            `).join('')}
          </div>
        </section>
      </div>
    </div>
  `;
}

export async function initDashboard() {
  // Check auth
  if (!portalApi.token) {
    window.location.hash = '/';
    showAuthModal();
    return;
  }

  try {
    const { user } = await portalApi.me();
    document.getElementById('plan-badge').textContent = `${user.plan_tier} plan · ${user.credits} credits`;
  } catch (err) {
    if (err.status === 401) { window.location.hash = '/'; return; }
  }

  // Load keys
  await refreshKeys();

  // Load usage + chart
  await loadUsageChart();

  // Create key button
  document.getElementById('create-key-btn').addEventListener('click', () => {
    document.getElementById('create-key-form').classList.toggle('hidden');
  });

  document.getElementById('cancel-key').addEventListener('click', () => {
    document.getElementById('create-key-form').classList.add('hidden');
  });

  document.getElementById('submit-key').addEventListener('click', async () => {
    const name = document.getElementById('key-name').value.trim();
    if (!name) return;
    try {
      const { key } = await portalApi.createKey(name);
      document.getElementById('create-key-form').classList.add('hidden');
      document.getElementById('new-key-value').textContent = key.raw_key;
      document.getElementById('new-key-reveal').classList.remove('hidden');
      document.getElementById('copy-key').addEventListener('click', () => {
        navigator.clipboard.writeText(key.raw_key);
        document.getElementById('copy-key').textContent = 'Copied!';
      });
      await refreshKeys();
    } catch (err) {
      showAlert(err.message, 'error');
    }
  });
}

async function refreshKeys() {
  const list = document.getElementById('keys-list');
  if (!list) return;
  try {
    const { keys } = await portalApi.listKeys();
    if (keys.length === 0) {
      list.innerHTML = '<div class="text-sm text-gray-500 text-center py-6 rounded-xl border border-dashed border-gray-800">No API keys yet. Create your first key above.</div>';
      return;
    }
    list.innerHTML = keys.map(k => `
      <div class="flex items-center gap-3 p-3.5 rounded-xl border border-gray-800 bg-gray-900/50" data-key-id="${k.id}">
        <div class="flex-1 min-w-0">
          <div class="flex items-center gap-2">
            <span class="font-medium text-white text-sm">${k.name}</span>
            <span class="px-2 py-0.5 text-[10px] rounded-full border capitalize
              ${k.tier === 'enterprise' ? 'border-yellow-500/40 text-yellow-400' :
                k.tier === 'studio' ? 'border-violet-500/40 text-violet-400' :
                k.tier === 'indie' ? 'border-blue-500/40 text-blue-400' :
                'border-gray-700 text-gray-400'}">${k.tier}</span>
          </div>
          <div class="text-xs text-gray-500 font-mono mt-0.5">${k.key_prefix}</div>
          <div class="text-xs text-gray-600 mt-0.5">${k.requests_today.toLocaleString()} / ${k.rate_limit.toLocaleString()} req today · ${k.requests_total.toLocaleString()} total</div>
        </div>
        <button class="revoke-btn px-2.5 py-1 text-xs text-red-400 border border-red-500/30 rounded hover:bg-red-500/10 transition-colors"
          data-key-id="${k.id}">Revoke</button>
      </div>
    `).join('');

    list.querySelectorAll('.revoke-btn').forEach(btn => {
      btn.addEventListener('click', async () => {
        if (!confirm('Revoke this key? This cannot be undone.')) return;
        try {
          await portalApi.revokeKey(btn.dataset.keyId);
          await refreshKeys();
        } catch (err) {
          showAlert(err.message, 'error');
        }
      });
    });
  } catch (err) {
    list.innerHTML = `<div class="text-sm text-red-400 text-center py-4">${err.message}</div>`;
  }
}

async function loadUsageChart() {
  try {
    const { usage } = await portalApi.getUsage();
    if (!usage || usage.length === 0) return;

    const { Chart } = await import('chart.js/auto');
    const canvas = document.getElementById('usage-chart');
    if (!canvas) return;

    const labels = usage[0]?.daily_stats?.map(d => d.date.slice(5)) ?? [];
    const datasets = usage.map(key => ({
      label: key.name,
      data: key.daily_stats.map(d => d.count),
      borderColor: `hsl(${Math.random() * 360}, 70%, 60%)`,
      backgroundColor: 'transparent',
      tension: 0.4,
    }));

    new Chart(canvas, {
      type: 'line',
      data: { labels, datasets },
      options: {
        responsive: true,
        plugins: {
          legend: { labels: { color: '#9ca3af', font: { size: 11 } } },
        },
        scales: {
          x: { ticks: { color: '#6b7280' }, grid: { color: '#1f2937' } },
          y: { ticks: { color: '#6b7280' }, grid: { color: '#1f2937' }, beginAtZero: true },
        },
      },
    });
  } catch { /* Chart.js not critical */ }
}

function showAlert(message, type = 'info') {
  const el = document.getElementById('dashboard-alert');
  if (!el) return;
  const colors = { error: 'border-red-500/30 bg-red-500/10 text-red-400', info: 'border-blue-500/30 bg-blue-500/10 text-blue-400' };
  el.className = `mb-4 p-3 rounded-lg border text-sm ${colors[type]}`;
  el.textContent = message;
  el.classList.remove('hidden');
  setTimeout(() => el.classList.add('hidden'), 5000);
}

function showAuthModal() {
  const modals = document.getElementById('portal-modal');
  if (!modals) return;
  modals.innerHTML = `
    <div class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div class="w-full max-w-sm bg-gray-900 border border-gray-800 rounded-xl p-6 space-y-4">
        <h2 id="pl-title" class="text-lg font-bold text-white">Sign in to Portal</h2>
        <form id="portal-login" class="space-y-3">
          <input type="text" id="pl-username" placeholder="Username" class="portal-input w-full hidden" />
          <input type="email" id="pl-email" placeholder="Email" class="portal-input w-full" required />
          <input type="password" id="pl-password" placeholder="Password" class="portal-input w-full" required />
          <button type="submit" id="pl-submit" class="portal-btn w-full">Sign In</button>
        </form>
        <button id="pl-toggle-mode" type="button" class="w-full px-3 py-2 text-xs border border-gray-700 text-gray-300 rounded-lg hover:text-white hover:border-gray-500 transition-colors">
          Need an account? Create one
        </button>
        <div id="pl-error" class="text-xs text-red-400 hidden"></div>
      </div>
    </div>
  `;

  let isRegisterMode = false;
  const titleEl = document.getElementById('pl-title');
  const usernameEl = document.getElementById('pl-username');
  const submitEl = document.getElementById('pl-submit');
  const toggleEl = document.getElementById('pl-toggle-mode');
  const errorEl = document.getElementById('pl-error');

  function setAuthMode(registerMode) {
    isRegisterMode = registerMode;
    titleEl.textContent = registerMode ? 'Create Portal Account' : 'Sign in to Portal';
    submitEl.textContent = registerMode ? 'Create Account' : 'Sign In';
    toggleEl.textContent = registerMode ? 'Already have an account? Sign in' : 'Need an account? Create one';
    usernameEl.classList.toggle('hidden', !registerMode);
    usernameEl.required = registerMode;
    errorEl.classList.add('hidden');
    errorEl.textContent = '';
  }

  toggleEl.addEventListener('click', () => setAuthMode(!isRegisterMode));

  document.getElementById('portal-login').addEventListener('submit', async (e) => {
    e.preventDefault();
    try {
      const email = document.getElementById('pl-email').value;
      const password = document.getElementById('pl-password').value;
      if (isRegisterMode) {
        const username = usernameEl.value.trim();
        if (!username) {
          throw new Error('Username is required.');
        }
        await portalApi.register(username, email, password);
      } else {
        await portalApi.login(email, password);
      }
      modals.innerHTML = '';
      window.location.hash = '/dashboard';
    } catch (err) {
      errorEl.textContent = err.message;
      errorEl.classList.remove('hidden');
    }
  });
}
