# Pipeline de release & gardes anti-dérive

Point d'entrée unique de la mécanique de publication. Le **comment** pas-à-pas vit dans
[`docs/dev/releasing.md`](../../docs/dev/releasing.md) ; les **invariants + post-mortem** dans
[`release-runbook.md`](./release-runbook.md) ; le détail **npm/changesets** dans
[`distribution-architecture.md`](../reference/distribution-architecture.md). Ici : la **vue d'ensemble** qui les
relie.

## En une phrase

Échoppe publie plusieurs artefacts **versionnés indépendamment** (ADR-0023), en **un seul acte
humain** : le **merge de la PR « Version Packages »**. Chaque unité n'avance que quand *son* code
change ; la version n'est jamais saisie à la main — elle vient du **niveau de bump** du changeset.

## Unités de release indépendantes (ADR-0023)

| Unité | Package(s) | Artefact | Tag git |
|-------|-----------|----------|---------|
| **runtime** | `@echoppe/api` + `@echoppe/admin` (paire `fixed`) | images Docker | **`v*`** (+ GitHub Release) |
| **sdk** | `@echoppe/client` | npm | — (npm = registre) |
| **content** | `@mrcasquette/content` | npm | — |
| **cli** | `create-echoppe` | npm | — |

- **Une seule épine de tags git : `v*`** = le runtime déployable. Les packages npm ne sont **pas**
  taggés en git (`changeset publish --no-git-tag`, action `createGithubReleases: false`) — leur
  registre de versions **est npm**.
- `api`/`admin` sont **privés mais versionnés** par changesets (`privatePackages.version: true`) →
  bump + `CHANGELOG` en repo, sans publication npm. La version `v*` vient de `apps/echoppe-api/package.json`.
- **0.x** : un changement **cassant = `minor`** (`major` réservé au passage 1.0). Mode pre changesets
  **désactivé** → versions propres (`0.6.0`, pas `-next.N`), publiées sur le dist-tag **`latest`**.
- Raccourci : `bun run ship <unité> <niveau> "résumé"` (ex. `ship runtime minor "…"`) crée le
  changeset, committe, pousse `main`. Sans args → interactif. `--dry` pour l'aperçu.

## Le flux one-move

```
bun run ship <unité> <niveau> "…"  (ou changeset committé + git push main)
        │
        ▼
 push main ──► release.yml ──► PR « Version Packages » (bump + CHANGELOG)   [aucune publication]
                                      │
                                  MERGE  ◄── unique acte humain
                                      │
                        release.yml (re-run sur main) :
                          1. changesets publish → npm (paquets bumpés ; --no-git-tag)
                          2. SI runtime bumpé (v x.y.z absent d'origin) :
                             tag v x.y.z + GitHub Release (GITHUB_TOKEN → ne re-déclenche rien)
                          3. SI runtime bumpé : job `images` ──workflow_call──► docker-build.yml
                                                               ├─ gate T2–T5 (base vierge, upgrade,
                                                               │   contrat, idempotence)
                                                               └─ push images :x.y.z + :latest
```

Un release **sdk/content/cli seul** publie npm et **ne crée ni tag ni image**. Un release **runtime**
tague `v*` + construit les images. Les deux peuvent coexister dans un même merge.

Échappatoire manuelle : un `push` de tag `v*` déclenche `docker-build.yml` seul (re-cut d'images hors
release npm). C'est un secours, pas la voie normale.

## Les gardes anti-dérive

Chaque garde attrape une classe de « faux vert » **le plus tôt possible**.

| Garde | Où | Attrape |
|-------|-----|---------|
| **Drift Drizzle** (T1) | `ci.yml` (PR/push) | schéma TS modifié sans migration générée (`db:generate` + `git diff`) — cause de l'incident 0.4.0 |
| **Drift contrat** | `ci.yml` (PR/push) | route changée sans SDK figé régénéré (`contracts:check` : régénère depuis l'app pure + `git diff` sur les types) — dès la PR, plus seulement au gate T4 |
| **Validation env** | boot API (`env.ts`) | config incomplète (`DATABASE_URL`, `ENCRYPTION_KEY`) → refus au démarrage avec message clair, avant crash cryptique |
| **Gate image T2–T5** | `docker-build.yml` (`integration` needs `build-and-push`) | image cassée : base vierge (T2), upgrade depuis `:latest` (T3), parité contrat (T4), idempotence seeds (T5) — aucune image ne part si un test casse |

Invariant transverse : **la vérité de prod = les migrations committées appliquées à l'image
publiée**, jamais `db:push` (dev only). Cf. [`release-runbook.md`](./release-runbook.md).

## Commandes

| Commande | Rôle |
|----------|------|
| `bun run contracts` | régénère le SDK figé depuis l'app pure offline (remplace le boot `:8101` manuel) |
| `bun run contracts:check` | idem + échoue si les types divergent des routes (garde CI) |
| `bun run ship <unité> <niveau> "msg"` | cut une release d'une unité (runtime/sdk/content/cli) → changeset + push `main` (interactif sans args) |
| `bun run --cwd apps/echoppe-api test:integration` | rejoue le gate T2–T5 en local |
| `bun run --cwd apps/echoppe-api test:smoke` | smoke source-level (base jetable) |

## Checklist minimale

1. Travail committé, `type-check` + `lint` + `smoke` verts.
2. Schéma changé → migration committée (`db:generate`, diff propre).
3. Contrat changé → `bun run contracts` committé.
4. `bun run ship <unité> <niveau> "résumé"` (ou push d'un changeset déjà committé).
5. **Merge de la PR** → npm (paquets bumpés) et/ou tag `v*` + images (si runtime bumpé). Fin.
