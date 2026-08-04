<script setup lang="ts">
import { computed } from 'vue';
import { useAuth } from '@/composables/useAuth';

const auth = useAuth();

const initials = computed(() => {
  const first = auth.user.value?.firstName?.charAt(0) ?? '';
  const last = auth.user.value?.lastName?.charAt(0) ?? '';
  return (first + last).toUpperCase();
});
</script>

<template>
  <div>
    <h1 class="text-2xl font-bold text-gray-900 mb-6">
      Mon profil
    </h1>

    <div class="bg-white rounded-lg shadow">
      <!-- Header profil -->
      <div class="p-6 border-b border-gray-200">
        <div class="flex items-center gap-4">
          <div
            class="w-16 h-16 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-white text-xl font-semibold shadow-md"
          >
            {{ initials }}
          </div>
          <div>
            <h2 class="text-xl font-semibold text-gray-900">
              {{ auth.user.value?.firstName }} {{ auth.user.value?.lastName }}
            </h2>
            <p class="text-sm text-gray-500">
              Administrateur
            </p>
          </div>
        </div>
      </div>

      <!-- Infos -->
      <div class="p-6 space-y-4">
        <div>
          <label class="block text-sm font-medium text-gray-500 mb-1">Email</label>
          <p class="text-gray-900">
            {{ auth.user.value?.email }}
          </p>
        </div>

        <div>
          <label class="block text-sm font-medium text-gray-500 mb-1">Prénom</label>
          <p class="text-gray-900">
            {{ auth.user.value?.firstName }}
          </p>
        </div>

        <div>
          <label class="block text-sm font-medium text-gray-500 mb-1">Nom</label>
          <p class="text-gray-900">
            {{ auth.user.value?.lastName }}
          </p>
        </div>
      </div>
    </div>
  </div>
</template>
