<script setup lang="ts">
import { onMounted, ref } from 'vue';
import { useRouter } from 'vue-router';
import Badge from '@/components/atoms/Badge.vue';
import Button from '@/components/atoms/Button.vue';
import ConfirmModal from '@/components/atoms/ConfirmModal.vue';
import Input from '@/components/atoms/Input.vue';
import Label from '@/components/atoms/Label.vue';
import Modal from '@/components/atoms/Modal.vue';
import { usePages } from '@/composables/content/usePages';
import { useToast } from '@/composables/useToast';
import type { PageListItem } from '@/composables/content/types';

// Liste des pages du page builder : créer, éditer (→ éditeur de zone), supprimer.
const router = useRouter();
const toast = useToast();
const { pages, loading, saving, load, createPage, deletePage } = usePages();

const createOpen = ref(false);
const form = ref({ title: '', slug: '' });

const pageToDelete = ref<PageListItem | null>(null);

onMounted(load);

// Slug auto depuis le titre tant que l'utilisateur ne l'a pas édité manuellement.
function slugify(value: string): string {
  return value
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
}

function openCreate() {
  form.value = { title: '', slug: '' };
  createOpen.value = true;
}

async function submitCreate() {
  const created = await createPage({ title: form.value.title, slug: form.value.slug });
  if (created) {
    createOpen.value = false;
    toast.success('Page créée');
    router.push({ name: 'content-page-edit', params: { id: created.id } });
  } else {
    toast.error('Impossible de créer la page (slug déjà utilisé ?)');
  }
}

async function confirmDelete() {
  if (!pageToDelete.value) return;
  const ok = await deletePage(pageToDelete.value.id);
  toast[ok ? 'success' : 'error'](ok ? 'Page supprimée' : 'Échec de la suppression');
  pageToDelete.value = null;
}
</script>

<template>
  <div class="p-6">
    <div class="mb-6 flex items-center justify-between">
      <div>
        <h1 class="text-xl font-semibold text-gray-900">
          Pages
        </h1>
        <p class="text-sm text-gray-500">
          Pages de contenu composées de sections.
        </p>
      </div>
      <Button
        variant="primary"
        @click="openCreate"
      >
        + Nouvelle page
      </Button>
    </div>

    <p
      v-if="loading"
      class="py-10 text-center text-sm text-gray-400"
    >
      Chargement…
    </p>

    <p
      v-else-if="pages.length === 0"
      class="rounded-lg border border-dashed border-gray-300 py-10 text-center text-sm text-gray-400"
    >
      Aucune page. Créez-en une pour commencer.
    </p>

    <table
      v-else
      class="w-full overflow-hidden rounded-lg border border-gray-200 bg-white text-sm"
    >
      <thead class="border-b border-gray-100 text-left text-xs uppercase text-gray-400">
        <tr>
          <th class="px-4 py-3 font-medium">
            Titre
          </th>
          <th class="px-4 py-3 font-medium">
            Slug
          </th>
          <th class="px-4 py-3 font-medium">
            Statut
          </th>
          <th class="px-4 py-3" />
        </tr>
      </thead>
      <tbody class="divide-y divide-gray-100">
        <tr
          v-for="p in pages"
          :key="p.id"
          class="cursor-pointer hover:bg-gray-50"
          @click="router.push({ name: 'content-page-edit', params: { id: p.id } })"
        >
          <td class="px-4 py-3 font-medium text-gray-800">
            {{ p.title }}
          </td>
          <td class="px-4 py-3 text-gray-500">
            /{{ p.slug }}
          </td>
          <td class="px-4 py-3">
            <Badge :variant="p.status === 'published' ? 'success' : 'default'">
              {{ p.status === 'published' ? 'Publiée' : 'Brouillon' }}
            </Badge>
          </td>
          <td class="px-4 py-3 text-right">
            <button
              type="button"
              class="text-gray-400 hover:text-red-500"
              @click.stop="pageToDelete = p"
            >
              Supprimer
            </button>
          </td>
        </tr>
      </tbody>
    </table>

    <!-- Création -->
    <Modal
      v-if="createOpen"
      title="Nouvelle page"
      size="md"
      @close="createOpen = false"
    >
      <div class="space-y-4">
        <div>
          <Label required>Titre</Label>
          <Input
            :model-value="form.title"
            placeholder="À propos"
            @update:model-value="form.title = $event; form.slug = slugify($event)"
          />
        </div>
        <div>
          <Label required>Slug</Label>
          <Input
            v-model="form.slug"
            placeholder="a-propos"
          />
          <p class="mt-1 text-xs text-gray-400">
            URL de la page : /{{ form.slug || '…' }}
          </p>
        </div>
      </div>
      <template #footer>
        <div class="flex justify-end gap-2">
          <Button
            variant="ghost"
            @click="createOpen = false"
          >
            Annuler
          </Button>
          <Button
            variant="primary"
            :loading="saving"
            :disabled="!form.title || !form.slug"
            @click="submitCreate"
          >
            Créer
          </Button>
        </div>
      </template>
    </Modal>

    <ConfirmModal
      :open="pageToDelete !== null"
      title="Supprimer la page"
      :message="`Supprimer « ${pageToDelete?.title} » et toutes ses sections ? Cette action est irréversible.`"
      confirm-label="Supprimer"
      @confirm="confirmDelete"
      @cancel="pageToDelete = null"
    />
  </div>
</template>
