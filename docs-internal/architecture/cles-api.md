# Clés d'API machine — décision & architecture

Doc de **décision** (le _pourquoi_) du système d'auth non-interactive introduit en P2b.
La doc utilisateur (le _comment_) vit dans [dev/api-keys](../../docs/dev/api-keys.md).

Voir aussi [Module contenu](./contenu.md) : la CLI `content:push` est le premier
consommateur de ces clés.

## Problème

Le module contenu impose au **dev du front** de pousser son registre de blocs vers l'API
(`pnpm content:push`) depuis un `.env` / une CI. Or l'API n'avait **qu'une auth par
session-cookie** (admin humain). Demander à un dev de récupérer un cookie de session pour
l'injecter dans un `.env` est :

- **détourné** — il faut se logger via l'admin, extraire le cookie, le renouveler à
  expiration (7 j) ;
- **fragile** — le cookie porte l'identité humaine complète (tous ses droits), pas un
  périmètre machine ;
- **non-idiomatique** — l'attendu d'un dev, c'est **une clé dans un `.env`**.

Décision : ajouter une **auth machine par clé d'API scopée**, en `Authorization: Bearer`.

## Invariants de conception

### 1. Les scopes sont ancrés sur `RESOURCE_LIST` (SSOT RBAC), pas un vocabulaire parallèle

Le vocabulaire de scopes est **dérivé**, pas déclaré à la main :

```ts
// apps/echoppe-api/src/plugins/apiKey.ts
export const SCOPES = RESOURCE_LIST
  .filter((resource) => resource !== 'api_key')
  .flatMap((resource) => [`read:${resource}`, `write:${resource}`]);
```

Conséquence : toute ressource ajoutée au RBAC crée **automatiquement** ses scopes
`read:<r>` / `write:<r>`. Aucun risque de divergence entre « ce que le RBAC connaît » et
« ce qu'une clé peut demander ».

#### Typage du body : `t.Unsafe<ApiKeyScope>` (piège TypeBox)

`SCOPES` est un `string[]` **construit au runtime** (`RESOURCE_LIST.filter().flatMap()`).
Un `t.Union(SCOPES.map((s) => t.Literal(s)))` **paraît** typé mais son `Static` **s'effondre
en `never`** : TypeBox ne peut inférer les membres d'un union bâti sur un *array* (pas un
tuple). Résultat : le body `scopes` devient `never[]` → **route non appelable** côté client
Eden (on ne peut passer que `[]`).

Correctif — découpler runtime et type :

```ts
// plugins/apiKey.ts — le type littéral, dérivé de Resource (SSOT), en template literal
type ScopableResource = Exclude<Resource, 'api_key'>;
export type ApiKeyScope = `read:${ScopableResource}` | `write:${ScopableResource}`;

// routes/api-keys.ts — runtime string permissif, mais Static = la vraie union
const scopeSchema = t.Unsafe<ApiKeyScope>(t.String());
```

`t.Unsafe<T>` attache le type `T` au `Static` sans contraindre le runtime → Eden expose la
**vraie union littérale** au client (admin type-safe), et la validité runtime reste assurée par
`isValidScope` (garde `scope is ApiKeyScope`) → **422** sinon. Un seul point de vérité
(`RESOURCES`), zéro drift. *(À réutiliser dès qu'un vocabulaire runtime doit être typé fin côté
client — cf. P3.)*

`write` est **composite** (create + update + delete), façon read/write de GitHub — les clés
machine restent volontairement grossières. Le grain fin (create seul, etc.) demeure réservé
au RBAC des rôles humains.

### 2. `api_key` est exclu des scopes — par construction

Une clé ne peut **jamais** être scopée sur les clés elles-mêmes (`filter(r !== 'api_key')`).
Donc une clé ne peut ni se gérer, ni en créer/révoquer d'autres. Ce n'est pas une règle
runtime qu'on pourrait oublier : **sans le scope, la permission n'existe pas**. La gestion
des clés reste une opération d'**humain authentifié**.

### 3. `type: 'apikey'` dans le contexte RBAC — aucun bypass propriétaire

Le contexte d'auth distingue la provenance :

```ts
type RbacAuthContext =
  | AuthenticatedUser      // session humaine (peut être Owner → bypass total)
  | AuthenticatedApiKey    // { type: 'apikey', permissions, ... }
  | null;
```

Une clé porte un `PermissionSet` **explicite par ressource** dérivé de ses scopes — et
**jamais** le bypass « Owner ». Même si elle était créée par le propriétaire, elle ne peut
que ce que ses scopes disent. Le mapping :

```ts
// read:<r>  → canRead
// write:<r> → canCreate + canUpdate + canDelete
```

Les guards `permissionGuard(resource, action)` existants fonctionnent **sans changement** :
ils lisent le `PermissionSet`, que la source soit un rôle ou une clé.

### 4. Gouvernance : création réservée à l'Owner, gestion `selfOnly` pour les admins

La ressource `api_key` est seedée avec deux niveaux :

- **Propriétaire** — CRUD complet sur `api_key` (gouvernance : voit/révoque toutes les
  clés).
- **Administrateur** — CRUD `selfOnly` : chaque admin ne voit et ne révoque **que ses
  propres** clés (`createdBy = currentUser.id`). Les clés d'autrui sont masquées en **404**
  (pas de fuite d'existence).

Rationale (validé) : un Owner **sans droit plein** pourrait techniquement se faire pirater
son accès ; concentrer la gouvernance des clés sur le rôle Owner limite la surface. Un admin
reste autonome pour ses propres intégrations sans dépendre de l'Owner.

## Format & stockage

| Aspect | Choix |
|--------|-------|
| Préfixe | `eck_` (echoppe key) — repérable dans les logs / secret-scanners |
| Entropie | `randomBytes(32).toString('base64url')` |
| Transport | `Authorization: Bearer eck_…` (regex `^Bearer\s+(eck_[A-Za-z0-9_-]+)$`) |
| Stockage | **hash SHA-256** (hex, colonne `hash` unique) — le clair n'est **jamais** persisté |
| Affichage | le clair est renvoyé **une seule fois**, à la création (`POST /api-keys`) |
| Expiration | `expiresAt` optionnel ; vérifié à la résolution |
| Traçabilité | `lastUsedAt` mis à jour à chaque appel (clés = faible volume → un write/appel OK) |

Table `api_key` : `id`, `name`, `hash` (unique, index `api_key_hash_idx`), `scopes` (jsonb
`string[]`), `createdBy` (→ `user.id`, `on delete set null`), `lastUsedAt`, `expiresAt`,
`dateCreated`. Migration `0004_nappy_talon.sql`.

## Résolution (chemin critique)

```
Authorization: Bearer eck_…
        │
        ▼
resolveApiKey(header)            plugins/apiKey.ts
  ├─ regex → extrait le clair
  ├─ hashApiKey (sha256)
  ├─ SELECT api_key WHERE hash = …        (miss → null → 401/403)
  ├─ expiresAt dépassé ? → null
  ├─ UPDATE lastUsedAt = now()
  └─ permissionsFromScopes(scopes) → Map<resource, PermissionSet>
        │
        ▼
getAuthContext(cookie, authHeader)   plugins/rbac.ts
  → { type: 'apikey', permissions, … }   (apiKey testé AVANT le cookie)
        │
        ▼
permissionGuard('content', 'update')  → inchangé
```

## Amorçage sans admin (bootstrap CLI)

Pour créer une première clé **sans passer par l'admin** (ex. CI, provisioning), un script
serveur : `apps/echoppe-api/src/scripts/create-api-key.ts` (`bun run api-key:create --name … --scopes
…`). Il insère avec `createdBy: null` (clé « système ») et imprime le clair une fois. C'est
l'échappatoire assumée ; le flux nominal reste l'admin.

## Alternatives écartées

- **Cookie de session réutilisé** → rejeté (§ Problème) : détourné, fragile, mauvais périmètre.
- **JWT** → surdimensionné : pas de besoin de claims auto-portés ni de vérif offline ; un
  lookup DB indexé suffit et permet la **révocation immédiate** (un JWT reste valide jusqu'à
  expiration).
- **Scopes libres / vocabulaire dédié** → rejeté : dérive garantie face au RBAC. Les scopes
  **doivent** être dérivés de `RESOURCE_LIST`.
- **Clés capables de gérer des clés** → rejeté : escalade. Exclusion par construction (§ 2).
