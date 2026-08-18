# @echoppe/client

## 0.7.0

### Minor Changes

- 7d0f246: **Cassant** — `company` disparaît de la façade, remplacé par `identity`.

  ```diff
  -const { data } = await client.company.get();
  +const { data } = await client.identity.get();
  ```

  La ressource porte désormais le nom qu'elle a côté API : l'identité du site — marque, contact
  public, entité légale, pays.

  **Nouveau : les entités référençables.** Une entité déclarée par `@mrcasquette/content` devient
  interrogeable depuis le front, par liste et par slug :

  ```ts
  await client.entities.list({ params: { path: { name: "article" } } });
  await client.entities.bySlug({
    params: { path: { name: "article", slug: "mon-titre" } },
  });
  ```

  Trois types s'exportent avec elles : `EntityResult`, `Identity` et `ErrorResponse` — ce dernier
  étant la forme de faute que toute réponse d'erreur partage, nécessaire pour la rendre sans la
  redéclarer à la main.

## 0.6.0

### Minor Changes

- 4e5a8b4: Expose l'`id` de la variante par défaut (`defaultVariant.id`) sur les cartes produit
  (`GET /products/`, `/categories/:id/products`, `/collections/:id/products`,
  `/products/:id/related`). Auparavant seuls `priceHt`/`compareAtPriceHt`/`quantity` étaient
  exposés — sans id, un storefront ne peut pas cibler cette variante depuis une carte (ex. wishlist,
  ajout panier direct) sans repasser par la fiche produit détaillée.

## 0.5.0

### Minor Changes

- 88be355: Storefront 0.5.0 — nouvelles capacités catalogue + rupture de contrat image.

  **BREAKING (contrat image)** — les références image du contrat storefront passent d'un UUID nu à une
  ref `{ id, width, height }` : `featuredImage`, `images[]`, `variant.featuredImage`, `swatch.image`.
  Le framework n'optimise pas les images (pas de resize serveur) ; il expose l'original + ses
  dimensions intrinsèques, à charge du storefront de bâtir son `<Image>` (anti-CLS). Migration
  boutique : `featuredImage` → `featuredImage.id` pour l'URL ; `width`/`height` désormais disponibles.
  Cf. ADR-0021.

  - **Tri** `sort`/`order` sur `/categories|collections/{id}/products` — même vocabulaire que la liste
    globale (`price`/`name`/`dateCreated`). Défaut : plus récent d'abord (B4).
  - **Wishlist** client — `GET/POST/DELETE /wishlist` (surface authentifiée, sur variantes) (B7).
  - **Produits liés** — `GET /products/{id}/related` : curation admin ordonnée + fallback voisinage si
    vide (B8, ADR-0022).
  - **Tags** produit exposés sur cartes + détail (B3).

## 0.4.0

### Minor Changes

- dc01188: Contrat storefront enrichi (options typées & swatches). La carte produit expose
  désormais `swatches[]` (`optionValueId`, `label`, `color` rendue en oklch, `image` de
  variante) ; les options de `ProductDetail` portent `type` (`string` | `color`) et
  `metadata` couleur oklch (`{ l, c, h, alpha }`). La pagination gagne `hasNextPage` /
  `hasPrevPage`. Ajouts rétrocompatibles.

## 0.3.0

### Minor Changes

- 5abc7c7: Ajout de la navigation : `echoppe.menus.byHandle({ params: { path: { handle } } })` expose les menus résolus du storefront (arbre d'items récursif, liens URL ou entités internes projetées). Le générateur du SDK normalise désormais les schémas récursifs (TypeBox `t.Recursive`) en composants nommés → type `MenuItemResolved` correctement récursif côté client.

## 0.2.0

### Minor Changes

- 985e216: Façade ressource namespacée + nouvelle surface storefront.

  - **Façade namespacée** : `createEchoppeClient` renvoie désormais des namespaces
    typés (`products`, `cart`, `checkout`, `auth`, `account`, `addresses`,
    `orders`, `pages`, …) au lieu du client brut. Le client `openapi-fetch` reste
    accessible en échappatoire via `echoppe.raw`. **Breaking** pour les appels
    directs `client.GET(...)` → passer par les namespaces ou `.raw`.
  - **Espace client** : `orders.list()` / `orders.get()`, `account.updateProfile()`,
    `auth.changePassword()`, `auth.forgotPassword()`, `auth.resetPassword()`.
  - **Panier enrichi** : la ligne panier expose `compareAtPriceHt` et `optionValues`.
  - **Content (page builder P1)** : `pages.list()` et `pages.bySlug()`.

## 0.1.0-next.1

### Patch Changes

- 494fd94: Valider le pipeline de release (Trusted Publishing OIDC, publication sans token).
