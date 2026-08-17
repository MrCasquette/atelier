<script setup lang="ts">
import { computed, ref } from 'vue';
import { responseExamples } from '../lib/openapi';

const props = defineProps<{ name: string }>();

const items = computed(() => responseExamples(props.name));
const active = ref(items.value[0]?.code ?? '200');
const current = computed(() => items.value.find((i) => i.code === active.value) ?? items.value[0]);

const isOk = (code: string) => code.startsWith('2');

// Coloration JSON minimale (clés / chaînes / nombres / booléens / null) → style IDE.
const escapeHtml = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

function highlight(json: string): string {
  return escapeHtml(json).replace(
    /("(?:\\.|[^"\\])*"(\s*:)?|\b(?:true|false)\b|\bnull\b|-?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?)/g,
    (m) => {
      let cls = 'tok-num';
      if (m.startsWith('"')) cls = /:\s*$/.test(m) ? 'tok-key' : 'tok-str';
      else if (m === 'true' || m === 'false') cls = 'tok-bool';
      else if (m === 'null') cls = 'tok-null';
      return `<span class="${cls}">${m}</span>`;
    },
  );
}
</script>

<template>
  <div class="resp">
    <div class="resp-tabs">
      <button
        v-for="i in items"
        :key="i.code"
        :class="['resp-tab', isOk(i.code) ? 'ok' : 'err', { active: i.code === active }]"
        @click="active = i.code"
      >
        {{ i.code }}
      </button>
    </div>
    <pre class="resp-code"><code v-html="highlight(current.json)" /></pre>
  </div>
</template>

<style scoped>
.resp {
  border: 1px solid var(--vp-c-divider);
  border-radius: 8px;
  overflow: hidden;
}
.resp-tabs {
  display: flex;
  gap: 0.25rem;
  padding: 0.35rem 0.5rem;
  background: var(--vp-c-bg-soft);
  border-bottom: 1px solid var(--vp-c-divider);
}
.resp-tab {
  font-family: var(--vp-font-family-mono);
  font-size: 0.78rem;
  font-weight: 600;
  padding: 0.15rem 0.6rem;
  border-radius: 5px;
  border: 1px solid transparent;
  background: transparent;
  cursor: pointer;
  opacity: 0.6;
}
.resp-tab.ok {
  color: var(--vp-c-green-1);
}
.resp-tab.err {
  color: var(--vp-c-red-1);
}
.resp-tab.active {
  opacity: 1;
  border-color: var(--vp-c-divider);
  background: var(--vp-c-bg);
}
.resp-code {
  margin: 0;
  padding: 0.85rem 1rem;
  background: var(--vp-code-block-bg);
  /* Colonne étroite (mode API) : on enroule le JSON plutôt que de scroller. */
  white-space: pre-wrap;
  overflow-wrap: anywhere;
  font-family: var(--vp-font-family-mono);
  font-size: 0.82rem;
  line-height: 1.55;
}
.resp-code :deep(.tok-key) {
  color: var(--vp-c-brand-1);
}
.resp-code :deep(.tok-str) {
  color: var(--vp-c-green-2);
}
.resp-code :deep(.tok-num) {
  color: var(--vp-c-yellow-2, #d98e00);
}
.resp-code :deep(.tok-bool),
.resp-code :deep(.tok-null) {
  color: var(--vp-c-purple-2, #8250df);
}
</style>
