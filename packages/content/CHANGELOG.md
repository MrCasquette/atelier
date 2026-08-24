# @echoppe/content

## 0.4.0

### Minor Changes

- b565d5b: Les paquets publiés changent de nom (ADR-0063). `@mrcasquette/content` devient
  `@axiome-apps/atelier-content`, `@echoppe/client` devient `@axiome-apps/echoppe-client`.

  Le scope dit qui publie, le préfixe du nom dit à quoi le paquet appartient — `atelier-` pour ce qui
  est partagé par les deux produits, le nom du produit pour ce qui lui appartient. `create-echoppe`
  garde son nom nu : `npm create echoppe` exige un paquet nommé exactement ainsi.

  Les anciens noms cessent d'être mis à jour. Rien ne casse pour une installation existante, mais elle
  n'aura plus de version nouvelle : `bun add @axiome-apps/echoppe-client` remplace
  `bun add @echoppe/client`, à version égale.

### Patch Changes

- 3e23f1e: Plus aucune assertion de type dans ces paquets.

  `@axiome-apps/atelier-content` — `defineContent` passe par deux surcharges au lieu d'un paramètre de type
  par défaut, et les constructeurs de champs composent par `Object.assign`, dont la signature produit
  nativement l'intersection qu'on affirmait. La surface publique et les types inférés sont identiques.
  Reste une exception, signalée dans le code : `asSections` est par construction une affirmation —
  sans validation, aucune expression ne mène de `RawSection[]` au type déclaré par le développeur.

  `create-echoppe` — le `package.json` du template est vérifié avant d'être personnalisé. Un fichier
  tronqué à l'installation échouait trois lignes plus loin, sur une propriété absente.

  `@axiome-apps/echoppe-client` — le générateur du SDK vérifie que la spec OpenAPI téléchargée porte bien des
  chemins, au lieu de l'affirmer. Le contrat produit est identique, `contracts:check` le confirme.

## 0.3.0

### Minor Changes

- b1b0fe0: **Cassant** — les variables d'environnement de la CLI perdent le nom d'Échoppe.

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

- 7a3c996: Les entités : `defineEntity`, et un `push` qui dérive de vraies tables.

  Une section est un contrat avec un composant de votre front — sortie de lui, sa donnée n'a pas de
  sens, et le jsonb y est correct. Une entité, non : un `Article` reste un article. Elle va donc en
  **vraies colonnes**, dans sa propre table.

  ```ts
  export default defineContent({
    sections: [hero],
    entities: [
      defineEntity("article", {
        label: "Articles",
        fields: { titre: f.text({ required: true }), corps: f.richText() },
      }),
      defineEntity("cgv", { singleton: true, fields: { corps: f.richText() } }),
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

- aa00205: Une entité peut déclarer son lien, et devenir citable.

  Un article n'était pas référençable : ni dans un menu, ni dans un champ `ref`. Il fallait écrire
  une cible à la main côté serveur — ce qui n'est pas le geste du dev qui déclare une entité. Une
  ligne suffit désormais :

  ```ts
  defineEntity("article", {
    fields: { titre: f.text({ required: true }), corps: f.richText() },
    link: { mode: "route", route: "/blog/:slug" },
  });

  defineEntity("reseau_social", {
    fields: { nom: f.text(), url: f.text({ required: true }) },
    link: { mode: "href", field: "url" }, // l'entité PORTE son URL, elle n'est pas une page
  });

  defineEntity("tarif", {
    fields: { titre: f.text(), page: f.ref({ to: "page" }) },
    link: { mode: "anchor", parent: "page" }, // /a-propos#tarifs
  });
  ```

  `link` est **optionnel** : une entité qui ne se visite pas ne se cite pas, et n'apparaît dans aucun
  sélecteur. C'est le bon défaut, et un dépôt qui n'en déclare aucun pousse exactement le même JSON
  qu'avant — rien à changer.

  Les incohérences sont refusées à l'écriture de la déclaration, pas en production : un `href` qui
  cite un champ inexistant, un `anchor` dont le parent n'est pas un `ref`, une route de liste sans
  `:slug` — qui donnerait la même URL à toutes les occurrences —, ou un `:slug` sur un singleton, qui
  n'en a pas.

- aa53979: Le schema est une séquence de champs, pas un dictionnaire.

  **Ce qui change pour vous : rien dans vos fichiers.** On continue d'écrire un objet littéral, qui
  est la bonne syntaxe pour déclarer :

  ```ts
  defineSection("legal", {
    fields: { titre: f.text(), sousTitre: f.text(), corps: f.richText() },
  });
  ```

  C'est la **sérialisation** qui change : `fields` est désormais poussé comme un tableau ordonné
  `[{ name: 'titre', kind: 'text' }, …]` au lieu d'un objet indexé par nom. Repoussez votre contenu
  après mise à jour (`content push`) — une déclaration restée à l'ancien format sera refusée.

  **Pourquoi.** L'ordre dans lequel vous déclarez vos champs est l'ordre du formulaire
  d'administration, et celui des colonnes d'une entité. Or aucune construction à clés ne le garantit :
  `jsonb` trie les clés d'un objet par longueur puis octet, si bien que `titre, sousTitre, corps`
  ressortait `corps, titre, sousTitre`. Un tableau, lui, est ordonné par définition.

  **Deux bornes nouvelles**, toutes deux refusées avec un message qui dit où corriger :

  - **un nom de champ commence par une lettre.** `{ '2024': f.text() }` est déjà réordonné par
    JavaScript dans votre objet littéral — les clés qui ressemblent à un index de tableau sont
    énumérées en tête —, avant toute sérialisation. On ne peut donc pas tenir l'ordre pour ces
    noms-là : on les refuse plutôt que de le promettre.
  - **deux champs ne peuvent pas porter le même nom.** Un objet l'interdisait gratuitement, un tableau
    l'admet. La vérification est explicite, sur les sections comme sur les entités.

  Un répéteur imbriqué dans un répéteur reste déclarable et rendu — rien n'est retiré au langage.

- 823d9c3: `RefTarget` n'énumère plus les entités d'Échoppe.

  Le type valait `'product' | 'collection' | 'category'` — le vocabulaire de l'e-commerce écrit dans
  un paquet que tout produit consomme. Un dev qui voulait référencer ses propres entités, ou un CMS
  qui n'a pas de produits, n'avaient aucun moyen de le dire.

  `RefTarget` est désormais un nom libre, vérifié à la synchronisation : l'API refuse un registre qui
  cite une cible qu'elle n'a pas inscrite, en nommant le champ fautif. Un nom inconnu devient une
  erreur de `pushRegistry`, plus un échec au type-check.

  Rien à changer dans un projet existant : `f.ref({ to: 'product' })` reste valide tant qu'Échoppe
  inscrit `product`, ce qu'elle fait. L'élargissement ne casse que le code qui NARROWAIT sur le type
  — exhaustivité d'un `switch` sur `RefTarget`, par exemple.

## 0.1.0

### Minor Changes

- 2383a29: Première publication de `@echoppe/content` — le package build/dev-time du module contenu (page builder headless). Fournit les builders `defineComponent`/`defineSection`/`defineContent`, le vocabulaire de champs `field`/`f`, l'inférence de types front (`InferData`/`InferSections`, `asSections`) et la CLI `push`/`check` (synchronisation du registre de blocs vers l'API + garde-fou anti-dérive).
