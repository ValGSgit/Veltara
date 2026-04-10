<script setup>
import { computed } from 'vue';
import SandboxHotkeyPill from './SandboxHotkeyPill.vue';
import SandboxActionButton from './SandboxActionButton.vue';

const props = defineProps({
  sceneMode: {
    type: String,
    default: 'planet',
  },
  activeRegionName: {
    type: String,
    default: '',
  },
  objectCount: {
    type: Number,
    default: 0,
  },
  selectedObject: {
    type: Object,
    default: null,
  },
  sandboxBuildMode: {
    type: Boolean,
    default: false,
  },
  canEditSelection: {
    type: Boolean,
    default: false,
  },
});

const emit = defineEmits(['toggle-build', 'leave', 'action']);

const isRegionLand = computed(() => props.sceneMode === 'region-land');
const selectedTitle = computed(() => {
  if (!props.selectedObject) return 'Nothing selected';
  return `${props.selectedObject.kind} · ${props.selectedObject.material}`;
});
</script>

<template>
  <Transition name="sandbox-slide">
    <aside v-if="isRegionLand" class="sandbox-overlay glass-panel">
      <header class="sandbox-overlay__header">
        <div>
          <p class="sandbox-overlay__eyebrow">Region Sandbox</p>
          <h3>{{ activeRegionName || 'Active Region' }}</h3>
        </div>
        <SandboxActionButton label="Leave" variant="ghost" @click="emit('leave')" />
      </header>

      <div class="sandbox-overlay__stats">
        <div class="sandbox-stat-card">
          <span>Objects</span>
          <strong>{{ objectCount }}</strong>
        </div>
        <div class="sandbox-stat-card">
          <span>Build Mode</span>
          <strong :class="sandboxBuildMode ? 'is-online' : 'is-offline'">{{ sandboxBuildMode ? 'Enabled' : 'Disabled' }}</strong>
        </div>
      </div>

      <section class="sandbox-overlay__selection">
        <p class="sandbox-overlay__eyebrow">Selection</p>
        <p class="sandbox-selection__title">{{ selectedTitle }}</p>
        <p v-if="selectedObject" class="sandbox-selection__meta">
          ID: {{ selectedObject.id.slice(0, 8) }} · owner {{ selectedObject.owner_id.slice(0, 6) }}
        </p>
      </section>

      <div class="sandbox-overlay__actions">
        <SandboxActionButton
          :label="sandboxBuildMode ? 'Disable Build' : 'Enable Build'"
          variant="primary"
          @click="emit('toggle-build')"
        />
        <SandboxActionButton
          label="Use"
          :disabled="!selectedObject"
          @click="emit('action', 'use')"
        />
        <SandboxActionButton
          label="Rotate"
          :disabled="!selectedObject || !canEditSelection"
          @click="emit('action', 'rotate')"
        />
        <SandboxActionButton
          label="Remove"
          variant="danger"
          :disabled="!selectedObject || !canEditSelection"
          @click="emit('action', 'remove')"
        />
      </div>

      <div class="sandbox-overlay__hotkeys">
        <SandboxHotkeyPill key-name="Shift + Click" label="Place" />
        <SandboxHotkeyPill key-name="R" label="Rotate" />
        <SandboxHotkeyPill key-name="Delete" label="Remove" />
        <SandboxHotkeyPill key-name="L / U" label="Door lock/unlock" />
        <SandboxHotkeyPill key-name="P / T" label="Storage put/take" />
        <SandboxHotkeyPill key-name="C / G" label="Craft start/collect" />
      </div>
    </aside>
  </Transition>
</template>
