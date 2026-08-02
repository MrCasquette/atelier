# ADR-0036 — Cycle de vie du contenu : un statut déclaré, pas de versionnement

Statut : accepté · 2026-08-02
Portée : content

## Contexte

Un CMS est attendu sur le versionnement : historique des révisions, comparaison, restauration,
publication planifiée, flux de validation. Directus le fait ; il l'a d'ailleurs **retiré de son
gabarit par défaut**, signe que le besoin est moins universel qu'il n'y paraît.

Le repo n'a aujourd'hui qu'un booléen : `contentStatusEnum` (`draft` | `published`).

## Décision

**Pas d'historique de révisions, pas de flux de validation, pas de publication planifiée.**

L'état d'un contenu est un **champ déclaré** comme un autre — un `select` que le dev ou
l'administrateur définit avec les valeurs qui lui conviennent. Le framework n'impose pas de machine
à états.

Motif : **Prisme est volontairement léger.** Ce n'est pas un CMS d'équipe marketing, c'est un CMS
pour utilisateur final. Le versionnement sert des organisations où plusieurs personnes se relisent —
un public que Prisme ne vise pas. L'ajouter reviendrait à payer la complexité d'un outil d'équipe
pour servir une personne seule.

## Conséquences

- Aucune table d'historique, aucune duplication de contenu à chaque enregistrement. Le modèle de
  données reste celui d'[ADR-0027](./ADR-0027-entites-tables-reelles.md) : une ligne par fiche.
- Une erreur d'édition n'est pas rattrapable depuis l'outil. C'est assumé — les sauvegardes de base
  de données restent le filet, comme pour toute autre donnée.
- Si le besoin apparaît, il s'ajoutera sans rien casser : une table d'historique se greffe sur un
  modèle existant. L'inverse — retirer un versionnement en place — serait coûteux.

## Question ouverte

**La prévisualisation d'un brouillon.** Ce n'est pas du versionnement : c'est la capacité, pour un
visiteur autorisé, de voir un contenu non publié sur le front. Elle suppose un jeton transmis au
front et honoré par l'API, et elle a du sens même sans historique. À traiter séparément, côté front.
