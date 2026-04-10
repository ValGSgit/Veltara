import { REGIONS } from '@veltara/shared';
import { store } from '../../state/store.js';
import { dispatchAppEvent } from '../utils/events.js';

export function useAppShellActions(shellState) {
  function teleport(regionId) {
    dispatchAppEvent('teleport-to-region', { regionId });
  }

  function navigate(page) {
    store.set('currentPage', page);
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
    store.set('currentPage', 'planet');
  }

  function openModelLab() {
    store.set('modelLabOpen', true);
  }

  function closeModelLab() {
    store.set('modelLabOpen', false);
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
    selectPlanet,
  };
}
