# ADR-0012 — Module contenu / page-builder headless (`@mrcasquette/content`)

Statut : accepté
Portée : content

> **Amendement 2026-07-31 — renommage du paquet.** Le DSL est republié sous
> **`@mrcasquette/content`** (v0.2.0). Motif : déclarer des sections et des composants n'a rien de
> spécifique à l'e-commerce — c'est une brique que **Prisme** (CMS) consommera aussi. La laisser
> sous le scope `@echoppe/*` reviendrait à faire dépendre le CMS du framework e-commerce.
> Règle générale retenue : un artefact spécifique à un produit garde le scope du produit, un
> artefact agnostique prend un namespace neutre. La décision de fond de cet ADR est inchangée —
> seul le nom du paquet bouge. `@echoppe/content@0.1.0` reste en ligne, inerte.

## Contexte

Une boutique a besoin de pages éditoriales (accueil, CGV, à-propos…) composées de blocs, gérables par
le commerçant, mais **définies par le dev** (types de blocs propres à chaque boutique). Il faut un
page-builder headless : le dev déclare ses blocs, l'admin les remplit, le front les rend.

## Options envisagées

- Un CMS externe (Directus, Strapi) — lourd, hors du modèle image-Docker autonome.
- Codegen de types + validateur maison — drift de version, maintenance.
- Un package léger : déclaration TypeScript du dev = SSOT, validateur générique, typage par inférence.

## Décision

Package **`@echoppe/content`**, léger par design :
- **Authoring vs registre** : le dev déclare ses blocs (verbes de déclaration) dans
  `src/content/index.ts` ; un registre les enregistre côté API (`models/content.ts` devient mince).
- **Validateur générique** : point d'architecture central — valide n'importe quelle déclaration sans
  code spécifique par bloc, **zéro nouvelle dépendance** (pas de Zod), zéro drift de version.
- **Typage front par inférence** (P2c) : **pas de codegen** — les déclarations du dev *sont* les types.
- **Loader CLI** : natif TypeScript d'abord, repli `tsx` legacy.
- **Blocs embarqués** : une section appartient à UNE page ; un « bloc partagé » = un type-marqueur
  rendu par un composant du front.

## Conséquences

- Le contenu est piloté par le dev de la boutique, rempli par l'admin, rendu par le front — cohérent
  avec le modèle « front hors framework » (ADR-0001/0002).
- Sert de base au bloc prose/richText (brief B9).

## Détail

→ [content-module.md](../reference/content-module.md)
