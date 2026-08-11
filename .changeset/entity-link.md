---
'@mrcasquette/content': minor
---

Une entité peut déclarer son lien, et devenir citable.

Un article n'était pas référençable : ni dans un menu, ni dans un champ `ref`. Il fallait écrire
une cible à la main côté serveur — ce qui n'est pas le geste du dev qui déclare une entité. Une
ligne suffit désormais :

```ts
defineEntity('article', {
  fields: { titre: f.text({ required: true }), corps: f.richText() },
  link: { mode: 'route', route: '/blog/:slug' },
});

defineEntity('reseau_social', {
  fields: { nom: f.text(), url: f.text({ required: true }) },
  link: { mode: 'href', field: 'url' },   // l'entité PORTE son URL, elle n'est pas une page
});

defineEntity('tarif', {
  fields: { titre: f.text(), page: f.ref({ to: 'page' }) },
  link: { mode: 'anchor', parent: 'page' },   // /a-propos#tarifs
});
```

`link` est **optionnel** : une entité qui ne se visite pas ne se cite pas, et n'apparaît dans aucun
sélecteur. C'est le bon défaut, et un dépôt qui n'en déclare aucun pousse exactement le même JSON
qu'avant — rien à changer.

Les incohérences sont refusées à l'écriture de la déclaration, pas en production : un `href` qui
cite un champ inexistant, un `anchor` dont le parent n'est pas un `ref`, une route de liste sans
`:slug` — qui donnerait la même URL à toutes les occurrences —, ou un `:slug` sur un singleton, qui
n'en a pas.
