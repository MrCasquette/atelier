# `@repo/assets` — les tables du média

Le paquet livre **deux définitions de tables** : `media` et `folder`. Rien d'autre — pas de service,
pas de route, pas de logique d'upload.

## Frontière

Ce paquet ne possède **aucune migration**. Chaque cœur produit inclut ces tables dans son barrel de
schémas, et donc dans son propre historique de migrations
([ADR-0025](../../docs-internal/adr/ADR-0025-deux-produits-un-repo.md)). Le SQL apparaît dans les deux
historiques : c'est correct, ce sont deux bases indépendantes.

Le stockage physique — arbre de dossiers sur disque local, nommage `UUID.ext` — est décrit par
[ADR-0018](../../docs-internal/adr/ADR-0018-stockage-media.md). Les dimensions sont exposées mais
aucune image n'est redimensionnée côté serveur
([ADR-0021](../../docs-internal/adr/ADR-0021-strategie-images.md)).

## Pourquoi ce paquet compte plus que sa taille ne le suggère

`media` est la **sonde d'extraction** d'ADR-0025 : c'est sur lui que se vérifie empiriquement la
thèse de la frontière des paquets. Le critère est explicite — *le paquet sort sans instance connectée,
et `db:generate` reste silencieux des deux côtés*.

**Conséquence pratique : aucune dépendance sortante ne doit être ajoutée ici.** La flèche va du
produit vers le paquet, jamais l'inverse. `product` peut référencer `media` ; `media` ne peut pas
référencer `product`. C'est exactement ce qui le rend extractible, et une seule dépendance ajoutée
dans le mauvais sens invaliderait la sonde.

Une relation qui traverse une frontière de paquet se déclare **dans le cœur**, pas ici.

## Dépendances

`drizzle-orm` seule.
