import type { EntityProjection } from '@repo/references';
import { references } from '../reference/targets';
import type { MenuItemInput, ResolvedMenuItem } from './model';

// Résolution des refs internes d'un menu au read storefront : chaque lien vers une entité est
// remplacé par sa projection { id, slug, name } (null si dangling). Les liens URL passent tels
// quels.
//
// Ce résolveur ne connaît AUCUNE entité (ADR-0032). Il groupe les identifiants par cible, demande
// au registre de les projeter — une requête par cible présente, comme avant —, puis reconstruit
// l'arbre. Une cible non inscrite ne fait pas échouer la lecture : son lien est rendu dangling,
// exactement comme une entité supprimée. Un menu écrit avant qu'une entité soit retirée du
// registre reste lisible.
//
// Le front reste maître de l'URL finale : on renvoie slug/name, pas un chemin en dur.

/** Le lien d'un item désigne-t-il une entité, ou porte-t-il une URL en clair ? */
const isEntityLink = (target: string): boolean => target !== 'url';

/**
 * Cibles citées par un arbre d'items que le registre ne connaît pas.
 *
 * Le contrat ne peut plus les énumérer — c'était le point d'ADR-0032 —, donc la validation
 * d'existence se fait ICI, à l'écriture. Sans elle, ouvrir `target` en `string` échangerait un
 * couplage contre une régression : n'importe quelle faute de frappe entrerait en base pour ne se
 * voir qu'au read, en lien dangling silencieux.
 *
 * Rend les noms fautifs, dédupliqués — pour pouvoir dire à l'appelant CE QUI est refusé.
 */
export function unknownTargets(items: MenuItemInput[]): string[] {
  const unknown = new Set<string>();

  const walk = (nodes: MenuItemInput[]): void => {
    for (const item of nodes) {
      if (isEntityLink(item.link.target) && !references.has(item.link.target)) {
        unknown.add(item.link.target);
      }
      walk(item.children);
    }
  };
  walk(items);

  return [...unknown];
}

function collectIds(items: MenuItemInput[], acc: Map<string, Set<string>>): void {
  for (const item of items) {
    if (isEntityLink(item.link.target)) {
      const ids = acc.get(item.link.target) ?? new Set<string>();
      ids.add(item.link.value);
      acc.set(item.link.target, ids);
    }
    collectIds(item.children, acc);
  }
}

export async function resolveMenuItems(items: MenuItemInput[]): Promise<ResolvedMenuItem[]> {
  const idsByTarget = new Map<string, Set<string>>();
  collectIds(items, idsByTarget);

  const projections = new Map<string, Map<string, EntityProjection>>();

  for (const [name, ids] of idsByTarget) {
    const target = references.get(name);
    if (!target) continue; // cible retirée du registre → liens rendus dangling, pas d'échec

    const rows = await target.project([...ids]);
    projections.set(name, new Map(rows.map((row) => [row.id, row])));
  }

  const resolve = (nodes: MenuItemInput[]): ResolvedMenuItem[] =>
    nodes.map((item): ResolvedMenuItem => {
      const { link } = item;
      return {
        label: item.label,
        link: isEntityLink(link.target)
          ? {
              target: link.target,
              entity: projections.get(link.target)?.get(link.value) ?? null,
              newTab: link.newTab,
            }
          : { target: 'url', url: link.value, newTab: link.newTab },
        children: resolve(item.children),
      };
    });

  return resolve(items);
}
