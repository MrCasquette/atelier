---
'@echoppe/client': minor
---

**Cassant** — `company` disparaît de la façade, remplacé par `identity`.

```diff
-const { data } = await client.company.get();
+const { data } = await client.identity.get();
```

La ressource porte désormais le nom qu'elle a côté API : l'identité du site — marque, contact
public, entité légale, pays.

**Nouveau : les entités référençables.** Une entité déclarée par `@mrcasquette/content` devient
interrogeable depuis le front, par liste et par slug :

```ts
await client.entities.list({ params: { path: { name: 'article' } } });
await client.entities.bySlug({ params: { path: { name: 'article', slug: 'mon-titre' } } });
```

Trois types s'exportent avec elles : `EntityResult`, `Identity` et `ErrorResponse` — ce dernier
étant la forme de faute que toute réponse d'erreur partage, nécessaire pour la rendre sans la
redéclarer à la main.
