/**
 * Landing page — hero with embedded planet demo, features, pricing, quickstart.
 */

export function landingPage() {
  return `
    <div class="min-h-screen">
      <!-- Nav -->
      <nav class="fixed top-0 left-0 right-0 z-50 flex items-center justify-between px-6 h-14
                  bg-gray-950/80 backdrop-blur-md border-b border-gray-800">
        <a href="#/" class="font-bold text-white text-lg tracking-wider">VELTARA <span class="text-violet-400 text-xs">DEV</span></a>
        <div class="flex items-center gap-4">
          <a href="#/docs" class="text-sm text-gray-400 hover:text-white transition-colors">Docs</a>
          <a href="#/playground" class="text-sm text-gray-400 hover:text-white transition-colors">Playground</a>
          <a href="#/dashboard" class="px-3 py-1.5 text-sm bg-violet-600 text-white rounded-lg hover:bg-violet-500 transition-colors">Dashboard</a>
        </div>
      </nav>

      <!-- Hero -->
      <section class="pt-32 pb-20 px-6 text-center">
        <div class="max-w-4xl mx-auto space-y-6">
          <div class="inline-block px-3 py-1 text-xs text-violet-300 bg-violet-500/10 border border-violet-500/30 rounded-full">
            Developer API — Now in Beta
          </div>
          <h1 class="text-5xl md:text-7xl font-bold text-white leading-tight">
            Embed a living<br />
            <span class="text-transparent bg-clip-text bg-gradient-to-r from-violet-400 to-cyan-400">planet</span>
            anywhere
          </h1>
          <p class="text-xl text-gray-400 max-w-2xl mx-auto leading-relaxed">
            Add real-time multiplayer 3D planets to your app with three lines of code.
            Thousands of players, AI events, and full customization.
          </p>
          <div class="flex flex-col sm:flex-row gap-3 justify-center">
            <a href="#/dashboard" class="px-6 py-3 bg-violet-600 text-white font-medium rounded-lg hover:bg-violet-500 transition-colors">
              Get API Key →
            </a>
            <a href="#/docs" class="px-6 py-3 border border-gray-700 text-gray-300 font-medium rounded-lg hover:border-gray-500 hover:text-white transition-colors">
              Read the Docs
            </a>
          </div>
        </div>
      </section>

      <!-- Embedded planet demo placeholder -->
      <section class="px-6 pb-20">
        <div class="max-w-4xl mx-auto">
          <div id="demo-planet" class="w-full h-80 rounded-2xl border border-gray-800 bg-gray-900
                                       flex items-center justify-center text-gray-600 text-sm">
            <!-- SDK planet would render here in production -->
            <div class="text-center space-y-2">
              <div class="text-4xl">🌍</div>
              <div>Live planet demo — add your API key in the Playground</div>
            </div>
          </div>
        </div>
      </section>

      <!-- Features -->
      <section class="px-6 py-20 border-t border-gray-900">
        <div class="max-w-5xl mx-auto">
          <h2 class="text-3xl font-bold text-white text-center mb-12">Everything you need</h2>
          <div class="grid md:grid-cols-3 gap-6">
            ${[
              { icon: '🌐', title: 'Real-time multiplayer', desc: 'WebSocket connections via Cloudflare Durable Objects. Sub-100ms latency globally.' },
              { icon: '✦', title: 'AI world events', desc: 'Procedurally generated events via Workers AI that keep your world dynamic.' },
              { icon: '🎮', title: '8 unique regions', desc: 'Aurora Basin, Nexus Core, Void Cradle — each with a distinct look and NPC.' },
              { icon: '📦', title: 'TypeScript SDK', desc: 'Full type safety, ESM + CJS, tree-shakeable. 3 lines to mount a planet.' },
              { icon: '🔑', title: 'API key tiers', desc: 'Start free, scale to enterprise. Usage tracked per key with daily analytics.' },
              { icon: '🎨', title: 'Customizable', desc: 'Override colors, hide UI, add your branding. Match your app perfectly.' },
            ].map(f => `
              <div class="p-5 rounded-xl border border-gray-800 bg-gray-900/50 space-y-2">
                <div class="text-2xl">${f.icon}</div>
                <div class="font-semibold text-white">${f.title}</div>
                <div class="text-sm text-gray-400 leading-relaxed">${f.desc}</div>
              </div>
            `).join('')}
          </div>
        </div>
      </section>

      <!-- Code snippet -->
      <section class="px-6 py-20 border-t border-gray-900">
        <div class="max-w-3xl mx-auto">
          <h2 class="text-3xl font-bold text-white text-center mb-4">Get started in 30 seconds</h2>
          <p class="text-gray-400 text-center mb-8">Install the SDK, add your API key, done.</p>
          <div class="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
            <div class="flex items-center gap-2 px-4 py-2.5 border-b border-gray-800 text-xs text-gray-500">
              <div class="w-3 h-3 rounded-full bg-red-500/60"></div>
              <div class="w-3 h-3 rounded-full bg-yellow-500/60"></div>
              <div class="w-3 h-3 rounded-full bg-green-500/60"></div>
              <span class="ml-2 font-mono">quickstart.ts</span>
            </div>
            <pre class="p-5 text-sm font-mono text-gray-300 overflow-x-auto"><code><span class="text-blue-400">import</span> { VeltaraEngine } <span class="text-blue-400">from</span> <span class="text-green-400">'@veltara/sdk'</span>;

<span class="text-gray-500">// Mount a live planet in any div</span>
<span class="text-blue-400">const</span> engine = <span class="text-blue-400">new</span> <span class="text-yellow-300">VeltaraEngine</span>({
  apiKey: <span class="text-green-400">'vlt_your_key_here'</span>,
  container: <span class="text-green-400">'#planet'</span>,
  region: <span class="text-green-400">'nexus-core'</span>,
  onReady: () => console.<span class="text-yellow-300">log</span>(<span class="text-green-400">'🌍 Planet ready!'</span>),
  onPlayerJoin: (player) => console.<span class="text-yellow-300">log</span>(<span class="text-green-400">\`\${player.username} joined\`</span>),
});

<span class="text-blue-400">await</span> engine.<span class="text-yellow-300">mount</span>();</code></pre>
          </div>
        </div>
      </section>

      <!-- Pricing -->
      <section class="px-6 py-20 border-t border-gray-900" id="pricing">
        <div class="max-w-5xl mx-auto">
          <h2 class="text-3xl font-bold text-white text-center mb-12">Simple, transparent pricing</h2>
          <div class="grid md:grid-cols-4 gap-4">
            ${[
              { name: 'Sandbox', price: 'Free', requests: '1,000 req/day', features: ['Watermark overlay', 'All 8 regions', 'WebSocket access', 'Community support'], cta: 'Start free', highlight: false },
              { name: 'Indie', price: '$19/mo', requests: '50,000 req/day', features: ['No watermark', 'All SDK features', 'Usage analytics', 'Email support'], cta: 'Get Indie', highlight: false },
              { name: 'Studio', price: '$79/mo', requests: '500,000 req/day', features: ['Custom branding', 'Priority support', 'Dedicated analytics', 'SLA 99.9%'], cta: 'Get Studio', highlight: true },
              { name: 'Enterprise', price: '$299/mo', requests: 'Unlimited', features: ['Dedicated infra', 'Custom SLA', 'Priority support', 'Direct access'], cta: 'Contact us', highlight: false },
            ].map(tier => `
              <div class="p-5 rounded-xl border ${tier.highlight ? 'border-violet-500 bg-violet-500/5' : 'border-gray-800'} space-y-4">
                ${tier.highlight ? '<div class="text-xs text-violet-400 font-medium">Most Popular</div>' : ''}
                <div>
                  <div class="font-bold text-white text-lg">${tier.name}</div>
                  <div class="text-2xl font-bold text-white mt-1">${tier.price}</div>
                  <div class="text-xs text-gray-500 mt-0.5">${tier.requests}</div>
                </div>
                <ul class="space-y-1.5">
                  ${tier.features.map(f => `
                    <li class="flex items-center gap-2 text-sm text-gray-400">
                      <span class="text-green-400">✓</span> ${f}
                    </li>
                  `).join('')}
                </ul>
                <a href="#/dashboard" class="block text-center px-4 py-2 rounded-lg text-sm font-medium transition-colors
                  ${tier.highlight ? 'bg-violet-600 text-white hover:bg-violet-500' : 'border border-gray-700 text-gray-300 hover:border-gray-500 hover:text-white'}">
                  ${tier.cta}
                </a>
              </div>
            `).join('')}
          </div>
        </div>
      </section>

      <!-- Footer -->
      <footer class="px-6 py-8 border-t border-gray-900 text-center text-sm text-gray-600">
        <div>© 2024 Veltara · <a href="#/docs" class="hover:text-gray-400">Docs</a> · <a href="https://veltara.gg" class="hover:text-gray-400">Main App</a></div>
      </footer>
    </div>
  `;
}
