# Backlog — socle partagé

Travail sur les packages, contrats et décisions qui concernent Échoppe et Prisme. Une abstraction
nouvelle doit avoir deux usages réels ; à défaut, elle reste dans le produit qui la porte.

## Contenu config-as-code

- [ ] 🔴 **Migrer `richText` de HTML vers Markdown** selon [ADR-0030](../adr/ADR-0030-texte-riche-markdown.md) :
  convertir les données, désactiver le HTML brut et tester le rendu contre le XSS stocké.
- [x] 🟠 **Préserver l'ordre déclaré des champs** : choisir une représentation explicitement
  ordonnée plutôt que dépendre de l'ordre d'un objet stocké en `jsonb`. → `json` au lieu de `jsonb`
  sur `content_definition.fields` et `entity_definition.fields` ; `jsonb` normalise les clés.
- [x] 🟠 **Extraire la grammaire des champs hors de `@repo/pages`** ; trancher le nom du package
  avec le lexique. → `@repo/fields`, sans aucune dépendance : la primitive et sa compilation sont
  parties, les dérivations sont restées — DDL côté entités, registre à deux rôles côté pages.
  `@repo/entities` ne dépend plus de `@repo/pages`.
- [x] 🟠 **Implémenter l'interpolation V1** après stabilisation de Markdown : jeu fini de variables,
  substitution sans évaluation, une passe, littéral conservé pour une inconnue.
- [ ] 🟡 **Type-gen du DSL** pour les sections et composants de front.
- [ ] 🟡 **Générateur de formulaires admin** depuis le registre.
- [ ] 🟡 Menus imbriqués, champs custom, fichiers/assets et i18n des enums.
- [ ] 🟡 Durcir les clés API et documenter la portabilité liée à PostgreSQL/`jsonb`.

## Architecture et contrats

- [ ] 🟠 **Trancher l'injection DB** dans un ADR : singleton, factory de service, contexte de requête
  et unité transactionnelle. L'éprouver d'abord dans le vertical slice Prisme.
- [ ] 🟠 **Encaisser le découpage en packages** — le constat, mesuré le 2026-08-12 : les frontières
  existent dans l'arborescence mais pas dans les imports. L'API compte **61 imports de
  `@echoppe/core` contre 29 de `@repo/*`**, et **46 usages de symboles qui vivent dans un `@repo/*`**
  y entrent par le barrel du cœur — 14 fois `media`, 7 fois `user`, 4 fois `menu`, 3 fois `site`.
  `packages/echoppe-core/src/db/schema/index.ts` réexporte les tables de sept packages, sous le
  commentaire « réexporté pour ne pas changer la surface ». Rien n'empêche donc de contourner un
  package : il y a juste un chemin plus court, et il gagne.

  Rien de dramatique — aucune indirection gratuite, le code interne est cohérent et testé. Mais
  l'extraction a été **payée sans être encaissée**, et une frontière que personne n'emprunte cesse
  d'être vraie : un package que plus rien n'importe directement finit par accueillir n'importe quoi.

  Deux gestes, dans cet ordre. Le premier seul compte, le second est de l'hygiène :

  1. **Faire tomber le barrel de réexport du cœur.** Que `media` s'importe depuis `@repo/assets` et
     nulle part ailleurs. Mécanique, vérifiable par une règle de lint — c'est ce qui transforme le
     découpage de décor en structure. Sans lui, tout le reste est cosmétique.
  2. **Refondre les feuilles sous ~100 lignes** dans leur consommateur unique, ou les regrouper.
     Cinq packages sont concernés : `assets` (**32 lignes**, deux tables et un `export`), `shared`
     (88), `db` (90), `identity` (92), `adapters` (102). Aucun n'achète ce qu'une frontière est
     censée acheter : ils sont `private` (pas de publication), tous en `0.0.1` sans tests propres
     (pas de versionnage), et `assets` n'a aucune dépendance sortante — la frontière n'empêche donc
     rien. À ressortir en dix minutes le jour où un deuxième lecteur apparaît.

  Réserve honnête : le découpage vise un second produit qui n'existe pas encore, donc quatre
  packages (`assets`, `identity`, `menus`, `pages`) n'ont qu'**un seul consommateur**. C'est du
  partitionnement anticipé, pas de la sur-abstraction — ça se défait en fusionnant deux dossiers,
  là où une mauvaise abstraction ne se défait pas. Le pari reste ouvert ; ce qui ne l'est pas, c'est
  de le porter sans l'appliquer.
- [ ] 🟠 **Définir la compatibilité runtime/API/SDK** : matrice, dépréciation et politique pré-1.0.
- [ ] 🟡 Réorganiser les domaines internes uniquement à l'apparition d'un deuxième consommateur.
- [ ] 🟡 Compiler en CI les exemples des packages publics et une configuration de contenu témoin.

## Documentation et gouvernance

- [ ] 🟠 **Ajouter à l'index ADR les états d'implémentation, de vérification et d'horizon**, sans
  réécrire le statut historique de décision.
- [ ] 🟡 **Resserrer le maillage documentaire** : liens depuis le code, références actives vérifiées
  et liens vers les ADR successeurs.
- [ ] 🟡 Corriger les chemins, versions et exemples devenus obsolètes dans les README actifs.
- [ ] 🟡 Distinguer explicitement documentation historique, référence active et vision.

## Intendance transverse

- [ ] 🟡 Vérifier les trusted publishers npm/OIDC des trois artefacts publics.
- [ ] 🟡 Purger l'ancien registre Docker Hub après migration des consommateurs encore concernés.
- [ ] 🟡 Garder npm 11 tant que Changesets est incompatible avec npm 12.

