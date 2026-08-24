# Design — Système de contenu léger (B9 + B11)

Détail des tâches **Système de contenu léger** du [backlog shared](../backlog/shared.md).

> **Superseded 2026-08-01.** Les questions ouvertes de ce document ont été tranchées dans le cadre de
> **Prisme**, où ce système cesse d'être une fonctionnalité annexe pour devenir le produit :
> [ADR-0026](../adr/ADR-0026-sections-entites.md) (sections vs entités),
> [ADR-0027](../adr/ADR-0027-entites-tables-reelles.md) (vraies tables, définies en code),
> [ADR-0028](../adr/ADR-0028-activation-entites.md) (activation, masquer/supprimer),
> [ADR-0030](../adr/ADR-0030-texte-riche-markdown.md) (**Markdown**, la décision bloquante ci-dessous),
> [ADR-0031](../adr/ADR-0031-i18n-champs-localises.md) (i18n).
> Le document reste pour le **reframe** et les consommateurs cibles côté Échoppe, qui n'ont pas changé.
> Le singleton vs liste est tranché par [ADR-0039](../adr/ADR-0039-entites-singleton.md).
> Reste non tranchée : la **surface storefront** (endpoint générique `/content/:type[/:slug]` vs
> endpoints dédiés).

## Reframe

Deux besoins remontés séparément convergent :

- **B9 — bloc prose/richText** : pages légales/éditoriales (CGV, confidentialité, retours, mentions).
- **B11 — onglets produit** (livraison / retours / conseils) : au départ envisagé comme système dédié.

Plutôt qu'un système par besoin, on vise **un système d'entités de contenu léger** (CMS minimal) :
des **types d'entités configurables**, chacun **singleton** (ex. politique de livraison, page CGV) ou
**liste** (ex. FAQ, conseils, articles). Les onglets produit et les pages prose deviennent alors de
simples **consommateurs** de ce système. B9 est **absorbé** : le prose est une entité de contenu.

## Relation au module contenu existant

Les deux sont **complémentaires, pas concurrents** — ne pas les confondre :

- Le **page-builder headless** `@axiome-apps/atelier-content`
  ([ADR-0012](../adr/ADR-0012-module-contenu.md) / [content-module.md](../architecture/contenu.md)) compose
  des **pages en sections/blocs** déclarées config-as-code par le dev du front (mise en page éditoriale,
  rendu côté front).
- Le **système d'entités léger** crée des **entités de données diverses** (singleton/liste), éditables
  en admin, pour **étendre les fonctionnalités** façon CMS type Directus allégé.

L'ADR précisera s'ils **partagent des primitives** (validation, formulaires admin générés) sans les
fondre — la finalité reste distincte.

## Décision bloquante : format du texte riche

**HTML vs Markdown.** Une partie du contenu existant est **déjà en HTML** → choisir Markdown
imposerait d'**homogénéiser tout l'existant** (migration). Ce choix est **celui du système** (pas de
B9 isolé) : le format retenu s'applique à toutes les entités prose. **Trancher AVANT toute impl.**

## Questions ouvertes (pour l'ADR)

- Modèle : table générique `content_entity` (type + `data` jsonb) vs tables par type ?
- Singleton vs liste : contrainte au niveau schéma ou au niveau type déclaré ?
- Édition admin : formulaires génériques dérivés du type (cf. page-builder P3) ?
- Surface storefront : endpoint générique `/content/:type[/:slug]` vs endpoints dédiés ?
- Format riche : HTML sanitisé vs Markdown (+ migration de l'existant HTML).

## Consommateurs cibles (V1)

Pages légales prose (B9) · onglets produit livraison/retours/conseils (B11) · potentiellement FAQ.
