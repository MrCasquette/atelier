<script setup lang="ts">
import { computed } from 'vue';
import { anchor, modelNames, schemaName, schemas } from '../lib/openapi';
import SchemaFields from './SchemaFields.vue';

const props = defineProps<{ name: string }>();

const schema = computed(() => schemas[props.name]);

// Modèle de type tableau dont l'élément est un autre modèle documenté → simple lien.
const arrayItemModel = computed(() => {
  const s = schema.value;
  if (s?.type !== 'array' || !s.items) return null;
  const item = schemaName(s.items);
  return item && modelNames.includes(item) ? item : null;
});
const fieldsSchema = computed(() =>
  schema.value?.type === 'array' && schema.value.items ? schema.value.items : schema.value,
);
</script>

<template>
  <div class="model-doc">
    <p
      v-if="schema?.description"
      class="model-desc"
    >
      {{ schema.description }}
    </p>

    <p
      v-if="arrayItemModel"
      class="array-note"
    >
      Tableau de <a :href="'#' + anchor(arrayItemModel)"><code>{{ arrayItemModel }}</code></a>.
    </p>
    <template v-else>
      <p class="section-label">
        Propriétés
      </p>
      <SchemaFields :schema="fieldsSchema" />
    </template>
  </div>
</template>

<style scoped>
.model-doc {
  margin-bottom: 0.5rem;
}
.model-desc {
  color: var(--vp-c-text-2);
  margin: 0 0 0.75rem;
}
.section-label {
  font-size: 0.7rem;
  font-weight: 700;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  color: var(--vp-c-text-3);
  margin: 0 0 0.25rem;
}
.array-note {
  margin: 0 0 0.5rem;
}
</style>
