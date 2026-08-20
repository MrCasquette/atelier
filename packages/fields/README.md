# `@repo/fields` — la grammaire d'un champ

Ce que le paquet livre : **ce qu'un champ est, et ce qu'il accepte**. Rien d'autre.

Une section et une entité décrivent leurs champs de la même façon
([ADR-0026](../../docs-internal/adr/ADR-0026-sections-entites.md)) : c'est la pièce
qu'[ADR-0012](../../docs-internal/adr/ADR-0012-module-contenu.md) désigne comme « le point
d'architecture central », et la seule qu'elles partagent intégralement.

## Frontière

| Ici | Chez le propriétaire |
|---|---|
| La forme sérialisée d'un champ (`model.ts`) | La traduction champ → colonne SQL (`@repo/entities/ddl.ts`) |
| La traduction champ → validateur TypeBox (`compile.ts`) | Le registre à deux rôles et son stockage (`@repo/pages`) |
| L'unicité des noms, vérifiable sur tous les chemins d'écriture | La décision de refuser une poussée |

Une déclaration d'un côté, une politique de l'autre.

## Ce que le paquet ne fait pas

- **Aucun accès base.** La grammaire se teste sans `DATABASE_URL`, et c'est délibéré : `bun test src`
  suffit.
- **Aucune route.** Conformément à [ADR-0044](../../docs-internal/adr/ADR-0044-surface-http-paquets-partages.md).
- **Aucune connaissance des entités du produit.** La cible d'un champ `ref` est un *nom* inscrit au
  registre de références, pas une union fermée
  ([ADR-0032](../../docs-internal/adr/ADR-0032-cibles-referencables.md)) ; son existence se vérifie à
  la synchronisation, pas dans la grammaire.

## Dépendances

`elysia` seule, et uniquement pour `t` et son type-system. C'est la **même instance TypeBox** que le
reste de l'API : aucune version à maintenir, aucune dérive possible entre ce qui valide ici et ce qui
valide sur une route.

## Deux points à connaître avant de modifier

**Le schéma existe en deux exemplaires.** `serializedFieldShape` (TypeBox) valide au runtime ;
`SerializedField` (TypeScript, écrit à la main) est ce qu'Elysia sait comparer. C'est un
contournement de framework, pas un modèle — il disparaîtra quand l'inférence récursive d'Elysia
encaissera un tableau. La duplication n'est tolérable que **verrouillée** : `model.test.ts` fait
échouer la compilation à la moindre divergence. Détail complet dans
[ADR-0049](../../docs-internal/adr/ADR-0049-schema-sequence-de-champs.md) §7.

**Un nom de champ commence par une lettre.** Ce n'est pas cosmétique : JavaScript énumère les clés
qui ressemblent à un index de tableau **en tête**, donc `{ titre, '2024', corps }` sort dans le
désordre. Le brouillage a lieu à l'écriture, hors de portée de la sérialisation comme du stockage —
on refuse donc le cas plutôt que de promettre un ordre qu'on ne tiendrait pas.

## Histoire

Le paquet vivait dans `@repo/pages` par accident d'ordre d'extraction : les champs ne sont pas une
affaire de pages, et `@repo/entities` en dépendait à l'envers du bon sens (#35).

## Vocabulaire

`docs-internal/glossaire.md`, ratifié par
[ADR-0043](../../docs-internal/adr/ADR-0043-lexique-contenu.md).
