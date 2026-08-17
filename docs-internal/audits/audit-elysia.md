# Audit Elysia — contraintes, requalification, décision

> **Statut (2026-08-16) — note de décision.** Verdict : **rester sur Elysia** ; découpler le
> type-system des paquets partagés (**C17**, exigence Prisme) ; surveiller **C15** (primitives de
> champ récursives). Lecture seule du code — aucune modification.

## Verdict global

Elysia ne crée **pas** de coût structurel net majeur à long terme. Sur 18 contraintes identifiées,
seules 6 sont réellement imputables à Elysia, et parmi elles 2 seulement sont récurrentes et
lourdes (**C15** — grammaire de champs dupliquée — et **C17** — paquets partagés couplés au package
`elysia`). Les 12 autres sont soit des coûts **déplacés** (on les paierait sous Hono/Fastify sous
une autre forme), soit issus de **notre propre architecture** (SSOT du contrat, séparation
domaine/transport, choix Eden pour l'admin, choix du runtime Bun). Le coût net se concentre sur
**l'inférence des routes** (littéraux, spreads, récursivité) — rien de runtime, rien de métier.

C17 se résout **sans migration** (découplage `@sinclair/typebox` dans les paquets partagés, exigé
par le socle agnostique Prisme). C15 est un argument de migration **conditionnel** : faible en
régime de primitives « plates », non borné dès qu'une primitive devient récursive.

## Périmètre et méthode

Contraintes identifiées sur le code (`apps/echoppe-api`, `apps/echoppe-admin`, `packages/`,
`docs-internal/`), chacune vérifiée fichier:ligne et attribuée à une seule couche (Elysia, Eden,
TypeBox, OpenAPI, Bun, architecture locale). Verdicts possibles : propre à Elysia / amplifiée /
indépendante. Compteurs relevés : **213** `status(4xx/5xx, …)` écrits à la main, **50**
`.use(models)` (43 fichiers), **66** `new Elysia` (59 fichiers), **278** déclarations de routes,
**80** imports `elysia` dans l'app + **7** fichiers de paquets, **5** `t.Unsafe` (4 app + 1 fields),
**41** littéraux de ressources dans `fault-schema.ts`.

> Note : les contraintes C11, C12 et C15 ont été reconstruites depuis les traces du code et des ADR
> (renommage `/option-axes`, règle d'ordre de composition, adaptateur statique `@repo/fields`) — les
> quinze autres sont vérifiées directement.

## Les 18 contraintes

| C | Contrainte (preuve) | Verdict initial |
|---|---|---|
| C1 | Statut écrit à la main (`lib/fault.ts:6-9`), déduire le statut du code de faute coûterait le contrat | propre à Elysia |
| C2 | 8 combinators de réponses (`lib/response.ts`) pour factoriser le socle d'erreurs | propre à Elysia |
| C3 | 41 littéraux écrits un par un, jamais dérivés d'une liste (`lib/fault-schema.ts:43-97`) — union sur tableau → `never` | amplifiée par Elysia |
| C4 | `t.Ref` imbriqué non résolu dans `Static` (`modules/customer/model.ts:5-6`) | amplifiée par Elysia |
| C5 | Registre central `.model()`/`ModelName` (`model.ts`, 50 uses) | propre à Elysia |
| C6 | Références par nom de modèle dans `response` + union stricte `ModelName` | propre à Elysia |
| C7 | Statut d'erreur contractuel par modèle nommé (`'ErrorResponse'` = `$ref` unique) | propre à Elysia |
| C8 | Helpers Eden admin (`types/api.ts`) + `Extract<Fault, …>` (`lib/fault.ts:22`) | propre à Elysia |
| C9 | `t.Unsafe<ApiKeyScope>` (`modules/api-key/index.ts:18`) — union runtime → `never` côté Eden | propre à Elysia |
| C10 | Gardes `Equal`, double écriture type + schéma (`lib/fault-schema.ts:210-228`) | amplifiée par Elysia |
| C11 | Renommage `/options` → `/option-axes` (piège Eden verbes réservés, ADR-0007:35-36) | propre à Elysia |
| C12 | Ordre de composition significatif, dernière déclaration écrase (conventions.md:131-133, ADR-0042:210) | propre à Elysia |
| C13 | `t.Recursive`/`$id` + `normalizeRecursiveSchemas` (`generate.ts:24-83`) | propre à Elysia |
| C14 | Annotations `AUTH_ERRORS`/`NOT_FOUND_ERROR` (`lib/response.ts:120-125`) — `as const` élargit le littéral | propre à Elysia |
| C15 | Adaptateur statique `@repo/fields` (`model.ts:100-172`) — `Static<>` récursif casse l'inférence de route | propre à Elysia |
| C16 | Pipeline contrat (`serve-contract.ts`, `scripts/contracts.ts`) | indépendante |
| C17 | Paquets partagés couplés au package `elysia` (fields/menus dep directe, content-module.md:99-110) | propre à Elysia |
| C18 | Couplage Bun (`Bun.spawn`, `$`, `Bun.write`, `bunx`) | indépendante |

## Requalification trois axes

Axe 1 — **coût réellement imputable à Elysia** (6) : C3, C9, C11, C14, C15, C17.
Axe 2 — **coût seulement déplacé** (8) : C1, C2, C4, C5, C6, C7, C12, C13.
Axe 3 — **vient de notre architecture** (4) : C8, C10, C16, C18.

| C | Verdict requalifié |
|---|---|
| C3 | **disparaît réellement** — la dérivation depuis un `as const` survit sous Hono/Fastify ; la liste des ressources reste (coût domaine) |
| C4 | **seulement déplacée** — limitation TypeBox : identique sous Fastify, naturelle sous Hono (zod-openapi) |
| C9 | **disparaît réellement** — un client généré (openapi-fetch) résout sans `t.Unsafe` |
| C11 | **disparaît réellement** — la règle vient d'Eden, pas du serveur ; ni Hono ni Fastify ne l'ont |
| C14 | **disparaît réellement** — fragilité littéral-through-spread propre à l'inférence Elysia |
| C15 | **disparaît réellement** (Hono : `z.lazy`/`z.infer` ; Fastify : pas d'inférence de handler) — plus grosse duplication nette |
| C17 | **disparaît réellement** — sous Hono → zod, sous Fastify → `@sinclair/typebox` direct ; se propage à Prisme |
| C1, C2, C5, C6, C7, C13 | **seulement déplacée** — le besoin (statut dans le contrat, composants nommés, refs, pipeline) est universel ; seule la mécanique est Elysia/TypeBox |
| C12 | **reste identique** — la discipline d'ordre est universelle (Hono/Fastify matchent en ordre) ; la part Elysia (écrasement silencieux) est faible |
| C8, C10, C16, C18 | **vient surtout de notre code / notre architecture** — Eden interne, SSOT double écriture + verrous, OpenAPI figé, runtime Bun |

## Couche économique — les 6 contraintes nettes

| C | Déjà payé (non récupérable) | Marginal futur si on reste | Propagation Prisme | Suppression si migration | Coût équivalent Hono/Fastify |
|---|---|---|---|---|---|
| C3 | 41 littéraux + commentaire + garde `Equal` (forme du fichier, 228 l.) | faible : +1 littéral par ressource, garde à la compilation | friction une fois, aucun héritage | ~0 (dérivation possible) | ~0 / ~0 |
| C9 | 1 ligne `t.Unsafe` + commentaire ; la validation `isValidScopeFor` a d'autres raisons | récurrent léger : chaque union runtime vers le contrat (SCOPES, SHIPPING_PROVIDERS, COMMUNICATION_PROVIDERS déjà touchés) | clés d'API / enums Prisme : même pattern | ~0 (client généré) | ~0 / ~0 |
| C11 | renommage + propagation admin/SDK + ADR-0007 — irrécupérable | ≈0 : piège documenté (3 docs) | risque transférable, faible | rien à supprimer (déjà fait) | 0 / 0 |
| C14 | diag « Mesuré sur les deux formes » + annotations + ADR-0050:432 | rare : seulement un nouveau combinator re-piège | re-découverte possible, faible | ~0 (annotations inutiles) | ~0 / ~0 |
| C15 | ~55 l. TS + 109 l. de test-lock + 3 sessions de diagnostic | **fort et linéaire** : chaque primitive = +1 membre TypeBox + 1 membre TS + 1 ligne de verrou | **directe et double** : Prisme hérite de la grammaire dupliquée et maintient le verrou | ~150 l. + tests (zod ou typebox seul) | Hono : dep zod · Fastify : 0 |
| C17 | 7 fichiers, 2 deps directes, référence content-module.md | faible mais persistant : chaque paquet à schéma re-dépend ; bump Elysia = bump TypeBox implicite | **directe** : Prisme dépend transitivement d'elysia | **faible, sans migration** : 7 imports + 2 `package.json` | transfert neutre (lib de schéma) |

## Coût marginal d'une primitive `fields` (mesuré le 2026-08-16)

Fichiers touchés pour une primitive supplémentaire :

| Fichier | Nature | Ajout |
|---|---|---|
| `packages/fields/src/model.ts` | **duplication Elysia** | +1 `t.Object` (TypeBox) **et** +1 membre de l'union `SerializedField` (adaptateur TS) |
| `packages/fields/src/model.test.ts` | **verrou Elysia** | +1 ligne `SameKeys<…, 'kind'>` (ligne par kind exigée) |
| `packages/fields/src/compile.ts` | dérivation légitime | +1 `case` `fieldToSchema` |
| `packages/entities/src/ddl.ts` | dérivation légitime | +1 `case` champ → colonne SQL |
| `packages/content/src/types.ts` | dérivation légitime (DSL) | +1 interface `XField` + membre `Field` + branche `ValueOf<F>` |
| `packages/content/src/serialize.ts` | conditionnel | +1 case si sérialisation spécifique |
| `packages/entities/src/reference.ts` | conditionnel | seulement si primitive référençable |
| `apps/echoppe-admin/…/FieldControl.vue` | dérivation légitime (UI) | +1 branche `v-else-if` |
| `apps/echoppe-admin/…/registry.ts` | dérivation légitime | +1 case (2 switch) |
| Tests `compile.test.ts`, `ddl.test.ts` | légitime | +1 cas chacun |

**Bilan** : sur 8–10 fichiers, la duplication pure imputable à Elysia est **3 éléments dans 2
fichiers** (~15–20 lignes). Le reste (champ → schéma/colonne/rendu, DSL) est payé sous n'importe
quelle stack. **Risque d'inférence asymétrique** : nul pour une primitive plate ; non borné pour
une primitive **récursive** (le bug d'origine est un `t.Array` dans un `t.Recursive` traversé par
`Static<>` — une nouvelle récursion peut recasser l'inférence de route). C15 ne devient donc
argument de migration que si la grammaire accueille des primitives récursives — la **forme**, pas le
**nombre**.

## Récurrent vs one-shot

- **One-shots payés (poids ≈ nul dans la décision)** : C11 (renommage), C14 (diag) — une migration ne les récupère pas.
- **Récurrents légers** : C3 (par ressource), C9 (par union runtime).
- **Récurrents lourds + propagation Prisme** : **C15** (croît avec la grammaire), **C17** (s'étend à chaque paquet et au second produit).

## Synthèse décisionnelle — rester / Hono / Fastify

| | Rester sur Elysia | Migrer vers Hono | Migrer vers Fastify |
|---|---|---|---|
| Supprime | — | C15, C17, C3, C9, C14, C11 | C15, C17, C14 (C3/C9 via client généré) |
| Re-paie | — | C1-C2, C5-C7, C12, C13 | C1-C2, C5-C7, C12, C13 (TypeBox conservé → C4/C10 inchangés) |
| Coûts nouveaux | croissance C15 + couplage C17 | validation de réponse à reconstruire (zod-openapi ne valide pas les réponses), perte d'Eden admin (ADR-0007 modifié), pipeline OpenAPI refondu | verbosité JSON Schema par route + plugin swagger + validation de réponse dédiée |
| Coût de migration | 0 | ~59 fichiers / 278 routes / pipeline / schémas / tests + admin | identique à Hono, plus l'outillage de réponses |

**Verdict** : les deux migrations suppriment en pratique 2 contraintes récurrentes (C15, C17) au
prix d'une réécriture complète, du re-paiement des coûts déplacés et de coûts d'outillage nouveaux
(validation de réponse). L'arbitrage économique n'est pas gagnant. **Rester sur Elysia** est la
voie retenue, avec deux mesures :

1. **Découpler C17 (exigence Prisme — socle agnostique)** : importer `@sinclair/typebox` directement
   dans `fields/pages/entities/menus` au lieu d'elysia (7 fichiers + 2 `package.json`, aucune route
   touchée). La peur du drift TypeBox (content-module.md:99-110) se gère par plage de version ou
   alias de paquet. Sujet : **socle**, avant l'extraction Prisme.
2. **Instrumenter C15** : garde « nouvelle primitive récursive = revue obligatoire » — le test-lock
   énumère déjà un kind par ligne, un compteur suffit. Sujet : **@repo/fields**.

**Sans suite** : C11, C14 (one-shots payés) ; C3, C9 (frictions légères documentées et verrouillées).
