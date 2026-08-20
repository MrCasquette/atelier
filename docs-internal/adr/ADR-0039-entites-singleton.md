# ADR-0039 — Cardinalité d'une entité : singleton déclaré, borne haute seulement

Statut : accepté · 2026-08-02
Portée : content

## Contexte

Certaines entités n'ont qu'une occurrence — CGV, politique de livraison, page « à propos » —, d'autres
sont des listes — articles, événements, membres. [systeme-contenu-leger.md](../backlog/systeme-contenu-leger.md)
posait la question sans la trancher : « singleton vs liste, contrainte au niveau schéma ou au niveau
type déclaré ? »

Un singleton demande quatre choses, dont une seule est structurelle :

| | |
|---|---|
| **UI** | pas d'écran de liste, on ouvre directement le formulaire |
| **Route** | `/content/cgv` et non `/content/cgv/:slug` |
| **Garantie** | le code lit sans gérer « plusieurs » |
| **Slug** | inutile |

## Options envisagées

- **Aucune distinction** — un singleton serait une liste dont on ne crée qu'un élément.
- **Les singletons sont des réglages** — écarté : des CGV sont du **contenu**, pas de la
  configuration. [ADR-0034](./ADR-0034-identite-referentiel-reglages.md) a déjà tracé cette ligne.
- **Une propriété déclarée.**

L'absence de distinction n'est pas seulement moins pratique, elle est **ambiguë** : une liste à un
élément est indistinguable d'un singleton, donc l'UI ne peut pas décider quoi afficher — et si elle
ouvre directement le formulaire, elle empêche la création d'un second élément.

## Décision

**Une propriété déclarée**, et la contrainte descend en base :

```sql
singleton boolean NOT NULL DEFAULT true UNIQUE CHECK (singleton)
```

Une seule valeur possible, unique — donc **au plus une ligne**, garanti par Postgres. Cohérent avec
[ADR-0027](./ADR-0027-entites-tables-reelles.md) : les garanties vivent dans la base, pas dans le
code.

### Borne haute seulement — 0 ou 1

**Aucune ligne n'est créée à l'activation.** La contrainte empêche le second enregistrement ; elle
n'impose pas le premier.

L'alternative — créer la ligne d'emblée avec les valeurs par défaut — donnerait « exactement 1 » et
dispenserait le front de gérer l'absence. Elle a été écartée : elle fabrique une fiche que personne
n'a demandée, et dont les champs obligatoires sont vides — donc une ligne valide en base et invalide
au regard du schéma déclaré.

Conséquence assumée : **le consommateur doit gérer le cas absent.** C'est le prix de ne rien
fabriquer d'office.

### Changer de cardinalité

| Sens | Comportement |
|---|---|
| singleton → liste | toujours sûr — la contrainte est retirée |
| liste → singleton | **refusé si la table contient plus d'une ligne** |

Refus plutôt que perte, conformément à la règle de `prisme:check`
([ADR-0027](./ADR-0027-entites-tables-reelles.md)) : jamais de destruction implicite.

## Conséquences

- Le drapeau pilote l'UI d'administration — formulaire direct plutôt que liste — et la forme de la
  route publique.
- Un singleton n'a pas de slug ; son identité est son nom d'entité.
- Coût total : un drapeau dans la déclaration, une colonne générée, une garde à la migration.

## Question ouverte

**Que renvoie l'API pour un singleton non renseigné ?** Un 404 dit « rien ici », ce qui est exact ;
un 200 avec un corps vide simplifie le front, qui rend une page dans les deux cas. À trancher avec la
surface storefront, encore non arrêtée.

## Amendement 2026-08-10 — un singleton non renseigné rend 200, pas 404

La question ouverte de cet ADR — « un 404 dit rien ici, ce qui est exact ; un 200 avec un corps vide
simplifie le front » — est tranchée en faveur du 200.

Le raisonnement n'est pas le confort du front, c'est qu'il y a **deux situations distinctes** et
qu'un 404 les confond :

| Situation | Réponse | Ce que ça veut dire |
|---|---|---|
| Singleton déclaré, jamais renseigné | `200 { data: null }` | une tâche à faire |
| Singleton non déclaré | `404` | une erreur de code |

La première est un état normal du produit : le dev a déclaré `ParametresSite`, personne ne l'a encore
rempli. La seconde est un bug — le front demande une entité qui n'existe pas au registre. Les
confondre oblige le front à deviner laquelle des deux il a sous les yeux, et il ne peut pas.

Un singleton EXISTE dès qu'il est déclaré : c'est la déclaration qui le fait exister, pas sa
première écriture. Le 200 dit exactement ça.
