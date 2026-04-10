/**
 * API client for the developer portal.
 * Reuses the same auth and developer API endpoints.
 */

const BASE = import.meta.env.VITE_API_BASE_URL ?? 'https://veltara.gg';

class PortalApi {
  token = localStorage.getItem('portal_token');

  setToken(t) { this.token = t; localStorage.setItem('portal_token', t); }
  clearToken() { this.token = null; localStorage.removeItem('portal_token'); }

  async req(method, path, body) {
    const headers = { 'Content-Type': 'application/json' };
    if (this.token) headers['Authorization'] = `Bearer ${this.token}`;
    const res = await fetch(`${BASE}${path}`, {
      method, headers, body: body ? JSON.stringify(body) : undefined,
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw Object.assign(new Error(data?.error?.message ?? `HTTP ${res.status}`), { status: res.status });
    return data;
  }

  get(p) { return this.req('GET', p); }
  post(p, b) { return this.req('POST', p, b); }
  delete(p) { return this.req('DELETE', p); }

  async login(email, password) {
    const d = await this.post('/api/auth/login', { email, password });
    this.setToken(d.access_token);
    return d;
  }

  async register(username, email, password) {
    const d = await this.post('/api/auth/register', { username, email, password });
    this.setToken(d.access_token);
    return d;
  }

  async me() { return this.get('/api/auth/me'); }
  async logout() { await this.post('/api/auth/logout', {}); this.clearToken(); }

  async createKey(name) { return this.post('/api/developer/keys', { name }); }
  async listKeys() { return this.get('/api/developer/keys'); }
  async revokeKey(id) { return this.delete(`/api/developer/keys/${id}`); }
  async getUsage() { return this.get('/api/developer/usage'); }

  async getRegions(apiKey) {
    const res = await fetch(`${BASE}/v1/regions`, {
      headers: { Authorization: `Bearer ${apiKey}` },
    });
    return res.json();
  }
  async getWorldState(apiKey) {
    const res = await fetch(`${BASE}/v1/world-state`, {
      headers: { Authorization: `Bearer ${apiKey}` },
    });
    return res.json();
  }
  async getOnlineCount(apiKey) {
    const res = await fetch(`${BASE}/v1/players/online`, {
      headers: { Authorization: `Bearer ${apiKey}` },
    });
    return res.json();
  }
}

export const portalApi = new PortalApi();
