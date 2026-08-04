<script setup lang="ts">
import { onMounted, ref } from 'vue';
import { useRouter } from 'vue-router';
import Button from '@/components/atoms/Button.vue';
import ConfirmModal from '@/components/atoms/ConfirmModal.vue';
import Input from '@/components/atoms/Input.vue';
import Label from '@/components/atoms/Label.vue';
import Modal from '@/components/atoms/Modal.vue';
import { useMenus } from '@/composables/content/useMenus';
import { useToast } from '@/composables/useToast';
import type { MenuListItem } from '@/composables/content/menuTypes';

// Liste des menus de navigation : créer, éditer (→ éditeur d'arbre), supprimer.
const router = useRouter();
const toast = useToast();
const { menus, loading, saving, load, createMenu, deleteMenu } = useMenus();

const createOpen = ref(false);
const form = ref({ label: '', handle: '' });
const menuToDelete = ref<MenuListItem | null>(null);

onMounted(load);

// Handle auto depuis le libellé (clé technique stable : main, footer…).
function slugify(value: string): string {
  return value
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
}

function openCreate() {
  form.value = { label: '', handle: '' };
  createOpen.value = true;
}

async function submitCreate() {
  const created = await createMenu({ label: form.value.label, handle: form.value.handle });
  if (created) {
    createOpen.value = false;
    toast.success('Menu créé');
    router.push({ name: 'content-menu-edit', params: { id: created.id } });
  } else {
    toast.error('Impossible de créer le menu (handle déjà utilisé ?)');
  }
}

async function confirmDelete() {
  if (!menuToDelete.value) return;
  const ok = await deleteMenu(menuToDelete.value.id);
  toast[ok ? 'success' : 'error'](ok ? 'Menu supprimé' : 'Échec de la suppression');
  menuToDelete.value = null;
}
</script>

<template>
  <div class="p-6">
    <div class="mb-6 flex items-center justify-between">
      <div>
        <h1 class="text-xl font-semibold text-gray-900">
          Menus
        </h1>
        <p class="text-sm text-gray-500">
          Menus de navigation (arbre d'items).
        </p>
      </div>
      <Button
        variant="primary"
        @click="openCreate"
      >
        + Nouveau menu
      </Button>
    </div>

    <p
      v-if="loading"
      class="py-10 text-center text-sm text-gray-400"
    >
      Chargement…
    </p>

    <p
      v-else-if="menus.length === 0"
      class="rounded-lg border border-dashed border-gray-300 py-10 text-center text-sm text-gray-400"
    >
      Aucun menu. Créez-en un pour commencer.
    </p>

    <table
      v-else
      class="w-full overflow-hidden rounded-lg border border-gray-200 bg-white text-sm"
    >
      <thead class="border-b border-gray-100 text-left text-xs uppercase text-gray-400">
        <tr>
          <th class="px-4 py-3 font-medium">
            Libellé
          </th>
          <th class="px-4 py-3 font-medium">
            Handle
          </th>
          <th class="px-4 py-3" />
        </tr>
      </thead>
      <tbody class="divide-y divide-gray-100">
        <tr
          v-for="m in menus"
          :key="m.id"
          class="cursor-pointer hover:bg-gray-50"
          @click="router.push({ name: 'content-menu-edit', params: { id: m.id } })"
        >
          <td class="px-4 py-3 font-medium text-gray-800">
            {{ m.label }}
          </td>
          <td class="px-4 py-3 font-mono text-xs text-gray-500">
            {{ m.handle }}
          </td>
          <td class="px-4 py-3 text-right">
            <button
              type="button"
              class="text-gray-400 hover:text-red-500"
              @click.stop="menuToDelete = m"
            >
              Supprimer
            </button>
          </td>
        </tr>
      </tbody>
    </table>

    <Modal
      v-if="createOpen"
      title="Nouveau menu"
      size="md"
      @close="createOpen = false"
    >
      <div class="space-y-4">
        <div>
          <Label required>Libellé</Label>
          <Input
            :model-value="form.label"
            placeholder="Navigation principale"
            @update:model-value="form.label = $event; form.handle = slugify($event)"
          />
        </div>
        <div>
          <Label required>Handle</Label>
          <Input
            v-model="form.handle"
            placeholder="main"
          />
          <p class="mt-1 text-xs text-gray-400">
            Clé stable fetchée par le front (ex. main, footer).
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
            :disabled="!form.label || !form.handle"
            @click="submitCreate"
          >
            Créer
          </Button>
        </div>
      </template>
    </Modal>

    <ConfirmModal
      :open="menuToDelete !== null"
      title="Supprimer le menu"
      :message="`Supprimer « ${menuToDelete?.label} » ? Cette action est irréversible.`"
      confirm-label="Supprimer"
      @confirm="confirmDelete"
      @cancel="menuToDelete = null"
    />
  </div>
</template>
