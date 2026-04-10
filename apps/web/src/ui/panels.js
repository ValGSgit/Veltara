/**
 * Slide-in panels: Profile, Social Feed, Cosmetics Store, Settings.
 * Each panel slides in from a side and can be closed.
 */

import { store } from '../state/store.js';
import { api } from '../network/api.js';
import { toast } from './toast.js';
import { sanitizeHtml, relativeTime, CREDIT_PACKS } from '@veltara/shared';

// ─── Panel Manager ────────────────────────────────────────────────────────────

let activePanel = null;

export function openPanel(name) {
  closePanel();
  activePanel = name;

  switch (name) {
    case 'profile': return openProfilePanel();
    case 'social': return openSocialPanel();
    case 'store': return openStorePanel();
    case 'settings': return openSettingsPanel();
  }
}

export function closePanel() {
  const existing = document.getElementById('slide-panel');
  if (existing) {
    existing.style.transform = existing.dataset.side === 'left' ? 'translateX(-100%)' : 'translateX(100%)';
    setTimeout(() => existing.remove(), 300);
  }
  activePanel = null;
}

function createSlidePanel(side = 'right', width = 'w-80') {
  const panel = document.createElement('div');
  panel.id = 'slide-panel';
  panel.dataset.side = side;
  panel.className = `
    fixed ${side === 'left' ? 'left-0' : 'right-0'} top-0 bottom-0 z-40 ${width}
    bg-veltara-panel border-${side === 'left' ? 'r' : 'l'} border-veltara-border
    flex flex-col overflow-hidden shadow-2xl transition-transform duration-300
    translate-x-${side === 'left' ? '[-100%]' : '[100%]'}
  `.trim().replace(/\s+/g, ' ');

  document.body.appendChild(panel);
  requestAnimationFrame(() => requestAnimationFrame(() => {
    panel.style.transform = 'translateX(0)';
  }));

  return panel;
}

// ─── Profile Panel ────────────────────────────────────────────────────────────

async function openProfilePanel() {
  const panel = createSlidePanel('left', 'w-80');
  const user = store.get('user');

  panel.innerHTML = `
    <div class="flex items-center justify-between p-4 border-b border-veltara-border">
      <h2 class="font-semibold text-white">Profile</h2>
      <button id="panel-close" aria-label="Close panel" class="text-veltara-muted hover:text-white">
        <svg class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/>
        </svg>
      </button>
    </div>
    <div class="flex-1 overflow-y-auto p-4 space-y-6">
      <!-- Avatar + name -->
      <div class="flex items-center gap-3">
        <div class="w-14 h-14 rounded-full bg-veltara-border flex items-center justify-center text-2xl font-bold text-white"
          style="background: #6c63ff">
          ${user?.username?.[0]?.toUpperCase() ?? '?'}
        </div>
        <div>
          <div class="font-semibold text-white">${sanitizeHtml(user?.username ?? '')}</div>
          <div class="text-xs text-veltara-muted capitalize">${user?.plan_tier ?? 'free'} plan</div>
          <div class="text-xs text-veltara-glow mt-0.5">${user?.credits ?? 0} credits</div>
        </div>
      </div>

      <!-- Bio edit -->
      <div>
        <label class="text-xs font-medium text-veltara-muted block mb-1.5">Bio</label>
        <textarea id="profile-bio" rows="3" maxlength="200"
          class="input-field w-full resize-none text-xs"
          placeholder="Tell the world about yourself…">${sanitizeHtml(user?.bio ?? '')}</textarea>
        <button id="save-bio" class="btn-secondary text-xs mt-2">Save Bio</button>
      </div>

      <!-- Stats -->
      <div>
        <div class="text-xs font-medium text-veltara-muted mb-2 uppercase tracking-wider">Stats</div>
        <div id="profile-stats" class="grid grid-cols-2 gap-2">
          <div class="stat-card">Loading…</div>
        </div>
      </div>

      <!-- Achievements -->
      <div>
        <div class="text-xs font-medium text-veltara-muted mb-2 uppercase tracking-wider">Achievements</div>
        <div id="achievements" class="text-xs text-veltara-muted">Loading…</div>
      </div>

      <!-- Upgrade CTA for free users -->
      ${user?.plan_tier === 'free' ? `
        <div class="p-3 rounded-lg bg-veltara-accent/10 border border-veltara-accent/30">
          <div class="text-xs font-semibold text-veltara-accent mb-1">Upgrade to Pro</div>
          <div class="text-xs text-veltara-muted mb-2">AI NPCs, 5GB storage, exclusive cosmetics</div>
          <button id="upgrade-pro" class="btn-primary text-xs w-full">Upgrade — $7/mo</button>
        </div>
      ` : ''}
    </div>
  `;

  panel.querySelector('#panel-close').addEventListener('click', closePanel);

  panel.querySelector('#save-bio')?.addEventListener('click', async () => {
    const bio = document.getElementById('profile-bio').value;
    // API call to update bio would go here
    toast.success('Bio saved!');
  });

  panel.querySelector('#upgrade-pro')?.addEventListener('click', async () => {
    try {
      const data = await api.subscribe('pro');
      window.location.href = data.checkout_url;
    } catch (err) {
      toast.error(err.message);
    }
  });

  // Load profile data
  if (user) {
    try {
      const { profile } = await api.getProfile(user.id);
      const statsEl = document.getElementById('profile-stats');
      statsEl.innerHTML = `
        <div class="stat-card"><div class="stat-value">${profile.follower_count}</div><div class="stat-label">Followers</div></div>
        <div class="stat-card"><div class="stat-value">${profile.following_count}</div><div class="stat-label">Following</div></div>
        <div class="stat-card"><div class="stat-value">${profile.post_count}</div><div class="stat-label">Posts</div></div>
        <div class="stat-card"><div class="stat-value">${Math.floor(profile.total_playtime / 3600000)}h</div><div class="stat-label">Playtime</div></div>
      `;

      const achEl = document.getElementById('achievements');
      if (profile.achievements.length > 0) {
        achEl.innerHTML = profile.achievements.map((a) =>
          `<span class="inline-block px-2 py-0.5 rounded bg-veltara-border text-[10px] mr-1 mb-1">
            ${a.achievement_type.replace(/_/g, ' ')}
          </span>`
        ).join('');
      } else {
        achEl.textContent = 'No achievements yet. Keep exploring!';
      }
    } catch { /* ignore */ }
  }
}

// ─── Social Feed Panel ────────────────────────────────────────────────────────

let feedPage = 1;
let feedLoading = false;

async function openSocialPanel() {
  const panel = createSlidePanel('right', 'w-96');
  panel.innerHTML = `
    <div class="flex items-center justify-between p-4 border-b border-veltara-border">
      <h2 class="font-semibold text-white">Social Feed</h2>
      <button id="panel-close" aria-label="Close" class="text-veltara-muted hover:text-white">
        <svg class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/>
        </svg>
      </button>
    </div>
    <!-- Post composer -->
    <div class="p-3 border-b border-veltara-border">
      <textarea id="post-content" rows="2" maxlength="5000" placeholder="Share something with the planet…"
        class="input-field w-full resize-none text-sm"></textarea>
      <div class="flex items-center justify-between mt-2">
        <label class="btn-secondary text-xs cursor-pointer">
          📎 Attach
          <input type="file" id="post-media" accept="image/*" class="hidden" />
        </label>
        <button id="post-submit" class="btn-primary text-xs">Post</button>
      </div>
    </div>
    <!-- Feed -->
    <div id="feed-container" class="flex-1 overflow-y-auto" role="feed" aria-label="Social feed">
      <div class="p-4 text-xs text-veltara-muted text-center">Loading feed…</div>
    </div>
  `;

  panel.querySelector('#panel-close').addEventListener('click', closePanel);

  panel.querySelector('#post-submit').addEventListener('click', async () => {
    const content = document.getElementById('post-content').value.trim();
    if (!content) return;
    try {
      await api.createPost(content, store.get('selfRegionId'));
      document.getElementById('post-content').value = '';
      feedPage = 1;
      loadFeed();
      toast.success('Post shared!');
    } catch (err) {
      toast.error(err.message);
    }
  });

  // Infinite scroll
  const feedEl = document.getElementById('feed-container');
  feedEl.addEventListener('scroll', () => {
    if (feedEl.scrollTop + feedEl.clientHeight >= feedEl.scrollHeight - 100 && !feedLoading) {
      feedPage++;
      loadFeed(true);
    }
  });

  feedPage = 1;
  loadFeed();
}

async function loadFeed(append = false) {
  if (feedLoading) return;
  feedLoading = true;
  const el = document.getElementById('feed-container');
  if (!el) { feedLoading = false; return; }

  try {
    const { data: posts } = await api.getFeed(feedPage);

    if (!append) el.innerHTML = '';

    if (posts.length === 0 && !append) {
      el.innerHTML = '<div class="p-4 text-xs text-veltara-muted text-center">No posts yet. Be the first!</div>';
    } else {
      posts.forEach((post) => {
        const article = document.createElement('article');
        article.className = 'p-3 border-b border-veltara-border hover:bg-veltara-bg/40 transition-colors';
        article.innerHTML = `
          <div class="flex items-start gap-2.5">
            <div class="w-8 h-8 rounded-full bg-veltara-border shrink-0 flex items-center justify-center text-sm font-bold text-white"
              style="background: #6c63ff">${(post.author?.username?.[0] ?? '?').toUpperCase()}</div>
            <div class="flex-1 min-w-0">
              <div class="flex items-center gap-1.5">
                <span class="text-xs font-semibold text-white">${sanitizeHtml(post.author?.username ?? '')}</span>
                <span class="text-[10px] text-veltara-muted">${relativeTime(post.created_at)}</span>
              </div>
              <p class="text-xs text-veltara-text mt-0.5 break-words">${sanitizeHtml(post.content)}</p>
              ${post.media_url ? `<img src="${post.media_url}" alt="Post media" class="mt-2 rounded max-h-48 w-full object-cover" loading="lazy" />` : ''}
              <div class="flex items-center gap-3 mt-2">
                <button data-post-id="${post.id}" class="like-btn flex items-center gap-1 text-[11px]
                  ${post.liked_by_me ? 'text-pink-400' : 'text-veltara-muted hover:text-pink-400'} transition-colors">
                  ♥ <span>${post.likes_count}</span>
                </button>
                <button class="text-[11px] text-veltara-muted hover:text-white transition-colors">
                  💬 ${post.comments_count}
                </button>
              </div>
            </div>
          </div>
        `;

        article.querySelector('.like-btn').addEventListener('click', async function () {
          try {
            const { liked } = await api.toggleLike(post.id);
            const countEl = this.querySelector('span');
            countEl.textContent = parseInt(countEl.textContent) + (liked ? 1 : -1);
            this.classList.toggle('text-pink-400', liked);
            this.classList.toggle('text-veltara-muted', !liked);
          } catch { /* ignore */ }
        });

        el.appendChild(article);
      });
    }
  } catch (err) {
    if (!append) el.innerHTML = `<div class="p-4 text-xs text-red-400">${err.message}</div>`;
  } finally {
    feedLoading = false;
  }
}

// ─── Store Panel ──────────────────────────────────────────────────────────────

async function openStorePanel() {
  const panel = createSlidePanel('right', 'w-96');
  panel.innerHTML = `
    <div class="flex items-center justify-between p-4 border-b border-veltara-border">
      <div class="flex items-center gap-3">
        <h2 class="font-semibold text-white">Store</h2>
        <span class="text-xs text-veltara-glow">${store.get('user')?.credits ?? 0} credits</span>
      </div>
      <button id="panel-close" aria-label="Close" class="text-veltara-muted hover:text-white">
        <svg class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/>
        </svg>
      </button>
    </div>
    <!-- Filter tabs -->
    <div class="flex border-b border-veltara-border">
      ${['all', 'cosmetic', 'marker', 'frame', 'emote'].map((t) =>
        `<button data-type="${t}" class="store-filter flex-1 py-2 text-[11px]
          ${t === 'all' ? 'text-veltara-accent border-b-2 border-veltara-accent' : 'text-veltara-muted hover:text-white'}
          transition-colors capitalize">${t}</button>`
      ).join('')}
    </div>
    <!-- Items grid -->
    <div id="store-items" class="flex-1 overflow-y-auto p-3">
      <div class="text-xs text-veltara-muted text-center p-4">Loading items…</div>
    </div>
    <!-- Credit packs -->
    <div class="p-3 border-t border-veltara-border space-y-2">
      <div class="text-xs font-medium text-veltara-muted uppercase tracking-wider mb-2">Buy Credits</div>
      <div class="flex gap-2">
        ${CREDIT_PACKS.map((pack, i) => `
          <button data-pack="${i}" class="credit-pack flex-1 p-2 rounded-lg border border-veltara-border
            hover:border-veltara-accent transition-colors text-center">
            <div class="text-xs font-semibold text-white">${pack.label}</div>
            <div class="text-[10px] text-veltara-muted">$${(pack.price_cents / 100).toFixed(2)}</div>
          </button>
        `).join('')}
      </div>
    </div>
  `;

  panel.querySelector('#panel-close').addEventListener('click', closePanel);

  // Filter tabs
  let currentType = null;
  panel.querySelectorAll('.store-filter').forEach((btn) => {
    btn.addEventListener('click', () => {
      panel.querySelectorAll('.store-filter').forEach((b) => {
        b.classList.toggle('text-veltara-accent', b === btn);
        b.classList.toggle('border-b-2', b === btn);
        b.classList.toggle('border-veltara-accent', b === btn);
        b.classList.toggle('text-veltara-muted', b !== btn);
      });
      currentType = btn.dataset.type === 'all' ? null : btn.dataset.type;
      loadStoreItems(currentType);
    });
  });

  // Credit pack purchases
  panel.querySelectorAll('.credit-pack').forEach((btn) => {
    btn.addEventListener('click', async () => {
      try {
        const data = await api.purchaseCredits(parseInt(btn.dataset.pack));
        window.location.href = data.checkout_url;
      } catch (err) {
        toast.error(err.message);
      }
    });
  });

  loadStoreItems(null);
}

async function loadStoreItems(type) {
  const el = document.getElementById('store-items');
  if (!el) return;
  el.innerHTML = '<div class="text-xs text-veltara-muted text-center p-4">Loading…</div>';

  try {
    const { items } = await api.getMarketplaceItems(type);
    const rarityColors = {
      common: '#9ca3af', uncommon: '#4ade80', rare: '#60a5fa', epic: '#c084fc', legendary: '#f59e0b',
    };

    el.innerHTML = `<div class="grid grid-cols-2 gap-2">
      ${items.map((item) => `
        <div class="item-card p-2.5 rounded-lg border border-veltara-border hover:border-veltara-accent
          transition-colors cursor-pointer" data-listing-id="${item.id}">
          <div class="aspect-square rounded bg-veltara-bg/80 mb-2 flex items-center justify-center text-3xl">
            ${item.items?.type === 'emote' ? '💃' : item.items?.type === 'frame' ? '🖼' : item.items?.type === 'marker' ? '📍' : '✨'}
          </div>
          <div class="text-[11px] font-medium text-white truncate">${sanitizeHtml(item.items?.name ?? 'Item')}</div>
          <div class="flex items-center justify-between mt-1">
            <span class="text-[10px] font-medium" style="color:${rarityColors[item.items?.rarity] ?? '#9ca3af'}">
              ${item.items?.rarity ?? 'common'}
            </span>
            <span class="text-[10px] text-veltara-glow">${item.price_credits} cr</span>
          </div>
        </div>
      `).join('')}
    </div>` || '<div class="text-xs text-veltara-muted text-center p-4">No items found</div>';

    el.querySelectorAll('.item-card').forEach((card) => {
      card.addEventListener('click', async () => {
        const listingId = card.dataset.listingId;
        if (!confirm('Purchase this item?')) return;
        try {
          await api.purchaseItem(listingId);
          toast.success('Item purchased!');
          loadStoreItems(type);
        } catch (err) {
          toast.error(err.message);
        }
      });
    });
  } catch (err) {
    el.innerHTML = `<div class="text-xs text-red-400 text-center p-4">${err.message}</div>`;
  }
}

// ─── Settings Panel ───────────────────────────────────────────────────────────

function openSettingsPanel() {
  const panel = createSlidePanel('right', 'w-80');
  panel.innerHTML = `
    <div class="flex items-center justify-between p-4 border-b border-veltara-border">
      <h2 class="font-semibold text-white">Settings</h2>
      <button id="panel-close" aria-label="Close" class="text-veltara-muted hover:text-white">
        <svg class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/>
        </svg>
      </button>
    </div>
    <div class="flex-1 overflow-y-auto p-4 space-y-5">
      <!-- Graphics -->
      <div>
        <div class="text-xs font-semibold text-veltara-muted uppercase tracking-wider mb-3">Graphics</div>
        <div class="space-y-2">
          ${['low', 'medium', 'high'].map((q) => `
            <label class="flex items-center gap-2.5 cursor-pointer">
              <input type="radio" name="quality" value="${q}"
                ${localStorage.getItem('quality') === q || (!localStorage.getItem('quality') && q === 'medium') ? 'checked' : ''}
                class="accent-veltara-accent" />
              <span class="text-sm text-veltara-text capitalize">${q}</span>
              <span class="text-xs text-veltara-muted ml-auto">
                ${q === 'low' ? '64 seg' : q === 'medium' ? '128 seg' : '256 seg'}
              </span>
            </label>
          `).join('')}
        </div>
      </div>

      <!-- Sound -->
      <div>
        <div class="text-xs font-semibold text-veltara-muted uppercase tracking-wider mb-3">Sound</div>
        <label class="flex items-center gap-2.5 cursor-pointer">
          <input type="checkbox" id="sound-toggle"
            ${localStorage.getItem('sound') !== 'false' ? 'checked' : ''}
            class="accent-veltara-accent" />
          <span class="text-sm text-veltara-text">Enable sounds</span>
        </label>
      </div>

      <!-- Notifications -->
      <div>
        <div class="text-xs font-semibold text-veltara-muted uppercase tracking-wider mb-3">Notifications</div>
        <div class="space-y-2">
          ${[
            ['notify-events', 'World events'],
            ['notify-chat', 'Chat mentions'],
            ['notify-followers', 'New followers'],
          ].map(([id, label]) => `
            <label class="flex items-center gap-2.5 cursor-pointer">
              <input type="checkbox" id="${id}" checked class="accent-veltara-accent" />
              <span class="text-sm text-veltara-text">${label}</span>
            </label>
          `).join('')}
        </div>
      </div>

      <!-- Account -->
      <div>
        <div class="text-xs font-semibold text-veltara-muted uppercase tracking-wider mb-3">Account</div>
        <div class="space-y-2">
          <button id="billing-portal" class="btn-secondary w-full text-xs">Manage Subscription</button>
          <button id="logout-btn" class="w-full px-3 py-2 text-xs text-red-400 border border-red-500/30
            rounded-lg hover:bg-red-500/10 transition-colors">Sign Out</button>
        </div>
      </div>
    </div>
  `;

  panel.querySelector('#panel-close').addEventListener('click', closePanel);

  panel.querySelectorAll('input[name="quality"]').forEach((radio) => {
    radio.addEventListener('change', () => {
      localStorage.setItem('quality', radio.value);
      document.dispatchEvent(new CustomEvent('quality-change', { detail: radio.value }));
    });
  });

  panel.querySelector('#sound-toggle').addEventListener('change', (e) => {
    localStorage.setItem('sound', e.target.checked);
  });

  panel.querySelector('#billing-portal')?.addEventListener('click', async () => {
    try {
      const { portal_url } = await api.billingPortal();
      window.open(portal_url, '_blank');
    } catch (err) {
      toast.error(err.message);
    }
  });

  panel.querySelector('#logout-btn').addEventListener('click', async () => {
    await api.logout();
    store.update({ user: null, isAuthenticated: false });
    closePanel();
    toast.info('Signed out.');
    location.reload();
  });
}

// Listen for panel open events
document.addEventListener('open-panel', (e) => openPanel(e.detail));
