# Module contenu — décision & architecture

Doc de **décision** (le _pourquoi_) du page builder headless et de son outillage
`@mrcasquette/content` (P2). La doc utilisateur (le _comment_) vit dans
[dev/content](../../docs/dev/content.md).

Voir aussi [Clés d'API](./api-keys.md) : l'auth machine que consomme `content:push`.

## Ce qu'on construit (et ce qu'on ne construit pas)

Un **page builder headless**, façon Strapi mais sans son admin monolithique. Le partage des
responsabilités :

| Le framework | Le dev |
|--------------|--------|
| **Stocke** les blocs (`page` → `section[]`, `data` en jsonb) | **Déclare** ses blocs en config-as-code (`@mrcasquette/content`) |
| **Valide** la donnée éditée contre les définitions | **Rend** (les composants de son front — le rendu n'est jamais au framework) |
| **Sert** la donnée (storefront + admin) | **Édite** via l'admin (formulaires générés — P3) |
| — | **Type** son front par **inférence** des déclarations (P2c, `InferData`/`InferSections`) |

Le `data` d'un bloc est **schemaless au niveau DB** (jsonb) mais **schema-driven au niveau
validation** : la forme est décrite par le registre déclaré par le dev, pas figée dans le
code de l'API.

## `@mrcasquette/content` : léger par design, mais pas dogmatique

Package **build/dev-time**, importé en **devDependency** du front. Il ne fait **aucun appel
runtime en production** : il déclare, la CLI sérialise/pousse, et le front **infère** ses types
depuis les déclarations (aucun codegen).

Position validée : « léger par design, mais pas orthodoxe ». Zéro dépendance _de production_
embarquée, mais on n'interdit pas une lib si un besoin réel et complexe l'exige (cf. `core`
qui est légitimement lourd). Aujourd'hui : **zéro runtime dep**. Le seul `@types/node` est un
**stub de types build-time** (devDep) — il n'expédie rien.

### Loader CLI : natif d'abord, `tsx` en repli legacy

La CLI doit charger le `src/content/index.ts` **TypeScript** du dev. Décision (validée) :
**pas de loader JIT type jiti**. On s'appuie sur le type-stripping natif — **Bun** ou
**Node ≥ 24** — et on ne tombe sur `npx tsx` (à la volée, rien d'installé) que pour le
**Node legacy < 24**. Le runner est détecté **au scaffold** (`create-echoppe`) :

```ts
// npm_config_user_agent (1er token = le PM) + process.versions
bun || Node≥24  → TS natif, aucun outil
Node < 24       → `npx tsx`   (repli, éphémère)
```

## Deux mondes : authoring vs registre

Distinction structurante (`packages/content/src/types.ts`) :

- **Authoring** — descripteurs riches manipulés dans le repo du dev. Un champ imbriqué ou une
  `list` porte la `Definition` **par référence** (l'objet lui-même, ex. `cta: link`,
  `f.list(card)`). C'est ce qui permet l'**auto-collecte** des components ET l'**inférence de
  types** (les builders sont génériques, `const` type params → littéraux préservés).
- **Registre** (`serialize.ts`) — forme JSON sérialisable, références résolues **par nom**.
  Poussé vers l'API (P2b) et lu par le générateur de formulaires admin (P3). Le **front n'en
  dépend pas pour se typer** : il infère depuis l'authoring (cf. P2c ci-dessous).

`serialize(content)` marche les sections, auto-collecte les components référencés dans
`registry.components`, avec deux garde-fous :

- **collision de nom** — deux définitions distinctes sous le même nom → erreur explicite ;
- **cycle** — le nom est enregistré **avant** de sérialiser ses champs, donc une
  auto-référence s'arrête sur l'identité déjà vue (pas de boucle infinie).

### Trois verbes de déclaration

| Verbe | Rôle | Insérable en page ? |
|-------|------|---------------------|
| `defineSection` | bloc de page (va dans `page.sections`) | **oui** |
| `defineComponent` | groupe de champs nommé, réutilisable | non (imbriqué / `list`) |
| `defineContent` | racine — seul point lu par la CLI | — |

`defineContent` **refuse** un component dans `sections` (garde-fou : seules les sections sont
insérables).

## Le validateur générique : le point d'architecture central

L'ancien `models/content.ts` figeait une **union statique** de blocs dans le code de l'API.
Incompatible avec un builder où **le dev** définit les blocs. On l'a remplacé par un
**validateur dérivé du registre à l'exécution** (`services/content-registry.ts`).

### Qu'est-ce qu'on gagne / perd vs un validateur maison ?

On **gagne sur tous les terrains**, à une condition (voir drift ci-dessous) :

- pas de moteur de validation à écrire/maintenir (contraintes, formats, messages d'erreur,
  chemins) ;
- **mêmes** règles et **mêmes** messages que le reste de l'API ;
- compilation + cache gratuits.

Ce qu'on « perd » : rien de fonctionnel — juste la contrainte d'**exprimer** chaque `kind`
de champ en schéma TypeBox (une fonction `fieldToSchema`, triviale).

### Zéro nouvelle dépendance, zéro drift de version

Le point délicat (soulevé et tranché) : réutiliser TypeBox **sans** l'ajouter comme dépendance
et **sans** risquer un décalage de version quand Elysia bump. Solution : importer le
type-system **depuis Elysia lui-même** —

```ts
import { type TSchema, t } from 'elysia';
import { FormatRegistry, type TypeCheck, TypeCompiler } from 'elysia/type-system';
```

C'est **la même instance TypeBox** qu'Elysia utilise déjà pour valider toutes les routes.
Aucun `@sinclair/typebox` dans le `package.json`, donc **aucune version à résoudre**, donc
**aucun drift** possible : si Elysia bump TypeBox, on suit automatiquement.

> Alternative écartée : `@sinclair/typebox/value` (`Value.Check`) — aurait **ajouté** un
> package et rouvert la porte au drift. `elysia/type-system` couvre le besoin (compile + cache
> + formats).

### Machinerie

```
Registry (JSON, refs par nom)
        │  fieldToSchema / fieldsToSchema / resolveComponent   (récursif)
        ▼
Schéma TypeBox par section     ← récursif pour list / repeater / component
        │  TypeCompiler.Compile                                (une fois)
        ▼
TypeCheck<TSchema>  ── mis en cache module (Map<type, check>)
        │  check.Check(data)  →  ok
        │  check.Errors(data) →  [`/path message`, …]          (→ 422)
```

- **Formats** (`uuid`, `date`, `date-time`) branchés une fois sur `FormatRegistry` (idempotent
  via `.Has`).
- **Cache module** : `{ registry, sectionChecks }`, invalidé par `invalidateRegistryCache()`
  après chaque `PUT /content/registry`.
- **Frontière interne assumée** : au rechargement depuis la DB, on **revalide** le registre
  jsonb contre `registrySchema` (`registryCheck.Check`) avant de lui faire confiance — le
  stockage est _censé_ sain, mais du jsonb non typé ne se truste pas aveuglément.
- **image / ref** → validés comme `uuid` ; l'existence réelle du média / de l'entité catalogue
  est vérifiée séparément (accès DB), hors du validateur de forme.

## Flux de synchronisation (push)

```
src/content/index.ts (dev, TS)
   │  defineContent(...)
   ▼
CLI  content:push            packages/content/src/cli.ts
   │  serialize() → Registry
   │  pushRegistry({ apiUrl, apiKey })
   ▼
PUT /content/registry        Authorization: Bearer eck_…   (scope write:content)
   │  assertRegistryCoherent(body)   → 422 si ref manquante / cycle
   │  transaction : delete-all + insert (miroir des fichiers du dev)
   │  invalidateRegistryCache()
   ▼
content_definition (une ligne par section/component)
```

Le registre est **remplace-tout** : la **source d'autorité, ce sont les fichiers du dev** ;
la DB en est le miroir. Édition de contenu et définition de contenu sont deux plans distincts
(le `data` des pages n'est jamais touché par un push de registre).

## Ce que `models/content.ts` reste (et n'est plus)

Question tranchée : le fichier `models` **reste la SSOT** pour tout le catalogue e-commerce
(d'où Eden/Treaty côté admin). Ce qu'il **n'est plus**, c'est la SSOT de la _forme des
blocs_ : celle-ci vit désormais **en base** (registre), la base minimale (schémas récursifs
`serializedFieldSchema`, `registrySchema`, `sectionInputSchema` générique `data: t.Unknown()`)
restant en fichier. Le `data` d'un bloc est donc `unknown` côté SDK/Eden — le typage fin vient
du **P2c** (inférence, ci-dessous).

## P2c — typage front par inférence (pas de codegen, pas de Zod)

Décision tranchée : **ne pas** générer de fichier de types. Les déclarations du dev **sont** du
TypeScript → on **infère** à la compilation, façon `z.infer`. Le registre poussé ne sert qu'à
l'**admin** ; le front tire ses types de sa propre source.

- **Builders génériques** (`field.ts`, `define.ts`) : `const` type params → `required: true`,
  options d'enum, `of` d'une `list`, nom de section sont **capturés littéralement**. La
  normalisation des enum est déplacée dans `serialize.ts` pour préserver ces littéraux à
  l'authoring.
- **`InferField`/`InferData`/`InferSections`** (`types.ts`) : table type-level descripteur →
  type valeur (text→string, enum→union, `multiple`→`[]`, list→`InferData<of>[]`, component
  by-ref→son type…), optionalité pilotée par `required`. `InferSections` produit l'union
  discriminée `{ id; type; data }`.
- **`asSections(content, raw)`** (`narrow.ts`) : le SEUL cast de frontière (le SDK type
  `data: unknown` par construction). Fourni par la lib, le dev n'écrit jamais de `as`. Trust :
  l'API a validé à l'écriture.

**Pourquoi pas Zod ?** Nos descripteurs sont un **modèle de domaine page-builder** (widgets
image/ref/richText, labels/icons admin), pas un schéma de validation ; on veut **seulement**
l'inférence, pas un validateur runtime front (validation mono-sourcée API/TypeBox) ; zéro-dep
runtime est un invariant ; et on garderait de toute façon notre `serialize` (Zod→JSON Schema ≠
notre registre). Le recouvrement avec Zod = ~30 lignes de types conditionnels.

**Dérive front ↔ registre.** Flux **à sens unique** (définitions = code, contenu = données
admin ; pas de sync bidirectionnelle). Le registre est traité comme une **migration
forward-only** : `content:push` au déploiement + **`content:check`** en CI (compare local vs
déployé par hash canonique, `read:content`, exit 1 si divergent). En dev local, pas besoin de
push à chaque modif (le front se type depuis ses fichiers). Cf. [dev/content](../../docs/dev/content.md).

## État & suite

- **Livré (P2a/P2b/P2c)** — format d'authoring, `serialize`, validateur générique, `PUT/GET
  /content/registry`, validation à `PUT /pages/:id/sections`, CLI `push`/`check`, auth par clé,
  **inférence de types front** (`InferData`/`InferSections`, `asSections`).
- **À venir** — **P3** générateur de formulaires admin (Vue) · **P4** menus, entités
  extensibles, champs custom.
