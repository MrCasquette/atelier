// Fabriques d'items/liens de menu vides (à la création d'un nœud). Pur — pas de logique dans les
// composants de l'éditeur.
import type { MenuItem, MenuLink } from './menuTypes';

export const emptyMenuLink = (): MenuLink => ({ target: 'url', value: '', newTab: false });

export const emptyMenuItem = (): MenuItem => ({
  label: '',
  link: emptyMenuLink(),
  children: [],
});
