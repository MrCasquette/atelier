<script setup lang="ts">
import { computed, onMounted } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import Button from '@/components/atoms/Button.vue';
import Input from '@/components/atoms/Input.vue';
import Label from '@/components/atoms/Label.vue';
import MenuItemTree from '@/components/organisms/content/menu/MenuItemTree.vue';
import { useMenuEditor } from '@/composables/content/useMenuEditor';
import { useToast } from '@/composables/useToast';

// Éditeur d'un menu : libellé + arbre d'items récursif. Sauvegarde via PUT (items validés serveur).
const route = useRoute();
const router = useRouter();
const toast = useToast();

const { handle, label, items, loading, saving, load, save } = useMenuEditor();

const menuId = computed(() => String(route.params.id));

onMounted(() => load(menuId.value));

async function onSave() {
  const result = await save(menuId.value);
  if (result.ok) {
    toast.success('Menu enregistré');
  } else {
    toast.error(result.message ?? 'Échec de l’enregistrement');
  }
}
</script>

<template>
  <div class="p-6">
    <div class="mb-6 flex items-center justify-between">
      <div class="flex items-center gap-3">
        <button
          type="button"
          class="text-sm text-gray-400 hover:text-gray-600"
          @click="router.push({ name: 'content-menus' })"
        >
          ← Menus
        </button>
        <h1 class="text-xl font-semibold text-gray-900">
          {{ label || 'Menu' }}
        </h1>
        <span class="font-mono text-xs text-gray-400">{{ handle }}</span>
      </div>
      <Button
        variant="primary"
        :loading="saving"
        @click="onSave"
      >
        Enregistrer
      </Button>
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
      <section class="rounded-lg border border-gray-200 bg-white p-4">
        <div class="max-w-sm">
          <Label required>Libellé</Label>
          <Input v-model="label" />
        </div>
      </section>

      <section>
        <h2 class="mb-3 text-sm font-semibold text-gray-700">
          Items
        </h2>
        <MenuItemTree v-model="items" />
      </section>
    </div>
  </div>
</template>
