# @axiome-apps/atelier-prose

## 0.1.1

### Patch Changes

- b44ebfd: Chaque paquet publié déclare le dépôt d'où il vient — `repository`, `directory` compris.

  npm signe la provenance de lui-même sous trusted publishing, et refuse la publication d'un paquet qui
  ne nomme pas son dépôt d'origine. Rien ne change pour un consommateur : c'est une métadonnée, qui
  donne à npm le lien vers le source du paquet dans le monorepo.

## 0.1.0

### Minor Changes

- 90a17e9: La prose sort du dépôt.

  `@repo/prose` devient `@axiome-apps/atelier-prose` et se publie : le parseur, l'arbre, le noyau de
  sept directives, sa validation par constats et le sérialiseur HTML générique. Sans cela, aucun front
  de développeur ne peut rendre la prose — le contrat d'arbre d'ADR-0061 restait inaccessible à ceux
  mêmes qu'il concerne.

  Le préfixe dit l'appartenance : la prose est de l'atelier, pas d'un produit (ADR-0063).
