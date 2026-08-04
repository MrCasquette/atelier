<script setup lang="ts">
import Toggle from '@/components/atoms/Toggle.vue';
import Button from '@/components/atoms/Button.vue';
import Badge from '@/components/atoms/Badge.vue';
import IconButton from '@/components/atoms/IconButton.vue';
import EditIcon from '@/components/atoms/icons/EditIcon.vue';
import TrashIcon from '@/components/atoms/icons/TrashIcon.vue';
import type { PersonalizationField } from '@/composables/product';

defineProps<{
  enabled: boolean;
  fields: PersonalizationField[];
}>();

const emit = defineEmits<{
  'update:enabled': [value: boolean];
  add: [];
  edit: [field: PersonalizationField];
  remove: [fieldId: string];
}>();

const typeLabel: Record<string, string> = { text: 'Texte court', textarea: 'Texte long' };
</script>

<template>
  <div class="bg-white rounded-lg shadow p-6 space-y-6">
    <!-- Toggle d'activation -->
    <div class="flex items-start justify-between gap-4">
      <div>
        <h3 class="text-sm font-semibold text-gray-900">
          Personnalisation du produit
        </h3>
        <p class="text-sm text-gray-500">
          Autorise le client à personnaliser le produit (ex. gravure d'un prénom). Un supplément de
          prix peut s'appliquer par champ rempli.
        </p>
      </div>
      <Toggle
        :model-value="enabled"
        @update:model-value="emit('update:enabled', $event)"
      />
    </div>

    <!-- Gestion des champs (si activé) -->
    <template v-if="enabled">
      <div class="border-t border-gray-100 pt-6">
        <div class="flex items-center justify-between mb-4">
          <h4 class="text-sm font-medium text-gray-700">
            Champs
            <span class="ml-1 text-xs text-gray-400">{{ fields.length }}</span>
          </h4>
          <Button
            size="sm"
            @click="emit('add')"
          >
            Ajouter un champ
          </Button>
        </div>

        <p
          v-if="fields.length === 0"
          class="text-sm text-gray-400 py-6 text-center"
        >
          Aucun champ. Ajoutez-en un (ex. « Prénom »).
        </p>

        <ul
          v-else
          class="divide-y divide-gray-100"
        >
          <li
            v-for="field in fields"
            :key="field.id"
            class="flex items-center gap-3 py-3"
          >
            <div class="flex-1 min-w-0">
              <div class="flex items-center gap-2">
                <span class="font-medium text-gray-900">{{ field.label }}</span>
                <Badge
                  v-if="field.required"
                  variant="warning"
                  size="sm"
                >
                  Requis
                </Badge>
              </div>
              <div class="text-xs text-gray-500 mt-0.5">
                {{ typeLabel[field.type] ?? field.type }}
                <template v-if="field.maxLength">
                  · max {{ field.maxLength }}
                </template>
                <template v-if="parseFloat(field.priceHt) > 0">
                  · +{{ field.priceHt }} €
                </template>
              </div>
            </div>
            <IconButton
              variant="ghost"
              size="sm"
              title="Modifier"
              class="text-gray-400 hover:text-blue-600 hover:bg-blue-50"
              @click="emit('edit', field)"
            >
              <EditIcon class="w-4 h-4" />
            </IconButton>
            <IconButton
              variant="ghost"
              size="sm"
              title="Supprimer"
              class="text-gray-400 hover:text-red-600 hover:bg-red-50"
              @click="emit('remove', field.id)"
            >
              <TrashIcon class="w-4 h-4" />
            </IconButton>
          </li>
        </ul>
      </div>
    </template>
  </div>
</template>
