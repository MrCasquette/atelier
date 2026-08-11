<script setup lang="ts">
import { computed, provide, ref, watch } from 'vue';
import Button from '@/components/atoms/Button.vue';
import Input from '@/components/atoms/Input.vue';
import Label from '@/components/atoms/Label.vue';
import DynamicForm from '@/components/organisms/content/DynamicForm.vue';
import { emptyFieldsData, pruneFields, registryKey } from '@/composables/content/registry';
import type { BlockData, Registry } from '@/composables/content/types';
import type { EntityRow, GrantedEntity } from '@/composables/entities/types';
import type { EntityRowInput } from '@/composables/entities/useEntityRows';

// Édite UNE occurrence. Le formulaire n'est pas écrit : il est GÉNÉRÉ depuis la déclaration, par le
// même générateur que les sections — une entité et une section décrivent leurs champs de la même
// façon (ADR-0026), donc il n'y a rien à réécrire ici.
//
// Le registre est fourni par injection, comme dans l'éditeur de zone : la récursion
// DynamicForm → FieldControl → DynamicForm en a besoin pour résoudre les `component`/`list`.
const props = defineProps<{
  declaration: GrantedEntity;
  registry: Registry;
  row: EntityRow | null;
  saving: boolean;
  canSave: boolean;
  canDelete: boolean;
}>();

const emit = defineEmits<{
  save: [input: EntityRowInput];
  delete: [];
}>();

provide(registryKey, props.registry);

const data = ref<BlockData>({});
const slug = ref('');

// La donnée d'une occurrence arrive PLATE (les champs au premier niveau, à côté d'`id`/`slug`) ;
// le formulaire ne veut que les champs déclarés, et l'écriture les niche sous `data`.
watch(
  () => props.row,
  (row) => {
    const empty = emptyFieldsData(props.declaration.fields, props.registry);
    if (!row) {
      data.value = empty;
      slug.value = '';
      return;
    }
    const filled: BlockData = { ...empty };
    for (const name of Object.keys(props.declaration.fields)) {
      if (row[name] !== undefined && row[name] !== null) filled[name] = row[name];
    }
    data.value = filled;
    slug.value = typeof row.slug === 'string' ? row.slug : '';
  },
  { immediate: true },
);

// Un singleton n'a pas de slug : son identité est son nom (ADR-0039).
const needsSlug = computed(() => !props.declaration.singleton);
const complete = computed(() => !needsSlug.value || slug.value.trim() !== '');

function submit() {
  emit('save', {
    ...(needsSlug.value ? { slug: slug.value.trim() } : {}),
    data: pruneFields(props.declaration.fields, data.value, props.registry),
  });
}
</script>

<template>
  <div class="space-y-6">
    <div class="rounded-lg border border-gray-200 bg-white p-6">
      <div
        v-if="needsSlug"
        class="mb-6 border-b border-gray-100 pb-6"
      >
        <Label required>Slug</Label>
        <Input
          v-model="slug"
          placeholder="mon-occurrence"
        />
        <p class="mt-1 text-xs text-gray-400">
          Identifiant de l'occurrence dans les URL, unique pour cette entité.
        </p>
      </div>

      <DynamicForm
        v-model="data"
        :fields="declaration.fields"
      />
    </div>

    <div class="flex items-center justify-between">
      <Button
        v-if="canDelete && row"
        variant="ghost"
        @click="emit('delete')"
      >
        Supprimer
      </Button>
      <span v-else />

      <Button
        v-if="canSave"
        variant="primary"
        :loading="saving"
        :disabled="!complete"
        @click="submit"
      >
        Enregistrer
      </Button>
      <span
        v-else
        class="text-sm text-gray-400"
      >
        Lecture seule — l'écriture ne vous est pas accordée sur cette entité.
      </span>
    </div>
  </div>
</template>
