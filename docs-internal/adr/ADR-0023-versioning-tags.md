# ADR-0023 — Versioning : épine `v*` produit, packages versionnés sur npm

Statut : accepté · 2026-07-20 · amende [ADR-0002](./ADR-0002-distribution.md), [ADR-0004](./ADR-0004-migrations-release.md)

## Contexte

Le monorepo (ADR-0002) publie plusieurs artefacts : les **images** api+admin (produit déployable) et
trois **packages npm** (`@echoppe/client`, `@mrcasquette/content`, `create-echoppe`). L'action changesets
crée **un git tag + une GitHub Release à chaque publication de package**. Résultat observé au 2026-07-20 :

- 20 tags git entrelacés (`v0.1.0…v0.5.0`, `@echoppe/client@*`, `create-echoppe@*`, + des `-next.*` morts) ;
- **8 GitHub Releases, toutes des packages** — aucune Release `v*`. Le « Latest » du repo est
  `@echoppe/client@0.5.0`, illisible pour qui cherche « quelle version d'Échoppe déployer ».

Le **découplage par package est acté et sain** (ADR-0002 : repo ≠ package ; chaque package évolue avec
son propre code — un bump n'est pas forcément partout, et bumper un package sans changelog est absurde).
Le problème n'est **pas** le modèle de versions mais sa **présentation** : il manque une colonne
vertébrale produit lisible, et les versions de package polluent la vue au lieu de vivre là où est leur
registre de vérité — **npm**.

## Options envisagées

- **Multi-repos** (1 repo par package, tag par repo) — rejeté : casse l'atomicité `core`⇄`api`⇄SDK qui
  justifie le monorepo (ADR-0002), multiplie CI et PR cross-repo pour un problème d'affichage.
- **Lockstep total** (une seule version pour tout) — rejeté : produit des bumps à changelog vide.
- **(B) Garder les tags git par package, hors GitHub Releases** — écarté : la page Tags brute reste bruitée.
- **(A) Épine `v*` produit + packages sur npm, sans tag git par package** — **retenu**.

## Décision

**Versioning indépendant par unité de release**, mais **une seule épine de tags git** :

- **git tags = `v*` uniquement** — le runtime **api+admin** (le produit qu'on déploie), versionné comme
  une unité (`fixed: [["@echoppe/api", "@echoppe/admin"]]`). Chaque `v*` est **promu en GitHub Release**
  avec ses notes → la page Releases lit `0.1 → 0.2 → … → 1.0 → 1.1 → 1.1.1`.
- **Packages (`@echoppe/client`, `@mrcasquette/content`, `create-echoppe`) = npm.** Versionnés
  **indépendamment** par changesets, publiés sur npm avec leur `CHANGELOG.md` in-repo. **Pas de git tag,
  pas de GitHub Release** : npm **est** leur registre de versions. `changeset publish --no-git-tag` +
  action `createGithubReleases: false`.
- **`core` / `shared`** : privés, non versionnés (portés par un changeset sur `api` quand ils changent).
- La version `v*` n'est **plus dérivée de `@echoppe/client`** (pont artificiel supprimé) : elle vient de
  l'unité runtime api+admin, bumpée par changesets (`privatePackages.version: true`, tag posé par
  `release.yml`, pas par changesets).

## Conséquences

- GitHub affiche **une** ligne produit linéaire ; « Latest » = la vraie version d'Échoppe.
- Traçabilité d'un package = son `CHANGELOG.md` + npm (`npm view <pkg> versions`), pas un tag git.
- Le **pipeline one-move** (ADR-0004, `pipeline-release.md`) est conservé ; changent seulement : la
  **source** de la version `v*` (runtime, pas client) et la **politique de tag** (packages non taggés).
  Le déclenchement des images reste sur `push: tags v*`.
- `bun run ship` doit demander **quelle unité** bumper (runtime / client / content / CLI) au lieu de
  supposer `@echoppe/client`.
- **Nettoyage ponctuel** (une fois) : supprimer les tags git par package + les `-next.*` + les GitHub
  Releases de package existantes ; créer les Releases pour l'épine `v*`. Les packages npm déjà publiés
  ne sont **pas** touchés (npm ≠ git). Détail dans `pipeline-release.md`.

## Détail

→ [pipeline-release.md](../release/pipeline-release.md) (mécanique à jour) ·
[distribution-architecture.md § Politique de versions](../reference/distribution-architecture.md)
