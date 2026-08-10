# ADR-0032 — Cibles référençables : le lien déclaré, la résolution ouverte

Statut : accepté · 2026-08-01
Portée : content

> **Jalon V1.** C'est un correctif de dette, pas une fonctionnalité utilisateur — il ne doit pas être
> repoussé. Même avec un dev qui écrit son front, l'éditeur de menus de l'admin doit proposer un
> choix de cibles.

## Contexte

Le module contenu connaît le catalogue en dur. La même union apparaît à cinq endroits :

| Fichier | Occurrence |
|---|---|
| `schema/content.ts` | `MenuLink.target: 'url' \| 'page' \| 'product' \| 'collection' \| 'category'` |
| `models/menu.ts` | **3 fois** — écriture (l. 20-22), lecture (l. 54 et l. 72-74) |
| `models/content.ts` | `refTarget` (l. 24) |
| `packages/content/src/types.ts` | `RefTarget` (l. 74) — **dans le paquet publié** |
| `services/menu-resolve.ts` | **fichier entier** : importe `product`, `collection`, `category` depuis le core et fait trois requêtes de projection |
| `composables/content/useCatalogRef.ts` | la contrepartie admin |

`menu-resolve.ts` est un résolveur **fermé** là où il faut un registre : un menu n'a pas à être codé
en dur dans un service. Et `RefTarget` fait dépendre le paquet de contenu — que Prisme consommera —
du vocabulaire de l'e-commerce.

## Options envisagées

- **Rendre le lien opaque** (`{ target: string, value: string }`) et laisser le front résoudre — le
  couplage disparaît, mais l'admin ne peut plus proposer que des URL saisies à la main. Régression
  d'UX réelle.
- **Garder `page` en dur** et n'ouvrir que le reste — demi-mesure : la mécanique reste spécifique.
- **Un registre de cibles référençables**, déclaré comme le sont les sections.

## Décision

**Un registre de cibles référençables**, et la résolution **côté API**.

Le front qui reçoit un menu veut des libellés et des URL, pas douze requêtes à enchaîner. L'API sait
résoudre parce que le registre le lui dit — c'est exactement la différence avec `menu-resolve.ts`,
qui sait résoudre parce que c'est écrit en dur.

### Opt-in, jamais opt-out

**Ce qui rend une entité référençable, ce n'est pas d'être déclarée, c'est d'avoir une URL.** Une
entité n'entre au registre que si elle déclare comment elle produit un lien. Silence = invisible dans
le sélecteur — un `SchémaDeCouleurs` ou un `SchémaDIcônes` ne pollue rien sans avoir à être marqué
négativement.

### Trois modes de production de lien

| Mode | Déclaration | Cas |
|---|---|---|
| **Route interne** | `route: '/articles/:slug'` | `Article`, `Produit`, `Collection`, `Catégorie`, `Page` |
| **URL portée par un champ** | `href: 'url'` | `LienRéseauSocial` — l'entité *contient* l'URL, elle n'*est* pas une page |
| **Ancre** | dérivée de la page parente + identifiant | une section : `/a-propos#tarifs` |
| *(aucune)* | — | entités purement métier, non liables |

Les deux premiers modes sont distincts et pas réductibles l'un à l'autre : un article *est* une page,
un lien de réseau social *porte* une URL.

L'ancre est le seul mode asymétrique — une section n'a pas de route à elle, son lien se dérive de sa
page parente.

### La déclaration fait foi

Si le dev remplace le rendu par sa propre page, rien ne garantit techniquement que la `route`
déclarée reste vraie. Un garde au build du front serait fiable, mais supposerait que le framework
inspecte le projet du dev — contraire au modèle « front hors framework »
([ADR-0001](./ADR-0001-stack-storefront.md), [ADR-0002](./ADR-0002-distribution.md)).

**Un lien cassé est un 404, pas une corruption.** Le coût d'un garde n'est pas justifié.

## Conséquences

- Les cinq points de couplage tombent, **`RefTarget` compris dans le paquet publié**. Le paquet de
  contenu cesse de connaître le vocabulaire de l'e-commerce.
- Échoppe déclare `produit`, `collection`, `catégorie` ; Prisme déclare ses entités. Le framework ne
  sait plus que « il existe des cibles, et voici comment les lister et les résoudre ».
- Le couplage n'est pas supprimé mais **converti en point d'extension** : une entité déclarée devient
  référençable sans code.
- La `route` sert **deux fois** : ici, et au rendu générique de
  [ADR-0029](./ADR-0029-rendu-generique.md) qui en dérivera la page à produire. Une seule
  information, donc pas de divergence possible entre ce que l'admin croit et ce que le front sert.
- `menu-resolve.ts` est réécrit comme résolveur générique piloté par le registre.

## Amendement 2026-08-10 — une entité se nomme `entity:<nom>`, partout

Le registre de cibles est implémenté (#8) et ne connaît aujourd'hui que des cibles natives, nommées
nûment : `page`, `product`, `collection`, `category`. Les entités ([ADR-0027](./ADR-0027-entites-tables-reelles.md))
vont s'y inscrire. Sous quel nom ?

**Le même préfixe que pour le RBAC** : [ADR-0038](./ADR-0038-ressources-ouvertes-delegation.md) pose
déjà `entity:${string}` pour l'espace des ressources. L'étendre aux cibles donne un vocabulaire
unique — un nom, un préfixe, valable des permissions aux liens.

| | Natif (framework) | Entité (dev) |
|---|---|---|
| Ressource RBAC | `content`, `media` | `entity:article` |
| Cible référençable | `page`, `product` | `entity:article` |
| Table | `page` | `article` |

**Ce qui décide, c'est la collision.** Sans préfixe, un dev qui nomme son entité `page` écrase la
cible native du même nom. `createReferenceRegistry` refuse déjà un doublon — mais il le refuse **au
démarrage**, donc après que la poussée a été acceptée : l'installation redémarre en erreur sur un
registre que l'API avait validé. Le préfixe rend la collision impossible par construction, sans garde
supplémentaire à écrire ni à maintenir.

Bénéfice second : un lecteur voit d'un coup d'œil si un nom vient du framework ou du dev.
