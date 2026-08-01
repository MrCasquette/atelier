# ADR-0031 — i18n de contenu : champs localisés, décidé mais non implémenté

Statut : accepté · 2026-08-01
Portée : content

## Contexte

Deux problèmes sans rapport se cachent derrière « i18n », et seul le second est structurant :

- **l'interface** — l'admin parlé en français, anglais, espagnol. Fichiers de traduction, sélecteur
  de langue. Ne touche pas le modèle de données, peut attendre.
- **le contenu** — un `Article` qui existe en français et en anglais. Change les tables, les URL,
  l'éditeur, l'API. C'est le morceau le plus lourd d'un CMS après le modèle lui-même.

Cet ADR ne traite que le second.

## Options envisagées

- **Tables de traductions liées** (modèle Directus) : `article` + `article_translation`. Propre et
  extensible, mais alourdit l'éditeur, l'API, les URL et le rendu générique dès la V1.
- **Duplication liée** (modèle Polylang / WordPress) : un `Article` FR et un `Article` EN sont deux
  fiches reliées par un champ. Simple à implémenter, lourd en UX et en cohérence à tenir.
- **Champs localisés** : une primitive `i18n()` qui enveloppe une autre primitive.

## Décision

**Si Prisme devient multilingue, ce sera par champs localisés.** La V1 est mono-langue — la primitive
n'est pas implémentée.

```ts
titre:      i18n(text()),      // → { "fr": "…", "en": "…" }
corps:      i18n(richText()),
couverture: image(),           // non traduit, reste une colonne normale
```

L'entité reste **une** fiche : pas de table jointe, pas de doublon, pas de cohérence à maintenir
entre deux enregistrements. L'éditeur bascule la valeur des champs concernés via un sélecteur de
langue.

## Conséquences

- Un champ traduit devient du `jsonb` et reperd, **pour lui seul**, ce que
  [ADR-0027](./ADR-0027-entites-tables-reelles.md) est allé chercher : pas d'`UNIQUE` direct, tri et
  filtre via `titre->>'fr'`, et un outil externe lit `{"fr":"…"}` au lieu d'une chaîne. C'est borné
  aux champs traduits — l'entité garde ses vraies colonnes et ses clés étrangères ailleurs. Un champ
  traduit est de toute façon intrinsèquement multi-valué : les trois modèles le paient d'une façon ou
  d'une autre.
- **Le rattrapage est le moins cher des trois modèles** — c'est ce qui autorise à décider sans
  construire :

  ```sql
  ALTER TABLE article ALTER COLUMN titre TYPE jsonb
    USING jsonb_build_object('fr', titre);
  ```

  Par champ, mécanique, sans toucher aux autres colonnes ni au reste du modèle.

## Questions ouvertes

- **Où vit la liste des langues ?** Une contrainte d'unicité sur le slug par langue exige de la
  connaître au moment de la migration. Sinon l'unicité redevient applicative.
- **Le statut de publication est-il localisé ?** Publier en français mais pas en anglais suppose que
  `status` soit lui-même un champ localisé. La primitive le permet ; ce n'est pas tranché.
