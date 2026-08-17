<script setup lang="ts">
import { type JsonSchema, anchor, linkedModel, objectChild, renderType } from '../lib/openapi';

const props = defineProps<{ schema: JsonSchema }>();

const required = new Set(props.schema.required ?? []);
const entries = Object.entries(props.schema.properties ?? {});
</script>

<template>
  <div class="fields">
    <div
      v-for="[key, prop] in entries"
      :key="key"
      class="field"
    >
      <div class="field-main">
        <span class="field-id">
          <code class="field-name">{{ key }}</code>
          <a
            v-if="linkedModel(prop)"
            class="badge link"
            :href="'#' + anchor(linkedModel(prop)!)"
          >{{ linkedModel(prop) }}{{ prop.type === 'array' ? '[]' : '' }}</a>
          <span
            v-else
            class="badge type"
          >{{ renderType(prop) }}</span>
          <span
            v-if="!required.has(key)"
            class="badge optional"
          >optionnel</span>
        </span>
        <span class="field-desc">{{ prop.description }}</span>
      </div>

      <details
        v-if="!linkedModel(prop) && objectChild(prop)"
        class="nested"
      >
        <summary>Propriétés</summary>
        <SchemaFields :schema="objectChild(prop)!" />
      </details>
    </div>
  </div>
</template>

<style scoped>
.field {
  padding: 0.4rem 0;
  border-top: 1px solid var(--vp-c-divider);
}
.field:first-child {
  border-top: none;
}
.field-main {
  display: grid;
  grid-template-columns: minmax(11rem, 16rem) 1fr;
  gap: 0.25rem 1.25rem;
  align-items: baseline;
  min-height: 1.9rem;
}
.field-id {
  display: flex;
  align-items: center;
  gap: 0.4rem;
  flex-wrap: wrap;
}
.field-name {
  font-weight: 600;
  color: var(--vp-c-brand-1);
  font-size: 0.85rem;
}
.badge {
  font-family: var(--vp-font-family-mono);
  font-size: 0.72rem;
  padding: 0.05rem 0.4rem;
  border-radius: 5px;
  line-height: 1.5;
  white-space: nowrap;
}
.badge.type {
  background: var(--vp-c-default-soft);
  color: var(--vp-c-text-2);
}
.badge.optional {
  background: transparent;
  color: var(--vp-c-text-3);
  border: 1px solid var(--vp-c-divider);
}
.badge.link {
  background: var(--vp-c-brand-soft);
  color: var(--vp-c-brand-1);
  text-decoration: none;
  font-weight: 600;
}
.badge.link:hover {
  text-decoration: underline;
}
.field-desc {
  font-size: 0.86rem;
  color: var(--vp-c-text-2);
  align-self: center;
}
.nested {
  margin-top: 0.4rem;
  border-left: 2px solid var(--vp-c-divider);
  padding-left: 1rem;
}
.nested > summary {
  cursor: pointer;
  font-size: 0.8rem;
  font-weight: 600;
  color: var(--vp-c-text-3);
  user-select: none;
  padding: 0.35rem 0;
}
.nested > summary:hover {
  color: var(--vp-c-brand-1);
}
/* Une fois déroulé : séparer le label du contenu, et aérer le bas de l'objet. */
.nested[open] > summary {
  margin-bottom: 0.6rem;
}
.nested[open] {
  padding-bottom: 0.3rem;
}

@media (max-width: 640px) {
  .field-main {
    grid-template-columns: 1fr;
    gap: 0.15rem;
  }
}
</style>
