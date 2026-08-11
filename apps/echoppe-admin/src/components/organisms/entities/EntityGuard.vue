<script setup lang="ts">
import type { Registry } from '@/composables/content/types';
import type { GrantedEntity } from '@/composables/entities/types';

// Ce qui doit être vrai avant qu'un écran d'entité puisse rendre : la déclaration est là, le
// registre aussi. Tant que non, on le DIT — un droit qui manque n'est pas une panne, et l'afficher
// comme telle laisse l'utilisateur sans rien à faire.
//
// Le slot n'est rendu qu'une fois les deux résolus : le contenu les reçoit non nuls.
defineProps<{
  ready: boolean;
  declaration: GrantedEntity | null;
  registry: Registry | null;
}>();
</script>

<template>
  <p
    v-if="!ready"
    class="py-10 text-center text-sm text-gray-400"
  >
    Chargement…
  </p>

  <div
    v-else-if="!declaration"
    class="rounded-lg border border-dashed border-gray-300 p-8 text-center"
  >
    <p class="text-sm font-medium text-gray-700">
      Cette entité ne vous est pas accordée.
    </p>
    <p class="mx-auto mt-2 max-w-md text-sm text-gray-500">
      Une entité fraîchement déclarée n'est visible de personne tant qu'un rôle ne la détient pas.
      Un administrateur peut vous l'accorder depuis
      <RouterLink
        to="/parametres?tab=roles"
        class="text-blue-600 hover:underline"
      >
        Paramètres → Rôles &amp; permissions
      </RouterLink>.
    </p>
  </div>

  <div
    v-else-if="!registry"
    class="rounded-lg border border-dashed border-gray-300 p-8 text-center"
  >
    <p class="text-sm font-medium text-gray-700">
      Le registre des définitions n'a pas pu être chargé.
    </p>
    <p class="mx-auto mt-2 max-w-md text-sm text-gray-500">
      Le formulaire est généré depuis les définitions du contenu : sa lecture demande le droit
      <code class="rounded bg-gray-100 px-1 py-0.5 text-xs">content</code> en lecture.
    </p>
  </div>

  <slot
    v-else
    :declaration="declaration"
    :registry="registry"
  />
</template>
