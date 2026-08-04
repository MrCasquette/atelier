<script setup lang="ts">
import { computed } from 'vue';

const props = defineProps<{
  firstName: string;
  lastName: string;
}>();

const emit = defineEmits<{
  logout: [];
}>();

const initials = computed(() => {
  const first = props.firstName?.charAt(0) ?? '';
  const last = props.lastName?.charAt(0) ?? '';
  return (first + last).toUpperCase();
});

const fullName = computed(() => `${props.firstName} ${props.lastName}`);
</script>

<template>
  <div class="p-3 border-t border-gray-200">
    <!-- Bloc utilisateur cliquable -->
    <RouterLink
      to="/profil"
      class="flex items-center gap-3 p-2 rounded-lg bg-gray-50 hover:bg-gray-100 cursor-pointer transition"
    >
      <!-- Avatar avec initiales -->
      <div
        class="w-10 h-10 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-white text-sm font-semibold shadow-sm shrink-0"
      >
        {{ initials }}
      </div>

      <!-- Infos utilisateur -->
      <div class="flex-1 min-w-0">
        <p class="text-sm font-medium text-gray-900 truncate">
          {{ fullName }}
        </p>
        <p class="text-xs text-gray-500">
          Administrateur
        </p>
      </div>

      <!-- Chevron -->
      <svg
        class="w-4 h-4 text-gray-400"
        fill="none"
        stroke="currentColor"
        viewBox="0 0 24 24"
      >
        <path
          stroke-linecap="round"
          stroke-linejoin="round"
          stroke-width="2"
          d="M9 5l7 7-7 7"
        />
      </svg>
    </RouterLink>

    <!-- Bouton déconnexion -->
    <button
      type="button"
      class="mt-2 w-full flex items-center justify-center gap-2 px-3 py-2 text-sm text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg cursor-pointer transition"
      @click="emit('logout')"
    >
      <svg
        class="w-4 h-4"
        fill="none"
        stroke="currentColor"
        viewBox="0 0 24 24"
      >
        <path
          stroke-linecap="round"
          stroke-linejoin="round"
          stroke-width="2"
          d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"
        />
      </svg>
      Déconnexion
    </button>
  </div>
</template>
