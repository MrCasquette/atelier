# Publier une version

Échoppe distribue plusieurs **unités versionnées indépendamment**, en **une seule action** : le
**merge de la PR « Version Packages »**. Chaque unité n'avance que quand *son* code change.

- **Runtime** (images Docker `echoppe-api` + `-admin`, paire co-versionnée) — seule à porter un **tag
  git `v*`** (+ GitHub Release). Construit par `release.yml` (appel de `docker-build.yml`), gate
  T2–T5 inclus.
- **Paquets npm** `@echoppe/client`, `@mrcasquette/content`, `create-echoppe` — publiés par `release.yml`,
  **sans tag ni Release git** (npm = leur registre de versions).

Le tag `v*` peut aussi être poussé à la main (échappatoire re-cut d'images), pas la voie normale.

La règle d'or : **une release n'est bonne que si une base vierge, migrée depuis
l'image publiée, répond `200` sur les routes clés.** Ce qui marche en dev via
`db:push` ne prouve rien pour l'utilisateur.

## Invariant migrations (à ne jamais enfreindre)

En dev, `db:push` applique le schéma **sans produire de fichier de migration**.
L'image de prod, elle, n'embarque que les **migrations versionnées** (`packages/echoppe-core/drizzle/`)
et les applique au boot. Un schéma modifié en dev par `push` seul est donc **absent
de l'image** → 500 au runtime pour toute boutique.

**Après tout changement de `packages/echoppe-core/src/db/schema/` :**

```bash
bun run db:generate   # produit la migration DDL manquante
```

Puis **committer** le `.sql` généré + le `meta/*_snapshot.json` + `_journal.json`.
Vérifier qu'il ne reste **aucune dérive** :

```bash
bun run db:generate   # doit afficher « No schema changes, nothing to migrate »
```

### Données de référence (≠ seed démo)

Le `db:seed` est **exclusif au dev** (jeu de démo complet). Une donnée dont la
**prod a besoin** (ex. un pays de livraison par défaut) ne doit **pas** dépendre du
seed : elle s'ajoute en **migration idempotente**, appendée au `.sql` généré :

```sql
-- Idempotent : rejouable sans doublon ni erreur.
INSERT INTO "country" ("name", "code", "is_shipping_enabled")
VALUES ('France', 'FR', true)
ON CONFLICT ("code") DO NOTHING;
```

## Validation en deux temps

| Étape | Fichier compose | Prouve |
|-------|-----------------|--------|
| **Pré-publication** (sources) | `compose.dev.yaml` | Le working tree migre et boot correctement |
| **Post-publication** (artefact) | `compose.yaml` (`VERSION=x.y.z`) | L'**image publiée** boot en base vierge |

Boucle serrée pré-commit (sans stack complet) : un Postgres jetable + migrate.

```bash
docker run -d --name mig-check -e POSTGRES_USER=echoppe -e POSTGRES_PASSWORD=echoppe \
  -e POSTGRES_DB=echoppe -p 5433:5432 postgres:17-alpine
DATABASE_URL="postgresql://echoppe:echoppe@localhost:5433/echoppe" \
  bun run --cwd packages/echoppe-core db:migrate       # 0000→N sans erreur
docker rm -f mig-check
```

> ⚠️ Ne jamais migrer/seed une base **de prod** (conteneurs `dpc-*` ou toute
> boutique réelle). Utiliser `echoppe-*` ou un conteneur éphémère jetable.

## Le SDK dérive de l'API

`@echoppe/client` est **généré depuis l'OpenAPI** de l'API (`packages/client/scripts/generate.ts`),
il ne se code pas à la main. Après un changement de contrat storefront :

```bash
bun run contracts        # boote l'app pure offline, régénère openapi.json + types + façade
bun run contracts:check  # + échoue si les types figés divergent des routes (garde CI)
```

`bun run contracts` remplace le rituel manuel (boot :7533 + generate). La garde `contracts:check`
tourne en CI (`ci.yml`) et **casse toute PR** qui change une route sans régénérer le SDK — la dérive
contrat est attrapée dès la PR, plus seulement au gate release (T4).

Comme le SDK **dérive** du contrat, corriger l'API réaligne toute la chaîne : un SDK
« en avance » sur des migrations en retard n'est pas un bug SDK, c'est un bug API.

## Gate automatique (rien à lancer à la main)

La CI **bloque la publication d'image** si les tests échouent :

- `ci.yml` (push/PR) : `type-check`, `lint`, **drift-guard Drizzle** (schéma == migrations),
  **drift-guard contrat** (SDK figé == routes), smoke source-level.
- `docker-build.yml` (appelé par `release.yml` au publish, ou sur tag manuel) : job `integration`
  **dont dépend `build-and-push`** — build l'image `api` puis la valide en **base vierge** (T2),
  **upgrade depuis `:latest`** (T3), **parité contrat** (T4), **idempotence** (T5). Aucune image ne
  part si un test casse.

Pour reproduire le gate en local : `bun run --cwd apps/echoppe-api test:integration`.

## Raccourci : `bun run ship`

Une release cible une **unité** (`runtime` / `sdk` / `content` / `cli`) à un **niveau** semver.
`ship` crée le changeset, committe et pousse `main` — il ne reste qu'à **merger la PR** :

```bash
bun run ship runtime minor "ajoute la wishlist"   # runtime (images + tag v*)
bun run ship sdk patch "corrige un type"          # SDK npm seul
bun run ship "…"                                   # interactif (demande unité + niveau)
bun run ship --dry runtime major "…"               # crée le changeset sans commit/push (aperçu)
```

Garde-fous : refuse hors branche `main` ou working tree non propre (le travail doit être committé
avant ; le changeset est le seul ajout embarqué). En 0.x, un **changement cassant = `minor`** (le
`major` est réservé au passage 1.0).

## Checklist de release

- [ ] Schéma changé → `db:generate` + migration committée (**jamais** `push` en prod).
- [ ] Donnée requise en prod → seed **idempotent** dans une migration (pas le `db:seed`).
- [ ] `db:generate` de contrôle → « No schema changes » (aucune dérive résiduelle).
- [ ] Gate d'intégration vert (`test:integration`) — ou laisser la CI le jouer.
- [ ] SDK régénéré (`bun run contracts`), `type-check` + `build` verts.
- [ ] Changeset ajouté pour la bonne **unité** (`bun run ship <unité> <niveau>`).
- [ ] Push `main` → ouvre la PR « Version Packages ».
- [ ] **Merge de la PR** → npm (paquets bumpés) et/ou tag `v*` + images (si runtime bumpé), automatique.

## Coordination des déclencheurs (one-move)

| Déclencheur | Workflow | Effet |
|-------------|----------|-------|
| push `main` + changeset | `release.yml` | Ouvre/maj la PR « Version Packages » |
| **merge PR « Version Packages »** | `release.yml` | Publie npm (paquets bumpés) ; **si runtime bumpé** : tag `v x.y.z` + GitHub Release, **puis appelle `docker-build.yml`** (images `x.y.z` + `latest`, gate T2–T5) |
| push tag `v*` (manuel) | `docker-build.yml` | Échappatoire : re-cut d'images hors release npm |

L'unique acte humain d'une release = le **merge de la PR**. La version des images = celle du **runtime**
(`apps/echoppe-api/package.json`, paire `fixed` avec admin), détectée par l'absence du tag `v x.y.z` sur
origin. Le tag est posé automatiquement (traçage) mais ne re-déclenche pas les images (garde
anti-récursion GitHub : un tag poussé au `GITHUB_TOKEN` ne relance aucun workflow).
