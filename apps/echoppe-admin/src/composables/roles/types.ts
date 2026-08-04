import { api } from '@/lib/api';
import type { ApiItem } from '@/types/api';

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
  scope: 'admin' | 'store';
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

// Groupes de ressources pour l'UI
export interface ResourceGroup {
  name: string;
  resources: string[];
}

export const RESOURCE_GROUPS: ResourceGroup[] = [
  {
    name: 'Catalogue',
    resources: ['product', 'category', 'collection', 'variant', 'option'],
  },
  {
    name: 'Medias',
    resources: ['media', 'folder'],
  },
  {
    name: 'Commerce',
    resources: ['order', 'cart', 'wishlist', 'invoice'],
  },
  {
    name: 'Clients',
    resources: ['customer', 'address'],
  },
  {
    name: 'Administration',
    resources: ['stock', 'user', 'role', 'permission', 'company', 'shipping_provider', 'payment_config', 'communication_config', 'audit_log'],
  },
  {
    name: 'Referentiel',
    resources: ['country', 'tax_rate'],
  },
];

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
  order: 'Commandes',
  cart: 'Paniers',
  wishlist: 'Listes de souhaits',
  invoice: 'Factures',
  customer: 'Clients',
  address: 'Adresses',
  user: 'Utilisateurs',
  role: 'Roles',
  permission: 'Permissions',
  company: 'Entreprise',
  stock: 'Stock',
  shipping_provider: 'Transporteurs',
  payment_config: 'Paiements',
  communication_config: 'Communications',
  audit_log: "Journal d'audit",
  country: 'Pays',
};
