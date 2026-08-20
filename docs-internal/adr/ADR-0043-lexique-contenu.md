# ADR-0043 — Ratification du lexique du contenu, et le terme qui manquait

Statut : accepté · 2026-08-05
Portée : content

> Ratifie [`lexique-prisme.md`](../glossaire.md), établi comme **provisoire** en cours
> de conception, et le complète sur les deux points qu'il ne couvrait pas. Aucun terme existant n'est
> modifié.

## Contexte

Le lexique posait déjà les termes du système de contenu — `Primitive`, `Champ`, `Schema`, `Section`,
`Component`, `Page`, `Entité` — avec leurs raisons : `Section` plutôt que « bloc » parce que la
sémantique HTML est littérale, `Entité` plutôt que « collection » (Directus) ou « content type »
(Strapi). Il portait la mention « à ratifier une fois la série d'ADR Prisme terminée ». Elle l'est.

Deux manques sont apparus au moment de découper l'API en modules ([ADR-0042](./ADR-0042-structure-api-modules.md)) :

**1. Aucun terme pour le registre lui-même.** Le lexique nomme les champs (`Schema`) et ce qu'ils
décrivent (`Section`, `Component`), mais pas la table qui les stocke ni la route qui les sert. Le
code employait trois mots pour trois choses différentes sans les distinguer : `contentDefinition`
(la table), `registry` (la route et le service), `entity` (la prose des ADR et l'espace RBAC
d'ADR-0038). On croyait se comprendre.

**2. Aucun arbitrage sur `menu`.** Ni le lexique ni les ADR ne disaient s'il relève du contenu.

**Ce que le code dit, mesuré :**

- `content_definition.role` ne prend que **deux valeurs** : `'section'` et `'component'`. La table
  est le **registre du page builder**, pas un système d'entités.
- L'entité au sens d'[ADR-0027](./ADR-0027-entites-tables-reelles.md) — déclarée en code, poussée,
  devenant une **vraie table** — est une extension du même chemin de poussée. **Elle n'existe pas
  encore en base.** C'est cohérent avec [ADR-0026](./ADR-0026-sections-entites.md) : deux systèmes,
  parce que la section est de la présentation et l'entité de la donnée.
- `menu` porte en commentaire de schéma : *« Shape figé par le framework — hors registre
  `@mrcasquette/content` »*. Il ne consomme pas `content_definition` ; il **pointe** vers des pages,
  produits ou catégories via `MenuLink`.
- `@mrcasquette/content` n'exporte que du **temps-dev** : `defineContent`, `defineSection`,
  `defineComponent`, `field`, `serialize`, et le client de poussée `checkRegistry` / `pushRegistry`.
  Il ne touche jamais la base.

## Décision

### Ratification

[`lexique-prisme.md`](../glossaire.md) n'est plus provisoire. Ses sept termes font
foi.

### `definition` — le terme qui manquait

**Une `definition` est une entrée du registre : un `Schema` nommé, de rôle `section` ou
`component`.** C'est le nom de la table (`content_definition`), et désormais celui du module.

`registry` reste employé pour **l'ensemble** des definitions — la route `/content/registry` remplace
le registre entier en un geste, ce qui justifie le collectif. Un mot pour l'unité, un pour la
collection : ce n'est pas une redondance.

**`entity` reste réservé** au concept d'ADR-0026/0027 — le déclaré qui devient une vraie table.
L'employer pour le registre de blocs donnerait un mot à deux choses, et le vrai concept arriverait
sans nom disponible, alors qu'ADR-0038 lui a déjà attribué l'espace RBAC `entity:${string}`.

### Un terme par niveau de l'arbre

| Niveau | Terme | Ce qu'il nomme |
|---|---|---|
| famille | **`content`** | ce qui est structuré et éditable |
| déclaré par le dev | **`definition`** | une entrée du registre — `section` ou `component` |
| livré opinionated | **`page`** | le page builder : pages et sections |
| à venir (ADR-0027) | **`entity`** | le déclaré qui devient une vraie table |

### `menu` n'est pas du contenu

C'est de la **navigation**. Forme figée par le framework, hors registre, et son seul lien au contenu
est qu'un item peut pointer vers une page. Module à part, au même niveau que `content`.

### Le paquet déclare, l'API reçoit

`@mrcasquette/content` est le **temps-dev** : DSL de déclaration, sérialisation, poussée. L'API est
le **temps-exécution** : table miroir, validation d'écriture compilée depuis `fields`, formulaires
d'administration, surface HTTP.

Deux moitiés complémentaires, pas deux implémentations. La question « pourquoi ce code est-il dans
l'API alors qu'on en a fait un paquet ? » a donc une réponse stable : **si c'est de la déclaration,
c'est le paquet ; si c'est de la réception, du stockage ou du service, c'est l'API.**

## Conséquences

- Arborescence des modules, en application d'ADR-0042 :

  ```
  modules/content/
    definition/   index  model  service     ← /content/registry
    page/         index  model              ← /content/pages (admin) + /pages (public)
  modules/menu/   index  model  service     ← /menus (public) + /content/menus (admin)
  ```

  `content/` n'a **pas d'`index.ts`** : c'est le terme parent, pas un controller. Le niveau n'existe
  que parce qu'il porte réellement deux enfants.

- `routes/content.ts` (377 lignes) mélange **trois** concepts — registre, pages, menus — et se
  découpe selon ce tableau.

- **Une collision de vocabulaire à connaître** : `schema` désigne trois choses selon le contexte — la
  liste de champs d'une section (lexique), les tables Drizzle (`db/schema/`), et rien du tout côté
  Elysia qui dit `model`. Aucune n'est renommable sans se battre contre un outil (ADR-0041 : le
  framework a autorité). On les distingue par le chemin : `content_definition.fields` pour la
  première, `packages/*/schema.ts` pour la deuxième, `model.ts` pour la validation HTTP.

- `refTarget = 'product' | 'collection' | 'category'` atterrit dans `content/definition/model.ts` —
  l'union fermée qu'ADR-0032 demande d'ouvrir, à son emplacement définitif.

- Quand ADR-0027 sera implémenté, `content/entity/` s'ajoutera sans renommer quoi que ce soit.

- `collection` n'est pas repris. Le mot ne subsiste que dans `refTarget` et `MenuLink.target`, où il
  désigne un **regroupement de produits** — un concept de commerce d'Échoppe, sans rapport avec le
  « collection » à la Directus que le lexique avait écarté.
