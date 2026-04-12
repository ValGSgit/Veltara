import { createApp, computed, onMounted, onUnmounted, reactive } from 'vue';
import { REGIONS } from '@veltara/shared';
import { store } from '../state/store.js';
import { handleAuthSuccess as resolveAuthSuccess } from '../ui/auth.js';
import AppNavBar from './components/AppNavBar.vue';
import LobbyView from './views/LobbyView.vue';
import HomeView from './views/HomeView.vue';
import WelcomeView from './views/WelcomeView.vue';
import AuthModalView from './components/AuthModalView.vue';
import OnboardingModalView from './components/OnboardingModalView.vue';
import PanelDrawerView from './components/PanelDrawerView.vue';
import SandboxOverlay from './components/sandbox/SandboxOverlay.vue';
import ModelLabModal from './components/ModelLabModal.vue';
import CreatorStudioModal from './components/CreatorStudioModal.vue';
import { useAppShellActions } from './composables/useAppShellActions.js';
import {
  formatClock,
  playerAction,
  playerName,
  playerRegion,
  regionById,
} from './utils/formatters.js';

const shellState = reactive(store.getAll());

store.on('*', ({ key, value }) => {
  shellState[key] = value;
});

let mounted = false;

function pageFromPath(pathname) {
  const path = String(pathname ?? '').toLowerCase();
  if (path === '/' || path === '/welcome') return 'welcome';
  if (path === '/planet') return 'planet';
  if (path === '/profile') return 'profile';
  if (path === '/shop') return 'shop';
  if (path === '/home') return 'home';
  return 'welcome';
}

export function mountAppShell() {
  const mountPoint = document.getElementById('hud');
  if (!mountPoint || mounted) return;

  mounted = true;

  createApp({
    name: 'AppShell',
    components: {
      LobbyView,
      HomeView,
      WelcomeView,
      AppNavBar,
      //AuthModalView,
      OnboardingModalView,
      PanelDrawerView,
      SandboxOverlay,
      ModelLabModal,
      CreatorStudioModal,
    },
    setup() {
      const currentPage = computed(() => shellState.currentPage ?? 'welcome');
      const isHomeSurface = computed(() => ['home', 'profile', 'shop'].includes(currentPage.value));
      // const authModal = computed(() => shellState.authModal);
      const onboardingVisible = computed(() => Boolean(shellState.showOnboarding));
      const activePanel = computed(() => shellState.activePanel);

      const regions = computed(() => {
        const counts = shellState.regionCounts ?? {};
        return (shellState.regions?.length ? shellState.regions : REGIONS).map((region) => ({
          ...region,
          users: counts[region.id] ?? region.player_count ?? 0,
        }));
      });

      const activeRegion = computed(() => regionById(shellState.selfRegionId));
      const activeRegionLand = computed(() => regionById(shellState.activeRegionLandId));

      const players = computed(() => {
        const map = shellState.players ?? new Map();
        return Array.from(map.values());
      });

      const nearbyPlayers = computed(() => {
        const currentId = shellState.selfRegionId;
        return players.value
          .filter((player) => (player.region_id ?? player.regionId ?? player.region) === currentId)
          .slice(0, 6);
      });

      const activeEvents = computed(() => shellState.activeEvents ?? shellState.worldState?.active_events ?? []);
      const clock = computed(() => formatClock(shellState.worldState?.day_cycle_progress ?? 0.5));
      const totalOnline = computed(() => players.value.length);

      const featuredRegion = computed(() => {
        if (!regions.value.length) return activeRegion.value;
        return [...regions.value].sort((a, b) => (b.users ?? 0) - (a.users ?? 0))[0] ?? activeRegion.value;
      });

      const chatMessages = computed(() => {
        const messages = shellState.chatMessages ?? [];
        const tab = shellState.chatTab ?? 'local';
        return messages
          .filter((message) => (tab === 'global' ? message.is_global : !message.is_global))
          .slice(-50);
      });

      const sandboxObjectCount = computed(() => {
        const objects = shellState.sandboxObjects;
        return objects instanceof Map ? objects.size : 0;
      });

      const selectedSandboxObject = computed(() => {
        const selectedId = shellState.selectedSandboxObjectId;
        if (!selectedId) return null;
        const objects = shellState.sandboxObjects;
        if (!(objects instanceof Map)) return null;
        return objects.get(selectedId) ?? null;
      });

      const canEditSelection = computed(() => {
        const object = selectedSandboxObject.value;
        const userId = shellState.user?.id;
        if (!object || !userId) return false;
        return object.owner_id === userId;
      });

      function handleAuthSuccess(user) {
        resolveAuthSuccess(user);
      }

      const actions = useAppShellActions(shellState);

      function syncPageFromLocation() {
        const page = pageFromPath(window.location.pathname);
        actions.navigate(page, { replace: true });
      }

      onMounted(() => {
        syncPageFromLocation();
        window.addEventListener('popstate', syncPageFromLocation);
      });

      onUnmounted(() => {
        window.removeEventListener('popstate', syncPageFromLocation);
      });

      return {
        shellState,
        currentPage,
        // authModal,
        onboardingVisible,
        activePanel,
        regions,
        activeRegion,
        nearbyPlayers,
        activeEvents,
        clock,
        totalOnline,
        featuredRegion,
        chatMessages,
        isHomeSurface,
        activeRegionLand,
        sandboxObjectCount,
        selectedSandboxObject,
        canEditSelection,
        ...actions,
        playerName,
        playerAction,
        playerRegion,
        handleAuthSuccess,
      };
    },
    template: `
      <div>
        <AppNavBar
          :current-page="currentPage"
          :is-authenticated="shellState.isAuthenticated"
          :username="shellState.user?.username || ''"
          :ws-connected="shellState.wsConnected"
          :ws-reconnecting="shellState.wsReconnecting"
          :ws-latency="shellState.wsLatency"
          :scene-mode="shellState.sceneMode"
          :sandbox-build-mode="shellState.sandboxBuildMode"
          :active-region-name="activeRegionLand.name"
          @navigate="navigate"
          @open-panel="openPanel"
          @auth="openAuth"
        />

        <HomeView
          v-if="isHomeSurface"
          :shell-state="shellState"
          :active-region="activeRegion"
          :regions="regions"
          :featured-region="featuredRegion"
          :nearby-players="nearbyPlayers"
          :chat-messages="chatMessages"
          :total-online="totalOnline"
          :clock="clock"
          :active-events="activeEvents"
          :quick-region="quickRegion"
          :teleport="teleport"
          :open-panel="openPanel"
          :set-chat-tab="setChatTab"
          :send-chat="sendChat"
          :is-authenticated="shellState.isAuthenticated"
          :player-name="playerName"
          :player-action="playerAction"
          :player-region="playerRegion"
          :go-planet="goPlanet"
        />

        <WelcomeView
          v-else-if="currentPage === 'welcome'"
          :is-authenticated="shellState.isAuthenticated"
          :open-auth="openAuth"
          :go-home="() => navigate('home')"
          :go-planet="goPlanet"
        />

        <LobbyView
          v-else-if="currentPage === 'planet' && shellState.activePlanetId !== 'black-hole'"
          :shell-state="shellState"
          :regions="regions"
          :active-region="activeRegion"
          :active-events="activeEvents"
          :clock="clock"
          :total-online="totalOnline"
          :featured-region="featuredRegion"
          :teleport="teleport"
          :open-panel="openPanel"
          :quick-region="quickRegion"
        />

        // <AuthModalView
        //   v-if="authModal"
        //   :mode="authModal"
        //   @close="closeAuth"
        //   @switch-mode="switchAuthMode"
        //   @success="handleAuthSuccess"
        // />

        <OnboardingModalView
          v-if="onboardingVisible"
          @close="closeOnboarding"
        />

        <PanelDrawerView
          v-if="activePanel"
          :panel="activePanel"
          @close="closePanel"
        />

        <SandboxOverlay
          :scene-mode="shellState.sceneMode"
          :active-region-name="activeRegionLand.name"
          :object-count="sandboxObjectCount"
          :selected-object="selectedSandboxObject"
          :sandbox-build-mode="shellState.sandboxBuildMode"
          :create-kind="shellState.sandboxCreateKind"
          :create-material="shellState.sandboxCreateMaterial"
          :create-model-key="shellState.sandboxCreateModelKey"
          :can-edit-selection="canEditSelection"
          @toggle-build="toggleSandboxBuild"
          @leave="leaveSandbox"
          @update-create-settings="updateSandboxCreateSettings"
          @action="triggerSandboxAction"
        />

        <ModelLabModal
          :open="Boolean(shellState.modelLabOpen)"
          @close="closeModelLab"
        />

        <CreatorStudioModal
          :open="Boolean(shellState.creatorStudioOpen)"
          @close="closeCreatorStudio"
          @open-model-lab="openModelLab"
        />

        <div class="planet-switcher glass-panel" v-if="shellState.sceneMode !== 'region-land' && currentPage === 'planet' && shellState.activePlanetId !== 'black-hole'" role="toolbar" aria-label="Planet switcher">
          <button
            class="planet-switcher__btn"
            :class="{ 'is-active': shellState.activePlanetId === 'black-hole' }"
            :aria-pressed="shellState.activePlanetId === 'black-hole'"
            @click="selectPlanet('black-hole')"
          >
            Black Hole (Menu)
          </button>
          <button
            class="planet-switcher__btn"
            :class="{ 'is-active': shellState.activePlanetId === 'veltara' }"
            :aria-pressed="shellState.activePlanetId === 'veltara'"
            @click="selectPlanet('veltara')"
          >
            Veltara
          </button>
          <button
            class="planet-switcher__btn"
            :class="{ 'is-active': shellState.activePlanetId === 'earth-test' }"
            :aria-pressed="shellState.activePlanetId === 'earth-test'"
            @click="selectPlanet('earth-test')"
          >
            Earth (Test)
          </button>
        </div>
      </div>
    `,
  }).mount(mountPoint);
}
