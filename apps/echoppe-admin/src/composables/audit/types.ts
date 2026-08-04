import type { api } from '@/lib/api';

// Types inférés depuis l'API
type AuditLogsResponse = Awaited<ReturnType<typeof api['audit-logs']['get']>>['data'];
type AuditLogsData = NonNullable<AuditLogsResponse>['data'];
export type AuditLog = AuditLogsData[number];
export type AuditLogUser = NonNullable<AuditLog['user']>;

// Filtres
export interface AuditFilters {
  action?: string;
  entityType?: string;
  userId?: string;
  dateFrom?: string;
  dateTo?: string;
}

// Labels pour les actions (catégorisées)
export const ACTION_CATEGORIES: Record<string, { label: string; color: string }> = {
  create: { label: 'Création', color: 'green' },
  update: { label: 'Modification', color: 'blue' },
  delete: { label: 'Suppression', color: 'red' },
  login: { label: 'Connexion', color: 'purple' },
  logout: { label: 'Déconnexion', color: 'gray' },
  status_change: { label: 'Changement statut', color: 'orange' },
  upload: { label: 'Upload', color: 'cyan' },
  config_update: { label: 'Configuration', color: 'yellow' },
  refund: { label: 'Remboursement', color: 'pink' },
  anonymize: { label: 'Anonymisation', color: 'gray' },
};

// Labels pour les types d'entités
export const ENTITY_TYPE_LABELS: Record<string, string> = {
  product: 'Produit',
  variant: 'Variante',
  category: 'Catégorie',
  collection: 'Collection',
  order: 'Commande',
  user: 'Utilisateur',
  role: 'Rôle',
  permission: 'Permission',
  media: 'Média',
  folder: 'Dossier',
  company: 'Entreprise',
  customer: 'Client',
  stock: 'Stock',
  shipment: 'Expédition',
  payment: 'Paiement',
};

/**
 * Extrait la catégorie d'action à partir du nom complet (ex: "product.create" -> "create")
 */
export function getActionCategory(action: string): string {
  const parts = action.split('.');
  return parts[parts.length - 1] ?? action;
}

/**
 * Retourne le style de badge pour une action donnée
 */
export function getActionBadgeStyle(action: string): { label: string; color: string } {
  const category = getActionCategory(action);
  return ACTION_CATEGORIES[category] ?? { label: category, color: 'gray' };
}

/**
 * Formate une action pour l'affichage (ex: "product.create" -> "Produit créé")
 */
export function formatAction(action: string): string {
  const [entity, verb] = action.split('.');
  const entityLabel = entity ? ENTITY_TYPE_LABELS[entity] ?? entity : '';
  const verbLabels: Record<string, string> = {
    create: 'créé',
    update: 'modifié',
    delete: 'supprimé',
    login: 'connexion',
    logout: 'déconnexion',
    status_change: 'statut modifié',
    upload: 'uploadé',
    config_update: 'configuré',
    refund: 'remboursé',
    anonymize: 'anonymisé',
    cancel: 'annulé',
    received: 'reçu',
    adjust: 'ajusté',
  };
  const verbLabel = verb ? verbLabels[verb] ?? verb : '';
  return `${entityLabel} ${verbLabel}`.trim();
}
