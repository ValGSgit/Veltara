import { computed, onMounted, ref } from 'vue';
import { CREDIT_PACKS, sanitizeHtml } from '@veltara/shared';
import { store } from '../../state/store.js';
import { api } from '../../network/api.js';
import { toast } from '../../ui/toast.js';
import { relativeTime } from '../utils/formatters.js';

const ITEM_ICONS = {
  emote: '💃',
  frame: '🖼',
  marker: '📍',
  cosmetic: '✨',
};

export const PanelDrawerView = {
  name: 'PanelDrawerView',
  props: {
    panel: { type: String, required: true },
  },
  setup(props, { emit }) {
    const side = computed(() => (props.panel === 'profile' ? 'left' : 'right'));
    const user = computed(() => store.get('user'));

    const profile = ref(null);
    const bio = ref('');

    const feed = ref([]);
    const feedPage = ref(1);
    const loadingFeed = ref(false);
    const postContent = ref('');

    const storeType = ref('all');
    const storeItems = ref([]);
    const loadingStore = ref(false);

    const quality = ref(localStorage.getItem('quality') ?? 'medium');
    const sound = ref(localStorage.getItem('sound') !== 'false');
    const sandboxBuildMode = ref(store.get('sandboxBuildMode') === true);

    async function loadProfile() {
      if (!user.value) return;
      try {
        const { profile: data } = await api.getProfile(user.value.id);
        profile.value = data;
        bio.value = data?.bio ?? user.value?.bio ?? '';
      } catch {
        profile.value = null;
      }
    }

    async function saveBio() {
      toast.success('Bio saved!');
    }

    async function upgradePro() {
      try {
        const data = await api.subscribe('pro');
        window.location.href = data.checkout_url;
      } catch (err) {
        toast.error(err.message);
      }
    }

    async function loadFeed(append = false) {
      if (loadingFeed.value) return;
      loadingFeed.value = true;

      try {
        const { data: posts } = await api.getFeed(feedPage.value);
        feed.value = append ? [...feed.value, ...posts] : posts;
      } catch (err) {
        if (!append) toast.error(err.message);
      } finally {
        loadingFeed.value = false;
      }
    }

    async function submitPost() {
      const content = postContent.value.trim();
      if (!content) return;
      try {
        await api.createPost(content, store.get('selfRegionId'));
        postContent.value = '';
        feedPage.value = 1;
        await loadFeed();
        toast.success('Post shared!');
      } catch (err) {
        toast.error(err.message);
      }
    }

    async function likePost(post) {
      try {
        const { liked } = await api.toggleLike(post.id);
        post.likes_count += liked ? 1 : -1;
        post.liked_by_me = liked;
      } catch {
        // ignore
      }
    }

    async function loadStoreItems() {
      loadingStore.value = true;
      try {
        const selectedType = storeType.value === 'all' ? null : storeType.value;
        const { items } = await api.getMarketplaceItems(selectedType);
        storeItems.value = items;
      } catch (err) {
        toast.error(err.message);
      } finally {
        loadingStore.value = false;
      }
    }

    async function purchaseItem(listingId) {
      if (!window.confirm('Purchase this item?')) return;
      try {
        await api.purchaseItem(listingId);
        toast.success('Item purchased!');
        await loadStoreItems();
      } catch (err) {
        toast.error(err.message);
      }
    }

    async function purchaseCreditPack(index) {
      try {
        const data = await api.purchaseCredits(index);
        window.location.href = data.checkout_url;
      } catch (err) {
        toast.error(err.message);
      }
    }

    async function billingPortal() {
      try {
        const { portal_url } = await api.billingPortal();
        window.open(portal_url, '_blank');
      } catch (err) {
        toast.error(err.message);
      }
    }

    async function logout() {
      await api.logout();
      store.update({ user: null, isAuthenticated: false });
      emit('close');
      toast.info('Signed out.');
      location.reload();
    }

    function updateQuality(value) {
      quality.value = value;
      localStorage.setItem('quality', value);
      document.dispatchEvent(new CustomEvent('quality-change', { detail: value }));
    }

    function updateSound() {
      localStorage.setItem('sound', String(sound.value));
    }

    function updateSandboxBuildMode() {
      store.set('sandboxBuildMode', sandboxBuildMode.value);
      document.dispatchEvent(new CustomEvent('sandbox-build-mode', { detail: { enabled: sandboxBuildMode.value } }));
    }

    function close() {
      emit('close');
    }

    function nextPage() {
      if (loadingFeed.value) return;
      feedPage.value += 1;
      loadFeed(true);
    }

    const profileStats = computed(() => {
      if (!profile.value) return null;
      return {
        followers: profile.value.follower_count ?? 0,
        following: profile.value.following_count ?? 0,
        posts: profile.value.post_count ?? 0,
        playtimeHours: Math.floor((profile.value.total_playtime ?? 0) / 3600000),
      };
    });

    onMounted(async () => {
      if (props.panel === 'profile') await loadProfile();
      if (props.panel === 'social') await loadFeed();
      if (props.panel === 'store') await loadStoreItems();
    });

    return {
      side,
      user,
      profile,
      profileStats,
      bio,
      feed,
      feedPage,
      loadingFeed,
      postContent,
      storeType,
      storeItems,
      loadingStore,
      quality,
      sound,
      sandboxBuildMode,
      close,
      saveBio,
      upgradePro,
      submitPost,
      likePost,
      loadStoreItems,
      purchaseItem,
      purchaseCreditPack,
      billingPortal,
      logout,
      updateQuality,
      updateSound,
      updateSandboxBuildMode,
      nextPage,
      sanitizeHtml,
      relativeTime,
      CREDIT_PACKS,
      ITEM_ICONS,
    };
  },
  template: `
    <Teleport to="body">
      <div class="fixed inset-y-0 z-40 w-96 overflow-hidden border-veltara-border bg-veltara-panel shadow-2xl transition-transform duration-300"
        :class="side === 'left' ? 'left-0 border-r' : 'right-0 border-l'">

        <div class="flex items-center justify-between border-b border-veltara-border p-4">
          <h2 class="font-semibold text-white capitalize">{{ panel }}</h2>
          <button class="text-veltara-muted hover:text-white" aria-label="Close" @click="close">
            <svg class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/>
            </svg>
          </button>
        </div>

        <div v-if="panel === 'profile'" class="flex h-[calc(100%-65px)] flex-col overflow-y-auto p-4">
          <div class="flex items-center gap-3">
            <div class="flex h-14 w-14 items-center justify-center rounded-full bg-veltara-border text-2xl font-bold text-white" :style="{ background: '#6c63ff' }">
              {{ (user?.username?.[0] ?? '?').toUpperCase() }}
            </div>
            <div>
              <div class="font-semibold text-white">{{ user?.username ?? '' }}</div>
              <div class="mt-0.5 text-xs capitalize text-veltara-muted">{{ user?.plan_tier ?? 'free' }} plan</div>
              <div class="mt-0.5 text-xs text-veltara-glow">{{ user?.credits ?? 0 }} credits</div>
            </div>
          </div>

          <div class="mt-6">
            <label class="mb-1.5 block text-xs font-medium text-veltara-muted">Bio</label>
            <textarea v-model="bio" rows="3" maxlength="200" class="input-field w-full resize-none text-xs" placeholder="Tell the world about yourself…"></textarea>
            <button class="btn-secondary mt-2 text-xs" @click="saveBio">Save Bio</button>
          </div>

          <div class="mt-6">
            <div class="mb-2 text-xs font-medium uppercase tracking-wider text-veltara-muted">Stats</div>
            <div v-if="!profileStats" class="text-xs text-veltara-muted">Loading…</div>
            <div v-else class="grid grid-cols-2 gap-2">
              <div class="stat-card"><div class="stat-value">{{ profileStats.followers }}</div><div class="stat-label">Followers</div></div>
              <div class="stat-card"><div class="stat-value">{{ profileStats.following }}</div><div class="stat-label">Following</div></div>
              <div class="stat-card"><div class="stat-value">{{ profileStats.posts }}</div><div class="stat-label">Posts</div></div>
              <div class="stat-card"><div class="stat-value">{{ profileStats.playtimeHours }}h</div><div class="stat-label">Playtime</div></div>
            </div>
          </div>

          <div class="mt-6">
            <div class="mb-2 text-xs font-medium uppercase tracking-wider text-veltara-muted">Achievements</div>
            <div v-if="!profile || !(profile.achievements?.length)" class="text-xs text-veltara-muted">No achievements yet. Keep exploring!</div>
            <div v-else>
              <span v-for="a in profile.achievements" :key="a.id ?? a.achievement_type" class="mb-1 mr-1 inline-block rounded bg-veltara-border px-2 py-0.5 text-[10px]">
                {{ a.achievement_type.replace(/_/g, ' ') }}
              </span>
            </div>
          </div>

          <div v-if="user?.plan_tier === 'free'" class="mt-6 rounded-lg border border-veltara-accent/30 bg-veltara-accent/10 p-3">
            <div class="mb-1 text-xs font-semibold text-veltara-accent">Upgrade to Pro</div>
            <div class="mb-2 text-xs text-veltara-muted">AI NPCs, 5GB storage, exclusive cosmetics</div>
            <button class="btn-primary w-full text-xs" @click="upgradePro">Upgrade — $7/mo</button>
          </div>
        </div>

        <div v-else-if="panel === 'social'" class="flex h-[calc(100%-65px)] flex-col overflow-hidden">
          <div class="border-b border-veltara-border p-3">
            <textarea v-model="postContent" rows="2" maxlength="5000" placeholder="Share something with the planet…" class="input-field w-full resize-none text-sm"></textarea>
            <div class="mt-2 flex items-center justify-end">
              <button class="btn-primary text-xs" @click="submitPost">Post</button>
            </div>
          </div>

          <div class="flex-1 overflow-y-auto">
            <div v-if="!feed.length && !loadingFeed" class="p-4 text-center text-xs text-veltara-muted">No posts yet. Be the first!</div>
            <article v-for="post in feed" :key="post.id" class="border-b border-veltara-border p-3 transition-colors hover:bg-veltara-bg/40">
              <div class="flex items-start gap-2.5">
                <div class="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-veltara-border text-sm font-bold text-white" :style="{ background: '#6c63ff' }">
                  {{ (post.author?.username?.[0] ?? '?').toUpperCase() }}
                </div>
                <div class="min-w-0 flex-1">
                  <div class="flex items-center gap-1.5">
                    <span class="text-xs font-semibold text-white">{{ sanitizeHtml(post.author?.username ?? '') }}</span>
                    <span class="text-[10px] text-veltara-muted">{{ relativeTime(post.created_at) }}</span>
                  </div>
                  <p class="mt-0.5 break-words text-xs text-veltara-text">{{ sanitizeHtml(post.content) }}</p>
                  <img v-if="post.media_url" :src="post.media_url" alt="Post media" class="mt-2 max-h-48 w-full rounded object-cover" loading="lazy" />
                  <div class="mt-2 flex items-center gap-3">
                    <button class="flex items-center gap-1 text-[11px] transition-colors"
                      :class="post.liked_by_me ? 'text-pink-400' : 'text-veltara-muted hover:text-pink-400'"
                      @click="likePost(post)">
                      ♥ <span>{{ post.likes_count }}</span>
                    </button>
                    <button class="text-[11px] text-veltara-muted">💬 {{ post.comments_count }}</button>
                  </div>
                </div>
              </div>
            </article>
            <div class="p-3">
              <button class="btn-secondary w-full text-xs" :disabled="loadingFeed" @click="nextPage">
                {{ loadingFeed ? 'Loading…' : 'Load more' }}
              </button>
            </div>
          </div>
        </div>

        <div v-else-if="panel === 'store'" class="flex h-[calc(100%-65px)] flex-col overflow-hidden">
          <div class="flex items-center gap-3 border-b border-veltara-border p-3">
            <span class="text-xs text-veltara-glow">{{ user?.credits ?? 0 }} credits</span>
            <div class="ml-auto flex gap-1">
              <button v-for="type in ['all','cosmetic','marker','frame','emote']" :key="type" class="store-filter px-2 py-1 text-[11px] capitalize" :class="storeType === type ? 'text-veltara-accent border-b-2 border-veltara-accent' : 'text-veltara-muted'" @click="storeType = type; loadStoreItems()">{{ type }}</button>
            </div>
          </div>

          <div class="flex-1 overflow-y-auto p-3">
            <div v-if="loadingStore" class="p-4 text-center text-xs text-veltara-muted">Loading…</div>
            <div v-else-if="!storeItems.length" class="p-4 text-center text-xs text-veltara-muted">No items found.</div>
            <div v-else class="grid grid-cols-2 gap-2">
              <button v-for="item in storeItems" :key="item.id" class="item-card cursor-pointer rounded-lg border border-veltara-border p-2.5 text-left transition-colors hover:border-veltara-accent" @click="purchaseItem(item.id)">
                <div class="mb-2 flex aspect-square items-center justify-center rounded bg-veltara-bg/80 text-3xl">
                  {{ ITEM_ICONS[item.items?.type] ?? '✨' }}
                </div>
                <div class="truncate text-[11px] font-medium text-white">{{ sanitizeHtml(item.items?.name ?? 'Item') }}</div>
                <div class="mt-1 flex items-center justify-between">
                  <span class="text-[10px] font-medium text-veltara-muted">{{ item.items?.rarity ?? 'common' }}</span>
                  <span class="text-[10px] text-veltara-glow">{{ item.price_credits }} cr</span>
                </div>
              </button>
            </div>
          </div>

          <div class="space-y-2 border-t border-veltara-border p-3">
            <div class="mb-2 text-xs font-medium uppercase tracking-wider text-veltara-muted">Buy Credits</div>
            <div class="flex gap-2">
              <button v-for="(pack, i) in CREDIT_PACKS" :key="pack.label" class="credit-pack flex-1 rounded-lg border border-veltara-border p-2 text-center transition-colors hover:border-veltara-accent" @click="purchaseCreditPack(i)">
                <div class="text-xs font-semibold text-white">{{ pack.label }}</div>
                <div class="text-[10px] text-veltara-muted">${{ (pack.price_cents / 100).toFixed(2) }}</div>
              </button>
            </div>
          </div>
        </div>

        <div v-else class="flex h-[calc(100%-65px)] flex-col overflow-y-auto p-4">
          <div>
            <div class="mb-3 text-xs font-semibold uppercase tracking-wider text-veltara-muted">Graphics</div>
            <div class="space-y-2">
              <label v-for="q in ['low','medium','high']" :key="q" class="flex cursor-pointer items-center gap-2.5">
                <input type="radio" name="quality" :value="q" :checked="quality === q" class="accent-veltara-accent" @change="updateQuality(q)" />
                <span class="capitalize text-sm text-veltara-text">{{ q }}</span>
                <span class="ml-auto text-xs text-veltara-muted">{{ q === 'low' ? '64 seg' : q === 'medium' ? '128 seg' : '256 seg' }}</span>
              </label>
            </div>
          </div>

          <div class="mt-5">
            <div class="mb-3 text-xs font-semibold uppercase tracking-wider text-veltara-muted">Sound</div>
            <label class="flex cursor-pointer items-center gap-2.5">
              <input type="checkbox" v-model="sound" class="accent-veltara-accent" @change="updateSound" />
              <span class="text-sm text-veltara-text">Enable sounds</span>
            </label>
          </div>

          <div class="mt-5">
            <div class="mb-3 text-xs font-semibold uppercase tracking-wider text-veltara-muted">Region Sandbox</div>
            <label class="flex cursor-pointer items-center gap-2.5">
              <input type="checkbox" v-model="sandboxBuildMode" class="accent-veltara-accent" @change="updateSandboxBuildMode" />
              <span class="text-sm text-veltara-text">Build mode</span>
            </label>
            <p class="mt-2 text-xs text-veltara-muted">Double-click a region marker to enter region land. Esc returns to planet. Build: Shift + Click. Selected object: R rotate, Delete remove, L/U lock or unlock door, P/T storage put or take, C/G craft start or collect.</p>
          </div>

          <div class="mt-5">
            <div class="mb-3 text-xs font-semibold uppercase tracking-wider text-veltara-muted">Account</div>
            <div class="space-y-2">
              <button class="btn-secondary w-full text-xs" @click="billingPortal">Manage Subscription</button>
              <button class="w-full rounded-lg border border-red-500/30 px-3 py-2 text-xs text-red-400 transition-colors hover:bg-red-500/10" @click="logout">Sign Out</button>
            </div>
          </div>
        </div>
      </div>
    </Teleport>
  `,
};
