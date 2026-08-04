<script setup lang="ts">
import { ref, computed, watch } from 'vue';
import Modal from '@/components/atoms/Modal.vue';
import Button from '@/components/atoms/Button.vue';
import Label from '@/components/atoms/Label.vue';
import Input from '@/components/atoms/Input.vue';
import Select from '@/components/atoms/Select.vue';
import Toggle from '@/components/atoms/Toggle.vue';
import { api } from '@/lib/api';
import type { PersonalizationField } from '@/composables/product';

const props = defineProps<{
  productId: string;
  field?: PersonalizationField | null;
  onClose: () => void;
  onSaved: () => void;
}>();

const isNew = computed(() => !props.field);
const saving = ref(false);

const form = ref({
  label: '',
  type: 'text' as 'text' | 'textarea',
  required: false,
  maxLength: '' as string,
  priceHt: '' as string,
});

const typeOptions = [
  { value: 'text', label: 'Texte court' },
  { value: 'textarea', label: 'Texte long' },
];

watch(
  () => props.field,
  (f) => {
    form.value = f
      ? {
          label: f.label,
          type: f.type,
          required: f.required,
          maxLength: f.maxLength != null ? String(f.maxLength) : '',
          priceHt: f.priceHt ?? '',
        }
      : { label: '', type: 'text', required: false, maxLength: '', priceHt: '' };
  },
  { immediate: true },
);

async function save() {
  if (!form.value.label.trim()) return;
  saving.value = true;

  const payload = {
    label: form.value.label.trim(),
    type: form.value.type,
    required: form.value.required,
    maxLength: form.value.maxLength ? parseInt(form.value.maxLength, 10) : null,
    priceHt: form.value.priceHt ? parseFloat(form.value.priceHt) : 0,
  };

  try {
    const fields = api.products({ id: props.productId })['personalization-fields'];
    if (isNew.value) {
      await fields.post(payload);
    } else if (props.field) {
      await fields({ fieldId: props.field.id }).put(payload);
    }
    props.onSaved();
  } finally {
    saving.value = false;
  }
}
</script>

<template>
  <Modal
    :title="isNew ? 'Nouveau champ de personnalisation' : 'Modifier le champ'"
    size="lg"
    @close="onClose"
  >
    <div class="space-y-5">
      <div>
        <Label required>Libellé</Label>
        <Input
          v-model="form.label"
          placeholder="Prénom"
          size="lg"
        />
      </div>

      <div class="grid grid-cols-2 gap-5">
        <div>
          <Label>Type de saisie</Label>
          <Select
            v-model="form.type"
            :options="typeOptions"
            size="lg"
          />
        </div>
        <div>
          <Label>Longueur max</Label>
          <input
            v-model="form.maxLength"
            type="number"
            min="1"
            placeholder="Illimité"
            class="w-full px-3 py-2 border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
        </div>
      </div>

      <div>
        <Label>Supplément HT</Label>
        <div class="relative">
          <input
            v-model="form.priceHt"
            type="number"
            step="0.01"
            min="0"
            placeholder="0.00"
            class="w-full px-3 py-2 pr-10 border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
          <span class="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400">€</span>
        </div>
      </div>

      <div class="flex items-start justify-between gap-4 rounded border border-gray-200 p-3">
        <div>
          <Label>Saisie obligatoire</Label>
          <p class="text-xs text-gray-500">
            Le client doit remplir ce champ pour commander.
          </p>
        </div>
        <Toggle v-model="form.required" />
      </div>
    </div>

    <template #footer>
      <div class="flex justify-end gap-3">
        <Button
          variant="ghost"
          @click="onClose"
        >
          Annuler
        </Button>
        <Button
          variant="primary"
          :disabled="saving || !form.label.trim()"
          @click="save"
        >
          {{ isNew ? 'Créer' : 'Enregistrer' }}
        </Button>
      </div>
    </template>
  </Modal>
</template>
