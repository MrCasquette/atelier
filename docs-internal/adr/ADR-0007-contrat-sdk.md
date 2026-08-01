# ADR-0007 — Contrat API & SDK figé (OpenAPI SSOT, Eden interne / SDK externe)

Statut : accepté · 2026-07-06
Portée : client

## Contexte

Un front agnostique « se connecte via l'API » = découplage. Le dashboard interne, lui, est
co-versionné dans le monorepo et peut se permettre un couplage fort pour la DX.

## Options envisagées

- **A. Types Eden `@echoppe/api` publiés** — DX max (inférence directe) mais couplage de version fort,
  TS-only, publie des deps serveur.
- **B. SDK npm généré depuis OpenAPI `@echoppe/client`** — versionnable, découplé, types propres.
- **C. Front génère son client localement depuis `openapi.json`** — zéro couplage, multi-langage, mais
  pas de SDK prêt à l'emploi.

## Décision

- **Eden Treaty pour le dashboard interne** (co-versionné) ; **SDK OpenAPI (B) pour les boutiques
  externes**.
- L'OpenAPI est **dérivé du code** (schémas TypeBox `t.Object` de `apps/api/src/models/*` = SSOT),
  exposé sur `/docs/json`. Le SDK fige un `openapi.json` (filtré sur la **surface storefront**) puis
  génère les types (`openapi-typescript`) + client fetch (`openapi-fetch`, `credentials:'include'`).
- Régénération : `bun run --cwd packages/client generate` contre une API à jour. Astuce offline :
  booter `app` (pur, `apps/api/src/app.ts`) sur :7533 sans migrations/DB.

## Conséquences

- Toute évolution de contrat storefront → **régénérer** `packages/client/{openapi.json,src/openapi.ts}`
  et aligner les versions api/admin/SDK.
- Les projections publiques (`variantPublicSchema`, `productDetailSchema`…) définissent ce qui fuit
  vers le SDK — jamais les champs internes (cf. ADR-0006).
- **Piège Eden verbe réservé** : ne pas nommer un segment de route comme un verbe HTTP si le client
  Eden passe un param dessus (ex. `/options` → renommé `/option-axes`). Type-check ne le voit pas.

## Détail

→ [distribution-architecture.md](../reference/distribution-architecture.md) (§ contrat API, § SDK).
