<script setup>
defineProps({
  keyName: {
    type: String,
    required: true,
  },
  label: {
    type: String,
    required: true,
  },
});
</script>

<template>
  <div class="sandbox-hotkey-pill">
    <kbd>{{ keyName }}</kbd>
    <span>{{ label }}</span>
  </div>
</template>
