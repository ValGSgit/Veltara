<script setup>
defineProps({
  text: { type: String, default: '' },
});
</script>

<template>
  <div class="empty-state">
    <slot>{{ text }}</slot>
  </div>
</template>