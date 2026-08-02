# ADR-0034 — Identité, référentiel et réglages : ce que l'outil possède

Statut : accepté · 2026-08-02
Portée : socle, échoppe

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

### `company` reste entière et partagée

Elle porte des données de types différents — identité, adresse, hébergeur — mais qui concernent
toutes l'entreprise. Un **regroupement logique dans l'UI** suffit ; il n'y a pas lieu de scinder la
table. Prisme en a besoin intégralement : un site vitrine français doit publier son éditeur, son
SIREN et son hébergeur, exactement comme une boutique.

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
