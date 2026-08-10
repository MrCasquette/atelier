# ADR — Architecture Decision Records

Référence **unique et centrale** des décisions structurantes du repo. Chaque décision = un ADR
numéroté. Les ADR sont la **porte d'entrée** ; quand le détail est dense, un ADR *lie* un fichier
détaillé (souvent un doc `docs/internal/` préexistant) qui, lui, survit.

Le repo porte **deux produits** — Échoppe (framework e-commerce) et Prisme (CMS). Chaque ADR déclare
sa **portée**, qui dit où vit le code concerné : `socle` (les raisons d'être du monorepo), un nom de
**package partagé**, `échoppe`, ou `prisme`. Le compteur est **unique et jamais renuméroté** — cf.
[ADR-0024](./ADR-0024-portee-adr.md).

## Format

```
# ADR-000X — <titre>
Statut : accepté | proposé | remplacé par ADR-00YY   ·   Date
Portée : socle | <package> | échoppe | prisme
## Contexte            le problème / la contrainte
## Options envisagées
## Décision
## Conséquences        impacts, dette, suivis
## Détail (optionnel)  → lien vers le fichier détaillé
```

## Index — `socle` · Les raisons d'être du monorepo

| N° | Titre | Statut | Détail |
|----|-------|--------|--------|
| [0002](./ADR-0002-distribution.md) | Distribution : Docker (runtime) + npm (SDK/CLI), modèle déploiement A | accepté | [distribution-architecture.md](../reference/distribution-architecture.md) |
| [0003](./ADR-0003-runtime-pm.md) | Runtime & package manager : PM-agnostique, Bun API / Node front | accepté | [contraintes-outillage.md](../reference/contraintes-outillage.md) |
| [0004](./ADR-0004-migrations-release.md) | Migrations au boot + validation release (compose dev vs prod) | accepté | [release-runbook.md](../release/release-runbook.md) |
| [0015](./ADR-0015-validation-typebox.md) | Validation à la frontière : TypeBox / Elysia (pas Zod) | accepté | — |
| [0016](./ADR-0016-conventions-front-admin.md) | Conventions front admin (atomic design, imports directs, types Eden) | accepté | [PATTERNS.md](../reference/PATTERNS.md) |
| [0023](./ADR-0023-versioning-tags.md) | Versioning : épine `v*` produit, packages versionnés sur npm | accepté | [pipeline-release.md](../release/pipeline-release.md) |
| [0024](./ADR-0024-portee-adr.md) | Portée des ADR : un compteur unique, un champ de portée | accepté | — |
| [0025](./ADR-0025-deux-produits-un-repo.md) | Deux produits, un repo : frontière core / packages | accepté | — |
| [0033](./ADR-0033-organisation-monorepo.md) | Organisation du monorepo : disposition à plat, deux cores, packages partagés | accepté | — |
| [0041](./ADR-0041-hierarchie-autorites.md) | Hiérarchie des autorités : framework → décision produit → SSOT personnelle | accepté | — |
| [0044](./ADR-0044-surface-http-paquets-partages.md) | Un paquet partagé n'expose pas de routes : `service` + `model`, jamais Elysia | accepté | — |
| [0034](./ADR-0034-identite-referentiel-reglages.md) | Identité, référentiel et réglages : ce que l'outil possède | accepté, partiellement amendé par [0040](./ADR-0040-identite-site-entite-legale.md) | — |

## Index — `client` · SDK et contrat d'API

| N° | Titre | Statut | Détail |
|----|-------|--------|--------|
| [0007](./ADR-0007-contrat-sdk.md) | Contrat API & SDK figé (OpenAPI SSOT, Eden interne / SDK externe) | accepté | [distribution-architecture.md](../reference/distribution-architecture.md) |

## Index — `auth` · Authentification et autorisation

| N° | Titre | Statut | Détail |
|----|-------|--------|--------|
| [0008](./ADR-0008-auth-sessions.md) | Auth : sessions Postgres (pas JWT), cookies HTTP-only, RBAC | accepté · amendé par 0037/0038 | [api-keys.md](../reference/api-keys.md) |
| [0013](./ADR-0013-modele-rbac.md) | Modèle RBAC (rôles / permissions) | accepté · amendé par 0037/0038 | [audit-rbac-plan.md](../audits/audit-rbac-plan.md) |
| [0014](./ADR-0014-cles-api-machine.md) | Authentification machine (clés d'API) | accepté | [api-keys.md](../reference/api-keys.md) |
| [0037](./ADR-0037-principaux-surfaces.md) | Principaux, surfaces et sessions : un registre plutôt qu'une union fermée | accepté | — |
| [0038](./ADR-0038-ressources-ouvertes-delegation.md) | Ressources ouvertes, délégation des droits, rôles système | accepté | — |

## Index — `content` · Page-builder, entités, texte riche

| N° | Titre | Statut | Détail |
|----|-------|--------|--------|
| [0012](./ADR-0012-module-contenu.md) | Module contenu / page-builder headless (`@mrcasquette/content`) | accepté | [content-module.md](../reference/content-module.md) |
| [0030](./ADR-0030-texte-riche-markdown.md) | Texte riche : Markdown, attributs sémantiques, saut dur explicite | accepté | — |
| [0031](./ADR-0031-i18n-champs-localises.md) | i18n de contenu : champs localisés, décidé mais non implémenté | accepté | — |
| [0032](./ADR-0032-cibles-referencables.md) | Cibles référençables : le lien déclaré, la résolution ouverte | accepté | — |
| [0035](./ADR-0035-interpolation-variables.md) | Interpolation de variables dans le contenu | accepté | — |
| [0036](./ADR-0036-cycle-de-vie-contenu.md) | Cycle de vie du contenu : un statut déclaré, pas de versionnement | accepté | — |
| [0026](./ADR-0026-sections-entites.md) | Sections et entités : deux natures de contenu | accepté | [lexique-prisme.md](../reference/lexique-prisme.md) |
| [0027](./ADR-0027-entites-tables-reelles.md) | Entités en vraies tables, déclarées en code et poussées | accepté | — |
| [0039](./ADR-0039-entites-singleton.md) | Cardinalité d'une entité : singleton déclaré, borne haute seulement | accepté | — |
| [0043](./ADR-0043-lexique-contenu.md) | Ratification du lexique du contenu, `definition` et le découpage `content` / `menu` | accepté | [lexique-prisme.md](../reference/lexique-prisme.md) |
| [0045](./ADR-0045-cles-etrangeres-entites.md) | Clés étrangères d'une entité : la cible déclare son stockage, `required` dit la politique | accepté | [entites.md](../reference/entites.md) |
| [0046](./ADR-0046-entites-referencables.md) | Une entité déclare son lien : les trois modes résolus, inscription à la poussée | accepté | [entites.md](../reference/entites.md) |

## Index — `assets` · Média et images

| N° | Titre | Statut | Détail |
|----|-------|--------|--------|
| [0018](./ADR-0018-stockage-media.md) | Stockage média (disque local, arbre de dossiers) | accepté | — |
| [0021](./ADR-0021-strategie-images.md) | Stratégie images : pas de resize serveur, dimensions exposées | accepté | — |

## Index — `identity` · Identité du site et entité légale

| N° | Titre | Statut | Détail |
|----|-------|--------|--------|
| [0040](./ADR-0040-identite-site-entite-legale.md) | Identité du site et entité légale : structure commune, exigence par produit | accepté | — |

## Index — `adapters` · Providers externes

| N° | Titre | Statut | Détail |
|----|-------|--------|--------|
| [0011](./ADR-0011-adapters-providers.md) | Adapters de providers externes (paiement / livraison / communication) | accepté | — |

## Index — `échoppe` · Framework e-commerce

| N° | Titre | Statut | Détail |
|----|-------|--------|--------|
| [0001](./ADR-0001-stack-storefront.md) | Stack storefront : Astro hybrid + îlots Vue (topologie B) | accepté | — |
| [0005](./ADR-0005-panier-stock.md) | Panier & stock : capture manuelle Stripe + garde atomique Postgres | accepté | — |
| [0006](./ADR-0006-visibilite-catalogue.md) | Sécurité visibilité catalogue : 404 vs 403, `adminOnly` | accepté | [security-audit.md](../audits/security-audit.md) |
| [0009](./ADR-0009-variante-defaut-image.md) | Variante par défaut (exclusivité + fallback publié) & `featuredImage` | accepté | — |
| [0010](./ADR-0010-personnalisation-produit.md) | Personnalisation produit (champs déclarés, optionnelle par produit) | accepté | — |
| [0017](./ADR-0017-documents-typst.md) | Génération de documents (factures / reçus via Typst) | accepté | — |
| [0019](./ADR-0019-tags-produit.md) | Tags produit (entité gérée + slug, surface storefront) | accepté | — |
| [0020](./ADR-0020-colormetadata-double-representation.md) | ColorMetadata : représentation double verrouillée (pas un drift) | accepté | — |
| [0022](./ADR-0022-produits-lies.md) | Produits liés : curation directionnelle + fallback voisinage | accepté | — |
| [0042](./ADR-0042-structure-api-modules.md) | Structure de l'API : modules Elysia, règle de propriété, `lib/` | accepté | — |

## Index — `prisme` · CMS

| N° | Titre | Statut | Détail |
|----|-------|--------|--------|
| [0028](./ADR-0028-activation-entites.md) | Prisme : activation à la carte, presets, masquer / supprimer | accepté · **V2** | — |
| [0029](./ADR-0029-rendu-generique.md) | Prisme : rendu générique et front livré (V2) | accepté · **V2** | — |

## Conventions (non-ADR)

Pièges récurrents — documentés à part, référencés par les ADR mais sans décision d'architecture à
trancher :
- **Eden verbe réservé** — ne jamais nommer un segment de route comme un verbe HTTP (`options`,
  `get`…) si le client Eden passe un param dessus (casse la forme appel). Cf. ADR-0007.
- `PATTERNS.md` (conventions front, désormais actées en ADR-0016) et `ports.md` (allocation des ports
  dev) restent des références détaillées.
