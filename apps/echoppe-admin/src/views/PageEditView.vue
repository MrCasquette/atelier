<script setup lang="ts">
import { computed, onMounted } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import Button from '@/components/atoms/Button.vue';
import Input from '@/components/atoms/Input.vue';
import Label from '@/components/atoms/Label.vue';
import Select from '@/components/atoms/Select.vue';
import Textarea from '@/components/atoms/Textarea.vue';
import SectionZoneEditor from '@/components/organisms/content/SectionZoneEditor.vue';
import { useContentRegistry } from '@/composables/content/useContentRegistry';
import { usePageEditor } from '@/composables/content/usePageEditor';
import { useToast } from '@/composables/useToast';
import type { PageStatus } from '@/composables/content/types';

// Éditeur d'une page : métadonnées SEO + zone dynamique (sections). Charge le registre (définitions)
// et le détail de la page ; sauvegarde métadonnées puis sections (validées côté serveur).
const route = useRoute();
const router = useRouter();
const toast = useToast();

const { registry, load: loadRegistry } = useContentRegistry();
const { blocks, meta, loading, saving, load: loadPage, save } = usePageEditor();

const pageId = computed(() => String(route.params.id));

const statusOptions = [
  { value: 'draft', label: 'Brouillon' },
  { value: 'published', label: 'Publiée' },
];

function setStatus(value: string) {
  meta.value.status = value === 'published' ? 'published' : 'draft';
}

onMounted(async () => {
  await Promise.all([loadRegistry(), loadPage(pageId.value)]);
});

async function onSave() {
  if (!registry.value) return;
  const result = await save(pageId.value, registry.value);
  if (result.ok) {
    toast.success('Page enregistrée');
  } else {
    toast.error(result.message ?? 'Échec de l’enregistrement');
  }
}

const statusValue = computed<PageStatus>(() => meta.value.status);
</script>

<template>
  <div class="p-6">
    <!-- Barre d'actions -->
    <div class="mb-6 flex items-center justify-between">
      <div class="flex items-center gap-3">
        <button
          type="button"
          class="text-sm text-gray-400 hover:text-gray-600"
          @click="router.push({ name: 'content-pages' })"
        >
          ← Pages
        </button>
        <h1 class="text-xl font-semibold text-gray-900">
          {{ meta.title || 'Page' }}
        </h1>
      </div>
      <div class="flex items-center gap-2">
        <div class="w-40">
          <Select
            :model-value="statusValue"
            :options="statusOptions"
            @update:model-value="setStatus"
          />
        </div>
        <Button
          variant="primary"
          :loading="saving"
          @click="onSave"
        >
          Enregistrer
        </Button>
      </div>
    </div>

    <p
      v-if="loading"
      class="py-10 text-center text-sm text-gray-400"
    >
      Chargement…
    </p>

    <div
      v-else
      class="space-y-6"
    >
      <!-- Métadonnées -->
      <section class="rounded-lg border border-gray-200 bg-white p-4">
        <h2 class="mb-4 text-sm font-semibold text-gray-700">
          Métadonnées
        </h2>
        <div class="grid grid-cols-1 gap-4 md:grid-cols-2">
          <div>
            <Label required>Titre</Label>
            <Input v-model="meta.title" />
          </div>
          <div>
            <Label required>Slug</Label>
            <Input v-model="meta.slug" />
          </div>
          <div>
            <Label>Titre SEO</Label>
            <Input
              v-model="meta.seoTitle"
              placeholder="Par défaut : le titre"
            />
          </div>
          <div>
            <Label>Description SEO</Label>
            <Textarea
              v-model="meta.seoDescription"
              :rows="2"
            />
          </div>
        </div>
      </section>

      <!-- Zone dynamique -->
      <section>
        <h2 class="mb-3 text-sm font-semibold text-gray-700">
          Sections
        </h2>
        <SectionZoneEditor
          v-if="registry"
          v-model="blocks"
          :registry="registry"
        />
        <p
          v-else
          class="text-sm text-gray-400"
        >
          Chargement du registre…
        </p>
      </section>
    </div>
  </div>
</template>
