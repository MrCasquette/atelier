import { ref } from 'vue';
import { api } from '@/lib/api';
import type { ApiData, ApiItem } from '@/types/api';

// Clé d'API telle que listée (sans le secret — jamais renvoyé après création).
export type ApiKey = ApiItem<ReturnType<(typeof api)['api-keys']['get']>>;
// Clé fraîchement créée : porte le secret en clair (`key`), affiché UNE seule fois.
export type CreatedApiKey = ApiData<ReturnType<(typeof api)['api-keys']['post']>>;
// Vocabulaire de scopes, dérivé du contrat Eden : le body du POST porte la vraie union littérale
// `read:<ressource>` / `write:<ressource>` (cf. t.Unsafe<ApiKeyScope> côté API).
export type Scope = NonNullable<
  Parameters<(typeof api)['api-keys']['post']>[0]
>['scopes'][number];

export interface ApiKeyFormData {
  name: string;
  scopes: Scope[];
  expiresAt: string | null; // ISO date-time, ou null (jamais)
}

export function useApiKeys() {
  const keys = ref<ApiKey[]>([]);
  // Scopes disponibles, dérivés des ressources RBAC (miroir de la dérivation serveur).
  const scopes = ref<Scope[]>([]);
  const loading = ref(true);
  const saving = ref(false);

  // Ensemble des scopes valides (rempli au chargement) : garde de type pour narrower `string`
  // (construit depuis les ressources) vers le littéral `Scope` sans cast.
  const known = new Set<string>();
  const isScope = (value: string): value is Scope => known.has(value);

  async function loadKeys() {
    loading.value = true;
    const { data } = await api['api-keys'].get();
    if (data) keys.value = data;
    loading.value = false;
  }

  async function loadScopes() {
    const { data } = await api.roles.resources.get();
    if (!data) return;
    known.clear();
    // `api_key` exclu : une clé ne peut jamais être scopée sur les clés (cf. plugin apiKey).
    const derived = data.resources
      .filter((resource) => resource !== 'api_key')
      .flatMap((resource) => [`read:${resource}`, `write:${resource}`]);
    for (const scope of derived) known.add(scope);
    scopes.value = derived.filter(isScope);
  }

  async function createKey(form: ApiKeyFormData): Promise<CreatedApiKey | null> {
    saving.value = true;
    const { data, error } = await api['api-keys'].post({
      name: form.name,
      scopes: form.scopes,
      expiresAt: form.expiresAt,
    });
    saving.value = false;
    if (!error && data) {
      await loadKeys();
      return data;
    }
    return null;
  }

  async function revokeKey(id: string): Promise<boolean> {
    const { error } = await api['api-keys']({ id }).delete();
    if (!error) {
      await loadKeys();
      return true;
    }
    return false;
  }

  return {
    keys,
    scopes,
    loading,
    saving,
    loadKeys,
    loadScopes,
    createKey,
    revokeKey,
  };
}
