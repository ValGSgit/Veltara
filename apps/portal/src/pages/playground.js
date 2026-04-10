/**
 * Playground — live SDK sandbox with code preview and event log.
 */

import { portalApi } from '../api.js';

export function playgroundPage() {
  return `
    <div class="min-h-screen pt-14">
      <div class="max-w-6xl mx-auto px-6 py-10">
        <h1 class="text-2xl font-bold text-white mb-1">API Playground</h1>
        <p class="text-sm text-gray-500 mb-8">Test the SDK live. Paste your API key and the planet renders in real time.</p>

        <div class="grid lg:grid-cols-2 gap-6">
          <!-- Left — controls -->
          <div class="space-y-4">
            <!-- API Key input -->
            <div>
              <label class="block text-xs font-medium text-gray-400 mb-1.5">API Key</label>
              <div class="flex gap-2">
                <input id="pg-api-key" type="password" placeholder="vlt_your_key_here"
                  class="flex-1 bg-gray-900 border border-gray-800 rounded-lg px-3 py-2 text-sm text-white
                         placeholder-gray-600 focus:outline-none focus:border-violet-500 font-mono" />
                <button id="pg-load" class="px-4 py-2 text-sm bg-violet-600 text-white rounded-lg hover:bg-violet-500 transition-colors">
                  Load
                </button>
              </div>
            </div>

            <!-- Planet container -->
            <div>
              <label class="block text-xs font-medium text-gray-400 mb-1.5">Planet Preview</label>
              <div id="pg-planet" class="w-full rounded-xl border border-gray-800 bg-gray-900 overflow-hidden"
                   style="height: 280px; position: relative;">
                <div class="absolute inset-0 flex items-center justify-center text-gray-600 text-sm">
                  Enter API key to load planet
                </div>
              </div>
            </div>

            <!-- SDK method calls -->
            <div>
              <label class="block text-xs font-medium text-gray-400 mb-2">SDK Methods</label>
              <div class="grid grid-cols-2 gap-2">
                ${[
                  { id: 'pg-btn-regions', label: 'getRegions()' },
                  { id: 'pg-btn-online', label: 'getOnlineCount()' },
                  { id: 'pg-btn-nexus', label: 'setRegion("nexus-core")' },
                  { id: 'pg-btn-aurora', label: 'setRegion("aurora-basin")' },
                  { id: 'pg-btn-event', label: 'triggerEvent("demo")' },
                  { id: 'pg-btn-unmount', label: 'unmount()' },
                ].map(b => `
                  <button id="${b.id}" class="pg-method-btn px-3 py-2 text-xs font-mono
                    bg-gray-900 border border-gray-800 rounded-lg text-gray-400
                    hover:border-violet-500 hover:text-white transition-colors text-left disabled:opacity-40"
                    disabled>${b.label}</button>
                `).join('')}
              </div>
            </div>
          </div>

          <!-- Right — code preview + event log -->
          <div class="space-y-4">
            <!-- Code preview -->
            <div>
              <label class="block text-xs font-medium text-gray-400 mb-1.5">Code Preview</label>
              <div class="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
                <div class="flex items-center justify-between px-4 py-2 border-b border-gray-800">
                  <span class="text-xs text-gray-500 font-mono">sdk-usage.ts</span>
                  <button id="pg-copy-code" class="text-xs text-gray-500 hover:text-white transition-colors">Copy</button>
                </div>
                <pre id="pg-code" class="p-4 text-xs font-mono text-gray-300 overflow-x-auto min-h-24"><code>// Load a planet to see generated code</code></pre>
              </div>
            </div>

            <!-- Event log -->
            <div class="flex-1">
              <div class="flex items-center justify-between mb-1.5">
                <label class="text-xs font-medium text-gray-400">Event Log</label>
                <button id="pg-clear-log" class="text-xs text-gray-600 hover:text-gray-400 transition-colors">Clear</button>
              </div>
              <div id="pg-log" class="h-64 bg-gray-900 border border-gray-800 rounded-xl p-3 overflow-y-auto
                                    font-mono text-xs text-gray-500 space-y-1">
                <div class="text-gray-600">// Events will appear here…</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  `;
}

/** @type {import('@veltara/sdk').VeltaraEngine | null} */
let engine = null;

export function initPlayground() {
  document.getElementById('pg-load').addEventListener('click', loadPlanet);
  document.getElementById('pg-clear-log').addEventListener('click', () => {
    document.getElementById('pg-log').innerHTML = '';
  });
  document.getElementById('pg-copy-code').addEventListener('click', () => {
    const code = document.getElementById('pg-code').textContent;
    navigator.clipboard.writeText(code).then(() => {
      document.getElementById('pg-copy-code').textContent = 'Copied!';
      setTimeout(() => { document.getElementById('pg-copy-code').textContent = 'Copy'; }, 1500);
    });
  });

  // Method buttons
  const btns = {
    'pg-btn-regions': async () => {
      const regions = await engine?.getRegions();
      logEvent('getRegions()', regions);
      updateCode('getRegions');
    },
    'pg-btn-online': async () => {
      const count = await engine?.getOnlineCount();
      logEvent('getOnlineCount()', { count });
      updateCode('getOnlineCount');
    },
    'pg-btn-nexus': async () => {
      await engine?.setRegion('nexus-core');
      logEvent('setRegion("nexus-core")', null);
      updateCode('setRegion', '"nexus-core"');
    },
    'pg-btn-aurora': async () => {
      await engine?.setRegion('aurora-basin');
      logEvent('setRegion("aurora-basin")', null);
      updateCode('setRegion', '"aurora-basin"');
    },
    'pg-btn-event': async () => {
      await engine?.triggerEvent('demo_event', { source: 'playground', time: Date.now() });
      logEvent('triggerEvent("demo_event")', { data: 'Demo event triggered' });
      updateCode('triggerEvent', '"demo_event", { source: "playground" }');
    },
    'pg-btn-unmount': () => {
      engine?.unmount();
      engine = null;
      logEvent('unmount()', null);
      updateCode('unmount');
      toggleMethodBtns(false);
      const container = document.getElementById('pg-planet');
      container.innerHTML = '<div class="absolute inset-0 flex items-center justify-center text-gray-600 text-sm">Planet unmounted. Reload to restart.</div>';
    },
  };

  Object.entries(btns).forEach(([id, handler]) => {
    document.getElementById(id)?.addEventListener('click', async () => {
      try { await handler(); } catch (err) { logEvent('ERROR', { message: err.message }); }
    });
  });
}

async function loadPlanet() {
  const apiKey = document.getElementById('pg-api-key').value.trim();
  if (!apiKey) return;

  const container = document.getElementById('pg-planet');
  container.innerHTML = '<div class="absolute inset-0 flex items-center justify-center text-gray-400 text-sm">Loading planet…</div>';

  try {
    const { VeltaraEngine } = await import('@veltara/sdk');

    engine?.unmount();
    engine = new VeltaraEngine({
      apiKey,
      container: '#pg-planet',
      region: 'nexus-core',
      theme: { primaryColor: '#6c63ff', showUI: true },
      onReady: () => {
        logEvent('onReady', { message: 'Planet is ready!' });
        toggleMethodBtns(true);
      },
      onPlayerJoin: (player) => logEvent('onPlayerJoin', player),
      onPlayerLeave: (player) => logEvent('onPlayerLeave', player),
      onRegionEvent: (event) => logEvent('onRegionEvent', event),
      onError: (err) => logEvent('onError', { message: err.message }),
    });

    await engine.mount();

    updateCode('mount', null, apiKey.slice(0, 12) + '…');
    logEvent('mount()', { message: 'Mounting planet…' });
  } catch (err) {
    container.innerHTML = `<div class="absolute inset-0 flex items-center justify-center text-red-400 text-sm p-4 text-center">${err.message}</div>`;
    logEvent('ERROR', { message: err.message });
  }
}

function logEvent(method, data) {
  const log = document.getElementById('pg-log');
  if (!log) return;
  const time = new Date().toLocaleTimeString('en-US', { hour12: false });
  const entry = document.createElement('div');
  entry.className = 'border-l-2 border-violet-500/30 pl-2';
  entry.innerHTML = `
    <span class="text-gray-600">${time}</span>
    <span class="text-violet-400 ml-2">${method}</span>
    ${data ? `<pre class="text-gray-500 mt-0.5 whitespace-pre-wrap">${JSON.stringify(data, null, 2).slice(0, 200)}</pre>` : ''}
  `;
  log.appendChild(entry);
  log.scrollTop = log.scrollHeight;
}

function updateCode(method, args = null, apiKeyDisplay = 'vlt_your_key') {
  const code = document.getElementById('pg-code');
  if (!code) return;

  const snippets = {
    mount: `import { VeltaraEngine } from '@veltara/sdk';

const engine = new VeltaraEngine({
  apiKey: '${apiKeyDisplay}',
  container: '#my-planet',
  region: 'nexus-core',
  onReady: () => console.log('Ready!'),
  onPlayerJoin: (p) => console.log(p.username + ' joined'),
});

await engine.mount();`,
    getRegions: `const regions = await engine.getRegions();
// Returns: Region[] with player counts`,
    getOnlineCount: `const count = await engine.getOnlineCount();
// Returns: number`,
    setRegion: `await engine.setRegion(${args});`,
    triggerEvent: `await engine.triggerEvent(${args});`,
    unmount: `engine.unmount();
// Cleans up WebSocket + removes iframe`,
  };

  code.textContent = snippets[method] ?? `engine.${method}(${args ?? ''});`;
}

function toggleMethodBtns(enabled) {
  document.querySelectorAll('.pg-method-btn').forEach(btn => {
    btn.disabled = !enabled;
  });
}
