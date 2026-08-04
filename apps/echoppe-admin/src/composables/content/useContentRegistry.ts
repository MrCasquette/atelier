// Charge le registre des définitions (GET /content/registry) et le partage entre les vues et la
// récursion du générateur. Cache module-level : un seul fetch par session admin (le registre ne
// change qu'au `content:push` du dev).
import { ref } from 'vue';
import { api } from '@/lib/api';
import type { Registry } from './types';

const registry = ref<Registry | null>(null);
const loading = ref(false);
let loaded = false;

export function useContentRegistry() {
  async function load(force = false) {
    if ((loaded || loading.value) && !force) return;
    loading.value = true;
    const { data } = await api.content.registry.get();
    if (data) {
      registry.value = data;
      loaded = true;
    }
    loading.value = false;
  }

  return { registry, loading, load };
}
