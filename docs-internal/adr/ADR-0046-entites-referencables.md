# ADR-0046 — Une entité déclare son lien, et devient référençable sans code

Statut : accepté · 2026-08-10
Portée : content

## Contexte

[ADR-0032](./ADR-0032-cibles-referencables.md) a ouvert le registre de cibles et déclaré **trois**
modes de production de lien. Un seul est résolu :

| Mode | État | Ce qu'il sert |
|---|---|---|
| `{ mode: 'route', route }` | résolu | l'entité EST une page — `/produits/:slug` |
| `{ mode: 'href', field }` | déclaré, rendu `null` | l'entité PORTE une URL — un lien de réseau social |
| `{ mode: 'anchor', parent }` | déclaré, rendu `null` | l'entité n'a pas de route — `/a-propos#tarifs` |

Et surtout : **aucune entité n'est inscrite au registre**. Le mécanisme d'ADR-0027 sait dériver une
table, pas la rendre citable. La promesse d'ADR-0032 — « une entité déclarée devient référençable
sans code » — n'est donc pas tenue : elle demande encore d'écrire un `ReferenceTarget` à la main,
ce que le dev d'une entité ne fait pas.

## Décision

### 1. L'entité déclare son lien, dans le DSL

`defineEntity` accepte un `link` optionnel, de la même forme que celle du registre :

```ts
defineEntity('article', {
  fields: { titre: f.text(), corps: f.richText() },
  link: { mode: 'route', route: '/blog/:slug' },
});

defineEntity('reseau_social', {
  fields: { nom: f.text(), url: f.text({ required: true }) },
  link: { mode: 'href', field: 'url' },
});

defineEntity('tarif', {
  fields: { titre: f.text(), page: f.ref('page') },
  link: { mode: 'anchor', parent: 'page' },
});
```

**Optionnel, et le silence n'est pas une faute.** ADR-0032 pose que ce qui rend une entité
référençable n'est pas d'être déclarée mais d'avoir une URL — une entité sans `link` n'entre pas au
registre, et n'apparaît donc pas dans le sélecteur. Même forme que le `storage` d'[ADR-0045](./ADR-0045-cles-etrangeres-entites.md) :
opt-in, silence légitime.

Le `link` voyage dans le registre poussé et s'inscrit au journal, comme le reste de la déclaration.
Un dépôt qui n'en déclare aucun pousse le même JSON qu'avant.

### 2. `href` et `anchor` nomment un CHAMP, pas un concept

ADR-0032 laissait `parent: string` ambigu — nom de cible ou nom de champ ? On tranche : **les deux
modes nomment un champ de l'entité**.

- `href` → le champ porte l'URL, en clair.
- `anchor` → le champ est un `ref` vers l'entité parente ; son mode `route` fournit le chemin, et
  le slug de l'entité fournit l'ancre.

C'est le seul choix qui rende le mécanisme générique : un mode qui nommerait un concept devrait
deviner par où l'atteindre, et une entité peut parfaitement référencer deux pages.

### 3. La cible calcule l'URL quand la déclaration ne suffit pas

`EntityProjection` gagne un `url?: string | null`, rempli par `project()` et `search()`.

`linkUrl` devient :

| Mode | Résolution |
|---|---|
| `route` | substitue `:slug` — inchangé, aucune donnée supplémentaire n'est nécessaire |
| `href` | rend `url` |
| `anchor` | rend `url` |

L'alternative — passer la ligne brute à `linkUrl` — a été écartée : elle ferait voyager toute
l'entité pour deux modes, et obligerait `linkUrl` à savoir joindre une table parente. Or c'est
précisément ce que la cible sait faire et que le socle ne doit pas savoir : `project()` est déjà
l'endroit où l'on interroge la base.

Conséquence assumée : **une projection porte parfois une URL déjà calculée.** Elle reste ce qu'elle
a toujours été — de quoi afficher et lier une entité — mais pour deux modes, lier demande une
lecture que seule la cible peut faire.

### 4. Les entités s'inscrivent à la poussée, comme leur ressource RBAC naît à la poussée

Même événement que celui d'[ADR-0038](./ADR-0038-ressources-ouvertes-delegation.md), pour la même
raison : la SSOT, ce sont les fichiers du dev. Le registre est donc **synchronisé** depuis le
journal — au démarrage de l'API, et après chaque push.

Différence avec la ressource RBAC, qui elle est purement dérivée : le registre est un objet vivant,
avec des cibles inscrites par le produit à l'import. La synchronisation ne le remplace pas — elle
ne touche qu'aux cibles `entity:`, et laisse `product`, `page`, `collection` intactes. D'où un
`unregister` sur le registre, qui n'existait pas : jusqu'ici une inscription était définitive parce
qu'elle venait toujours d'un import.

Le préfixe `entity:` rend la frontière nette et la collision impossible : une entité nommée `page`
s'inscrit sous `entity:page` et n'écrase rien (ADR-0032, amendement).

### 5. Une entité inscrite hérite de ses clés étrangères

Elle déclare `storage: { table: 'entity_<nom>' }` comme n'importe quelle cible, et ADR-0045 fait le
reste. Un `ref('entity:article')` porte donc une vraie clé étrangère, et la suppression de
l'entité `article` est refusée tant que quelque chose la référence — ce qu'ADR-0045 avait anticipé
sans pouvoir l'éprouver.

## Conséquences

- Un dev rend son entité citable dans un menu et dans un champ `ref` en ajoutant **une ligne** à sa
  déclaration. C'est la promesse d'ADR-0032, tenue.
- Les trois modes d'ADR-0032 sont résolus. `linkUrl` ne rend plus `null` par défaut d'implémentation,
  seulement quand la donnée manque réellement.
- Le registre devient mutable en cours d'exécution. Borné : seules les cibles `entity:` bougent, et
  seule la synchronisation les touche.
- Rupture douce du DSL publié : `link` est optionnel, un dépôt existant pousse le même JSON.

## Ce que cet ADR ne tranche pas

- **Le rendu.** Le storefront ne consomme encore aucun menu ; produire l'URL et l'afficher sont deux
  choses, et la seconde reste à faire.
- **La validation de `link` contre les champs déclarés.** Un `href` qui nomme un champ inexistant,
  ou un `anchor` qui nomme un champ qui n'est pas un `ref`, doit être refusé au push — c'est une
  cohérence de registre, du même ordre que `unknownRefTargets`. Nommé ici, fait dans la tâche.
