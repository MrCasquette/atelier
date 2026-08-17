---
'@mrcasquette/content': major
---

**Cassant** — les variables d'environnement de la CLI perdent le nom d'Échoppe.

`ECHOPPE_API_KEY` devient **`CONTENT_API_KEY`**, `ECHOPPE_CONTENT_CONFIG` devient
**`CONTENT_CONFIG`**. Aucune lecture de repli sur les anciens noms : une clé absente arrête la CLI
avec un message qui nomme la variable attendue, donc la migration se voit au premier `push`.

Le package ne connaît pas le produit qui le consomme — il pousse un registre de blocs vers une API,
et cette API n'est pas nécessairement une boutique. Ses variables portaient pourtant le nom d'un
produit, ce qui obligeait tout autre consommateur à réclamer une clé d'Échoppe pour synchroniser son
propre contenu. Le nom suit désormais le package.

Migration : dans le `.env` de votre front,

```diff
-ECHOPPE_API_KEY=eck_votre_cle
+CONTENT_API_KEY=eck_votre_cle
```

`PUBLIC_API_URL` (ou `API_URL`) ne change pas. `create-echoppe` scaffolde le nouveau nom.
