# Roadmap Prisme

> Ce que Prisme est, par jalon, et ce qui reste ouvert. Les décisions vivent dans les
> [ADR](../adr/README.md) ; les travaux concrets vivent dans la liste de tâches. Ce document fait le
> lien.
>
> Périmètre mesuré : [perimetre-prisme.md](./perimetre-prisme.md).

## Ce qu'est Prisme

Un **CMS léger**, pour utilisateur final — pas un outil d'équipe marketing. Il partage un repo, une
philosophie et des packages avec Échoppe, mais résout un problème différent et n'en dépend pas
([ADR-0025](../adr/ADR-0025-deux-produits-un-repo.md)).

Son modèle repose sur une distinction unique : **une section est de la présentation, une entité est
de la donnée** ([ADR-0026](../adr/ADR-0026-sections-entites.md)). Le stockage suit la nature de la
chose — jsonb pour ce qui n'a de sens que rendu, vraies tables souveraines avec clés étrangères pour
ce qui garde son sens sans Prisme.

## V1 — headless, dev only

Le dev écrit son front, comme pour Échoppe. Il n'y a ni preset, ni écran d'activation, ni rendu
livré. Le profil servi est **l'utilisateur standard qui a un dev**.

| Périmètre | ADR | Tâche |
|---|---|---|
| Sections vs entités | [0026](../adr/ADR-0026-sections-entites.md) | — |
| Entités en vraies tables, déclarées en code et poussées | [0027](../adr/ADR-0027-entites-tables-reelles.md) | — |
| Texte riche en Markdown | [0030](../adr/ADR-0030-texte-riche-markdown.md) | #10 |
| Cibles référençables (découplage des menus) | [0032](../adr/ADR-0032-cibles-referencables.md) | #8 |
| Identité, référentiel, réglages | [0034](../adr/ADR-0034-identite-referentiel-reglages.md) | #9 |
| Interpolation de variables, humble | [0035](../adr/ADR-0035-interpolation-variables.md) | #12 |
| Statut déclaré, pas de versionnement | [0036](../adr/ADR-0036-cycle-de-vie-contenu.md) | — |

**Prérequis d'infrastructure** — indépendants du CMS, mais bloquants :

| | Tâche |
|---|---|
| Découper `enums.ts` par domaine | #2 |
| Sonde d'extraction `@repo/assets` | #3 |
| Découpler les templates email | #7 |
| Réorganiser le monorepo, scinder le core | #11 |

**Sujet non ouvert, bloquant à terme** : l'**auth**. `plugins/rbac.ts` fait de
`AuthenticatedCustomer` un citoyen de premier rang, `RESOURCES` énumère 14 ressources commerce sur
24, et `roleScopeEnum` contient `store`. [ADR-0008](../adr/ADR-0008-auth-sessions.md) et
[ADR-0013](../adr/ADR-0013-modele-rbac.md) sont marqués « à relire pour Prisme ».

## V2 — Prisme outil pour utilisateur final

C'est le **momentum** : Prisme cesse d'être dev-only. C'est là qu'apparaît son différenciateur —
un CMS headless où l'utilisateur active une entité et la voit en ligne le jour même, sans thème et
sans dev. Ni Strapi ni Directus ne le font.

| Chantier | ADR | État |
|---|---|---|
| Rendu générique dérivé des `kind` de champs, remplaçable champ par champ | [0029](../adr/ADR-0029-rendu-generique.md) | décidé |
| Section « liste d'entités » — le mécanisme de branchement | [0029](../adr/ADR-0029-rendu-generique.md) | décidé |
| `apps/prisme-store` livré en image Docker | [0029](../adr/ADR-0029-rendu-generique.md) | décidé |
| Presets d'entités, activation à la carte, masquer/supprimer | [0028](../adr/ADR-0028-activation-entites.md) | décidé |
| Thèmes utilisateurs, appuyés sur le rendu générique | [0029](../adr/ADR-0029-rendu-generique.md) | à concevoir |
| Interpolation de variables, poussée | [0035](../adr/ADR-0035-interpolation-variables.md) | à définir selon l'usage |
| Reconstruction du front après changement de contenu — *deploy hook* sortant | [0028](../adr/ADR-0028-activation-entites.md) | à concevoir |

### Le chantier le plus dur de la V2, et il n'est pas dans les ADR

**Le déploiement pour un utilisateur non technique.** Un utilisateur sans dev ne posera ni reverse
proxy, ni TLS, ni DNS. Le front livré ne suffit pas : il faut soit une image tout-en-un avec TLS
automatique, soit un installeur, soit de l'hébergement.

C'est un problème distinct du rendu générique, et probablement plus difficile. Sans lui, la V2 sert
un utilisateur qui sait déployer — c'est-à-dire pas celui qu'elle vise.

## Non tranché

| Sujet | Où |
|---|---|
| Permission de modifier le schéma — Owner / Admin / dev, à traiter dans le RBAC **avant** l'implémentation | [0027](../adr/ADR-0027-entites-tables-reelles.md) |
| GUI de conception d'entités, ultérieurement — purement additif | [0027](../adr/ADR-0027-entites-tables-reelles.md) |
| Masqué : admin seul, ou admin + API publique — probablement du RBAC | [0028](../adr/ADR-0028-activation-entites.md) |
| Granularité de remplacement du rendu : par `kind`, par entité, ou les deux | [0029](../adr/ADR-0029-rendu-generique.md) |
| Où vit la liste des langues ; le statut est-il localisé | [0031](../adr/ADR-0031-i18n-champs-localises.md) |
| Prévisualisation d'un brouillon — un jeton côté front, distinct du versionnement | [0036](../adr/ADR-0036-cycle-de-vie-contenu.md) |
| Scope npm du SDK Prisme | [0033](../adr/ADR-0033-organisation-monorepo.md) |
| Nom du package d'identité — `@repo/identity` proposé | [0034](../adr/ADR-0034-identite-referentiel-reglages.md) |
| Singleton vs liste, et la surface storefront | [systeme-contenu-leger.md](./systeme-contenu-leger.md) |
| i18n de l'interface admin — sans effet sur le modèle, peut attendre | [0031](../adr/ADR-0031-i18n-champs-localises.md) |
| Lexique — provisoire, à ratifier | [lexique-prisme.md](../reference/lexique-prisme.md) |
