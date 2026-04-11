/**
 * Minimal hash-based SPA router for the developer portal.
 */

const routes = new Map();
let currentRoute = null;

export function route(path, component) {
  routes.set(path, component);
}

export function navigate(path) {
  window.location.hash = path;
}

export function initRouter(app) {
  function render() {
    const rawHash = window.location.hash.slice(1) || '/';
    const [path, query = ''] = rawHash.split('?');
    const handler = routes.get(path) ?? routes.get('/404') ?? (() => '<p>Not found</p>');
    currentRoute = path;
    app.innerHTML = handler();
    app.dispatchEvent(new CustomEvent('route-changed', {
      detail: {
        path,
        query: new URLSearchParams(query),
      },
      bubbles: true,
    }));
  }

  window.addEventListener('hashchange', render);
  render();

  return { navigate, currentRoute: () => currentRoute };
}
