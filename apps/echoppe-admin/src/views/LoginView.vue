<script setup lang="ts">
import { ref } from 'vue';
import { useRouter, useRoute } from 'vue-router';
import { useAuth } from '@/composables/useAuth';
import Button from '@/components/atoms/Button.vue';

const router = useRouter();
const route = useRoute();
const auth = useAuth();

const email = ref('');
const password = ref('');
const loading = ref(false);
const errorMessage = ref('');

async function handleSubmit() {
  loading.value = true;
  errorMessage.value = '';

  const result = await auth.login(email.value, password.value);

  if (result.success) {
    const redirect = (route.query.redirect as string) || '/';
    router.push(redirect);
  } else {
    errorMessage.value = result.error || 'Erreur de connexion';
  }

  loading.value = false;
}
</script>

<template>
  <div class="min-h-screen bg-gray-100 flex items-center justify-center px-4">
    <div class="bg-white rounded-xl shadow-lg p-8 w-full max-w-md">
      <div class="text-center mb-8">
        <h1 class="text-2xl font-bold text-gray-900">
          Echoppe
        </h1>
        <p class="text-gray-500 mt-2">
          Connexion administration
        </p>
      </div>

      <form
        class="space-y-6"
        @submit.prevent="handleSubmit"
      >
        <div
          v-if="errorMessage"
          class="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm"
        >
          {{ errorMessage }}
        </div>

        <div>
          <label
            for="email"
            class="block text-sm font-medium text-gray-700 mb-2"
          >
            Email
          </label>
          <input
            id="email"
            v-model="email"
            type="email"
            required
            autocomplete="email"
            class="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition"
            placeholder="admin@echoppe.dev"
          />
        </div>

        <div>
          <label
            for="password"
            class="block text-sm font-medium text-gray-700 mb-2"
          >
            Mot de passe
          </label>
          <input
            id="password"
            v-model="password"
            type="password"
            required
            autocomplete="current-password"
            class="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition"
            placeholder="••••••••"
          />
        </div>

        <Button
          type="submit"
          variant="primary"
          size="lg"
          :loading="loading"
          class="w-full"
        >
          {{ loading ? 'Connexion...' : 'Se connecter' }}
        </Button>
      </form>
    </div>
  </div>
</template>
