// État d'édition d'une page : métadonnées + zone dynamique (blocs). Charge le détail, expose des
// modèles éditables, et sauvegarde en deux temps (PATCH métadonnées + PUT sections). La validation
// fine par bloc est faite côté serveur (registre P2b) → on remonte le message 422 tel quel.
import { ref } from 'vue';
import { api } from '@/lib/api';
import { pruneFields } from './registry';
import type { BlockData, EditorBlock, PageDetail, PageSection, PageStatus, Registry } from './types';

interface PageMeta {
  slug: string;
  title: string;
  seoTitle: string;
  seoDescription: string;
  status: PageStatus;
}

export interface SaveResult {
  ok: boolean;
  message?: string;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

// La donnée serveur est `unknown` (validée à l'écriture contre le registre) → on la truste comme
// dictionnaire éditable, sans cast (narrowing par garde).
function toBlockData(data: unknown): BlockData {
  return isRecord(data) ? data : {};
}

function toEditorBlock(section: PageSection): EditorBlock {
  return {
    key: crypto.randomUUID(),
    id: section.id,
    name: section.name,
    type: section.type,
    data: toBlockData(section.data),
  };
}

// Message d'erreur Eden (422 registre, 409 slug, …) : `error.value` porte `{ message }`.
function errorMessage(error: { value: unknown }, fallback: string): string {
  const value = error.value;
  if (isRecord(value) && typeof value.message === 'string') return value.message;
  return fallback;
}

export function usePageEditor() {
  const page = ref<PageDetail | null>(null);
  const blocks = ref<EditorBlock[]>([]);
  const loading = ref(true);
  const saving = ref(false);

  const meta = ref<PageMeta>({
    slug: '',
    title: '',
    seoTitle: '',
    seoDescription: '',
    status: 'draft',
  });

  async function load(id: string) {
    loading.value = true;
    const { data } = await api.content.pages({ id }).get();
    if (data) {
      page.value = data;
      meta.value = {
        slug: data.slug,
        title: data.title,
        seoTitle: data.seoTitle ?? '',
        seoDescription: data.seoDescription ?? '',
        status: data.status,
      };
      blocks.value = data.sections.map(toEditorBlock);
    }
    loading.value = false;
  }

  async function save(id: string, registry: Registry): Promise<SaveResult> {
    saving.value = true;
    try {
      const patch = await api.content.pages({ id }).patch({
        slug: meta.value.slug,
        title: meta.value.title,
        seoTitle: meta.value.seoTitle || null,
        seoDescription: meta.value.seoDescription || null,
        status: meta.value.status,
      });
      if (patch.error) {
        return { ok: false, message: errorMessage(patch.error, 'Échec de la mise à jour de la page') };
      }

      // Sérialisation à la frontière : on omet les champs vides (cf. pruneFields) pour ne pas
      // heurter la validation de format serveur (date/uuid). Type inconnu du registre → bloc ignoré.
      const put = await api.content.pages({ id }).sections.put(
        blocks.value.map((block) => {
          const def = registry.sections[block.type];
          return {
            name: block.name ?? undefined,
            type: block.type,
            data: def ? pruneFields(def.fields, block.data, registry) : block.data,
          };
        }),
      );
      if (put.error) {
        return { ok: false, message: errorMessage(put.error, 'Certains blocs sont invalides') };
      }
      if (put.data) blocks.value = put.data.map(toEditorBlock);
      return { ok: true };
    } finally {
      saving.value = false;
    }
  }

  return { page, blocks, meta, loading, saving, load, save };
}
