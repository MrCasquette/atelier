<script setup lang="ts">
import Label from '@/components/atoms/Label.vue';
import RichTextEditor from '@/components/atoms/RichTextEditor.vue';
import TagsInput from '@/components/molecules/TagsInput.vue';

const name = defineModel<string>('name', { required: true });
const description = defineModel<string>('description', { required: true });
const tags = defineModel<string[]>('tags', { required: true });
</script>

<template>
  <div class="bg-white rounded-lg shadow p-6">
    <h3 class="font-medium text-gray-900 mb-4">
      Informations principales
    </h3>
    <div class="space-y-4">
      <div>
        <Label required>Nom du produit</Label>
        <input
          v-model="name"
          type="text"
          required
          class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          placeholder="Nom du produit"
        />
      </div>

      <div>
        <Label>Description</Label>
        <RichTextEditor
          :content="description"
          :on-change="(html) => description = html"
          placeholder="Description du produit..."
          min-height="200px"
        />
      </div>

      <div>
        <Label>Tags</Label>
        <TagsInput v-model="tags" />
        <p class="mt-1 text-xs text-gray-500">
          Étiquettes storefront (ex. « Nouveauté », « Personnalisable »). Entrée ou virgule pour
          ajouter.
        </p>
      </div>
    </div>
  </div>
</template>
