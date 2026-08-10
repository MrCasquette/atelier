---
'@mrcasquette/content': minor
---

Les entités : `defineEntity`, et un `push` qui dérive de vraies tables.

Une section est un contrat avec un composant de votre front — sortie de lui, sa donnée n'a pas de
sens, et le jsonb y est correct. Une entité, non : un `Article` reste un article. Elle va donc en
**vraies colonnes**, dans sa propre table.

```ts
export default defineContent({
  sections: [hero],
  entities: [
    defineEntity('article', {
      label: 'Articles',
      fields: { titre: f.text({ required: true }), corps: f.richText() },
    }),
    defineEntity('cgv', { singleton: true, fields: { corps: f.richText() } }),
  ],
});
```

`content check` montre le SQL qu'un push appliquerait, `content push` l'applique. Une opération qui
détruit des données — colonne retirée, entité supprimée — est **refusée** et dit ce qu'elle aurait
emporté ; `content push --force` la confirme. Une entité dont la table n'est pas vide n'est jamais
supprimée, et jamais en cascade.

`singleton: true` garantit **au plus une** occurrence, par une contrainte en base et non par du
code. Aucune ligne n'est créée d'office : votre front doit gérer le cas non renseigné.

**Deux points d'attention pour un projet existant :**

- `push` demande désormais la portée `write:schema` sur votre clé d'API, et non plus
  `write:content`. Redéfinir ce qu'EST une section est un acte de structure, pas d'édition — un
  éditeur ne doit pouvoir qu'éditer. `check` demande en plus `read:schema`.
- Un dépôt qui ne déclare aucune entité pousse exactement le même JSON qu'avant : rien à changer.
