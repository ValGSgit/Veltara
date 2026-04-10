/**
 * Developer portal main entry — router, nav, global auth state.
 */

import './styles/portal.css';
import { route, initRouter, navigate } from './router.js';
import { landingPage } from './pages/landing.js';
import { dashboardPage, initDashboard } from './pages/dashboard.js';
import { docsPage } from './pages/docs.js';
import { playgroundPage, initPlayground } from './pages/playground.js';
import { portalApi } from './api.js';

// ─── App Shell ────────────────────────────────────────────────────────────────

document.getElementById('app').innerHTML = `
  <!-- Nav (injected into every page) -->
  <nav id="portal-nav"
    class="fixed top-0 left-0 right-0 z-50 flex items-center justify-between px-6 h-14
           bg-gray-950/90 backdrop-blur-md border-b border-gray-900">
    <a href="#/" class="font-bold text-white text-base tracking-wider">
      VELTARA <span class="text-violet-400 text-xs font-normal ml-1">DEV</span>
    </a>
    <div class="flex items-center gap-1 text-sm">
      <a href="#/" class="nav-link px-3 py-1.5 rounded-lg text-gray-400 hover:text-white hover:bg-gray-900 transition-colors">Home</a>
      <a href="#/docs" class="nav-link px-3 py-1.5 rounded-lg text-gray-400 hover:text-white hover:bg-gray-900 transition-colors">Docs</a>
      <a href="#/playground" class="nav-link px-3 py-1.5 rounded-lg text-gray-400 hover:text-white hover:bg-gray-900 transition-colors">Playground</a>
      <a href="#/dashboard" class="nav-link px-3 py-1.5 rounded-lg text-gray-400 hover:text-white hover:bg-gray-900 transition-colors">Dashboard</a>
      <div id="nav-auth" class="ml-2">
        <a href="#/dashboard" id="nav-login-btn"
          class="px-3 py-1.5 text-sm bg-violet-600 text-white rounded-lg hover:bg-violet-500 transition-colors">
          Sign In
        </a>
      </div>
    </div>
  </nav>

  <!-- Page content -->
  <div id="page-root"></div>

  <!-- Modal container -->
  <div id="portal-modal"></div>
`;

// ─── Routes ───────────────────────────────────────────────────────────────────

const pageRoot = document.getElementById('page-root');

route('/', () => landingPage());
route('/dashboard', () => dashboardPage());
route('/docs', () => docsPage());
route('/playground', () => playgroundPage());
route('/404', () => `<div class="min-h-screen flex items-center justify-center text-gray-500">Page not found</div>`);

initRouter(pageRoot);

// ─── Post-route init ──────────────────────────────────────────────────────────

pageRoot.addEventListener('route-changed', (e) => {
  const path = e.detail;

  // Highlight active nav link
  document.querySelectorAll('.nav-link').forEach((a) => {
    const href = a.getAttribute('href').slice(1); // remove #
    a.classList.toggle('text-white', path === href || (path === '/' && href === '/'));
    a.classList.toggle('text-gray-400', path !== href && !(path === '/' && href === '/'));
  });

  // Run page-specific init
  if (path === '/dashboard') initDashboard();
  if (path === '/playground') initPlayground();

  // Scroll to top
  window.scrollTo(0, 0);
});

// ─── Auth state in nav ────────────────────────────────────────────────────────

async function updateNavAuth() {
  const navAuth = document.getElementById('nav-auth');
  if (!navAuth) return;

  if (portalApi.token) {
    try {
      const { user } = await portalApi.me();
      navAuth.innerHTML = `
        <div class="flex items-center gap-2">
          <span class="text-xs text-gray-400">${user.username}</span>
          <button id="nav-logout" class="px-2.5 py-1 text-xs text-gray-500 hover:text-white transition-colors">
            Sign out
          </button>
        </div>
      `;
      document.getElementById('nav-logout').addEventListener('click', async () => {
        await portalApi.logout();
        window.location.hash = '/';
        updateNavAuth();
      });
    } catch {
      portalApi.clearToken();
    }
  }
}

updateNavAuth();
