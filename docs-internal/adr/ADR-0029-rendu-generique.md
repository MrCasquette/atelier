# ADR-0029 — Prisme : rendu générique, le branchement du contenu au front

Statut : accepté · 2026-08-01
Portée : prisme

## Contexte

Les CMS modernes laissent un trou. Soit ils sont **headless** et excluent l'utilisateur final — une
entité créée sans dev n'est affichée nulle part, l'API expose la donnée et débrouille-toi (Strapi,
Directus). Soit ils reposent sur un **thème**, système visuel monolithique qu'on subit et contre
lequel on passe son temps à lutter (WordPress).

Les deux traitent le rendu comme du tout-ou-rien.

Trois profils d'utilisateurs, et non deux :

| Profil | Ce qu'il veut | Servi par la définition en code seule ? |
|---|---|---|
| **Standard, avec un dev** | éditer du contenu | ✅ intégralement |
| **Avancé, sans dev** | définir ses propres entités | ❌ — le seul que le GUI récupérerait |
| **Standard, sans dev** | un site qui marche tout de suite | ❌ — et **le GUI ne l'aide pas non plus** |

Le troisième est le plus nombreux, et c'est le point décisif : **un constructeur de schémas ne lui
sert à rien.** Quelqu'un qui ne veut pas concevoir de schéma ne veut pas d'un écran pour concevoir
des schémas.

## Décision

**Des rendus par défaut dérivés de la déclaration, remplaçables un par un.** Pas un thème.

Le DSL décrit déjà les champs par leur **intention** et non par leur stockage : `richText`, `image`,
`date`, `relation`. C'est exactement ce qu'il faut pour rendre génériquement. Une entité déclarée
obtient sans intervention une liste et une fiche, composées champ par champ depuis les `kind`. Moche
mais juste, et surtout : **jamais zéro**.

**La granularité de remplacement est le champ, pas le site.** C'est la différence avec un thème : le
dev remplace un rendu de champ, un rendu d'entité, ou tout — sans jamais devoir tout reprendre.

**Une section « liste d'entités »** livrée avec le page-builder, où l'utilisateur choisit l'entité à
afficher. Nouvelle entité `Événement` → l'utilisateur pose la section sur une page, sélectionne
`Événement`, c'est en ligne. **Aucun dev.** Le page-builder existant devient le mécanisme de
branchement.

**Des presets d'entités livrés** — Article, FAQ, Événement, Membre — déjà déclarés et rendus. Le
profil « standard sans dev » n'invente rien, il remplit (cf.
[ADR-0028](./ADR-0028-activation-entites.md)).

## Conséquences

- **C'est le différenciateur de Prisme** : un CMS headless où l'utilisateur peut activer une entité
  et la voir en ligne le jour même, sans thème et sans dev. Ni Strapi ni Directus ne le font.
- Cette décision **ne dépend d'aucune décision de stockage** — le rendu travaille depuis la
  déclaration. Elle peut être construite indépendamment, et en premier.
- Elle est la brique sur laquelle s'appuieront les **thèmes utilisateurs V2**, ce qui évitera le
  thème monolithique.
- `create-prisme` (scaffolding CLI) sert le profil **avancé**, pas le standard. Il ne remplace pas
  les presets.

## Questions ouvertes

- Où vivent les rendus par défaut : un paquet npm installé dans le front — donc lié à un framework —
  ou une convention de composants scaffoldée par la CLI ?
- Granularité de remplacement : par `kind` de champ, par entité, ou les deux ?
