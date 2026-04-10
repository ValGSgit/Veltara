<script setup>
defineProps({
  label: {
    type: String,
    required: true,
  },
  variant: {
    type: String,
    default: 'default',
  },
  disabled: {
    type: Boolean,
    default: false,
  },
});

defineEmits(['click']);
</script>

<template>
  <button
    class="sandbox-action-btn"
    :class="`sandbox-action-btn--${variant}`"
    :disabled="disabled"
    @click="$emit('click')"
  >
    {{ label }}
  </button>
</template>
