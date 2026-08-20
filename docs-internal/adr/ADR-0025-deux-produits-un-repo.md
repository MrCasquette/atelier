# ADR-0025 — Deux produits, un repo : frontière core / packages

Statut : accepté · 2026-08-01 · rapport entre périmètres précisé par [ADR-0058](./ADR-0058-fraternite-des-produits.md) le 2026-08-20
Portée : socle

## Contexte

Échoppe (framework e-commerce) et Prisme (CMS) ne sont **pas un système à découper en deux**. Ce sont
**deux applications distinctes** qui résolvent chacune un problème différent, partagent des packages,
une philosophie et un repo. Aucune ne nécessite l'autre.

*(Cette phrase parle de **dépendance**, et reste vraie telle quelle. Elle ne dit rien du rapport
entre les périmètres — les deux produits recomposent les mêmes paquets de contenu, Échoppe en
recompose davantage. Cf. [ADR-0058](./ADR-0058-fraternite-des-produits.md).)*

Il faut donc fixer où passe la frontière, et à qui appartient la base de données.

Deux mesures ont cadré la décision :

- `db.query.*` : **0 occurrence**. `relations()` : **0 occurrence**. L'argument `{ schema }` de
  `drizzle(client, { schema })` est aujourd'hui inerte — le code n'utilise que le query-builder.
- `runMigrations(migrationsFolder)` prend déjà son dossier **en paramètre** : le runner est déjà
  agnostique du produit. Seul `drizzle.config.ts` est lié à un produit, sur deux lignes.

## Options envisagées

- **Deux repos séparés** — tout ce qui traverse la frontière doit être publié et versionné. Média,
  contenu, auth et communication deviendraient des paquets à releaser, avec le décalage de version
  que ça implique entre les deux produits.
- **Un repo, packages partagés** — coût de partage mesuré comme bas (cf. mesures ci-dessus).

## Décision

**Un repo.** La frontière est posée ainsi :

- **Le core appartient au produit et possède la base** : la connexion, le barrel de schémas,
  `drizzle.config.ts`, le dossier de migrations. Un produit = un core = une base.
- **Un package partagé livre des définitions de tables et des helpers.** Il ne possède **jamais** de
  migrations — les migrations appartiennent au core qui l'agrège.
- **La flèche de dépendance va du produit vers le package, jamais l'inverse.** `product` référence
  `media` ; `media` ne peut pas référencer `product`. C'est ce qui rend `media` extractible.
- **Une relation qui traverse une frontière de package se déclare dans le core**, pas dans le
  package. Drizzle permet de déclarer `relations()` dans un fichier séparé des tables.

## Conséquences

- Le SQL d'une table partagée apparaît dans **les deux** historiques de migrations. C'est correct :
  ce sont deux bases indépendantes.
- L'API relationnelle (`db.query`) reste disponible **par produit** — chaque core branche son propre
  barrel. Elle peut être adoptée dans un produit et pas dans l'autre. Ce n'est pas une capacité
  supplémentaire, c'est une ergonomie : elle ne sait ni écrire, ni agréger, ni joindre hors des
  relations déclarées.
- La sonde d'extraction de `media` (zéro dépendance sortante) sert de test empirique de cette
  frontière. Critère : le package sort sans instance connectée, et `db:generate` reste silencieux
  des deux côtés.
