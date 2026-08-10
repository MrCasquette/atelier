import type { EntityProjection, ReferenceRegistry } from '@repo/references';
import type { MenuItemInput } from './model';

// Résolution et validation d'un arbre de menu. Aucune entité n'est nommée ici : le registre est
// passé en argument, jamais lu depuis un module — c'est ce qui permet à ce fichier de servir deux
// produits qui n'ont pas les mêmes cibles (ADR-0032).

/** Un lien résolu : soit une URL en clair, soit une entité projetée (`null` si elle a disparu). */
export type ResolvedMenuLink =
  | { target: 'url'; url: string; newTab?: boolean }
  | {
      target: string;
      // null si la ref est dangling : entité supprimée, ou cible retirée du registre.
      entity: EntityProjection | null;
      newTab?: boolean;
    };

export interface ResolvedMenuItem {
  label: string;
  link: ResolvedMenuLink;
  children: ResolvedMenuItem[];
}

/** Le lien d'un item désigne-t-il une entité, ou porte-t-il une URL en clair ? */
const isEntityLink = (target: string): boolean => target !== 'url';

/**
 * Cibles citées par un arbre d'items que le registre ne connaît pas.
 *
 * Le schéma ne peut plus les énumérer — c'était le point d'ADR-0032 —, donc la validation
 * d'existence se fait ICI, à l'écriture. Sans elle, ouvrir `target` en `string` échangerait un
 * couplage contre une régression : n'importe quelle faute de frappe entrerait en base pour ne se
 * voir qu'au read, en lien dangling silencieux.
 *
 * Rend les noms fautifs, dédupliqués — pour pouvoir dire à l'appelant CE QUI est refusé.
 */
export function unknownTargets(items: MenuItemInput[], registry: ReferenceRegistry): string[] {
  const unknown = new Set<string>();

  const walk = (nodes: MenuItemInput[]): void => {
    for (const item of nodes) {
      if (isEntityLink(item.link.target) && !registry.has(item.link.target)) {
        unknown.add(item.link.target);
      }
      walk(item.children);
    }
  };
  walk(items);

  return [...unknown];
}

/**
 * Remplace chaque lien d'entité par sa projection `{ id, slug, name }`. Les liens URL passent tels
 * quels.
 *
 * Une requête par cible présente, puis reconstruction de l'arbre. Une cible non inscrite ne fait
 * pas échouer la lecture : son lien est rendu dangling, exactement comme une entité supprimée — un
 * menu écrit avant qu'une entité soit retirée du registre reste lisible.
 *
 * Le front reste maître de l'URL finale : on renvoie slug/name, pas un chemin en dur.
 */
export async function resolveMenuItems(
  items: MenuItemInput[],
  registry: ReferenceRegistry,
): Promise<ResolvedMenuItem[]> {
  const idsByTarget = new Map<string, Set<string>>();

  const collectIds = (nodes: MenuItemInput[]): void => {
    for (const item of nodes) {
      if (isEntityLink(item.link.target)) {
        const ids = idsByTarget.get(item.link.target) ?? new Set<string>();
        ids.add(item.link.value);
        idsByTarget.set(item.link.target, ids);
      }
      collectIds(item.children);
    }
  };
  collectIds(items);

  const projections = new Map<string, Map<string, EntityProjection>>();

  for (const [name, ids] of idsByTarget) {
    const target = registry.get(name);
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
