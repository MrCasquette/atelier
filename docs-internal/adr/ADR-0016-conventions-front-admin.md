# ADR-0016 — Conventions front admin (atomic design, imports directs, types Eden)

Statut : accepté
Portée : socle

## Contexte

Le dashboard admin (Vue 3) grossit ; sans conventions partagées, la structure des composants, des
types et des états dérive. Il faut des règles stables, lisibles et outillables.

## Options envisagées

- Laisser libre — divergence, duplication.
- Fixer un petit socle de conventions structurantes, documenté et outillé (lint).

## Décision

- **Atomic design** : `components/{atoms,molecules,organisms}` (+ `templates`, `icons` au besoin) ;
  pas de `src/ui/`.
- **Imports directs des composants Vue** (pas de barrel `index.ts`) ; barrels tolérés pour
  composables/types/utils.
- **Types depuis Eden Treaty (OBLIGATOIRE)** : jamais d'interface manuelle pour les données API — on
  infère (`Awaited<ReturnType<typeof api.x.get>>`). Contrat interne co-versionné (cf. ADR-0007).
- **Composables** : un par feature, retour `{ state, actions }` ; organisms « dumb » ; logique métier
  déléguée aux helpers du concept (pas dans le composant).
- **Variants** : `Record<Variant, classes>` par défaut ; `tailwind-variants` seulement si combinatoire.

## Conséquences

- Cohérence et revue facilitées ; règles partiellement imposées par ESLint/Biome.
- Symétrie attendue pour les nouveaux écrans (ex. onglet personnalisation, cf. ADR-0010).

## Détail

→ [PATTERNS.md](../reference/PATTERNS.md)
