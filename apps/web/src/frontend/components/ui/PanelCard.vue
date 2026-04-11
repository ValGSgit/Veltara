<script setup>
defineProps({
  compact: { type: Boolean, default: false },
  as: { type: String, default: 'section' },
});
</script>

<template>
  <component :is="as" class="panel-card glass-panel" :class="{ 'panel-card--compact': compact }">
    <slot />
  </component>
</template>

<style scoped>
.panel-card {
  border-radius: 1.1rem;
  padding: 1rem;
  border: 1px solid rgba(148, 163, 184, 0.12);
  background: rgba(255, 255, 255, 0.03);
}

.panel-card--compact {
  padding: 0.72rem;
  border-radius: 0.95rem;
}
</style>
