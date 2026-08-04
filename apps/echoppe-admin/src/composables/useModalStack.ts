import { ref, computed, onMounted, onUnmounted } from 'vue';

const modalCount = ref(0);

export function useModalStack() {
  const level = ref(0);

  onMounted(() => {
    modalCount.value++;
    level.value = modalCount.value;
  });

  onUnmounted(() => {
    modalCount.value--;
  });

  const zIndex = computed(() => 50 + level.value * 10);

  return { zIndex, level };
}
