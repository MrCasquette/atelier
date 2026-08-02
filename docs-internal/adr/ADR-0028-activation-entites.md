# ADR-0028 — Prisme : activation à la carte, presets, masquer / supprimer

Statut : accepté · 2026-08-01
Portée : prisme

> **Jalon V2.** La V1 de Prisme est **headless, dev only** : le dev écrit ses entités, il n'y a ni
> preset ni écran d'activation. Tout ce qui suit décrit la V2, où Prisme devient un outil pour
> utilisateur final. La décision est prise maintenant parce qu'elle contraint le modèle de migration
> dès la V1 — on ne peut pas rendre les entités activables après coup sans revoir le drift guard.

## Contexte

Prisme doit servir un utilisateur qui n'écrit pas de code, sans devenir l'outil généraliste qui sait
tout faire et rien faire à la fois — le défaut de Shopify, WordPress ou Wix. Un CMS livré avec
douze tables « au cas où » est exactement ça : chaque entité inutilisée est du bruit permanent.

La condition est donc **sine qua non** : ou l'entité existe, ou elle n'existe pas.

## Options envisagées

- **Toutes les tables des presets existent toujours**, la case à cocher ne pilote que la visibilité
  en admin — migrations linéaires et triviales, mais des tables vides. **Écarté** pour la raison
  ci-dessus.
- **Activation conditionnelle** : la table est créée au moment où l'utilisateur active l'entité.

## Décision

**Une entité n'existe que si elle est activée.** Rien n'est livré « au cas où ».

**Un preset n'est pas un fichier SQL pré-écrit, c'est une déclaration livrée dans l'image**,
identique à celle qu'un dev écrirait. Activer `Article` exécute **exactement le même chemin de code**
que créer une entité sur mesure. Un seul mécanisme, deux origines : livrée ou écrite. Pas de branche
« preset » dans le code.

**Deux régimes de migration :**

| | Schéma | Migrations | Drift guard |
|---|---|---|---|
| **Cœur** — auth, média, pages, sections, registre | statique, décrit en TypeScript | linéaires, au démarrage | ✅ appliqué |
| **Entités** — presets et entités sur mesure | dynamique, décrit par les déclarations | à l'activation | ❌ hors périmètre |

C'est cohérent : le cœur est le framework, les entités sont le contenu de l'utilisateur. On ne garde
pas sous CI ce qui varie par installation.

**Le bouton « construire »** de l'admin est une **route protégée de l'API**, pas un webhook. Le
webhook sortant — reconstruire un front généré statiquement — est un sujet distinct, renvoyé au
backlog V2 avec les thèmes utilisateurs.

**Deux verbes distincts** au lieu d'un seul surchargé :

- **Masquer** — un drapeau sur la déclaration. La table reste, la donnée reste, les clés étrangères
  restent. Réversible instantanément, aucun risque. C'est le geste courant.
- **Supprimer** — **refusé si la table n'est pas vide. Jamais de cascade par défaut.** C'est le geste
  rare, et il est gardé. L'utilisateur qui veut vraiment supprimer vide son contenu d'abord, ce qui
  est un geste explicite.

## Conséquences

- **Le schéma d'une installation de Prisme n'est plus entièrement déterminé par les fichiers de
  migration.** Deux installations n'ont pas les mêmes tables. C'est le prix de la condition sine qua
  non, et il se paie sur le drift guard.
- Il faut un **journal des entités activées** — l'équivalent de `__drizzle_migrations` — indiquant
  quelles entités sont actives et à quelle version de leur déclaration. Sans lui, on ne sait pas
  répondre à « cette entité a-t-elle déjà sa table ».
- Une table vide ne peut apparaître que si l'utilisateur a activé puis masqué. Jamais par défaut.
- Le choix n'est pas irréversible : activer une entité six mois plus tard reste possible.

## Résolu depuis — le masquage est du RBAC

La question « masqué, c'est masqué où ? » est tranchée par
[ADR-0038](./ADR-0038-ressources-ouvertes-delegation.md) : **masquer, c'est retirer `canRead` à un
rôle**, pas poser un drapeau global.

Ça règle le cas qui rendait le drapeau insuffisant — cacher une entité à ses éditeurs tout en la
gardant active sur le front public : deux rôles, deux réponses. Le mécanisme existait déjà
(`permission(role, resource, canRead)`) ; il lui manquait de pouvoir nommer une ressource inconnue à
la compilation, ce que l'espace `entity:` apporte.
