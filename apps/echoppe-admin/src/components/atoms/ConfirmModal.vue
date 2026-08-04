<script setup lang="ts">
import Button from './Button.vue';
import WarningIcon from './icons/WarningIcon.vue';

defineProps<{
  open: boolean;
  title?: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
}>();

const emit = defineEmits<{
  confirm: [];
  cancel: [];
}>();
</script>

<template>
  <Teleport to="body">
    <div
      v-if="open"
      class="fixed inset-0 bg-black/50 flex items-center justify-center z-50"
      @click.self="emit('cancel')"
    >
      <div class="bg-white rounded-lg shadow-xl max-w-md w-full mx-4 overflow-hidden">
        <div class="p-6">
          <div class="flex items-start gap-4">
            <div class="flex-shrink-0 w-10 h-10 bg-red-100 rounded-full flex items-center justify-center">
              <WarningIcon class="text-red-600" />
            </div>
            <div class="flex-1">
              <h3 class="text-lg font-semibold text-gray-900">
                {{ title || 'Confirmation' }}
              </h3>
              <p class="mt-2 text-sm text-gray-600">
                {{ message }}
              </p>
            </div>
          </div>
        </div>

        <div class="px-6 py-4 bg-gray-50 flex justify-end gap-3">
          <Button
            variant="secondary"
            size="lg"
            @click="emit('cancel')"
          >
            {{ cancelLabel || 'Annuler' }}
          </Button>
          <Button
            variant="danger"
            size="lg"
            @click="emit('confirm')"
          >
            {{ confirmLabel || 'Confirmer' }}
          </Button>
        </div>
      </div>
    </div>
  </Teleport>
</template>
