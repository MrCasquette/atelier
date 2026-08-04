<script setup lang="ts">
import { onMounted } from 'vue';
import { useAuth } from './composables/useAuth';
import ToastContainer from './components/organisms/ToastContainer.vue';

const auth = useAuth();

onMounted(async () => {
  await auth.checkAuth();
});
</script>

<template>
  <router-view />
  <ToastContainer />
</template>
