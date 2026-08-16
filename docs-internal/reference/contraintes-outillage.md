# Contraintes & pièges outillage

Registre des contraintes imposées par l'**outillage** (pins de version, workarounds,
bugs upstream) rencontrées en cours de route. Objectif : **traçabilité** + une
**condition de levée** explicite pour chaque entrée, afin de revenir à l'état idéal
dès que l'écosystème rattrape — sans re-diagnostiquer de zéro.

Voir aussi [Architecture de distribution](./distribution-architecture.md) pour le
workflow de release lui-même (changesets + Trusted Publishing OIDC).

## Format d'une entrée

**Où** · **Contrainte** · **Symptôme** · **Cause racine** · **Fausses pistes** ·
**Condition de levée** · **Date / Réfs**. On garde les entrées résolues (barrées ou
section « Résolu ») pour l'historique.

---

## ⛓️ Actives

### `@mrcasquette/content` reparse le contrat à la main — `tsc` ne le protège pas

- **Où** : `packages/content/src/sync.ts`, fonctions `readPlan` et `extractMessage`.
- **Contrainte** : ce paquet est **publié sans aucune dépendance de production**, délibérément. Il ne
  consomme donc pas `@repo/client` ni `@repo/shared` : il **redéclare** en structurel ce qu'il lit sur
  le fil (`PlanStep`, `PlanBlocker`, `Fault`). Toute évolution de forme d'un corps de réponse doit
  être répercutée **à la main** dans ce fichier — aucun outil ne le signalera.
- **Symptôme** : `content check` a cessé de signaler le moindre blocage et annonçait un registre
  synchronisé alors que la migration était impossible. Silencieux : exit 0, aucun avertissement.
- **Cause racine** : `readPlan` filtrait `blockers` sur `typeof blocker === 'string'`. Quand
  `EntityPlan.blockers` est passé de `string[]` à des objets structurés (ADR-0050, tranche 422), le
  filtre les a tous éliminés → tableau vide → « rien ne bloque ». Le champ `issues`, ajouté au même
  moment, n'était pas lu du tout.
- **Fausses pistes** : le `type-check` du monorepo passe (le paquet parse de l'`unknown`, donc aucune
  erreur de type) ; les 197 tests d'intégration passent (ils testent l'API, pas la CLI) ; le
  `contracts:check` passe (il garde le SDK, dont la CLI ne dépend pas).
- **Règle générale** : **un contrat typé ne protège que ses consommateurs typés.** Toute frontière
  qui reparse est un point de rupture silencieux, et doit être inventoriée à chaque changement de
  forme du contrat.
- **Condition de levée** : la CLI consomme le SDK généré, ou un test de bout en bout exerce
  `content check` contre une API réelle. Ni l'un ni l'autre n'est prévu — l'autonomie du paquet
  publié est un choix assumé, cette contrainte en est le prix.
- **Date / Réfs** : 2026-08-17 · [ADR-0050](../adr/ADR-0050-exception-jamais-reponse-http.md).

### npm 12 casse la détection de changesets → pin `npm@11`

- **Où** : `.github/workflows/release.yml`, étape « Ensure npm supports OIDC ».
- **Contrainte** : `npm install -g npm@11` — **PAS `npm@latest`** (qui tire npm 12).
- **Symptôme** : à chaque release, la CI sort en **exit 1**. changesets logue
  `<pkg> is being published because our local version (X) has not been published on npm`
  pour des paquets pourtant en ligne, retente `changeset publish`, npm refuse
  (`cannot publish over the previously published versions`) → rouge. Les vraies
  nouvelles versions, elles, **se publient bien** (seul le re-publish des versions
  existantes échoue).
- **Cause racine** : **npm 12** (major shippé juillet 2026) change la sortie de
  `npm info` ; `@changesets/cli` (v1.9.x) *scrape* cette sortie CLI dans son
  `getUnpublishedPackages` → parsing cassé → il croit tout non-publié. **Prouvé**
  par un step debug temporaire, dans l'environnement exact du publish : un
  `npm info @echoppe/client` **direct** voyait la version (`exit=0`), sans aucun
  `.npmrc`, registre public correct ; le `npm info` **interne de changesets**
  échouait au même instant. Seul différenciateur : `npm=12.0.1`. Pin `npm@11`
  (11.18.0) → run **vert**.
- **Fausses pistes écartées** (toutes côté *publish*, or le publish marchait) :
  Node runtime (22→24, sans effet) · `git+` dans `repository.url` (npm le
  renormalise, c'est la forme canonique) · casse de l'org `Axiome-Apps` (le publish
  OIDC réussit → config Trusted Publisher déjà bonne) · `registry-url` sur
  setup-node (absent).
- **Condition de levée** : dé-pinner vers `npm@latest` **quand `@changesets/cli`
  annonce le support de npm 12** (surveiller ses releases / une issue « npm 12 »).
  Valider par un run de release avant de figer.
- **Date** : 2026-07-11 · **Réfs** :
  [breaking changes npm v12](https://github.blog/changelog/2026-06-09-upcoming-breaking-changes-for-npm-v12/),
  [changesets #1285](https://github.com/changesets/changesets/issues/1285),
  [npm/cli #8976](https://github.com/npm/cli/issues/8976).

---

## ✅ Résolu

### Warning de dépréciation Node 20 sur les actions GitHub

- **Symptôme** : `Node 20 is being deprecated. This workflow is running with Node 24
  by default…` sur les runs.
- **Cause** : plusieurs actions épinglées sur des majeures encore **node20** (les
  tags flottants `oven-sh/setup-bun@v2` et `changesets/action@v1` résolvaient déjà
  en node24).
- **Résolution** (2026-07-11) : bump vers les majeures node24 sur les **trois**
  workflows —
  - `release.yml` : `checkout@v7`, `setup-node@v6` ;
  - `docker-build.yml` : `setup-qemu-action@v4`, `setup-buildx-action@v4`,
    `login-action@v4`, `build-push-action@v7` ;
  - `docs-deploy.yml` : `checkout@v7`, `upload-pages-artifact@v5`,
    `deploy-pages@v5`.
  Inventaire vérifié : plus aucune action node20. Rien à revisiter.

---

## Gabarit (copier pour une nouvelle entrée)

```
### <titre court>

- **Où** :
- **Contrainte** :
- **Symptôme** :
- **Cause racine** :
- **Fausses pistes** :
- **Condition de levée** :
- **Date / Réfs** :
```
