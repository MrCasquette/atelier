# Backlog — socle partagé

Travail sur les packages, contrats et décisions qui concernent Échoppe et Prisme. Une abstraction
nouvelle doit avoir deux usages réels ; à défaut, elle reste dans le produit qui la porte.

## Contenu config-as-code

- [ ] 🔴 **Migrer `richText` de HTML vers Markdown** selon [ADR-0030](../adr/ADR-0030-texte-riche-markdown.md) :
  convertir les données, désactiver le HTML brut et tester le rendu contre le XSS stocké.
- [ ] 🟠 **Préserver l'ordre déclaré des champs** : choisir une représentation explicitement
  ordonnée plutôt que dépendre de l'ordre d'un objet stocké en `jsonb`.
- [ ] 🟠 **Extraire la grammaire des champs hors de `@repo/pages`** lorsque ses deux consommateurs
  imposent une frontière stable ; trancher le nom du package avec le lexique.
- [ ] 🟠 **Implémenter l'interpolation V1** après stabilisation de Markdown : jeu fini de variables,
  substitution sans évaluation, une passe, littéral conservé pour une inconnue.
- [ ] 🟡 **Type-gen du DSL** pour les sections et composants de front.
- [ ] 🟡 **Générateur de formulaires admin** depuis le registre.
- [ ] 🟡 Menus imbriqués, champs custom, fichiers/assets et i18n des enums.
- [ ] 🟡 Durcir les clés API et documenter la portabilité liée à PostgreSQL/`jsonb`.

## Architecture et contrats

- [ ] 🟠 **Trancher l'injection DB** dans un ADR : singleton, factory de service, contexte de requête
  et unité transactionnelle. L'éprouver d'abord dans le vertical slice Prisme.
- [ ] 🟠 **Réduire progressivement le barrel `@echoppe/core`** et vérifier les imports directs aux
  frontières des packages.
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

