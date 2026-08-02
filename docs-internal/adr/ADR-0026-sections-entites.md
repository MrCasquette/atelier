# ADR-0026 — Sections et entités, deux natures de contenu

Statut : accepté · 2026-08-01
Portée : content

## Contexte

[systeme-contenu-leger.md](../design/systeme-contenu-leger.md) décrivait un « système d'entités de
contenu léger » comme **fonctionnalité annexe** d'Échoppe — ses consommateurs cibles étaient les
pages légales, les onglets produit et la FAQ. Dans Prisme, ce même système **est le produit**.

Cette inversion change les réponses. Concevoir pour des CGV et des onglets produit, c'est un modèle
simple. Concevoir le cœur d'un CMS, ça doit porter des articles, des projets, des événements, et des
références entre eux.

La question dominante était de savoir si le page-builder existant et le système d'entités sont un
seul système ou deux.

## Options envisagées

- **Un système unifié** — une page est un contenu parmi d'autres, une section est un champ. Un seul
  registre, un seul validateur, un seul stockage générique.
- **Deux systèmes, primitives partagées** — même DSL de champs et même validateur, mais registres et
  stockages distincts.
- **Deux systèmes séparés** — écarté : dupliquer le validateur, c'est garantir le drift.

## Décision

**Deux systèmes**, parce que les deux objets n'ont pas la même nature :

- **Une section est de la présentation.** Sa déclaration est un **contrat avec un composant du
  front** : déclarer `Hero` sans avoir de `Hero.astro` en face produit du contenu irrémédiablement
  non rendu. Sortie de son composant, sa donnée n'a pas de sens — `{ "titre": "…", "variante":
  "sombre" }` ne veut rien dire ailleurs. Le **jsonb y est donc correct**, pas un compromis, et la
  déclaration en config-as-code y est **obligatoire**.
- **Une entité est de la donnée.** Un `Article` garde tout son sens sans Prisme. Il doit être en
  **vraies colonnes** (cf. [ADR-0027](./ADR-0027-entites-tables-reelles.md)).

**Le stockage suit la nature de la chose, pas l'uniformité du système.**

Ce qui reste partagé : le **schema** — la liste de champs — et son validateur générique, décrit par
[ADR-0012](./ADR-0012-module-contenu.md) comme « le point d'architecture central ». C'est la pièce
coûteuse, et elle est partagée intégralement.

## Conséquences

- Le page-builder existant n'est pas refondu. La décision est additive.
- Deux registres à garder cohérents. Point à trancher à l'implémentation : un nom d'entité peut-il
  coïncider avec un nom de section ? (aujourd'hui `content_definition.name` est unique globalement
  sur sections + components).
- Les références (`RefTarget`) sont à câbler des deux côtés, au lieu d'un champ `relation` unique
  qu'un modèle unifié aurait donné. Coût assumé.

## Détail

→ [lexique-prisme.md](../reference/lexique-prisme.md) — vocabulaire (section, component, entité,
schema), **provisoire, à ratifier**.
