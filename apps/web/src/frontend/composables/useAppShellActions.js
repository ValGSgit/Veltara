import { REGIONS } from '@veltara/shared';
import { store } from '../../state/store.js';
import { dispatchAppEvent } from '../utils/events.js';

const PAGE_TO_PATH = {
  welcome: '/welcome',
  home: '/home',
  planet: '/planet',
  profile: '/profile',
  shop: '/shop',
};

function pushPageLocation(page, { replace = false } = {}) {
  const path = PAGE_TO_PATH[page] ?? '/welcome';
  if (typeof window === 'undefined') return;
  if (window.location.pathname === path) return;
  if (replace) window.history.replaceState({}, '', path);
  else window.history.pushState({}, '', path);
}

export function useAppShellActions(shellState) {

  function teleport(regionId) {
    dispatchAppEvent('teleport-to-region', { regionId });
  }

  function navigate(page, options = {}) {
    if (page === 'welcome') {
      store.set('currentPage', 'welcome');
      store.set('activePanel', null);
      pushPageLocation('welcome', options);
      return;
    }

    if (page === 'profile') {
      store.set('currentPage', 'profile');
      store.set('activePanel', 'profile');
      pushPageLocation('profile', options);
      return;
    }

    if (page === 'shop') {
      store.set('currentPage', 'shop');
      store.set('activePanel', 'store');
      pushPageLocation('shop', options);
      return;
    }

    if (page === 'planet') {
      store.set('currentPage', 'planet');
      store.set('activePanel', null);
      pushPageLocation('planet', options);
      return;
    }

    store.set('currentPage', 'home');
    store.set('activePanel', null);
    pushPageLocation('home', options);
  }

  function openPanel(panel) {
    store.set('activePanel', panel);
  }

  function closePanel() {
    store.set('activePanel', null);
    if (shellState.currentPage === 'profile' || shellState.currentPage === 'shop') {
      navigate('home', { replace: true });
    }
  }

  function setChatTab(tab) {
    store.set('chatTab', tab);
  }

  function sendChat(event) {
    if (event.key !== 'Enter') return;
    const text = event.target.value.trim();
    if (!text) return;
    const isGlobal = shellState.chatTab === 'global';
    dispatchAppEvent('send-chat', { text, is_global: isGlobal });
    event.target.value = '';
  }

  function quickRegion() {
    const region = REGIONS[Math.floor(Math.random() * REGIONS.length)];
    if (region) teleport(region.id);
  }

  function closeAuth() {
    store.set('authModal', null);
  }

  function openAuth(mode = 'login') {
    store.set('authModal', mode);
  }

  function switchAuthMode(mode) {
    store.set('authModal', mode);
  }

  function closeOnboarding() {
    store.set('showOnboarding', false);
  }

  function toggleSandboxBuild() {
    dispatchAppEvent('sandbox-build-mode', {
      enabled: !shellState.sandboxBuildMode,
    });
  }

  function leaveSandbox() {
    dispatchAppEvent('leave-region-land');
  }

  function updateSandboxCreateSettings(settings) {
    if (!settings || typeof settings !== 'object') return;
    if (typeof settings.kind === 'string') {
      store.set('sandboxCreateKind', settings.kind);
    }
    if (typeof settings.material === 'string') {
      store.set('sandboxCreateMaterial', settings.material);
    }
    if (typeof settings.modelKey === 'string') {
      store.set('sandboxCreateModelKey', settings.modelKey);
    }
  }

  function triggerSandboxAction(action) {
    dispatchAppEvent('sandbox-ui-action', { action });
  }

  function goPlanet() {
    navigate('planet');
  }

  function openModelLab() {
    store.set('modelLabOpen', true);
  }

  function closeModelLab() {
    store.set('modelLabOpen', false);
  }

  function openCreatorStudio() {
    store.set('creatorStudioOpen', true);
  }

  function closeCreatorStudio() {
    store.set('creatorStudioOpen', false);
  }

  function selectPlanet(planetId) {
    dispatchAppEvent('planet-select', { planetId });
  }

  return {
    teleport,
    navigate,
    openPanel,
    closePanel,
    setChatTab,
    sendChat,
    quickRegion,
    closeAuth,
    openAuth,
    switchAuthMode,
    closeOnboarding,
    toggleSandboxBuild,
    leaveSandbox,
    updateSandboxCreateSettings,
    triggerSandboxAction,
    goPlanet,
    openModelLab,
    closeModelLab,
    openCreatorStudio,
    closeCreatorStudio,
    selectPlanet,
  };
}
