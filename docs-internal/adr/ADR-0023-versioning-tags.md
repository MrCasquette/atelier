# ADR-0023 — Versioning : épine `v*` produit, packages versionnés sur npm

Statut : accepté · 2026-07-20 · amende [ADR-0002](./ADR-0002-distribution.md), [ADR-0004](./ADR-0004-migrations-release.md)
Portée : socle

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

## Amendement — 2026-08-18 : `1.0.0` dit la stabilité, pas l'ampleur de la rupture

L'ADR fixait où vivent les versions, jamais **quel rang** bumper. La question s'est posée au premier
lot de ruptures : le runtime changeait de surface, de port, de racine de données et de mode
d'amorçage, et le SDK perdait une méthode de sa façade.

**Tant que le développement est actif, aucune unité ne franchit `1.0.0`.** Une rupture se dit
`minor` — ce qui est le comportement normal de semver en `0.x`, où le contrat est explicitement
instable — et le corps du changeset la nomme sans détour. Passer à `1.0.0` annoncerait une stabilité
qu'on ne peut pas encore promettre, et l'annonce ne se reprend pas.

Ce que cela n'autorise pas : minimiser la rupture dans le texte. Le rang mesure l'engagement de
stabilité, le changelog décrit ce qui casse. Les deux ne disent pas la même chose.

### Stabilité de quoi — les cinq surfaces publiées

Dire que `1.0.0` promet la stabilité n'engage à rien tant qu'on n'a pas dit **de quoi**. Le dépôt ne
publie que cinq choses :

| Surface | Artefact |
|---|---|
| Le SDK | `@echoppe/client` |
| Le DSL de contenu | `@mrcasquette/content` |
| Le scaffold | `create-echoppe` et son template |
| Le contrat HTTP | l'OpenAPI servi par l'image |
| Le contrat d'exploitation | variables, volumes, ports, amorçage |

Tout le reste est **privé** — les `@repo/*`, `@echoppe/core`, les applications. Leur forme peut
changer après `1.0.0` sans rien casser chez personne. **Le découpage en paquets ne conditionne donc
pas la V1 stable** : c'est une dette d'architecture, pas une dette de contrat, et les confondre ferait
attendre la version à un chantier qui ne la concerne pas.

`1.0.0` se pose quand il ne reste **aucune rupture connue** sur ces cinq surfaces. Deux subsistent au
2026-08-18, et elles sont donc la frontière de la version :

- les **~32 requalifications de statut HTTP**, qui changent le comportement observable des clients
  (backlog Échoppe) ;
- la **migration de `richText` vers Markdown**, qui change la sérialisation du contenu
  (backlog socle, [ADR-0030](./ADR-0030-texte-riche-markdown.md)).

Le contrat d'exploitation, lui, est stabilisé depuis les ADR
[0052](./ADR-0052-surfaces-exploitation-image-unique.md), [0054](./ADR-0054-ports-rang-de-pile.md),
[0056](./ADR-0056-racine-de-donnees.md) et [0057](./ADR-0057-amorcage-du-proprietaire.md), et le
contrat de faute depuis la clôture d'[ADR-0050](./ADR-0050-exception-jamais-reponse-http.md).

S'y ajoutent deux conditions qui ne sont pas des ruptures mais des preuves : la ligne de durcissement
de sécurité purgée, et une vraie boutique déployée hors du monorepo.

**Une garde le mesure désormais.** `release-coverage` (`scripts/release-coverage.ts`, `bun run
release-coverage`) échoue si une unité de release a bougé sans changeset. Elle découvre les unités
au lieu de les connaître — workspaces publiables, plus les groupes `fixed` de la configuration
changesets, par où le runtime, privé mais porteur du tag `v*`, se déclare. Elle est née de deux
dérives réelles : `@echoppe/client` avait perdu `company.get()` sans qu'aucun changeset ne le
couvre, et le runtime accumulait 72 commits — la release aurait publié les paquets npm sans jamais
reconstruire l'image.

**Nettoyage associé** : le tag local `v1.0.0` (29 décembre 2025), antérieur à cette politique et
jamais poussé sur origin, est supprimé. Il ne documentait aucune release et aurait un jour croisé
un vrai `1.0.0`.

## Détail

→ [pipeline-release.md](../release/pipeline-release.md) (mécanique à jour) ·
[distribution-architecture.md § Politique de versions](../reference/distribution-architecture.md)
