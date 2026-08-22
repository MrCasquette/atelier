# Conventions projet

Capture les **choix et seuils projet non dérivables du code** (cf. philosophy §9). La SSOT des
idiomes reste `~/.code-conform/docs/` ; ce fichier ne note que ce qui est **spécifique à ce repo**
ou qui **tranche un point contextuel**. Les décisions structurantes vivent dans les
[ADR](./adr/README.md) ; ici on capture les conventions de travail et les seuils.

## Un registre, pas une union fermée

**Quand le framework doit nommer des concepts qui appartiennent au produit, il déclare un contrat et
le produit s'enregistre.** Il n'énumère pas.

Ce motif a été découvert quatre fois séparément en préparant le découpage Échoppe / Prisme, à chaque
fois comme un couplage à défaire :

| Où | Union fermée | Devient |
|---|---|---|
| `packages/content` — `RefTarget` | `'product' \| 'collection' \| 'category'` | registre de cibles référençables ([ADR-0032](./adr/ADR-0032-cibles-referencables.md)) |
| `core/constants/resources.ts` — `RESOURCES` | 24 entrées dont 14 de commerce | espace `entity:` ouvert ([ADR-0038](./adr/ADR-0038-ressources-ouvertes-delegation.md)) |
| `api/plugins/rbac.ts` — `RbacAuthContext` | `admin \| customer \| apikey \| public` | registre de principaux ([ADR-0037](./adr/ADR-0037-principaux-surfaces.md)) |
| `core/db/schema/auth.ts` — `roleScopeEnum` | `['admin', 'store']` | ~~registre~~ → union fermée, valeur corrigée en `['admin', 'public']` ([ADR-0037 amendé](./adr/ADR-0037-principaux-surfaces.md)) |

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

## Fermer un vocabulaire : le dériver d'une mesure, jamais d'une documentation

**Quand une échelle de valeurs doit être close, on l'obtient en observant ce que le code produit
réellement — pas en recopiant ce que la bibliothèque sous-jacente déclare pouvoir produire.**

Le cas d'école est `ValidationReason` ([ADR-0050](./adr/ADR-0050-exception-jamais-reponse-http.md)
§7). TypeBox déclare **64** types d'erreur. Le générateur de `@repo/fields` n'en émet que **15**,
parce qu'il n'emploie que neuf constructions de schéma. Le vocabulaire retenu en compte **6** — les
15 mesurés regroupés par *geste de correction*, `StringMinLength` / `NumberMinimum` / `ArrayMinItems`
disant tous « agrandis ».

La méthode, en trois temps :

1. **Mesurer** — un script jetable qui exerce chaque cas que la grammaire autorise et relève ce qui
   sort. Le même travail avait déjà servi aux 401/403 (16 réponses → 3 concepts) et aux 409.
2. **Regrouper par le geste attendu**, pas par le mot-clé technique. Le lecteur doit savoir quoi
   corriger, pas quel prédicat a échoué.
3. **Verrouiller par un test qui remesure** — c'est lui la garantie, pas une version épinglée. Si la
   dépendance change ses codes ou si le générateur gagne une construction, le test tombe.

**Le nom de la bibliothèque n'entre pas dans le contrat** : changer de version d'un validateur ne
doit pas être un changement de contrat.

**Deux pièges rencontrés.** Un même code technique peut recouvrir deux prédicats opposés — le `Union`
de TypeBox vaut « valeur hors liste » pour un `enum` et « mauvais type » pour un entier : on le
discrimine alors par la **forme** de la donnée, jamais par un nom. Et une échelle mesurée reste
**additive** : on l'étend quand un cas neuf apparaît, on ne l'élargit pas d'avance.

## L'outillage découvre, il n'énumère pas

Une garde, un script racine ou un workflow ne doit **jamais** contenir la liste des workspaces,
des produits ou des paquets qu'il traite. Il la reconstitue à chaque exécution. Sans cela, un
paquet créé pendant un chantier n'est couvert par rien, et l'oubli ne se voit qu'au pire moment :
`@repo/fields` a manqué au `Dockerfile` des semaines, jusqu'à faire échouer une publication sur un
dépôt par ailleurs vert.

La découverte se fait par **capacité** — le fichier qui prouve qu'un workspace sait faire quelque
chose — ou par **déclaration** — le workspace le dit dans son manifeste. Jamais par convention de
nom, qui tiendrait sans que rien ne la vérifie.

| Découvre | Par quoi |
|---|---|
| `drift-guard` | les `drizzle.config.ts` du dépôt, et lit `out` dans chaque config |
| `product-isolation` | les préfixes de paquets, sur dépendances déclarées **et** imports réels |
| `core-passthrough` | les cœurs produit par leur `drizzle.config.ts`, puis leurs points d'entrée déclarés |
| `image-manifests` | les motifs de workspace du manifeste racine, croisés aux `COPY` du `Dockerfile` |
| `contract-targets` | `contract.source` / `contract.frozen`, déclarés par le client lui-même |
| `release-coverage` | les workspaces publiables, plus les groupes `fixed` de la config changesets |
| `registry-gap` | l'`IMAGE_PREFIX` et la matrice de cibles de `docker-build.yml` |

Corollaire éprouvé sur les scripts racine : `--filter '*'` plutôt qu'une énumération. L'ancien
`test` listait 14 workspaces, et un test délibérément cassé dans le quinzième sortait en **0**.

Un `Record<Clé, …>` exhaustif joue le même rôle dans le type : une clé ajoutée sans entrée ne
compile plus. C'est la version compilée du même principe.

## Tenue des backlogs

Les listes elles-mêmes sont indexées par [BACKLOG.md](../BACKLOG.md), qui dit seulement où elles
vivent. Comment on les tient est une convention, et vit donc ici.

### Une tâche finie se supprime, elle ne se coche pas

La garder cochée fabrique un journal parallèle : Git sait quand elle a été faite, le changelog ce
qu'elle a changé, l'ADR pourquoi. Trois sources fiables contre une quatrième qui vieillit sans que
personne ne le voie.

Le `[x]` ne sert que de marqueur **transitoire à l'intérieur d'un chantier ouvert**, pour dire où
l'on en est dans une tâche à plusieurs pas. Quand le chantier se clôt, le bloc entier disparaît,
cases cochées comprises. Autrement dit : un `[x]` visible signale un chantier en cours, et aucun ne
survit à sa section.

**Avant la purge, consolider ce que le chantier a produit de durable** — une règle de conception
ici, une décision dans un ADR. C'est le seul moment où on peut encore le faire : après, la
formulation n'existe plus. Le chantier ADR-0050 l'avait anticipé en écrivant ses huit règles dans
l'ADR ; celui de l'outillage ne l'avait pas fait, et le principe « l'outillage découvre » a failli
partir avec ses cases.

### Où vit le détail d'une tâche

Une ligne de backlog dit *quoi* et *pourquoi*, en quelques lignes. Au-delà, le détail sort du
fichier, et sa durée de vie décide de sa destination :

| Nature du détail | Où | Durée de vie |
|---|---|---|
| Une décision et ses raisons | un ADR | permanent — amendé, jamais supprimé |
| Une règle de conception réutilisable | ce fichier | permanent |
| Un relevé, un plan de travail, un audit | une note dans `docs-internal/` | **supprimée avec la tâche** |

La troisième ligne est celle qui se perd de vue : une note de chantier n'a pas vocation à survivre
au chantier. Elle est citée par la tâche qui la motive, et elle part avec elle.

## Où vit un fichier

**Un fichier appartient au module de son concept, pas à celui qui l'utilise.** Plusieurs
consommateurs, c'est une dépendance entre modules — normal. Le transverse n'accueille que ce
qu'**aucun concept ne revendique** ([ADR-0042](./adr/ADR-0042-structure-api-modules.md)).

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

### Un contrat typé ne protège que ses consommateurs typés

Toute frontière qui **reparse** un contrat au lieu de l'importer est un point de rupture silencieux :
le compilateur ne peut pas avertir un paquet publié sans dépendance quand le contrat bouge. C'est
arrivé — `@mrcasquette/content` filtrait des `blockers` sur `typeof === 'string'` ; le jour où ils
sont devenus des objets structurés, le filtre les a tous éliminés sans bruit, et `content check`
annonçait un registre synchronisé alors qu'il refusait tout.

La règle qui en sort : quand une frontière reparse, le garde-fou vit **au point exact où la faute se
commettrait** (ADR-0053), pas dans un registre tenu à part.

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

Structure dérivée de la doc Elysia ([ADR-0042](./adr/ADR-0042-structure-api-modules.md), en
application d'[ADR-0041](./adr/ADR-0041-hierarchie-autorites.md)) : `modules/<concept>/` avec
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
cf. [ADR-0020](./adr/ADR-0020-colormetadata-double-representation.md).

### `apps/echoppe-admin` — atomic + composables

Le cadre vient d'[ADR-0016](./adr/ADR-0016-conventions-front-admin.md) et de la SSOT personnelle
(`atomic-design.md`) : atomic design, organisms « dumb » (props in, events out), **imports directs**
des composants Vue (pas de barrel — mais barrel toléré pour composables, types et utils), variants en
`Record<Variant, classes>`. Rien de tout cela n'est redit ici.

Ce qui suit est **propre à ce dépôt**, et ne se déduit d'aucune règle générale.

**Un composable par feature, en trois fichiers.** `composables/<feature>/` porte `types.ts` (les
types de la feature), `use<Feature>.ts` (l'implémentation) et `index.ts` (le barrel). Le corps du
composable est découpé par des bannières de commentaires — `STATE`, `COMPUTED`, `API OPERATIONS`… —
qui donnent le même ordre de lecture à tous. Référence : `composables/media/`.

**Les types d'API ne s'écrivent pas à la main, et ne s'extraient plus en ligne.** Les helpers de
`src/types/api.ts` (`ApiData`, `ApiItem`, `ApiPaginatedItem`) portent l'extraction depuis les
réponses Eden. La forme longue — `NonNullable<Awaited<ReturnType<typeof api.x.get>>['data']>` écrite
sur place — est un reliquat : elle ne survit que dans `views/UserEditView.vue`.

**Une vue orchestre, elle n'implémente pas.** Elle branche le composable, tient l'état d'interface
local, et distribue aux organisms. Même convention de bannières que les composables — `UI STATE`,
`COMPOSABLE`, `LIFECYCLE`. Référence : `views/MediaView.vue`.

## Gestion des erreurs

- **Erreur métier attendue** = valeur de retour typée via `status(4xx, …)` à la frontière Elysia
  (ex. 404 produit introuvable, 400 personnalisation invalide). Pas d'exception pour un cas nominal.
- **Erreur exceptionnelle** = `throw`, capturé à la frontière (ex. `verifyWebhook` d'un adapter qui
  lève sur signature invalide → `catch` route → 400). Try/catch async **aux frontières**, pas par
  réflexe partout.
- Jamais de catch silencieux. Pas de `console.log` de debug en prod (les logs structurés
  `[Contexte] …` sont volontaires).
- **Le `message` d'une exception n'entre jamais dans un corps de réponse**
  ([ADR-0050](./adr/ADR-0050-exception-jamais-reponse-http.md)). Une faute qui traverse HTTP est une
  valeur structurée — union discriminée plate sur `code` — dont chaque surface rend le texte. Le
  domaine n'écrit pas d'interface. **Migration terminée** : le contrat ne porte plus de champ
  `message`, et le serveur n'écrit plus de français. Trois surfaces tiennent leur catalogue —
  administration, CLI `@mrcasquette/content`, et le repli de chacune.
- **Un `try` ne couvre que ce qui peut échouer de la faute de l'appelant.** Une portée trop large
  requalifie nos pannes en fautes client : le webhook rendait 400 sur une panne de base, ce qu'un
  provider de paiement lit comme un refus définitif — il cessait de réessayer. Ce qui échoue de notre
  côté doit remonter au gestionnaire global et sortir en 5xx.
- **Les règles de conception d'une faute** (unité migrable, classement par la garde, opérandes
  minimaux, réduction selon l'audience) sont consolidées en
  [ADR-0050 §7](./adr/ADR-0050-exception-jamais-reponse-http.md).

## Frontière de validation

Une seule frontière (philosophy §5) : **TypeBox/Elysia** à l'entrée HTTP
([ADR-0015](./adr/ADR-0015-validation-typebox.md)). Pas de Zod (retiré de `core`/`shared`, deps
mortes). En interne, on **truste** la donnée déjà parsée. `slugify`/dédup et autres normalisations
sont des transformations, pas des revalidations.

## Providers & frontière HTTP

`payments`/`shipping`/`communications` ne sont pas « le métier du paiement/livraison » mais la
**frontière HTTP mince** vers le provisionner (adapters, [ADR-0011](./adr/ADR-0011-adapters-providers.md)).
Ajouter un provider = un adapter + une entrée dans la SSOT `PAYMENT_PROVIDERS`, **zéro route**
(webhook paramétrique `/:provider`). Seules restent des routes : création de session (secret serveur
+ montant autoritaire), webhook (le provider nous rappelle), config/statut/refund admin.

## Seuils (non chiffrés)

Pas de seuil dur sur lignes/fichiers (philosophy §9) : un fichier/fonction « lourd » est un **signal
de revue**, pas une violation. Le découpage suit la lisibilité et la duplication **réelle** (≥2
occurrences déclenchent la factorisation, pas l'anticipation).

## Tests

Filet **lean anti-régression** (esprit CI/CD, sans gonfler la CI) : `bun test` intégré. Smoke API via
`bun run test:api` sur **base Postgres jetable éphémère** (conteneur sur port libre,
**jamais** la base dev ni `dpc-*`/5432). Les routes auth-gated se testent **sans Redis** en injectant
user+rôle+session Postgres et le cookie `echoppe_admin_session` (owner bypass). Chaque capacité ajoute
1–2 assertions ciblées (contrat + comportement clé), rien de plus.

## Contrat SDK — régénération & garde anti-dérive

Le SDK figé (`packages/echoppe-client/src/{openapi,models,facade}.ts` + `openapi.json`) **dérive des routes**.
Ne jamais l'éditer à la main : `bun run contracts` boote l'app pure offline (`serve-contract`),
régénère, et remplace le rituel manuel `:8101`. `bun run contracts:check` fait de même **puis échoue
si les types figés ont bougé** — garde anti-dérive en CI (`ci.yml`, miroir du drift-guard Drizzle),
qui attrape « route changée, SDK oublié » dès la PR. `openapi.json` n'est pas gardé (bruit cosmétique
`additionalProperties` de TypeBox) — seuls les types dérivés le sont, comme le gate release T4.

## Configuration & exploitation (self-host)

**Validation env au boot.** `apps/echoppe-api/src/env.ts` est un **garde-fou fail-fast** importé EN PREMIER
par `index.ts` (avant tout import de `@echoppe/core`, dont le client DB throw sur `DATABASE_URL`
absente). Il refuse le démarrage avec un message clair si une variable **critique** manque :
`DATABASE_URL`, `ENCRYPTION_KEY` (32 octets base64). Les optionnelles ont des défauts sûrs. Autonome
(n'importe pas core) pour pouvoir s'exécuter avant lui. Non chargé par `app.ts` (pure) ni les tests.

**Sauvegarde et restauration** relèvent de l'exploitation, pas des conventions :
→ [runbook/sauvegarde.md](./runbook/sauvegarde.md).

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
