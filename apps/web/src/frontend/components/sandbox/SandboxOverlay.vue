<script setup>
import { computed, ref, watch } from 'vue';
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
  createKind: {
    type: String,
    default: 'block',
  },
  createMaterial: {
    type: String,
    default: 'stone',
  },
  createModelKey: {
    type: String,
    default: '',
  },
  canEditSelection: {
    type: Boolean,
    default: false,
  },
});

const emit = defineEmits(['toggle-build', 'leave', 'action', 'update-create-settings']);

const isRegionLand = computed(() => props.sceneMode === 'region-land');
const selectedTitle = computed(() => {
  if (!props.selectedObject) return 'Nothing selected';
  return `${props.selectedObject.kind} · ${props.selectedObject.material}`;
});
const objectNameDraft = ref('');
const builderIdDraft = ref('');
const modelKeyDraft = ref('');
const createKindDraft = ref('block');
const createMaterialDraft = ref('stone');
const createModelKeyDraft = ref('');

const CREATE_KINDS = ['block', 'platform', 'beacon', 'orb'];
const CREATE_MATERIALS = ['stone', 'metal', 'wood', 'glass', 'neon'];

const selectedNodeType = computed(() => {
  const object = props.selectedObject;
  if (!object) return null;
  const explicit = object.metadata?.node_type;
  if (explicit === 'door' || explicit === 'storage' || explicit === 'crafting') return explicit;
  if (object.kind === 'beacon') return 'door';
  if (object.kind === 'platform') return 'crafting';
  return 'storage';
});

const selectedNodeHints = computed(() => {
  if (selectedNodeType.value === 'door') {
    return {
      title: 'Door Settings',
      body: 'Door nodes toggle open/closed. Only owners can lock or unlock.',
      tip: 'Builders can repair but cannot lock. Use clear names like North Gate.',
    };
  }
  if (selectedNodeType.value === 'crafting') {
    return {
      title: 'Crafting Settings',
      body: 'Crafting nodes queue jobs. Start crafting to enqueue, then collect when ready.',
      tip: 'Use names to distinguish stations (example: Forge A).',
    };
  }
  return {
    title: 'Storage Settings',
    body: 'Storage nodes keep item counts by item ID. Put adds count, take removes available stock.',
    tip: 'Use names to describe purpose (example: Ore Cache).',
  };
});

const objectNameError = computed(() => {
  const normalized = String(objectNameDraft.value ?? '').trim().replace(/\s+/g, ' ').slice(0, 64);
  if (!normalized) return '';
  if (/[<>]/.test(normalized)) return 'Name cannot include angle brackets.';
  if (/[\u0000-\u001F\u007F]/.test(normalized)) return 'Name contains unsupported control characters.';
  if (/\b(?:https?:\/\/|www\.)\S+/i.test(normalized)) return 'Name cannot contain links.';
  return '';
});

const modelKeyError = computed(() => {
  const key = String(modelKeyDraft.value ?? '').trim().toLowerCase();
  if (!key) return '';
  if (!/^[a-z0-9][a-z0-9-_]{0,63}$/.test(key)) {
    return 'Model key must use letters, numbers, dash, or underscore.';
  }
  return '';
});

const createModelKeyError = computed(() => {
  const key = String(createModelKeyDraft.value ?? '').trim().toLowerCase();
  if (!key) return '';
  if (!/^[a-z0-9][a-z0-9-_]{0,63}$/.test(key)) {
    return 'Create model key must use letters, numbers, dash, or underscore.';
  }
  return '';
});

const healthLabel = computed(() => {
  const health = props.selectedObject?.metadata?.health;
  const current = Number(health?.current ?? 100);
  const max = Number(health?.max ?? 100);
  return `${Math.max(0, Math.floor(current))}/${Math.max(1, Math.floor(max))}`;
});

watch(
  () => [props.createKind, props.createMaterial, props.createModelKey],
  () => {
    createKindDraft.value = String(props.createKind ?? 'block');
    createMaterialDraft.value = String(props.createMaterial ?? 'stone');
    createModelKeyDraft.value = String(props.createModelKey ?? '');
  },
  { immediate: true },
);

watch(
  () => props.selectedObject?.id,
  () => {
    objectNameDraft.value = String(props.selectedObject?.metadata?.name ?? '');
    modelKeyDraft.value = String(props.selectedObject?.metadata?.model_key ?? '');
    builderIdDraft.value = '';
  },
  { immediate: true },
);

function saveObjectName() {
  if (objectNameError.value) return;
  emit('action', {
    type: 'set-name',
    payload: { name: objectNameDraft.value },
  });
}

function saveModelKey() {
  if (modelKeyError.value) return;
  emit('action', {
    type: 'set-model-key',
    payload: { model_key: modelKeyDraft.value },
  });
}

function applyCreateSettings() {
  if (createModelKeyError.value) return;
  const modelKey = String(createModelKeyDraft.value ?? '').trim().toLowerCase();
  emit('update-create-settings', {
    kind: createKindDraft.value,
    material: createMaterialDraft.value,
    modelKey,
  });
}

function grantBuilderRole() {
  emit('action', {
    type: 'grant-builder',
    payload: { user_id: builderIdDraft.value },
  });
  builderIdDraft.value = '';
}

function revokeBuilderRole() {
  emit('action', {
    type: 'revoke-builder',
    payload: { user_id: builderIdDraft.value },
  });
  builderIdDraft.value = '';
}
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
        <p v-if="selectedObject" class="sandbox-selection__meta">
          Health: {{ healthLabel }}
        </p>
        <p v-if="selectedObject?.metadata?.name" class="sandbox-selection__meta">
          Name: {{ selectedObject.metadata.name }}
        </p>
      </section>

      <section v-if="selectedObject" class="sandbox-overlay__selection sandbox-meta-editor">
        <p class="sandbox-overlay__eyebrow">Metadata</p>
        <label class="sandbox-meta-editor__label">
          Object Name
          <input
            v-model="objectNameDraft"
            class="sandbox-meta-editor__input"
            maxlength="64"
            placeholder="e.g. North Gate"
            :disabled="!canEditSelection"
          />
        </label>
        <p v-if="objectNameError" class="sandbox-meta-editor__error">{{ objectNameError }}</p>
        <SandboxActionButton label="Save Name" :disabled="!canEditSelection || !!objectNameError" @click="saveObjectName" />

        <label class="sandbox-meta-editor__label">
          Model Key
          <input
            v-model="modelKeyDraft"
            class="sandbox-meta-editor__input"
            maxlength="64"
            placeholder="e.g. beacon_tower"
            :disabled="!canEditSelection"
          />
        </label>
        <p v-if="modelKeyError" class="sandbox-meta-editor__error">{{ modelKeyError }}</p>
        <SandboxActionButton label="Save Model" :disabled="!canEditSelection || !!modelKeyError" @click="saveModelKey" />

        <label class="sandbox-meta-editor__label">
          Builder User ID
          <input
            v-model="builderIdDraft"
            class="sandbox-meta-editor__input"
            maxlength="64"
            placeholder="user-123"
            :disabled="!canEditSelection"
          />
        </label>
        <div class="sandbox-meta-editor__actions">
          <SandboxActionButton label="Grant Builder" :disabled="!canEditSelection || !builderIdDraft.trim()" @click="grantBuilderRole" />
          <SandboxActionButton label="Revoke Builder" variant="ghost" :disabled="!canEditSelection || !builderIdDraft.trim()" @click="revokeBuilderRole" />
        </div>
      </section>

      <section v-if="selectedObject" class="sandbox-overlay__selection sandbox-node-guide">
        <p class="sandbox-overlay__eyebrow">Node Guide</p>
        <p class="sandbox-node-guide__title">{{ selectedNodeHints.title }}</p>
        <p class="sandbox-selection__meta">{{ selectedNodeHints.body }}</p>
        <p class="sandbox-selection__meta">{{ selectedNodeHints.tip }}</p>
      </section>

      <section class="sandbox-overlay__selection sandbox-meta-editor">
        <p class="sandbox-overlay__eyebrow">Object Creation</p>
        <label class="sandbox-meta-editor__label">
          Kind
          <select v-model="createKindDraft" class="sandbox-meta-editor__input" @change="applyCreateSettings">
            <option v-for="kind in CREATE_KINDS" :key="kind" :value="kind">{{ kind }}</option>
          </select>
        </label>
        <label class="sandbox-meta-editor__label">
          Material
          <select v-model="createMaterialDraft" class="sandbox-meta-editor__input" @change="applyCreateSettings">
            <option v-for="material in CREATE_MATERIALS" :key="material" :value="material">{{ material }}</option>
          </select>
        </label>
        <label class="sandbox-meta-editor__label">
          Create Model Key (optional)
          <input
            v-model="createModelKeyDraft"
            class="sandbox-meta-editor__input"
            maxlength="64"
            placeholder="e.g. beacon_tower"
            @change="applyCreateSettings"
          />
        </label>
        <p v-if="createModelKeyError" class="sandbox-meta-editor__error">{{ createModelKeyError }}</p>
      </section>

      <div class="sandbox-overlay__actions">
        <SandboxActionButton
          :label="sandboxBuildMode ? 'Disable Build' : 'Enable Build'"
          variant="primary"
          @click="emit('toggle-build')"
        />
        
        <template v-if="selectedObject">
          <SandboxActionButton
            label="Use"
            @click="emit('action', 'use')"
          />

          <!-- Door Controls -->
          <template v-if="selectedNodeType === 'door'">
            <SandboxActionButton
              label="Lock"
              @click="emit('action', 'lock')"
              :disabled="!canEditSelection"
            />
            <SandboxActionButton
              label="Unlock"
              @click="emit('action', 'unlock')"
              :disabled="!canEditSelection"
            />
          </template>
          
          <!-- Storage Controls -->
          <template v-if="selectedNodeType === 'storage'">
            <SandboxActionButton
              label="Put Item"
              @click="emit('action', 'put')"
            />
            <SandboxActionButton
              label="Take Item"
              @click="emit('action', 'take')"
            />
          </template>

          <!-- Crafter Controls -->
          <template v-if="selectedNodeType === 'crafting'">
            <SandboxActionButton
              label="Start Crafting"
              @click="emit('action', 'start-craft')"
            />
            <SandboxActionButton
              label="Collect"
              @click="emit('action', 'collect-craft')"
            />
          </template>

          <SandboxActionButton
            label="Repair"
            @click="emit('action', 'repair')"
          />

          <SandboxActionButton
            label="Rotate"
            :disabled="!canEditSelection"
            @click="emit('action', 'rotate')"
          />
          <SandboxActionButton
            label="Remove"
            variant="danger"
            :disabled="!canEditSelection"
            @click="emit('action', 'remove')"
          />
        </template>
      </div>

      <div class="sandbox-overlay__hotkeys">
        <SandboxHotkeyPill key-name="Shift + Click" label="Place" />
        <SandboxHotkeyPill key-name="R" label="Rotate" />
        <SandboxHotkeyPill key-name="Delete" label="Remove" />
        <SandboxHotkeyPill key-name="L / U" label="Door lock/unlock" />
        <SandboxHotkeyPill key-name="P / T" label="Storage put/take" />
        <SandboxHotkeyPill key-name="C / G" label="Craft start/collect" />
        <SandboxHotkeyPill key-name="H" label="Repair" />
      </div>
    </aside>
  </Transition>
</template>
