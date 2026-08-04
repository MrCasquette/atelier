# ADR-0040 — Identité du site et entité légale : structure commune, exigence par produit

Statut : accepté · 2026-08-04
Portée : identity

> Amende [ADR-0034](./ADR-0034-identite-referentiel-reglages.md), dont la décision « `company`
> reste entière et partagée » tombe, ainsi que son argument « Prisme en a besoin intégralement ».
> Le reste de l'ADR tient — en particulier « l'outil fournit des mécanismes et des variables, jamais
> des textes juridiques », qui devient plus vrai encore.

## Contexte

`company` mélangeait six couches sous un seul nom. La mesure la plus parlante est la nullabilité :

| Couche | Colonnes | Contrainte | Universel ? |
|---|---|---|---|
| Site | `shopName`, `logo` | **NOT NULL** | oui |
| Contact public | `publicEmail`, `publicPhone` | **NOT NULL** / nullable | non |
| Hébergeur | `hostingProvider`, `hostingAddress`, `hostingPhone` | nullable | **oui** (LCEN) |
| Directeur de publication | `publisherName` | nullable | **oui** (LCEN) |
| Entité légale | `legalName`, `legalForm`, `siren`, `siret`, `tvaIntra`, `rcsCity`, `shareCapital` | mixte | non |
| Adresse du siège | `street`, `postalCode`, `city`, `country` | **NOT NULL** | non |

**Ce qui est universel est nullable, ce qui est boutique est `NOT NULL`.** La table est à l'envers
pour un CMS : un blog personnel n'a ni raison sociale, ni adresse à publier, mais doit publier son
hébergeur et son directeur de publication.

Un second constat défait l'hypothèse implicite qui structurait la discussion. Le clivage
**particulier / professionnel n'est pas le clivage Prisme / Échoppe** : `legalForm` liste déjà
`SASU, EURL, EI, AE` — entreprise individuelle et auto-entrepreneur sont des **personnes physiques**,
et c'est le profil dominant d'une boutique artisanale. Les deux produits ont besoin des deux formes.

Ce qui diffère entre les produits n'est donc pas la **forme** de l'entité, mais **l'exigence** :
Échoppe ne peut pas facturer sans elle, Prisme peut n'en avoir aucune.

## Options envisagées

### Sur la distinction personne physique / personne morale

- **Une colonne `kind` discriminante**, avec des `CHECK` par forme. **Écartée** : la colonne est une
  réponse à une question que personne ne pose. Elle doit être renseignée par quelqu'un — installateur,
  CLI, premier écran — et tant qu'elle ne l'est pas, l'absence de ligne devient ambiguë : particulier
  sans obligation, ou professionnel qui n'a pas fini ? Les contraintes qu'elle permettait ne gardaient
  que le problème qu'elle créait.
- **Deux tables**, `legal_individual` et `legal_company`. **Écartée** : « au plus une des deux » ne
  s'exprime pas proprement en SQL, et toute lecture devient une union à deux branches — y compris la
  résolution du nom, qui est le cas le plus fréquent.
- **Tronc commun plus extension par présence**, comme `shipping_country`. **Écartée** : une jointure
  permanente pour trois colonnes qui ne servent qu'aux mentions légales.
- **Le plus large, sans discriminant.**

### Sur l'exigence d'Échoppe

- **`NOT NULL` dans une table propre à Échoppe.** Impose **deux déclarations de même forme**, qui
  divergeront. Et n'atteint pas le but : `NOT NULL` interdit les lignes partielles, pas l'absence de
  ligne.
- **Validation à la frontière**, profil d'exigence par produit.

## Décision

### Le plus large, sans discriminant

Une seule forme d'entité légale, tout nullable. Un auto-entrepreneur laisse `legal_form`,
`share_capital` et `rcs_city` vides ; une SASU les remplit. **Personne ne déclare ce qu'il est** :
ça se lit dans ce qui est rempli.

Ce qu'on renonce à empêcher — un particulier qui saisirait un capital social — n'a aucune valeur :
quelqu'un qui saisit un capital en a un.

Le rendu des mentions légales n'a pas besoin du discriminant non plus : ADR-0034 avait déjà retenu
un **gabarit à trous alimenté par les variables**, et un gabarit à trous rend ce qui est rempli.

### Deux tables, pour une raison précise

```
site           name NOT NULL · logo · url · description
               publisher_name · host_name · host_address · host_phone

legal_entity   name · adresse · contact · siren · vat_number
               legal_form · share_capital · rcs_city
```

`site` regroupe marque, directeur de publication et hébergeur. Des données de natures différentes,
mais toutes universelles et toutes toujours présentes — c'est exactement le cas où ADR-0034 conclut
qu'**un regroupement logique dans l'UI suffit**. Le critère qui avait fait sortir le bloc commercial
de `company` était l'appartenance à un seul produit, pas la différence de nature.

`legal_entity` est séparée **pour que l'absence de ligne reste un signal propre** : « pas d'entité
légale » s'exprime par une ligne absente. Fusionnée dans `site`, ça deviendrait « toutes les
colonnes nulles », ce qui est moins net.

### La structure est commune, l'exigence est par produit

Les tables vivent dans `@repo/identity`, qui livre des **définitions**, jamais de migrations — chaque
cœur les inclut dans son barrel et donc dans ses migrations ([ADR-0025](./ADR-0025-deux-produits-un-repo.md)).
Une fois la structure débarrassée de ses hypothèses de boutique, il n'y a plus de raison de ne pas la
partager.

L'exigence, elle, se dérive d'une liste de champs écrite **une seule fois** :

```ts
// échoppe — refuse d'enregistrer un vendeur incomplet
t.Composite([t.Partial(base), t.Required(t.Pick(base, ['name', 'street', 'postalCode', 'city']))])

// prisme — accepte tout
t.Partial(base)
```

Vérifié : le profil permissif accepte le vide, le partiel et le complet ; le restrictif ne garde que
le complet, en conservant les champs facultatifs. `t.Composite` et `t.Omit` sont déjà des idiomes du
projet (`models/catalog.ts`).

### « Requis » ne veut pas dire « garanti présent »

À énoncer explicitement, parce que l'intuition dit le contraire. Sans fabriquer de ligne à
l'installation — ce qu'ADR-0039 refuse — aucun mécanisme ne garantit la présence. « Requis » ne peut
signifier que deux choses :

1. **on ne peut pas enregistrer** une fiche incomplète — validation à la frontière ;
2. **on ne peut pas produire** un document sans elle — au point d'usage.

`generateInvoice` tient déjà le second point. Et la mesure rassure sur sa tardiveté : la facture est
générée par une action d'administration explicite (`POST /orders/:id/invoice`), **jamais pendant le
paiement**. Le pire scénario est un commerçant qui clique et lit une erreur — aucun client impacté,
rien d'irréversible. Seul le message est à refaire : `Company settings not found` ne dit pas quoi
remplir.

## Conséquences

- `company` disparaît au profit de `site` et `legal_entity`. Migration de données à écrire à la main,
  comme en `#9` — drizzle-kit ne transfère rien.
- **`shopName` devient `site.name`.** Ce nom a fait obstacle trois fois : signalé en `#7`, reporté en
  `#9`, bloquant ici. Il traîne dans `getShopInfo()`, les pieds de page des gabarits, le contrat SDK
  et l'écran d'administration.
- `@repo/communication` ne dépend ni de `company` ni de `@repo/identity` : il lit `site.name` dans le
  **contrat de variables**, comme n'importe quel autre consommateur. C'est ce qui débloque son
  extraction.
- Le contrat de variables converge avec [ADR-0035](./ADR-0035-interpolation-variables.md) : c'est la
  même surface, vue depuis l'identité plutôt que depuis l'interpolation.
- L'écran de réglages devra être écrit deux fois, un par produit. Coût réel et assumé — deux profils
  d'exigence, deux formulaires. Des composants pourront être mutualisés, pas le formulaire.

## Ce qui n'est pas décidé ici

**Une checklist de mise en route** dans le tableau de bord — non bloquante, visible dès la première
connexion : « votre identité de vendeur est incomplète, vous ne pourrez pas facturer ». C'est
l'endroit honnête pour l'obligation légale, et c'est un sujet produit, pas de refactor.

**Ce que rend l'API pour une variable connue mais vide.** Même famille que la question ouverte
d'ADR-0039 sur le singleton non renseigné, à trancher avec elle.
