# Lexique Prisme — vocabulaire du système de contenu

> **Provisoire.** Établi en cours de conception pour pouvoir rédiger les ADR sans ambiguïté.
> **À ratifier** une fois la série d'ADR Prisme terminée.

Le mot `type` était déjà pris en base (`section.type` = quel bloc est-ce) : le réemployer pour
désigner un modèle d'entité garantissait la collision. D'où ce lexique.

## Termes

| Terme | Désigne | Exemple | En base |
|---|---|---|---|
| **Primitive** | un type de champ | `text`, `richText`, `image`, `relation`, `i18n` | `field.kind` |
| **Champ** | une primitive nommée dans un schema | `titre: text()` | clé de `fields` |
| **Schema** | la liste de champs d'une section ou d'une entité | — | `content_definition.fields` |
| **Section** | une unité de présentation insérable dans une page | `Hero`, `FAQ`, `CTA` | `section.type` |
| **Component** | un groupe de champs réutilisable, non insérable seul | `Bouton` | `content_definition.role` |
| **Page** | un document composé de sections | `/a-propos` | table `page` |
| **Entité** | un modèle de données éditable | `Article`, `Événement` | une table par entité |

Une **instance** n'a pas besoin de mot dédié : c'est un `Hero`, c'est un `Article`.

## Choix de vocabulaire

- **Section** plutôt que « bloc » — reprend littéralement la sémantique HTML, là où « bloc » est
  générique. `section.type` se lit sans ambiguïté.
- **Entité** plutôt que « collection » (Directus) ou « content type » (Strapi) — vocabulaire Doctrine,
  sémantiquement plus juste, et « content type » retombe dans le mot piégé.
- **Schema** plutôt que « modèle » — vient de Zod ; « modèle » est chargé par le MVC.

## Ce que le lexique ne recouvre pas encore

- Le nom de l'écran d'administration qui sépare la définition des entités de leur contenu (Directus
  distingue *Data Model* et *Content*). Non tranché — cf.
  [ADR-0028](../adr/ADR-0028-activation-entites.md).
