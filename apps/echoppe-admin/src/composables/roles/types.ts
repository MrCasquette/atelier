import type { api } from '@/lib/api';
import type { ApiData, ApiItem } from '@/types/api';

// Types inférés depuis Eden
export type Role = ApiItem<ReturnType<typeof api.roles.get>>;

export type Permission = {
  id: string;
  role: string;
  resource: string;
  canCreate: boolean;
  canRead: boolean;
  canUpdate: boolean;
  canDelete: boolean;
  selfOnly: boolean;
  locked: boolean;
};

export type RoleWithPermissions = Role & {
  permissions: Permission[];
};

// Données du formulaire
export interface RoleFormData {
  name: string;
  description: string | null;
  scope: 'admin' | 'public';
}

export interface PermissionFormData {
  resource: string;
  canCreate: boolean;
  canRead: boolean;
  canUpdate: boolean;
  canDelete: boolean;
  selfOnly: boolean;
  locked: boolean;
}

/** Une ressource protégeable, telle que `GET /roles/resources` la rend. */
export type ProtectableResource = ApiData<
  ReturnType<typeof api.roles.resources.get>
>['resources'][number];

// Groupes de ressources pour l'UI
export interface ResourceGroup {
  name: string;
  resources: ProtectableResource[];
}

// L'ORDRE et le RANGEMENT sont une affaire d'interface ; la LISTE, elle, vient du serveur. Cette
// carte ne dit donc pas ce qui existe — elle dit seulement où poser ce qui existe déjà.
const GROUP_OF_RESOURCE: Record<string, string> = {
  product: 'Catalogue',
  category: 'Catalogue',
  collection: 'Catalogue',
  variant: 'Catalogue',
  option: 'Catalogue',
  media: 'Medias',
  folder: 'Medias',
  order: 'Commerce',
  cart: 'Commerce',
  wishlist: 'Commerce',
  invoice: 'Commerce',
  customer: 'Clients',
  address: 'Clients',
  content: 'Contenu',
  schema: 'Contenu',
  stock: 'Administration',
  user: 'Administration',
  role: 'Administration',
  permission: 'Administration',
  identity: 'Administration',
  shipping_provider: 'Administration',
  payment_config: 'Administration',
  communication_config: 'Administration',
  audit_log: 'Administration',
  api_key: 'Administration',
  country: 'Referentiel',
  tax_rate: 'Referentiel',
};

const GROUP_ORDER = [
  'Catalogue',
  'Contenu',
  'Entités',
  'Medias',
  'Commerce',
  'Clients',
  'Administration',
  'Referentiel',
];

/** Groupe de repli : une ressource que cet écran ne connaît pas doit rester VISIBLE. */
const UNGROUPED = 'Autres';

const ENTITY_PREFIX = 'entity:';

/**
 * Range les ressources rendues par le serveur en groupes affichables.
 *
 * Rien n'est filtré : une ressource née après cet écran — une entité déclarée, une ressource
 * ajoutée au socle — tombe dans « Autres » plutôt que de disparaître. C'est ce qui manquait, et ce
 * qui a rendu `content`, `api_key` et `schema` inaccordables depuis l'interface.
 */
export function groupResources(resources: ProtectableResource[]): ResourceGroup[] {
  const groups = new Map<string, ProtectableResource[]>();

  for (const resource of resources) {
    const name = resource.name.startsWith(ENTITY_PREFIX)
      ? 'Entités'
      : (GROUP_OF_RESOURCE[resource.name] ?? UNGROUPED);
    const members = groups.get(name);
    if (members) members.push(resource);
    else groups.set(name, [resource]);
  }

  const ordered = [...GROUP_ORDER, UNGROUPED].filter((name) => groups.has(name));
  return ordered.map((name) => ({ name, resources: groups.get(name) ?? [] }));
}

/**
 * Libellé d'une ressource : celui que le serveur déclare s'il existe — une entité porte le sien —
 * sinon la traduction du vocabulaire du framework, sinon le nom brut.
 */
export function resourceLabel(resource: ProtectableResource): string {
  return resource.label ?? RESOURCE_LABELS[resource.name] ?? resource.name;
}

// Labels français pour les ressources
export const RESOURCE_LABELS: Record<string, string> = {
  product: 'Produits',
  category: 'Categories',
  collection: 'Collections',
  variant: 'Variantes',
  option: 'Options',
  tax_rate: 'Taux de TVA',
  media: 'Medias',
  folder: 'Dossiers',
  content: 'Pages et contenus',
  // Redéfinir ce qu'EST un contenu, pas l'éditer. Ce droit tient au rang : le serveur refuse de le
  // déléguer à qui ne le détient pas (ADR-0038).
  schema: 'Structure du contenu',
  api_key: "Clés d'API",
  order: 'Commandes',
  cart: 'Paniers',
  wishlist: 'Listes de souhaits',
  invoice: 'Factures',
  customer: 'Clients',
  address: 'Adresses',
  user: 'Utilisateurs',
  role: 'Roles',
  permission: 'Permissions',
  identity: 'Identité du site',
  stock: 'Stock',
  shipping_provider: 'Transporteurs',
  payment_config: 'Paiements',
  communication_config: 'Communications',
  audit_log: "Journal d'audit",
  country: 'Pays',
};
