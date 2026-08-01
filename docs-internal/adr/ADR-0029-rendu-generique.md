# ADR-0029 — Prisme : rendu générique et front livré (V2)

Statut : accepté · 2026-08-01
Portée : prisme

> **Jalon V2.** La **V1 de Prisme est headless, dev only** : le dev écrit son front, comme pour
> Échoppe. Rien de ce qui suit n'existe en V1. La décision est prise maintenant parce qu'elle
> détermine ce que les déclarations doivent porter — notamment la `route` de
> [ADR-0032](./ADR-0032-cibles-referencables.md), qui, elle, est V1.

## Contexte

Les CMS modernes laissent un trou. Soit ils sont **headless** et excluent l'utilisateur final — une
entité créée sans dev n'est affichée nulle part, l'API expose la donnée et débrouille-toi (Strapi,
Directus). Soit ils reposent sur un **thème**, système visuel monolithique qu'on subit et contre
lequel on passe son temps à lutter (WordPress).

Les deux traitent le rendu comme du tout-ou-rien.

Trois profils d'utilisateurs, et non deux :

| Profil | Ce qu'il veut | Servi en V1 |
|---|---|---|
| **Standard, avec un dev** | éditer du contenu | ✅ |
| **Avancé, sans dev** | définir ses propres entités | ❌ |
| **Standard, sans dev** | un site qui marche tout de suite | ❌ |

Le troisième est le plus nombreux, et c'est le point décisif : **un constructeur de schémas ne lui
sert à rien.** Quelqu'un qui ne veut pas concevoir de schéma ne veut pas d'un écran pour concevoir
des schémas. Ce qu'il lui faut, c'est que le contenu s'affiche.

## Décision

### 1. Des rendus par défaut, remplaçables un par un — pas un thème

Le DSL décrit les champs par leur **intention** et non par leur stockage : `richText`, `image`,
`date`, `relation`. C'est ce qu'il faut pour rendre génériquement. Une entité déclarée obtient une
liste et une fiche composées champ par champ depuis les `kind`. Moche mais juste, et surtout :
**jamais zéro**.

**La granularité de remplacement est le champ, pas le site.** C'est la différence avec un thème : on
remplace un rendu de champ, un rendu d'entité, ou tout — sans jamais devoir tout reprendre.

### 2. Une section « liste d'entités »

Livrée avec le page-builder, où l'utilisateur choisit l'entité à afficher. Nouvelle entité
`Événement` → l'utilisateur pose la section sur une page, sélectionne `Événement`, c'est en ligne.
**Aucun dev.** Le page-builder existant devient le mécanisme de branchement.

### 3. Deux modes, et le framework ne rend jamais rien lui-même

C'est le point qui manquait à la première rédaction de cet ADR. Le framework **livre du code**, il
n'exécute pas de rendu. La responsabilité du front reste au dev — le rendu générique ne la supprime
pas, il supprime la page blanche.

| Mode | Front | Responsabilité | Jalon |
|---|---|---|---|
| **Headless** | écrit par le dev | intégralement au dev | **V1** |
| **Simplifié** | `apps/prisme-store`, livré en image Docker | à Prisme | **V2** |

`apps/prisme-store` est de même nature qu'`apps/store` côté Échoppe — une application du repo, pas un
paquet npm. **Pas de paquet de rendu** : le code est scaffoldé ou livré dans l'image.

Corollaire assumé, c'est le modèle shadcn/ui : **un correctif du rendu générique ne redescend jamais
dans un projet existant.** Acceptable pour des composants simples destinés à être remplacés.

### 4. Les thèmes V2 s'appliquent au front livré, pas au front du dev

C'est ce qui les rend possibles sans redevenir monolithiques : Prisme ne style que ce qu'il contrôle.

## Conséquences

- **C'est le différenciateur de Prisme, et il arrive en V2** : un CMS headless où l'utilisateur peut
  activer une entité et la voir en ligne le jour même, sans thème et sans dev. Ni Strapi ni Directus
  ne le font.
- Cette décision **ne dépend d'aucune décision de stockage** — le rendu travaille depuis la
  déclaration.
- `create-prisme` (scaffolding CLI) sert le profil **avancé**, pas le standard.
- La reconstruction du front livré après un changement de contenu — le *deploy hook* du headless —
  relève du même jalon. Cf. backlog V2.

## Question ouverte

Granularité de remplacement : par `kind` de champ, par entité, ou les deux ?
