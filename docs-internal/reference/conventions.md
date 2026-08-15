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

## Où vit un fichier

**Un fichier appartient au module de son concept, pas à celui qui l'utilise.** Plusieurs
consommateurs, c'est une dépendance entre modules — normal. Le transverse n'accueille que ce
qu'**aucun concept ne revendique** ([ADR-0042](../adr/ADR-0042-structure-api-modules.md)).

**Test d'admission dans un dossier transverse — les deux clauses :**

1. ≥2 modules le consomment ;
2. **aucun concept ne le revendique.**

La clause 2 est la plus importante et c'est celle qu'aucun nom de dossier ne porte. Compter les
consommateurs ne suffit pas : `personalization` en avait trois (panier, produits, commande) et
appartient au catalogue ; `visibility` en avait deux, tous deux du catalogue. C'est l'absence de ce
test qui a fabriqué `utils/` — 7 fichiers sur 11 y touchaient la base.

**Le signal à reconnaître** : un dossier dont le nom désigne un *statut* (« ce qui ne rentre pas
ailleurs ») plutôt qu'une *nature*. `utils/`, `helpers/`, `common/`, `misc/`. Un fichier à un seul
consommateur appartient à ce consommateur, jamais au dossier partagé.

**Corollaire sur la profondeur** : un concept naît fichier et devient dossier quand il porte
plusieurs natures. Pas d'arborescence posée d'avance (philosophy §4 appliquée à l'arbre).

## Structure des packages

### La charte d'un paquet vit dans son `README.md`

Tout paquet **interne** (`private: true`) porte un `README.md` qui énonce sa raison d'être, sa
frontière — ce qui lui appartient et ce qui appartient à son consommateur —, ses dépendances et leur
justification, et les ADR qui le régissent.

Le barrel (`src/index.ts`) ne reprend **pas** ce raisonnement. Il garde deux ou trois lignes
**impératives** — la règle, pas son argumentation — et renvoie au README :

```ts
// @repo/fields — la grammaire d'un champ.
// Ni route, ni table, ni accès base : voir README.md.
```

Les deux supports ne s'adressent pas au même lecteur. Le barrel est lu par qui s'apprête à violer la
frontière : la règle doit s'y trouver au point de violation. Le README est lu par qui décide
d'utiliser, d'extraire ou de publier le paquet, et peut porter ce qui n'a pas sa place en tête d'un
fichier source. Dupliquer le raisonnement dans les deux le fait diverger — constaté et corrigé sur
`@repo/fields`.

**Exception — les paquets publiés.** Pour `@mrcasquette/content`, `@echoppe/client` et
`create-echoppe`, `README.md` est la page npm : elle s'adresse à un consommateur externe et ne doit
pas porter d'histoire interne (numéros de tickets, ordre d'extraction, dettes). Leur charte reste
dans le barrel.

### `packages/echoppe-core` — slicing horizontal assumé (pour l'instant)

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

### `apps/echoppe-api` — modules Elysia + SSOT contrat

Structure dérivée de la doc Elysia ([ADR-0042](../adr/ADR-0042-structure-api-modules.md), en
application d'[ADR-0041](../adr/ADR-0041-hierarchie-autorites.md)) : `modules/<concept>/` avec
`index.ts` (controller), `service.ts` (logique), `model.ts` (validation). Un module par concept que
l'utilisateur nomme spontanément — « 1 instance Elysia = 1 controller ».

Pas de `routes/`, `models/`, `utils/`, `plugins/` ni `services/` : ce sont des couches techniques,
que la doc Elysia déconseille explicitement. `lib/` accueille le non-métier transverse et rien
d'autre — écart assumé vs le `utils/` que le schéma d'Elysia *montre* sans jamais le définir.

**Trois formes de module**, selon ce que le concept porte réellement. Un concept naît fichier et ne
devient dossier que quand il porte plusieurs natures ; le dossier ne se subdivise que quand il porte
plusieurs enfants.

| Forme | Quand | Exemples |
|---|---|---|
| un `index.ts` | une seule surface | `contact`, `stock`, `shipping`, `cart` |
| plusieurs contrôleurs composés par `index.ts` | plusieurs surfaces au même concept | par public : `auth` (`admin` + `customer`), `order`, `page`, `menu` · par sous-concept : `media` (`folder` + `item` + `asset`) |
| terme parent **sans** `index.ts` | le dossier n'a pas de surface propre, seulement des enfants | `content` (`definition`, `page`), `catalog` (`product`, `category`, `collection`, `option`) |

Un terme parent n'accueille de fichier que si **aucun de ses enfants ne le revendique** — c'est la
règle de propriété appliquée un cran plus bas. `catalog/visibility.ts` y est parce qu'il sert la
catégorie *et* la collection ; `catalog/model.ts` parce que ses schémas croisent produit, variante
et option.

Quand plusieurs contrôleurs partagent un préfixe, **l'ordre de composition dans `index.ts` est
significatif** : Elysia laisse la dernière déclaration l'emporter, donc une route statique doit
précéder la route à paramètre qui l'absorberait (`/media/folders` avant `/media/:id`).

`model.ts` (TypeBox) = SSOT du contrat : validation runtime **+** OpenAPI **+** inférence Eden.
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
- **Le `message` d'une exception n'entre jamais dans un corps de réponse**
  ([ADR-0050](../adr/ADR-0050-exception-jamais-reponse-http.md)). Une faute qui traverse HTTP est une
  valeur structurée — union discriminée plate sur `code` — dont chaque surface rend le texte. Le
  domaine n'écrit pas d'interface. *Contrat acté, migration non lancée : le code actuel ne s'y
  conforme pas encore.*

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
