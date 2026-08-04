# Conventions projet

Capture les **choix et seuils projet non dérivables du code** (cf. philosophy §9). La SSOT des
idiomes reste `~/.code-conform/docs/` ; ce fichier ne note que ce qui est **spécifique à ce repo**
ou qui **tranche un point contextuel**. Les décisions structurantes vivent dans les
[ADR](../adr/README.md) ; ici on capture les conventions de travail et les seuils.

## Un registre, pas une union fermée

**Quand le framework doit nommer des concepts qui appartiennent au produit, il déclare un contrat et
le produit s'enregistre.** Il n'énumère pas.

Ce motif a été découvert quatre fois séparément en préparant le découpage Échoppe / Prisme, à chaque
fois comme un couplage à défaire :

| Où | Union fermée | Devient |
|---|---|---|
| `packages/content` — `RefTarget` | `'product' \| 'collection' \| 'category'` | registre de cibles référençables ([ADR-0032](../adr/ADR-0032-cibles-referencables.md)) |
| `core/constants/resources.ts` — `RESOURCES` | 24 entrées dont 14 de commerce | espace `entity:` ouvert ([ADR-0038](../adr/ADR-0038-ressources-ouvertes-delegation.md)) |
| `api/plugins/rbac.ts` — `RbacAuthContext` | `admin \| customer \| apikey \| public` | registre de principaux ([ADR-0037](../adr/ADR-0037-principaux-surfaces.md)) |
| `core/db/schema/auth.ts` — `roleScopeEnum` | `['admin', 'store']` | ~~registre~~ → union fermée, valeur corrigée en `['admin', 'public']` ([ADR-0037 amendé](../adr/ADR-0037-principaux-surfaces.md)) |

**Le signal à reconnaître** : une union, un `pgEnum` ou une constante du framework qui énumère des
valeurs nommant des concepts d'un produit. `'product'` dans un paquet de contenu, `'store'` dans un
enum d'authentification. Le mot d'un produit dans le vocabulaire du socle.

**Le gain mesuré** : ouvrir `RefTarget` à lui seul supprime cinq points de couplage, dont un dans un
paquet publié.

**Ce n'est pas une règle universelle.** Une union fermée est juste quand le vocabulaire appartient
*vraiment* au framework — les actions `create/read/update/delete`, les verbes HTTP, les statuts d'une
machine à états qu'il possède. Le critère n'est pas « est-ce que ça pourrait grandir », c'est
**« qui décide de cette liste »**. Si la réponse est « le produit » ou « le dev qui consomme », c'est
un registre.

**Corollaire de typage** : ouvrir ne veut pas dire renoncer à la vérification. `Resource |
\`entity:${string}\`` laisse passer l'espace ouvert tout en continuant de rejeter
`permissionGuard('medai', 'read')`. Préférer un espace **préfixé** à un `| string` nu — le préfixe
sert aussi à la maintenance (`LIKE 'entity:%'` pour purger).

## Structure des packages

### `packages/core` — slicing horizontal assumé (pour l'instant)

`core` est organisé par **couche technique** : `db/schema/*`, `adapters/<famille>/*`, `services/*`,
`utils/*` — **pas** en `domain/<concept>/` (slicing vertical DDD). C'est un **écart conscient** vs
philosophy §6 / typescript.md §8, acté ici :

- **Pourquoi maintenant** : `core` a un seul consommateur (l'API). La première implémentation reste
  concrète et minimale (philosophy §4) ; introduire `domain/product/{Product.ts, Product.schema.ts,
  Product.repository.ts}` par anticipation serait une abstraction non justifiée.
- **Seuil de bascule** : on passe au slicing vertical `domain/` **quand le wiring se duplique** —
  typiquement à l'arrivée d'un 2ᵉ consommateur de `core` (worker, CLI de maintenance, job externe)
  qui recompose la même logique métier hors des routes. C'est le signal #1 de typescript.md §4.
- **Suivi** : refactor différé, tracé en tâche dédiée. À rouvrir formellement (ADR) avant exécution.

### `apps/echoppe-api` — frontière + SSOT contrat

`models/*.ts` (TypeBox) = SSOT du contrat : validation runtime **+** OpenAPI **+** inférence Eden.
Une donnée `jsonb` typée côté `core` **et** validée côté `api` suit le pattern à double
représentation verrouillée (interface core + TypeBox api + guard `Static<> extends`) —
cf. [ADR-0020](../adr/ADR-0020-colormetadata-double-representation.md).

### `apps/echoppe-admin` — atomic + composables

Détail dans [PATTERNS.md](./PATTERNS.md) / [ADR-0016](../adr/ADR-0016-conventions-front-admin.md) :
atomic design, **imports directs** (pas de barrel pour les composants Vue), types **inférés depuis
Eden** (jamais d'interface manuelle pour les données API), un composable par feature `{state,
actions}`.

## Gestion des erreurs

- **Erreur métier attendue** = valeur de retour typée via `status(4xx, …)` à la frontière Elysia
  (ex. 404 produit introuvable, 400 personnalisation invalide). Pas d'exception pour un cas nominal.
- **Erreur exceptionnelle** = `throw`, capturé à la frontière (ex. `verifyWebhook` d'un adapter qui
  lève sur signature invalide → `catch` route → 400). Try/catch async **aux frontières**, pas par
  réflexe partout.
- Jamais de catch silencieux. Pas de `console.log` de debug en prod (les logs structurés
  `[Contexte] …` sont volontaires).

## Frontière de validation

Une seule frontière (philosophy §5) : **TypeBox/Elysia** à l'entrée HTTP
([ADR-0015](../adr/ADR-0015-validation-typebox.md)). Pas de Zod (retiré de `core`/`shared`, deps
mortes). En interne, on **truste** la donnée déjà parsée. `slugify`/dédup et autres normalisations
sont des transformations, pas des revalidations.

## Providers & frontière HTTP

`payments`/`shipping`/`communications` ne sont pas « le métier du paiement/livraison » mais la
**frontière HTTP mince** vers le provisionner (adapters, [ADR-0011](../adr/ADR-0011-adapters-providers.md)).
Ajouter un provider = un adapter + une entrée dans la SSOT `PAYMENT_PROVIDERS`, **zéro route**
(webhook paramétrique `/:provider`). Seules restent des routes : création de session (secret serveur
+ montant autoritaire), webhook (le provider nous rappelle), config/statut/refund admin.

## Seuils (non chiffrés)

Pas de seuil dur sur lignes/fichiers (philosophy §9) : un fichier/fonction « lourd » est un **signal
de revue**, pas une violation. Le découpage suit la lisibilité et la duplication **réelle** (≥2
occurrences déclenchent la factorisation, pas l'anticipation).

## Tests

Filet **lean anti-régression** (esprit CI/CD, sans gonfler la CI) : `bun test` intégré. Smoke API via
`bun run --cwd apps/echoppe-api test:smoke` sur **base Postgres jetable éphémère** (conteneur sur port libre,
**jamais** la base dev ni `dpc-*`/5432). Les routes auth-gated se testent **sans Redis** en injectant
user+rôle+session Postgres et le cookie `echoppe_admin_session` (owner bypass). Chaque capacité ajoute
1–2 assertions ciblées (contrat + comportement clé), rien de plus.

## Contrat SDK — régénération & garde anti-dérive

Le SDK figé (`packages/client/src/{openapi,models,facade}.ts` + `openapi.json`) **dérive des routes**.
Ne jamais l'éditer à la main : `bun run contracts` boote l'app pure offline (`serve-contract`),
régénère, et remplace le rituel manuel `:7533`. `bun run contracts:check` fait de même **puis échoue
si les types figés ont bougé** — garde anti-dérive en CI (`ci.yml`, miroir du drift-guard Drizzle),
qui attrape « route changée, SDK oublié » dès la PR. `openapi.json` n'est pas gardé (bruit cosmétique
`additionalProperties` de TypeBox) — seuls les types dérivés le sont, comme le gate release T4.

## Configuration & exploitation (self-host)

**Validation env au boot.** `apps/echoppe-api/src/env.ts` est un **garde-fou fail-fast** importé EN PREMIER
par `index.ts` (avant tout import de `@echoppe/core`, dont le client DB throw sur `DATABASE_URL`
absente). Il refuse le démarrage avec un message clair si une variable **critique** manque :
`DATABASE_URL`, `ENCRYPTION_KEY` (32 octets base64). Les optionnelles ont des défauts sûrs. Autonome
(n'importe pas core) pour pouvoir s'exécuter avant lui. Non chargé par `app.ts` (pure) ni les tests.

**Sauvegarde (opérateur boutique).** La vérité de prod = Postgres + le volume d'uploads.
- **Base** : `pg_dump` planifié (ex. quotidien) hors du conteneur, rétention à définir — ex.
  `docker exec <db> pg_dump -U echoppe echoppe | gzip > backup-$(date +%F).sql.gz`. Restauration :
  `gunzip -c … | docker exec -i <db> psql -U echoppe echoppe`.
- **Uploads** : snapshot du volume `UPLOAD_DIR` (médias) — les migrations recréent le schéma, **pas**
  les fichiers. Sauvegarder base **et** uploads ensemble (cohérence des références média).
- ⚠️ Ne jamais tester une restauration sur la base de prod (`dpc-*`) ; utiliser une base jetable.

## Nommage & Git

Code/API en **anglais**, URLs storefront en **français** (`/produits`), UI en français. Messages de
commit en **français**, **aucune mention d'IA/assistant** (seul le nom de l'utilisateur). Commit
oui, **push jamais** sans demande explicite.

Préfixes de branches et de commits (repris de l'ancien `CONTRIBUTING.md`, supprimé au passage
du dépôt en privé — plus de contribution externe) :

```
feat/…      feat: ajouter le support des variantes produit
fix/…       fix: corriger le calcul du panier
docs/…      docs: mettre à jour le guide d'installation
refactor/…  refactor: simplifier la gestion des médias
```
