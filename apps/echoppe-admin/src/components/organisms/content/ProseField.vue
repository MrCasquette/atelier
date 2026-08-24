<script setup lang="ts">
import { computed, nextTick, ref } from 'vue';
import {
  CORE_DIRECTIVES,
  describeIssue,
  parseProse,
  proseIssues,
  proseToHtml,
  type DirectiveShape,
} from '@axiome-apps/atelier-prose';
import Textarea from '@/components/atoms/Textarea.vue';
import { insertDirective } from '@/composables/content/prose-insert';

// La surface d'édition d'un `richText` : la source, son aperçu, et ce qui ne va pas
// (ADR-0061 §9, ADR-0064).
//
// UN SEUL PARSE sert les trois. L'aperçu est le rendu de PRODUCTION — `proseToHtml` est la même
// fonction que celle d'un front —, et les constats viennent avec lui sans rien coûter de plus.
// C'est ce qui rend cette surface économique autant que juste.
//
// Rien n'est refusé ici, et rien ne l'est non plus à l'écriture (ADR-0064) : la base stocke le
// texte source octet pour octet, un constat s'affiche, et l'auteur corrige ou non. Un brouillon
// reste enregistrable.
const props = defineProps<{
  modelValue: string;
  placeholder?: string;
}>();

const emit = defineEmits<{
  'update:modelValue': [value: string];
}>();

const view = ref<'source' | 'preview'>('source');
const field = ref<InstanceType<typeof Textarea> | null>(null);

// Le parse unique. Tout le reste en descend.
const tree = computed(() => parseProse(props.modelValue));
const html = computed(() => proseToHtml(tree.value));
const issues = computed(() => proseIssues(tree.value).map(describeIssue));

// Le noyau se DÉCOUVRE : la barre n'énumère pas les sept directives, elle lit le registre. Une
// huitième admise au noyau apparaîtra ici sans qu'on y touche.
const directives = computed(() => Object.entries(CORE_DIRECTIVES));

/**
 * L'élément derrière l'atome, pour connaître la sélection.
 *
 * `$el` est typé `any` par Vue : le `instanceof` est ce qui le réduit, et c'est une garde vraie —
 * un composant à racine multiple rendrait un fragment, et l'insertion se replierait alors en fin
 * de texte plutôt que de casser.
 */
function element(): HTMLTextAreaElement | null {
  const node: unknown = field.value?.$el;
  return node instanceof HTMLTextAreaElement ? node : null;
}

/**
 * Insère une directive au curseur — la logique vit dans `prose-insert`, qui est testée.
 *
 * Ce qui reste ici est ce que seul le composant sait : où est le curseur, et où le remettre.
 */
function insert(name: string, shape: DirectiveShape): void {
  const el = element();
  const value = props.modelValue;
  const start = el?.selectionStart ?? value.length;
  const end = el?.selectionEnd ?? value.length;

  const inserted = insertDirective(value, start, end, name, shape);
  emit('update:modelValue', inserted.value);

  nextTick(() => {
    const target = element();
    if (!target) return;
    target.focus();
    target.setSelectionRange(inserted.caret, inserted.caret);
  });
}
</script>

<template>
  <div class="space-y-2">
    <div class="flex items-center justify-between gap-2">
      <!-- Deux vues EXCLUSIVES, la source restant l'unique vérité : il n'y a pas d'aller-retour,
           donc rien à perdre au passage (ADR-0061 §9). -->
      <div class="flex rounded border border-gray-300 text-xs">
        <button
          type="button"
          :class="[
            'px-2 py-1 rounded-l transition',
            view === 'source' ? 'bg-gray-800 text-white' : 'text-gray-600 hover:bg-gray-100',
          ]"
          @click="view = 'source'"
        >
          Source
        </button>
        <button
          type="button"
          :class="[
            'px-2 py-1 rounded-r transition',
            view === 'preview' ? 'bg-gray-800 text-white' : 'text-gray-600 hover:bg-gray-100',
          ]"
          @click="view = 'preview'"
        >
          Aperçu
        </button>
      </div>

      <div
        v-if="view === 'source'"
        class="flex flex-wrap justify-end gap-1"
      >
        <button
          v-for="[name, spec] in directives"
          :key="name"
          type="button"
          class="px-1.5 py-0.5 text-xs font-mono text-gray-600 border border-gray-200 rounded hover:bg-gray-100 transition"
          :title="`Insérer une directive « ${name} »`"
          @click="insert(name, spec.shape)"
        >
          {{ name }}
        </button>
      </div>
    </div>

    <Textarea
      v-show="view === 'source'"
      ref="field"
      :model-value="modelValue"
      :placeholder="placeholder"
      :rows="10"
      @update:model-value="emit('update:modelValue', $event)"
    />

    <!-- Le HTML vient de `proseToHtml`, close par construction : le HTML brut est refusé au
         tokenizer, les URL sont filtrées et les noms d'attributs sont inertes (ADR-0061 §7).
         C'est le seul emploi de `v-html` que l'ADR §6 autorise, et il est motivé — ici le contenu
         vient de l'éditeur lui-même. -->
    <!-- eslint-disable vue/no-v-html -->
    <div
      v-show="view === 'preview'"
      class="prose-preview min-h-[10rem] px-2.5 py-1.5 text-sm border border-gray-300 rounded"
      v-html="html"
    />
    <!-- eslint-enable vue/no-v-html -->

    <!-- Les constats, sous le champ, à qui tient le texte sous les yeux. Ils n'empêchent rien
         d'enregistrer (ADR-0064 §2). -->
    <ul
      v-if="issues.length > 0"
      class="space-y-0.5 text-xs text-amber-700"
    >
      <li
        v-for="issue in issues"
        :key="issue"
      >
        {{ issue }}
      </li>
    </ul>
  </div>
</template>

<style scoped>
/* Les directives se stylent par leur `data-*`, jamais par une classe (ADR-0061 §5). Ce dessin-ci
   n'est pas un thème : il rend seulement les frontières VISIBLES, pour que l'auteur voie ce qu'il
   vient d'écrire. Un thème réel remplacera ces règles sans toucher au contenu. */
.prose-preview :deep(p) {
  margin-bottom: 0.5rem;
}

.prose-preview :deep([data-directive]) {
  display: block;
  padding: 0.5rem 0.75rem;
  margin-bottom: 0.5rem;
  border-left: 3px solid var(--color-gray-400);
  background: var(--color-gray-50);
}

.prose-preview :deep([data-directive='warning']) {
  border-left-color: var(--color-amber-500);
}

.prose-preview :deep([data-directive='highlight']) {
  display: inline;
  padding: 0 0.15rem;
  border-left: none;
  background: var(--color-amber-100);
}

/* Ce qui n'est pas au noyau traverse sans garantie de style — on le signale plutôt que de le
   déguiser en directive dessinée (ADR-0061 §4). */
.prose-preview :deep([data-directive]::before) {
  content: attr(data-directive);
  display: block;
  margin-bottom: 0.25rem;
  font-size: 0.65rem;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: var(--color-gray-500);
}

.prose-preview :deep([data-directive='highlight']::before) {
  display: none;
}
</style>
