<script setup>
import { onMounted, ref } from 'vue';
import { supabase } from '../utils/supabase';

const todos = ref([]);
const error = ref('');

async function getTodos() {
  const { data, error: queryError } = await supabase.from('todos').select();
  if (queryError) {
    error.value = queryError.message;
    todos.value = [];
    return;
  }
  error.value = '';
  todos.value = data ?? [];
}

onMounted(() => {
  getTodos();
});
</script>

<template>
  <div>
    <p v-if="error">{{ error }}</p>
    <ul>
      <li v-for="todo in todos" :key="todo.id">{{ todo.name }}</li>
    </ul>
  </div>
</template>
