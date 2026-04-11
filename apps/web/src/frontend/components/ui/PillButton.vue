<script setup>
defineProps({
  active: { type: Boolean, default: false },
  size: { type: String, default: 'sm' },
  as: { type: String, default: 'button' },
  type: { type: String, default: 'button' },
});
</script>

<template>
  <component :is="as" class="pill-btn" :class="[`pill-btn--${size}`, { 'is-active': active }]" :type="as === 'button' ? type : undefined">
    <slot />
  </component>
</template>

<style scoped>
.pill-btn {
  border-radius: 999px;
  border: 1px solid rgba(148, 163, 184, 0.2);
  background: rgba(255, 255, 255, 0.04);
  color: #d8e4f8;
  transition: all 0.18s ease;
}

.pill-btn:hover {
  border-color: rgba(79, 255, 176, 0.32);
  transform: translateY(-1px);
}

.pill-btn.is-active {
  color: #f8fbff;
  border-color: rgba(79, 255, 176, 0.32);
  background: linear-gradient(135deg, rgba(79, 255, 176, 0.16), rgba(108, 99, 255, 0.14));
}

.pill-btn--sm {
  padding: 0.38rem 0.78rem;
  font-size: 0.75rem;
}

.pill-btn--md {
  padding: 0.52rem 0.94rem;
  font-size: 0.82rem;
}
</style>
