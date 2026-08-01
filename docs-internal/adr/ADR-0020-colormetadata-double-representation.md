# ADR-0020 — ColorMetadata : représentation double verrouillée (pas un drift)

Statut : accepté · 2026-07-18
Portée : échoppe

## Contexte

La couleur oklch portée par une valeur d'option (`option.type = 'color'`) existe sous **deux formes**
dans le code :

1. `packages/core/src/db/schema/catalog.ts` — `interface ColorMetadata { l, c, h, alpha }`, qui
   **type la colonne `jsonb`** (`optionValue.metadata` via `.$type<OptionValueMetadata>()`).
2. `apps/api/src/models/catalog.ts` — `colorMetadataSchema` (TypeBox), qui **valide à la frontière**
   HTTP (bornes structurelles) et **peuple le contrat OpenAPI/SDK**.

Un audit a signalé ça comme « double source de vérité » (écart potentiel vs frontière unique de
validation, philosophy §5).

## Options envisagées

1. **TypeBox seul** + dériver le type TS via `Static<>` pour typer la colonne Drizzle. Supprime
   l'interface, mais fait dépendre `packages/core` (couche DB, sans HTTP) de TypeBox/Elysia — couplage
   inversé indésirable (le cœur ne doit pas importer la couche API).
2. **Interface TS seule** + revalider à la main dans la route. Perd la validation déclarative et le
   contrat OpenAPI.
3. **Garder les deux, verrouillés par un garde-fou compile-time** (état actuel).

## Décision

**Option 3 — c'est le pattern voulu, pas un écart.** Les deux formes servent des rôles distincts et
non fusionnables sans casser une frontière de couche :

- l'`interface` vit dans `core` (couche DB pure, zéro dépendance HTTP) et type le `jsonb` ;
- le `TypeBox` vit dans `api` (couche frontière) et valide + documente.

La **cohérence structurelle** est garantie au build par le garde-fou dans `models/catalog.ts` :

```ts
type _ColorMetadataMatchesSSOT =
  Static<typeof colorMetadataSchema> extends ColorMetadata
    ? ColorMetadata extends Static<typeof colorMetadataSchema> ? true : never
    : never;
const _colorMetadataInSync: _ColorMetadataMatchesSSOT = true;
```

Toute divergence de forme entre l'interface (`core`) et le schéma (`api`) **casse la compilation**.
La frontière unique de validation (philosophy §5) est respectée : la validation runtime a lieu **une
seule fois**, à la frontière API (TypeBox) ; l'interface ne valide rien, elle type. `core` reste la
SSOT de la *forme*, `api` la SSOT des *bornes*.

## Conséquences

- Aucun changement de code. Décision documentée pour clore la question à chaque audit.
- Contrainte à maintenir : le garde-fou `_ColorMetadataMatchesSSOT` ne doit jamais être supprimé ni
  contourné (`@ts-ignore`). S'il gêne, c'est qu'une des deux formes a divergé → corriger la forme,
  pas le garde-fou.
- Pattern réutilisable : toute donnée `jsonb` typée côté `core` **et** validée côté `api` suit le même
  schéma (interface core + TypeBox api + guard `Static<> extends` bidirectionnel).
