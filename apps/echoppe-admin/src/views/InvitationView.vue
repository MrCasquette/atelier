<script setup lang="ts">
import { computed, ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import Button from '@/components/atoms/Button.vue';
import { api } from '@/lib/api';
import { errorMessage } from '@/lib/apiError';

// Où l'invité pose son mot de passe (ADR-0048). Écran PUBLIC : celui qui arrive ici n'a pas de
// session, c'est précisément ce qu'il vient chercher.

const route = useRoute();
const router = useRouter();

const token = computed(() => (route.query.token as string | undefined) ?? '');
const password = ref('');
const confirmation = ref('');
const submitting = ref(false);
const error = ref<string | null>(null);
const done = ref(false);

const MIN_LENGTH = 6;

async function submit() {
  error.value = null;

  if (password.value.length < MIN_LENGTH) {
    error.value = `Le mot de passe doit contenir au moins ${MIN_LENGTH} caractères`;
    return;
  }
  if (password.value !== confirmation.value) {
    error.value = 'Les deux saisies diffèrent';
    return;
  }

  submitting.value = true;
  const { error: failure } = await api.auth['accept-invitation'].post({
    token: token.value,
    password: password.value,
  });
  submitting.value = false;

  if (failure) {
    // Le serveur ne dit pas si le jeton a existé — on ne le devine pas non plus.
    error.value = errorMessage(failure, 'Lien invalide ou expiré');
    return;
  }

  done.value = true;
}
</script>

<template>
  <div class="min-h-screen flex items-center justify-center bg-gray-50 px-4">
    <div class="w-full max-w-md">
      <div class="bg-white rounded-lg shadow p-8">
        <h1 class="text-xl font-semibold text-gray-900">
          Choisissez votre mot de passe
        </h1>

        <template v-if="!token">
          <p class="mt-4 text-sm text-gray-600">
            Ce lien est incomplet. Demandez-en un nouveau à la personne qui vous a invité.
          </p>
        </template>

        <template v-else-if="done">
          <p class="mt-4 text-sm text-gray-600">
            Votre mot de passe est enregistré. Vous pouvez maintenant vous connecter.
          </p>
          <Button
            class="mt-6 w-full"
            variant="primary"
            size="lg"
            @click="router.push('/connexion')"
          >
            Se connecter
          </Button>
        </template>

        <template v-else>
          <p class="mt-2 text-sm text-gray-600">
            Personne d'autre que vous ne le connaîtra.
          </p>

          <form
            class="mt-6 space-y-4"
            @submit.prevent="submit"
          >
            <div>
              <label class="block text-sm font-medium text-gray-700 mb-1">
                Mot de passe
              </label>
              <input
                v-model="password"
                type="password"
                required
                :minlength="MIN_LENGTH"
                autocomplete="new-password"
                class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>

            <div>
              <label class="block text-sm font-medium text-gray-700 mb-1">
                Confirmation
              </label>
              <input
                v-model="confirmation"
                type="password"
                required
                autocomplete="new-password"
                class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>

            <p
              v-if="error"
              class="text-sm text-red-600"
            >
              {{ error }}
            </p>

            <Button
              type="submit"
              variant="primary"
              size="lg"
              class="w-full"
              :loading="submitting"
            >
              Enregistrer
            </Button>
          </form>
        </template>
      </div>
    </div>
  </div>
</template>
