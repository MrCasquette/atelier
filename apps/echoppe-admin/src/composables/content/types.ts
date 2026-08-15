// Types du module content côté admin, DÉRIVÉS du contrat Eden (SSOT = l'API, elle-même miroir du
// registre @mrcasquette/content). Aucune redéclaration manuelle : le `t.Recursive` du registre est
// narrowé proprement par Eden sur `kind` (union discriminée) — d'où un générateur type-safe.
import type { api } from '@/lib/api';
import type { ApiData, ApiItem } from '@/types/api';

// ── Registre ──────────────────────────────────────────────────────────────────────────────────
export type Registry = ApiData<ReturnType<typeof api.content.registry.get>>;
export type SerializedDefinition = Registry['sections'][string];
// `[number]` et non `[string]` : `fields` est une SÉQUENCE, dont la position porte l'ordre déclaré
// — donc l'ordre d'affichage du formulaire généré (ADR-0049).
export type SerializedField = SerializedDefinition['fields'][number];
export type FieldKind = SerializedField['kind'];

// Extrait la variante du champ correspondant à un `kind` (pour typer les props des widgets).
export type FieldOf<K extends FieldKind> = Extract<SerializedField, { kind: K }>;

export type RefTarget = FieldOf<'ref'>['to'];

// ── Pages ───────────────────────────────────────────────────────────────────────────────────
export type PageListItem = ApiItem<ReturnType<typeof api.content.pages.get>>;
export type PageDetail = ApiData<ReturnType<typeof api.content.pages.post>>;
export type PageStatus = PageDetail['status'];
export type PageSection = PageDetail['sections'][number];

// ── Modèle d'édition local ──────────────────────────────────────────────────────────────────
// La donnée d'un bloc est un dictionnaire éditable ; sa forme fine est garantie par le registre à
// l'écriture (validation serveur P2b). En édition on la manipule en `Record<string, unknown>`.
export type BlockData = Record<string, unknown>;

// Un bloc dans l'éditeur de zone. `key` = identité locale stable (v-for/reorder) indépendante de
// l'`id` serveur (null tant que non persisté).
export interface EditorBlock {
  key: string;
  id: string | null;
  name: string | null;
  type: string;
  data: BlockData;
}
