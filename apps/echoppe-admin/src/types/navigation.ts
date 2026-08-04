import type { BadgeVariant } from './ui';

export interface NavItemBadge {
  /** Clé unique pour identifier le badge (ex: 'pendingOrders', 'outOfStock') */
  key: string;
  /** Variante du badge */
  variant: BadgeVariant;
}

export interface NavItem {
  /** Nom affiché dans la sidebar */
  name: string;
  /** Chemin de la route */
  path: string;
  /** Path SVG Heroicons (outline, stroke) */
  icon: string;
  /** Configuration du badge (optionnel) */
  badge?: NavItemBadge;
}

export interface NavSection {
  /** Titre de la section (ex: 'TABLEAU DE BORD') */
  title: string;
  /** Items de navigation de cette section */
  items: NavItem[];
}

export type NavigationConfig = NavSection[];
