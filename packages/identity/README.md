# `@repo/identity` — l'identité d'un site et l'entité légale derrière lui

Trois définitions de tables : `site`, `legalEntity`, `country`
([ADR-0040](../../docs-internal/adr/ADR-0040-identite-site-entite-legale.md)).

## Frontière

Ce paquet ne livre **que des définitions de tables**. Chaque cœur les inclut dans son barrel, et donc
dans ses migrations ([ADR-0025](../../docs-internal/adr/ADR-0025-deux-produits-un-repo.md)).

Il ne contient volontairement **aucun modèle de validation** : la liste de champs TypeBox vit dans
l'app, où `conventions.md` la situe, et n'a qu'un seul consommateur tant que `prisme-api` n'existe
pas. On l'extraira sur duplication réelle, pas par anticipation.

## Le principe qui gouverne la nullabilité

**La structure est commune aux deux produits ; seule l'exigence diffère, et elle s'exprime à la
frontière de validation, pas ici.** Échoppe refuse d'enregistrer une entité légale incomplète, Prisme
accepte tout. C'est pourquoi tout est nullable sauf `site.name`.

Ces tables remplacent `company`, qui mêlait six couches et dont la nullabilité était à l'envers : les
colonnes universelles — hébergeur, directeur de publication — y étaient facultatives, les colonnes de
boutique obligatoires. Inutilisable pour un CMS.

## Pourquoi `legalEntity` est une table séparée

**L'absence de ligne est le signal « pas d'entité légale ».** C'est la seule raison de la séparation :
fusionnée dans `site`, cet état deviendrait « toutes les colonnes nulles », indiscernable d'une saisie
inachevée.

Pas de colonne `kind` non plus : elle devrait être renseignée par quelqu'un, et tant qu'elle ne l'est
pas l'absence devient ambiguë — particulier sans obligation, ou professionnel qui n'a pas fini ? On
lit la forme dans ce qui est rempli : un auto-entrepreneur laisse `legalForm`, `shareCapital` et
`rcsCity` vides, une SASU les remplit.

## `site` — un regroupement assumé

Marque, contact public et mentions LCEN dans une même table : des données de natures différentes,
mais toutes universelles et toutes toujours là. C'est l'argument
qu'[ADR-0034](../../docs-internal/adr/ADR-0034-identite-referentiel-reglages.md) employait pour garder
`company` entière, et il reste valable — ce qui l'invalidait, c'était l'appartenance à un seul
produit.

`country` est de la donnée de référence neutre : la liste ISO n'appartient à aucun produit.

## Dépendances

`drizzle-orm`, et `@repo/assets` pour la référence `site.logo → media.id`.
