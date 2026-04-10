import { createApp, computed, reactive } from 'vue';
import { REGIONS } from '@veltara/shared';
import { store } from '../state/store.js';
import { handleAuthSuccess as resolveAuthSuccess } from '../ui/auth.js';
import { LobbyView } from './views/LobbyView.js';
import { AuthModalView } from './components/AuthModalView.js';
import { OnboardingModalView } from './components/OnboardingModalView.js';
import { PanelDrawerView } from './components/PanelDrawerView.js';
import { dispatchAppEvent } from './utils/events.js';
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

export function mountAppShell() {
  const mountPoint = document.getElementById('hud');
  if (!mountPoint || mounted) return;

  mounted = true;

  createApp({
    name: 'AppShell',
    components: {
      LobbyView,
      AuthModalView,
      OnboardingModalView,
      PanelDrawerView,
    },
    setup() {
      const authModal = computed(() => shellState.authModal);
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

      function teleport(regionId) {
        dispatchAppEvent('teleport-to-region', { regionId });
      }

      function openPanel(panel) {
        store.set('activePanel', panel);
      }

      function closePanel() {
        store.set('activePanel', null);
      }

      function setChatTab(tab) {
        store.set('chatTab', tab);
      }

      function sendChat(event) {
        if (event.key === 'Enter') {
          const text = event.target.value.trim();
          if (!text) return;
          const isGlobal = shellState.chatTab === 'global';
          dispatchAppEvent('send-chat', { text, is_global: isGlobal });
          event.target.value = '';
        }
      }

      function quickRegion() {
        const region = REGIONS[Math.floor(Math.random() * REGIONS.length)];
        if (region) teleport(region.id);
      }

      function closeAuth() {
        store.set('authModal', null);
      }

      function switchAuthMode(mode) {
        store.set('authModal', mode);
      }

      function handleAuthSuccess(user) {
        resolveAuthSuccess(user);
      }

      function closeOnboarding() {
        store.set('showOnboarding', false);
      }

      return {
        shellState,
        authModal,
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
        teleport,
        openPanel,
        closePanel,
        setChatTab,
        sendChat,
        quickRegion,
        playerName,
        playerAction,
        playerRegion,
        closeAuth,
        switchAuthMode,
        handleAuthSuccess,
        closeOnboarding,
      };
    },
    template: `
      <div>
        <LobbyView
          :shell-state="shellState"
          :regions="regions"
          :active-region="activeRegion"
          :nearby-players="nearbyPlayers"
          :active-events="activeEvents"
          :clock="clock"
          :total-online="totalOnline"
          :featured-region="featuredRegion"
          :chat-messages="chatMessages"
          :teleport="teleport"
          :open-panel="openPanel"
          :set-chat-tab="setChatTab"
          :send-chat="sendChat"
          :quick-region="quickRegion"
          :player-name="playerName"
          :player-action="playerAction"
          :player-region="playerRegion"
        />

        <AuthModalView
          v-if="authModal"
          :mode="authModal"
          @close="closeAuth"
          @switch-mode="switchAuthMode"
          @success="handleAuthSuccess"
        />

        <OnboardingModalView
          v-if="onboardingVisible"
          @close="closeOnboarding"
        />

        <PanelDrawerView
          v-if="activePanel"
          :panel="activePanel"
          @close="closePanel"
        />
      </div>
    `,
  }).mount(mountPoint);
}
