# ADR-0015 — Validation à la frontière : TypeBox / Elysia (pas Zod)

Statut : accepté
Portée : socle

## Contexte

La convention par défaut de l'écosystème (SSOT code-conform) est **Zod** pour la validation. L'API
Échoppe est bâtie sur **Elysia**, dont la validation intégrée repose sur **TypeBox** (`t.Object`), et
qui dérive l'OpenAPI directement des schémas.

## Options envisagées

- **Zod** (défaut global) + adaptateur vers Elysia — double couche, redondance, pas d'OpenAPI natif.
- **TypeBox/Elysia** (built-in) — une seule couche, OpenAPI dérivé, exception explicitement prévue par
  la convention (« Exception : Elysia Treaty — validation built-in »).

## Décision

Validation **à la frontière** via les schémas **TypeBox** d'Elysia. Les schémas nommés de
`apps/api/src/models/*.ts` sont la **SSOT du contrat** : ils servent à la validation runtime **et**
peuplent `components.schemas` de l'OpenAPI (donc le SDK, cf. ADR-0007).
- **Une seule frontière de validation** : parser à l'entrée, truster en interne (invariant philosophy).
- **Projections** : des schémas distincts publient/masquent les champs selon l'audience
  (`variantPublicSchema` masque `costPrice`/`lowStockThreshold`, cf. ADR-0006).
- Zod reste le défaut **hors API Elysia** (autres packages si besoin).

## Conséquences

- Zéro dépendance Zod dans `apps/api`/`packages/core`.
- Le contrat, la validation et la doc proviennent d'une source unique — pas de drift schéma/doc.
- Piège associé : Eden réserve les verbes HTTP comme noms de segment (cf. ADR-0007).
