# ADR-0033 — Organisation du monorepo : disposition à plat, deux cores, packages partagés

Statut : accepté · 2026-08-02
Portée : socle

## Contexte

[ADR-0025](./ADR-0025-deux-produits-un-repo.md) pose la frontière — le core appartient au produit et
possède la base, un package partagé livre des définitions de tables, la flèche de dépendance va du
produit vers le package. Il reste à en tirer la **disposition concrète** : où vivent les
applications, comment se nomment les packages, et ce que fabriquent les CLI.

État actuel : `apps/{api,admin,store}`, `packages/{core,client,content,create-echoppe,shared}`, un
seul `core` qui porte la base, les schémas, les adapters et les services.

## Options envisagées

- **Imbriqué par produit** — `apps/echoppe/{api,admin}`, `apps/prisme/{api,admin}`. Lisible, mais
  crée un niveau de plus et complique les filtres Bun (`-F`) comme les chemins CI.
- **À plat, préfixé par produit** — `apps/echoppe-api`, `apps/prisme-api`.

## Décision

### Disposition à plat, préfixée par produit

```
apps/
  echoppe-api  echoppe-admin  echoppe-store
  prisme-api   prisme-admin   prisme-store      (V2, cf. ADR-0029)
packages/
  echoppe-core  prisme-core
  echoppe-client  prisme-client
  auth  content  assets  communication  adapters  shared
  create-echoppe  create-prisme
```

### Deux cores

Conséquence directe d'ADR-0025 : `echoppe-core` et `prisme-core`. Chacun porte **sa** connexion, son
barrel de schémas, sa `drizzle.config.ts` et son dossier de migrations. Un produit = un core = une
base.

### Nommage

- **Packages internes** : scope `@repo/*`. Jamais publiés.
- **Packages publiés** : le scope suit le produit — `@echoppe/client` reste. Un artefact agnostique
  prend un namespace neutre : `@mrcasquette/content` (cf. amendement d'[ADR-0012](./ADR-0012-module-contenu.md)).

### Découpage des adapters

`packages/core/src/adapters/` est scindé en trois selon qui en a besoin :

| Cible | Contenu | Pour |
|---|---|---|
| `@repo/adapters` | `registry.ts`, `credential-store.ts` — l'abstraction et le port DIP | les deux |
| `@repo/communication` | `adapters/communication/*` + `schema/communication.ts` | les deux — Prisme envoie des emails |
| `echoppe-core` | `adapters/payment/*`, `adapters/shipping/*` | commerce seul |

**Prérequis** : `services/email.ts` expose aujourd'hui `sendOrderConfirmation` et
`sendShipmentNotification`, et `adapters/communication/templates.ts` code en dur les templates
`order-confirmation` et `shipment`. L'adapter est propre, la couche au-dessus ne l'est pas. Il faut
un `sendEmail(template, data)` générique dont les templates sont **enregistrés par le produit**,
sinon Prisme hérite du vocabulaire des commandes.

### Les deux CLI ont le même rôle

`create-echoppe` et `create-prisme` scaffoldent un **consommateur** : un `compose.yaml` qui tire les
images, un `.env` pré-rempli, et la configuration. Les packages arrivent en dépendances npm. C'est le
modèle d'[ADR-0002](./ADR-0002-distribution.md), il s'applique inchangé aux deux produits.

### Pas de modules désactivables

Aucun mécanisme d'activation/désactivation de briques fonctionnelles à l'échelle du produit. Un
produit assemble ce dont il a besoin à la compilation. (À ne pas confondre avec l'activation des
**entités**, qui est un mécanisme de contenu — cf. [ADR-0028](./ADR-0028-activation-entites.md).)

## Conséquences

- Les alias TypeScript de `tsconfig.base.json` ne pointent aujourd'hui que vers des packages, jamais
  vers des apps : **renommer les apps ne touche pas les chemins TS**. La migration des apps est un
  `git mv` plus les scripts racine.
- Les chaînes de scripts en `--cwd` de la racine sont à reprendre — le passage au filtre Bun (`-F`)
  déjà fait pour `type-check` sert de modèle.
- `packages/core/src/db/schema/enums.ts` reste le blocage mécanique n°1 : un sac global de ~20
  `pgEnum` mélangeant tous les domaines. À découper avant toute extraction.
- Le SQL d'une table partagée figure dans les deux historiques de migrations. Correct : deux bases.

## Question ouverte

**Le scope npm du SDK Prisme.** `@echoppe/client` reste tel quel ; l'équivalent Prisme dépend de la
disponibilité du scope sur npm, à vérifier au moment de la publication.
