# create-echoppe

## 0.2.0

### Minor Changes

- dcdf7f2: Le compte propriétaire ne se configure plus dans `.env` : `ADMIN_EMAIL` et `ADMIN_PASSWORD`
  disparaissent du `.env` généré et du `compose.yaml` livré. Le compte se crée après le démarrage,
  par `docker compose exec -it api ./api admin:create`, qui demande e-mail et mot de passe au
  terminal — aucun mot de passe n'est donc écrit dans un fichier.

  Au passage, les commandes d'exploitation citées par le projet généré étaient inexécutables :
  l'image ne contient qu'un binaire compilé, sans `package.json`, donc `bun run api-key:create` n'y
  existait pas. Elles passent désormais par le binaire lui-même (`./api api-key:create …`).

- 01198f4: Le backend scaffoldé écoute désormais sur `8100` — le port publié appartient à l'instance, pas au
  produit, et le rang 0 revient à la boutique (ADR-0054). Une boutique déjà créée n'est pas affectée :
  son `.env` porte son propre `API_PORT`.
- cd6d7c9: Le `compose.yaml` scaffoldé monte le volume sur `/data` au lieu de `/app/uploads` (ADR-0056) : les
  données quittent le répertoire que l'image possède, et une nature ajoutée plus tard devient un
  sous-dossier sans volume à déclarer. Une boutique déjà créée doit déplacer ses fichiers d'un cran
  dans son volume avant de passer à cette image — cf. ADR-0056.

## 0.1.2

### Patch Changes

- 224c95f: Aligne le template scaffoldé sur la façade namespacée de `@echoppe/client`.

  Le template pin `@echoppe/client: "latest"` et appelait le client brut
  (`api.GET('/products/', …)`). Depuis `@echoppe/client@0.2.0`, `createEchoppeClient`
  renvoie la façade (`api.products.list()`, `api.products.bySlug(…)`, `api.raw` en
  échappatoire) — l'ancien pattern cassait tout store fraîchement généré. Les pages
  `index`, `produits/index` et `produits/[slug]` passent désormais par les namespaces.

## 0.1.0-next.1

### Patch Changes

- 494fd94: Valider le pipeline de release (Trusted Publishing OIDC, publication sans token).
