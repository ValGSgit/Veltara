/**
 * API client — wrapper around fetch for all Veltara API calls.
 * Handles auth tokens, error formatting, and base URL.
 */

const envApiBase = String(import.meta.env.VITE_API_BASE_URL ?? '').trim();
const isLocalHost = typeof window !== 'undefined' && ['localhost', '127.0.0.1'].includes(window.location.hostname);
// Prefer same-origin /api proxy in local dev when VITE_API_BASE_URL is not set.
const BASE_URL = envApiBase || '';

class ApiClient {
  token = null;

  setToken(token) {
    this.token = token;
  }

  clearToken() {
    this.token = null;
  }

  async _fetch(method, path, body, token) {
    const headers = { 'Content-Type': 'application/json' };
    if (token) headers['Authorization'] = `Bearer ${token}`;
    try {
      return await fetch(`${BASE_URL}${path}`, {
        method,
        headers,
        body: body ? JSON.stringify(body) : undefined,
      });
    } catch (networkErr) {
      const hint = isLocalHost
        ? 'Unable to reach Veltara API. Ensure `pnpm dev` (or docker compose) is running and Vite proxy can reach Workers on :8787.'
        : 'Unable to reach Veltara API. Check backend/proxy and VITE_API_BASE_URL.';
      const err = new Error(hint);
      err.code = 'NETWORK_ERROR';
      err.cause = networkErr;
      throw err;
    }
  }

  async _request(method, path, body = null) {
    let res = await this._fetch(method, path, body, this.token);

    // On 401 during an active session, try refreshing the token once then retry.
    if (res.status === 401 && localStorage.getItem('refresh_token')) {
      try {
        await this.refreshToken();
        res = await this._fetch(method, path, body, this.token);
      } catch {
        // Refresh failed — fall through to throw the original 401 below
      }
    }

    const data = await res.json().catch(() => ({}));

    if (!res.ok) {
      const err = new Error(data?.error?.message ?? `HTTP ${res.status}`);
      err.code = data?.error?.code ?? 'UNKNOWN';
      err.status = res.status;
      throw err;
    }

    return data;
  }

  get(path) { return this._request('GET', path); }
  post(path, body) { return this._request('POST', path, body); }
  put(path, body) { return this._request('PUT', path, body); }
  delete(path) { return this._request('DELETE', path); }

  // ─── Auth ──────────────────────────────────────────────────────────────────

  async register(username, email, password) {
    const data = await this.post('/api/auth/register', { username, email, password });
    this.setToken(data.access_token);
    localStorage.setItem('refresh_token', data.refresh_token);
    localStorage.setItem('access_token', data.access_token);
    return data;
  }

  async login(email, password) {
    const data = await this.post('/api/auth/login', { email, password });
    this.setToken(data.access_token);
    localStorage.setItem('refresh_token', data.refresh_token);
    localStorage.setItem('access_token', data.access_token);
    return data;
  }

  async logout() {
    const refreshToken = localStorage.getItem('refresh_token');
    await this.post('/api/auth/logout', { refresh_token: refreshToken }).catch(() => {});
    this.clearToken();
    localStorage.removeItem('refresh_token');
    localStorage.removeItem('access_token');
  }

  async refreshToken() {
    const refreshToken = localStorage.getItem('refresh_token');
    if (!refreshToken) throw new Error('No refresh token');
    const data = await this.post('/api/auth/refresh', { refresh_token: refreshToken });
    this.setToken(data.access_token);
    localStorage.setItem('access_token', data.access_token);
    if (data.refresh_token) localStorage.setItem('refresh_token', data.refresh_token);
    return data;
  }

  async me() { return this.get('/api/auth/me'); }

  // ─── Regions + World ──────────────────────────────────────────────────────

  async getRegions() { return this.get('/api/regions'); }
  async getWorldState() { return this.get('/api/world-state'); }
  async joinPlanet(lat, lon, regionId) {
    return this.post('/api/players/join', { lat, lon, region_id: regionId });
  }

  // ─── Social ───────────────────────────────────────────────────────────────

  async getFeed(page = 1) { return this.get(`/api/feed?page=${page}`); }
  async createPost(content, regionId, mediaBase64, mediaType) {
    return this.post('/api/posts', { content, region_id: regionId, media_base64: mediaBase64, media_type: mediaType });
  }
  async toggleLike(postId) { return this.post(`/api/posts/${postId}/like`); }
  async getComments(postId, page = 1) { return this.get(`/api/posts/${postId}/comments?page=${page}`); }
  async addComment(postId, content) { return this.post(`/api/posts/${postId}/comments`, { content }); }
  async toggleFollow(userId) { return this.post(`/api/users/${userId}/follow`); }
  async getProfile(userId) { return this.get(`/api/users/${userId}/profile`); }
  async getLeaderboard(region, period) {
    const params = new URLSearchParams();
    if (region) params.set('region', region);
    if (period) params.set('period', period);
    return this.get(`/api/leaderboard?${params}`);
  }

  // ─── Billing ──────────────────────────────────────────────────────────────

  async subscribe(plan) {
    return this.post('/api/billing/subscribe', {
      plan,
      success_url: `${window.location.origin}?subscribed=1`,
      cancel_url: window.location.href,
    });
  }
  async billingPortal() {
    return this.post('/api/billing/portal', { return_url: window.location.href });
  }
  async billingStatus() { return this.get('/api/billing/status'); }

  // ─── Store ────────────────────────────────────────────────────────────────

  async getMarketplaceItems(type, page) {
    const params = new URLSearchParams();
    if (type) params.set('type', type);
    if (page) params.set('page', page);
    return this.get(`/api/marketplace/items?${params}`);
  }
  async purchaseItem(listingId) { return this.post('/api/marketplace/purchase', { listing_id: listingId }); }
  async purchaseCredits(packIndex) {
    return this.post('/api/credits/purchase', {
      pack_index: packIndex,
      success_url: `${window.location.origin}?credits=1`,
      cancel_url: window.location.href,
    });
  }

  // ─── Developer API ────────────────────────────────────────────────────────

  async createApiKey(name) { return this.post('/api/developer/keys', { name }); }
  async listApiKeys() { return this.get('/api/developer/keys'); }
  async revokeApiKey(id) { return this.delete(`/api/developer/keys/${id}`); }
  async getApiUsage() { return this.get('/api/developer/usage'); }

  // ─── Restore session from localStorage ───────────────────────────────────

  async restoreSession() {
    const token = localStorage.getItem('access_token');
    if (!token) return null;
    this.setToken(token);
    try {
      const data = await this.me();
      return data.user;
    } catch (err) {
      if (err.status === 401) {
        try {
          await this.refreshToken();
          const data = await this.me();
          return data.user;
        } catch {
          this.clearToken();
          return null;
        }
      }
      return null;
    }
  }
}

export const api = new ApiClient();
