# `@repo/menus` — la navigation

Des liens ordonnés vers ce que le registre de références déclare. Un menu n'est pas une page : il
**pointe** vers des choses, dont des pages — d'où son propre paquet plutôt qu'un coin de
`@repo/pages`.

## Frontière

**Aucune route, aucun plugin Elysia** — le contrat de lecture front appartient au produit, parce
qu'il décrit ce qu'une route rend
([ADR-0044](../../docs-internal/adr/ADR-0044-surface-http-paquets-partages.md)). Les définitions de
tables sont livrées comme définitions
([ADR-0025](../../docs-internal/adr/ADR-0025-deux-produits-un-repo.md)).

**Aucune entité n'est nommée ici.** Le registre de références est passé en argument, jamais lu depuis
un module : c'est ce qui permet à `service.ts` de servir deux produits qui n'ont pas les mêmes
cibles.

## Pourquoi ce paquet a attendu ADR-0032

Tant que la cible d'un lien énumérait `product`, `collection`, `category`, la colonne `items` faisait
entrer le vocabulaire du commerce dans tout socle qui l'aurait accueillie. La cible est désormais un
**nom**, et le registre dit lesquels existent
([ADR-0032](../../docs-internal/adr/ADR-0032-cibles-referencables.md)).

Conséquence directe : le schéma ne peut plus énumérer les cibles, donc **l'existence se vérifie à
l'écriture** (`unknownTargets`). Sans cette garde, ouvrir `target` en `string` échangerait un couplage
contre une régression — n'importe quelle faute de frappe entrerait en base pour ne se voir qu'au
read, en lien dangling silencieux.

## Le contrat de robustesse en lecture

`resolveMenuItems` **ne fait jamais échouer une lecture**. Une entité supprimée comme une cible
retirée du registre rendent un lien *dangling* (`entity: null`) : un menu écrit avant qu'une entité
soit retirée reste lisible. C'est vérifié par les tests, parce que c'est une promesse et pas un effet
de bord.

Le front reste maître de l'URL finale : on rend `{ id, slug, name }`, jamais un chemin en dur.

## Deux pièges de récursion

- **Le schéma** : `t.Recursive` avec un thunk `Self`, pas une copie inline. Et son `Static` s'effondre
  (`children: never[]`), d'où le `t.Unsafe<MenuItem[]>` — le runtime valide l'arbre, le contrat porte
  le vrai type. `MenuItem` est la SSOT du shape.
- **Les parcours** : `unknownTargets` et `resolveMenuItems` descendent à profondeur illimitée.
  `resolveMenuItems` ne fait **qu'une projection par cible**, quel que soit le nombre de liens.

## Dépendances

`@repo/references`, `drizzle-orm`, `elysia` (pour `t` uniquement).
