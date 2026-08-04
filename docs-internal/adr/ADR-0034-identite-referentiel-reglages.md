# ADR-0034 — Identité, référentiel et réglages : ce que l'outil possède

Statut : accepté, partiellement amendé · 2026-08-02
Portée : socle, échoppe

> **Amendé le 2026-08-04 par [ADR-0040](./ADR-0040-identite-site-entite-legale.md).** La décision
> « `company` reste entière et partagée » et son argument « Prisme en a besoin intégralement » sont
> **caducs** : les colonnes universelles de la table sont nullables et les colonnes de boutique sont
> `NOT NULL`, ce qui la rend inutilisable pour un CMS. `company` se décompose en `site` et
> `legal_entity`. Le reste de cet ADR tient — en particulier le référentiel, les réglages par produit
> et la règle sur les textes juridiques.

## Contexte

Trois sujets étaient confondus sous « les réglages » :

- **`company`** — l'entité qui exploite le site : nom légal, forme, SIREN, capital, adresse.
- **Le légal et le RGPD** — mentions obligatoires, hébergeur, droits des personnes.
- **Les réglages applicatifs** — propres à chaque produit, différents par nature.

Le code mélangeait les trois. `company` porte aujourd'hui l'identité légale, l'hébergeur, **et** la
numérotation des factures (`documentPrefix`, `documentNextNumber`, `invoicePrefix`,
`invoiceNextNumber`, `taxExempt`). `referential` porte `country` et `taxRate` dans le core partagé.

Mesures : `country` est référencé par `customerAddress.country` (commerce) et `company.country`
(l'adresse légale, dont Prisme a besoin). Son seul champ commercial est `isShippingEnabled`, utilisé
à **un seul endroit** (`routes/countries.ts:19`). `taxRate` n'est utilisé qu'en contexte
produit/catalogue.

## Décision

### ~~`company` reste entière et partagée~~ — caduc, cf. [ADR-0040](./ADR-0040-identite-site-entite-legale.md)

Elle porte des données de types différents — identité, adresse, hébergeur — mais qui concernent
toutes l'entreprise. Un **regroupement logique dans l'UI** suffit ; il n'y a pas lieu de scinder la
table. Prisme en a besoin intégralement : un site vitrine français doit publier son éditeur, son
SIREN et son hébergeur, exactement comme une boutique.

> **Ce qui était faux** : « intégralement ». Un blog personnel n'a ni raison sociale ni adresse à
> publier, alors que `legalName`, `street`, `postalCode` et `city` sont `NOT NULL`. Et le clivage
> particulier / professionnel n'est pas le clivage Prisme / Échoppe — `legalForm` liste déjà `EI` et
> `AE`, des personnes physiques, profil dominant d'une boutique artisanale.
>
> **Ce qui reste vrai** : l'argument du regroupement logique. ADR-0040 le reprend tel quel pour
> garder marque, directeur de publication et hébergeur dans une même table `site`.

**Seul le bloc commercial sort** vers les réglages d'`echoppe-core` : `documentPrefix`,
`documentNextNumber`, `invoicePrefix`, `invoiceNextNumber`, `taxExempt`.

### Le référentiel se scinde selon sa nature

| | Destination | Motif |
|---|---|---|
| `country` | **partagé** | la liste ISO — nom, code — est de la donnée de référence neutre |
| `country.isShippingEnabled` | `echoppe-core` | c'est ce champ, et lui seul, qui la polluait |
| `taxRate` | `echoppe-core` | commerce pur |

Même motif que `RefTarget` dans le paquet de contenu ([ADR-0032](./ADR-0032-cibles-referencables.md)) :
une brique neutre rendue spécifique par un champ.

### Les réglages applicatifs sont propres à chaque produit

Un module `settings` **dans chaque core**, sans package partagé — Prisme et Échoppe n'ont pas les
mêmes réglages et n'en auront jamais.

### L'outil fournit des mécanismes et des variables, jamais des textes juridiques

C'est la décision la plus importante de cet ADR.

| | L'outil livre | Exemple |
|---|---|---|
| **Mécanismes** | ✅ | anonymisation, export des données — des fonctions dont l'exploitant a besoin |
| **Variables** | ✅ | nom légal, SIREN, hébergeur — des faits, exposés au contenu |
| **Textes juridiques** | ❌ | politique de confidentialité, CGV, CGU |

Livrer des modèles de conformité crée une **confiance fausse** : un texte générique est inadapté par
construction, et il déplace vers l'outil une responsabilité juridique qu'il ne peut pas porter.

Exception admissible : les **mentions légales**, purement factuelles et dont la LCEN fixe la liste
des champs. Un gabarit à trous alimenté par les variables y est légitime.

Corollaire : Prisme détiendra des données personnelles — soumissions de formulaires, comptes admin —
et aura donc besoin d'un mécanisme d'export et de suppression. Ce n'est **pas** transposable depuis
celui d'Échoppe, écrit autour de `customer`.

## Conséquences

- Les textes légaux ne sont pas de la configuration : ce sont des **pages**, relevant du système de
  contenu ([ADR-0026](./ADR-0026-sections-entites.md)). Ils dépendent de la configuration, ce que
  résout l'interpolation de variables ([ADR-0035](./ADR-0035-interpolation-variables.md)).
- `company` et `country` forment un package partagé — nom à fixer dans
  [ADR-0033](./ADR-0033-organisation-monorepo.md), `@repo/identity` proposé.
- La dépendance `admin.company → referential.country` survit et devient interne au package partagé.
- `customerAddress.country` pointe vers une table partagée : la flèche va bien du produit vers le
  package, conforme à [ADR-0025](./ADR-0025-deux-produits-un-repo.md).
