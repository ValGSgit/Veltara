<script setup>
defineProps({
  title: { type: String, required: true },
  copy: { type: String, default: '' },
  compact: { type: Boolean, default: false },
});
</script>

<template>
  <div class="panel-heading" :class="{ 'panel-heading--compact': compact }">
    <div>
      <div class="panel-title">{{ title }}</div>
      <div v-if="copy" class="panel-copy">{{ copy }}</div>
    </div>
    <slot />
  </div>
</template>