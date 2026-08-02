# ADR-0035 — Interpolation de variables dans le contenu

Statut : accepté · 2026-08-02
Portée : content

## Contexte

Les textes légaux ne sont pas de la configuration — ce sont des pages — mais ils en **dépendent** :
une mention légale cite le nom légal, le SIREN, l'hébergeur. Sans mécanisme, l'utilisateur recopie
ces valeurs à la main, et elles se périment en silence.

Le besoin dépasse d'ailleurs le légal : *« Notre atelier est à {{ company.city }} »* dans n'importe
quelle page.

## Options envisagées

- **Déléguer au front** — le front dispose déjà des réglages et compose sa page. Coût nul, mais
  l'utilisateur ne peut pas éditer le texte, ce qui est précisément la cible de Prisme V2.
- **Interpoler côté front** — chaque front réimplémente la syntaxe et le jeu de variables.
- **Interpoler côté API, à la lecture.**

## Décision

**Interpolation côté API, à la lecture.** Le front reçoit du texte prêt à afficher, il n'a rien à
savoir. En V2, le front livré et le front du dev partagent le même comportement sans effort.

### Le stockage garde la référence

`{{ company.legalName }}` est stocké en clair, jamais résolu à l'écriture. C'est **meilleur pour la
souveraineté** qu'une valeur figée : un outil externe lit une référence explicite plutôt qu'un nom
d'entreprise périmé.

### Un jeu de variables déclaré et fini

Le jeu exposé est un **type union, SSOT unique**, réutilisé partout où il est nécessaire — validation
à l'écriture, autocomplétion dans l'éditeur, résolution à la lecture. Il s'élargit ou se rétrécit
selon les besoins réels constatés.

Pas d'accès arbitraire à la base : ce serait un moteur de template, avec la surface de sécurité
correspondante.

Chaque produit peut étendre le jeu de base avec ses propres réglages ; l'union diffère donc par
produit, à partir d'un socle commun.

### Variable inconnue : laisser le littéral

Jamais vider. Une mention légale avec un trou blanc passe inaperçue ; `{{ company.siren }}` affiché
tel quel se voit immédiatement.

### Deux jalons

- **V1 — humble** : substitution simple d'un jeu restreint dans les champs texte et `richText`.
- **V2 — poussé** : à définir selon l'usage réel. Le jeu s'élargit, l'éditeur assiste.

## Conséquences

- Les valeurs interpolées sont du **texte brut** injecté dans du Markdown ([ADR-0030](./ADR-0030-texte-riche-markdown.md)),
  donc à échapper : un nom d'entreprise contenant `*` ou `[` ne doit pas produire du balisage.
- L'interpolation s'applique à la lecture, donc **après** le cache éventuel du contenu : un
  changement de raison sociale doit invalider ce cache.
- Le gabarit de mentions légales admis par [ADR-0034](./ADR-0034-identite-referentiel-reglages.md)
  repose entièrement sur ce mécanisme.
