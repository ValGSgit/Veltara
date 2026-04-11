/**
 * Documentation page — getting started, SDK reference, REST API, WebSocket protocol.
 */

export function docsPage() {
  return `
    <div class="min-h-screen pt-14">
      <div class="max-w-6xl mx-auto flex gap-8 px-6 py-10">
        <!-- Sidebar -->
        <aside class="hidden md:block w-52 shrink-0">
          <div class="sticky top-20 space-y-1 text-sm">
            ${[
              ['getting-started', 'Getting Started'],
              ['sdk-reference', 'SDK Reference'],
              ['rest-api', 'REST API'],
              ['websocket', 'WebSocket Protocol'],
              ['rate-limits', 'Rate Limits'],
              ['changelog', 'Changelog'],
            ].map(([section, label]) => `
              <button type="button" data-doc-section="${section}" class="docs-nav-link block w-full px-3 py-1.5 rounded-lg text-left text-gray-400 hover:text-white hover:bg-gray-900 transition-colors">
                ${label}
              </button>
            `).join('')}
          </div>
        </aside>

        <!-- Content -->
        <main class="flex-1 max-w-3xl space-y-16 prose-veltara">

          <section id="getting-started">
            <h1 class="text-3xl font-bold text-white mb-2">Getting Started</h1>
            <p class="text-gray-400 leading-relaxed">Embed a live Veltara planet in your app in under 5 minutes.</p>

            <h3 class="text-lg font-semibold text-white mt-6 mb-2">1. Install the SDK</h3>
            <div class="code-block"><pre><code>npm install @veltara/sdk three</code></pre></div>

            <h3 class="text-lg font-semibold text-white mt-6 mb-2">2. Get an API key</h3>
            <p class="text-gray-400">Create an account at <a href="#/dashboard" class="text-violet-400">dev.veltara.gg</a>, then create a key on the dashboard. Keys start with <code class="text-violet-300">vlt_</code>.</p>

            <h3 class="text-lg font-semibold text-white mt-6 mb-2">3. Mount a planet</h3>
            <div class="code-block"><pre><code><span class="text-blue-400">import</span> { VeltaraEngine } <span class="text-blue-400">from</span> <span class="text-green-400">'@veltara/sdk'</span>;

<span class="text-blue-400">const</span> engine = <span class="text-blue-400">new</span> <span class="text-yellow-300">VeltaraEngine</span>({
  apiKey: <span class="text-green-400">'vlt_your_key_here'</span>,
  container: <span class="text-green-400">'#planet'</span>,
  region: <span class="text-green-400">'nexus-core'</span>,
  onReady: () => console.<span class="text-yellow-300">log</span>(<span class="text-green-400">'Ready!'</span>),
});

<span class="text-blue-400">await</span> engine.<span class="text-yellow-300">mount</span>();</code></pre></div>

            <h3 class="text-lg font-semibold text-white mt-6 mb-2">4. Add your container</h3>
            <div class="code-block"><pre><code><span class="text-gray-500">&lt;!-- Give it a size! --&gt;</span>
&lt;<span class="text-blue-400">div</span> <span class="text-yellow-300">id</span>=<span class="text-green-400">"planet"</span> <span class="text-yellow-300">style</span>=<span class="text-green-400">"width: 800px; height: 500px;"</span>&gt;&lt;/<span class="text-blue-400">div</span>&gt;</code></pre></div>
          </section>

          <section id="sdk-reference">
            <h2 class="text-2xl font-bold text-white mb-4">SDK Reference</h2>

            <h3 class="text-lg font-semibold text-white mb-2">Constructor Options</h3>
            <div class="overflow-x-auto">
              <table class="w-full text-sm border-collapse">
                <thead>
                  <tr class="border-b border-gray-800">
                    <th class="text-left py-2 pr-4 text-gray-400 font-medium">Option</th>
                    <th class="text-left py-2 pr-4 text-gray-400 font-medium">Type</th>
                    <th class="text-left py-2 text-gray-400 font-medium">Description</th>
                  </tr>
                </thead>
                <tbody>
                  ${[
                    ['apiKey', 'string', 'Your API key (starts with vlt_)'],
                    ['container', 'string | HTMLElement', 'CSS selector or DOM element'],
                    ['region', 'RegionId?', 'Starting region (default: nexus-core)'],
                    ['theme.primaryColor', 'string?', 'Hex color for accents'],
                    ['theme.showUI', 'boolean?', 'Show HUD overlay (default: true)'],
                    ['theme.showChat', 'boolean?', 'Show chat panel (default: true)'],
                    ['theme.watermark', 'boolean?', 'Force watermark (sandbox always shows it)'],
                    ['onReady', '() => void', 'Planet is mounted and visible'],
                    ['onPlayerJoin', '(player: Player) => void', 'Player joined the region'],
                    ['onPlayerLeave', '(player: Player) => void', 'Player left the region'],
                    ['onRegionEvent', '(event: RegionEvent) => void', 'Region event fired'],
                    ['onError', '(error: Error) => void', 'SDK error occurred'],
                  ].map(([opt, type, desc]) => `
                    <tr class="border-b border-gray-900">
                      <td class="py-2 pr-4 font-mono text-violet-300 text-xs">${opt}</td>
                      <td class="py-2 pr-4 font-mono text-gray-400 text-xs">${type}</td>
                      <td class="py-2 text-gray-400 text-xs">${desc}</td>
                    </tr>
                  `).join('')}
                </tbody>
              </table>
            </div>

            <h3 class="text-lg font-semibold text-white mt-6 mb-2">Methods</h3>
            ${[
              { sig: 'mount(): Promise&lt;void&gt;', desc: 'Mount the planet into the container. Must be called once.' },
              { sig: 'unmount(): void', desc: 'Cleanly tear down the planet, close WebSocket, remove DOM elements.' },
              { sig: 'setRegion(regionId: RegionId): Promise&lt;void&gt;', desc: 'Switch to a different region.' },
              { sig: 'triggerEvent(type: string, data: unknown): Promise&lt;void&gt;', desc: 'Trigger a custom event in the current region.' },
              { sig: 'getOnlineCount(): Promise&lt;number&gt;', desc: 'Returns total online player count.' },
              { sig: 'getRegions(): Promise&lt;Region[]&gt;', desc: 'Returns all 8 regions with current player counts.' },
              { sig: 'on(event, handler): void', desc: 'Register an event listener.' },
              { sig: 'off(event, handler): void', desc: 'Remove an event listener.' },
            ].map(m => `
              <div class="mb-3 p-3 rounded-lg bg-gray-900 border border-gray-800">
                <code class="text-violet-300 text-xs font-mono">${m.sig}</code>
                <p class="text-xs text-gray-400 mt-1">${m.desc}</p>
              </div>
            `).join('')}
          </section>

          <section id="rest-api">
            <h2 class="text-2xl font-bold text-white mb-4">REST API</h2>
            <p class="text-gray-400 mb-4">All endpoints require <code class="text-violet-300">Authorization: Bearer vlt_your_key</code></p>
            ${[
              { method: 'GET', path: '/v1/regions', desc: 'List all 8 regions with current player counts' },
              { method: 'GET', path: '/v1/world-state', desc: 'Current planet time, weather, and active events' },
              { method: 'GET', path: '/v1/players/online', desc: 'Total count of online players' },
              { method: 'POST', path: '/v1/events', desc: 'Trigger a custom event in a region' },
              { method: 'POST', path: '/v1/embed/session', desc: 'Create an embed session token for the SDK' },
              { method: 'WS', path: '/v1/regions/:id/subscribe', desc: 'WebSocket stream of region events' },
            ].map(e => `
              <div class="flex items-start gap-3 py-2.5 border-b border-gray-900">
                <span class="text-xs font-mono font-bold px-1.5 py-0.5 rounded shrink-0 mt-0.5
                  ${e.method === 'GET' ? 'bg-green-500/20 text-green-400' :
                    e.method === 'POST' ? 'bg-blue-500/20 text-blue-400' :
                    'bg-purple-500/20 text-purple-400'}">${e.method}</span>
                <code class="text-violet-300 text-xs font-mono">${e.path}</code>
                <span class="text-xs text-gray-400 ml-auto text-right">${e.desc}</span>
              </div>
            `).join('')}

            <h3 class="text-lg font-semibold text-white mt-6 mb-2">POST /v1/events — Body</h3>
            <div class="code-block"><pre><code>{
  "type": "custom_celebration",
  "title": "My App Event",
  "description": "Something special is happening!",
  "region_id": "nexus-core"  // optional, null = all regions
}</code></pre></div>
          </section>

          <section id="websocket">
            <h2 class="text-2xl font-bold text-white mb-4">WebSocket Protocol</h2>
            <p class="text-gray-400 mb-4">All messages follow: <code class="text-violet-300">{"type": "...", "payload": {...}, "timestamp": 1234567890}</code></p>

            <h3 class="text-lg font-semibold text-white mb-2">Server → Client events</h3>
            ${[
              { type: 'initial_state', desc: 'Sent on connect — full region state + chat history' },
              { type: 'player_joined', desc: 'A player connected to this region' },
              { type: 'player_left', desc: 'A player disconnected from this region' },
              { type: 'position_update', desc: 'A player moved on the planet surface' },
              { type: 'chat_message', desc: 'A new chat message (local or global)' },
              { type: 'region_event', desc: 'A game interaction occurred in this region' },
              { type: 'global_event', desc: 'A world-wide event was triggered' },
              { type: 'world_state', desc: 'Planet time/weather update broadcast every 60s' },
              { type: 'pong', desc: 'Response to client ping, includes latency ms' },
              { type: 'error', desc: 'Server-side error with code and message' },
            ].map(m => `
              <div class="flex items-center gap-3 py-2 border-b border-gray-900 text-sm">
                <code class="text-violet-300 font-mono text-xs w-36 shrink-0">${m.type}</code>
                <span class="text-gray-400 text-xs">${m.desc}</span>
              </div>
            `).join('')}
          </section>

          <section id="rate-limits">
            <h2 class="text-2xl font-bold text-white mb-4">Rate Limits</h2>
            <div class="overflow-x-auto">
              <table class="w-full text-sm">
                <thead>
                  <tr class="border-b border-gray-800">
                    <th class="text-left py-2 text-gray-400 font-medium">Tier</th>
                    <th class="text-left py-2 text-gray-400 font-medium">Requests / Day</th>
                    <th class="text-left py-2 text-gray-400 font-medium">Price</th>
                    <th class="text-left py-2 text-gray-400 font-medium">Watermark</th>
                  </tr>
                </thead>
                <tbody>
                  ${[
                    ['Sandbox', '1,000', 'Free', 'Yes'],
                    ['Indie', '50,000', '$19/mo', 'No'],
                    ['Studio', '500,000', '$79/mo', 'No'],
                    ['Enterprise', 'Unlimited', '$299/mo', 'No'],
                  ].map(row => `
                    <tr class="border-b border-gray-900">
                      ${row.map(cell => `<td class="py-2 text-gray-300 text-sm">${cell}</td>`).join('')}
                    </tr>
                  `).join('')}
                </tbody>
              </table>
            </div>
            <p class="text-sm text-gray-500 mt-3">Rate limit headers: <code class="text-violet-300">X-RateLimit-Limit</code>, <code class="text-violet-300">X-RateLimit-Remaining</code>, <code class="text-violet-300">X-RateLimit-Reset</code></p>
          </section>

          <section id="changelog">
            <h2 class="text-2xl font-bold text-white mb-4">Changelog</h2>
            ${[
              { version: '1.0.0', date: '2024-Q4', notes: ['Initial release', 'SDK v1.0', 'All 8 regions live', 'AI NPC system', 'WebSocket streaming'] },
            ].map(v => `
              <div class="mb-6">
                <div class="flex items-center gap-3 mb-2">
                  <span class="text-white font-semibold">v${v.version}</span>
                  <span class="text-xs text-gray-500">${v.date}</span>
                </div>
                <ul class="space-y-1">
                  ${v.notes.map(n => `<li class="text-sm text-gray-400 flex items-center gap-2"><span class="text-green-400">+</span> ${n}</li>`).join('')}
                </ul>
              </div>
            `).join('')}
          </section>

        </main>
      </div>
    </div>
  `;
}

export function initDocs(query = new URLSearchParams()) {
  const section = query.get('section');
  document.querySelectorAll('[data-doc-section]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const targetId = btn.getAttribute('data-doc-section');
      const target = targetId ? document.getElementById(targetId) : null;
      if (!target) return;
      const nextHash = `#/docs?section=${encodeURIComponent(targetId)}`;
      if (window.location.hash !== nextHash) window.history.replaceState({}, '', nextHash);
      target.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
  });

  if (section) {
    const target = document.getElementById(section);
    if (target) {
      requestAnimationFrame(() => {
        target.scrollIntoView({ behavior: 'auto', block: 'start' });
      });
    }
  }
}
