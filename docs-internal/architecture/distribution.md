# Architecture de distribution & découpage repo

> Document interne de cadrage. Décrit comment Échoppe est (et sera) distribué, et
> comment les couches se répartissent entre repos et artefacts publiés.

## Vision produit

Un framework e-commerce **clé en main « à la Medusa »** :

1. **Backend déployable** (API + Dashboard) — l'artisan/le dev le fait tourner.
2. **Front agnostique** — n'importe quelle techno front, qui se connecte via l'API.
3. **CLI de scaffolding one-shot** façon `create-next-app` — `create-echoppe`.

## Deux canaux de distribution : Docker et npm

Ils ne se remplacent pas, ils sont **complémentaires**.

| | **GHCR** (privé) | **npm** (public) |
|---|---|---|
| Distribue | des **images = applications qui tournent** | du **code = librairies à intégrer** |
| Sert à | **déployer/faire tourner** le backend | **consommer du code** dans un projet |
| Public | celui qui **héberge** Échoppe | celui qui **développe un front / scaffolde** |
| Analogie | le serveur PostgreSQL qu'on lance | le driver `pg` qu'on installe |
| État | ✅ en place (`ghcr.io/mrcasquette/echoppe-*`, privé — tirage sous PAT `read:packages`) | ✅ en place (SDK + CLI + DSL) |

Docker fait *tourner* le backend ; npm *outille* le développement du front. Docker
ne peut pas fournir un client à importer dans un projet Astro → npm est indispensable.

Référence : **Medusa** fait exactement cette séparation — backend déployable +
`@medusajs/js-sdk` (npm) + `create-medusa-app` (npm).

## Idée reçue à lever : un package npm n'est PAS un repo

`npm publish` envoie au registre le **contenu d'un dossier qui contient un
`package.json`**. Le repo Git n'a aucun rôle : au mieux un champ `repository`
optionnel, purement informatif.

- **1 repo peut publier 0, 1 ou N packages.**
- C'est le `package.json` qui définit un package, pas le repo.
- Analogie : le registre npm est une bibliothèque, chaque package un livre, un
  monorepo une maison d'édition qui publie plusieurs livres.

Conséquence : l'**indépendance des artefacts** (chaque couche installable séparément)
se joue au niveau **package**, pas au niveau **repo**. Un monorepo suffit.

## Structure monorepo cible

```
echoppe/                           ← 1 seul repo Git (le framework)
├─ apps/
│  ├─ api/                         → image Docker  echoppe-api      (runtime)
│  └─ admin/                       → image Docker  echoppe-admin    (runtime)
├─ packages/
│  ├─ core/          name:@echoppe/core           (privé, interne)
│  ├─ shared/        name:@repo/shared          (privé, interne)
│  ├─ client/        name:@echoppe/client         → npm publish  (SDK)
│  └─ create-echoppe/ name:create-echoppe (bin)   → npm publish  (CLI)
└─ examples/
   └─ store-astro/                 exemple de front (non publié)
```

- **Framework** (API + Dashboard) → distribué en **images Docker**.
- **SDK** (`@echoppe/client`) → **npm**. Généré depuis l'OpenAPI de l'API.
- **CLI** (`create-echoppe`) → **npm**. Wizard de scaffolding.
- **Template** (`examples/store-astro`) → exemple de référence, testé en CI.
- **Boutique réelle** → **repo séparé, hors monorepo** (voir plus bas).

→ **2 repos au total** (framework + boutique), pas un par couche. Le monorepo publie
plusieurs packages npm distincts + plusieurs images Docker.

## Le contrat API : Eden (interne) vs OpenAPI (externe)

Comment un front obtient les types/le client de l'API :

| Option | Pour | Pros | Cons |
|---|---|---|---|
| **A. Types Eden `@echoppe/api`** | **Dashboard interne** (co-versionné) | DX max, inférence directe | couplage de version fort, TS-only |
| **B. SDK npm généré depuis OpenAPI** (`@echoppe/client`) | **Boutiques externes** (reco) | versionnable, découplé, propre | une étape de génération |
| **C. Génération locale depuis `openapi.json` déployé** | fronts non-TS / zéro dépendance | découplage total, multi-langage | pas de SDK prêt à l'emploi |

Décision de principe : **Eden reste pour le dashboard interne** (dans le monorepo,
co-versionné) ; **SDK OpenAPI (B) pour les boutiques externes**. Échoppe expose déjà
OpenAPI (Scalar sur `/docs`), la matière est là.

## La boutique réelle vit dans son propre repo

Règle non négociable : une **boutique client est un consommateur du framework**, pas
un morceau de lui. Elle vit dans un **repo Astro autonome** qui :

- dépend de `@echoppe/client` (npm),
- parle à l'API déployée (Docker) via **URL + SDK**,
- est scaffoldée par `create-echoppe`.

La mettre dans le monorepo framework coupleraient le framework à du code client → à
proscrire.

## La CLI `create-echoppe`

`npm create echoppe@latest` (package npm avec un `bin`) :

1. Wizard : nom du projet, techno front (**Astro** par défaut), URL de l'API, options.
2. Scaffold un **repo boutique Astro** préconfiguré, avec `@echoppe/client` installé.
3. Optionnel : proposer de lancer le backend Docker (`docker compose up`).

## Publier des packages npm (workflow) — **changesets câblé**

> Vue d'ensemble du pipeline complet (npm **+** images, gardes anti-dérive, flux one-move) :
> [`pipeline-release.md`](../release/pipeline-release.md). Cette section couvre le volet **npm**.

Deux paquets publiables : `@echoppe/client` (scopé) et `create-echoppe` (non-scopé,
comme `create-next-app`). Tous les autres workspaces sont `private: true` → ignorés.

**Outillage en place** ([changesets](https://github.com/changesets/changesets)) :

- `.changeset/config.json` : `access: public`, `privatePackages.version: false`
  (changesets ne touche QUE les 2 paquets publiables).
- Scripts racine : `bun run changeset` (déclarer un changement), `bun run
  version-packages` (`changeset version` → bump + CHANGELOG), `bun run release`
  (`scripts/release.sh` : build des 2 paquets + `changeset publish`).

**Publication = CI via Trusted Publishing (OIDC), aucun token.** Le workflow
`.github/workflows/release.yml` (action changesets) :

1. push sur `main` **avec** des changesets → ouvre/maj la PR « Version Packages »
   (bump + CHANGELOG). Requiert le toggle orga *« Allow GitHub Actions to create and
   approve pull requests »*.
2. merge de cette PR → l'étape `publish` s'exécute et publie via **OIDC** (npm échange
   le jeton GitHub Actions, pas de `NPM_TOKEN`). Prérequis : trusted publisher configuré sur
   npmjs.com pour chaque paquet (repo `MrCasquette/atelier` + workflow `release.yml`), et
   npm ≥ 11.5.1 dans le runner. **Sans provenance** depuis le passage en privé : l'attestation
   exige un dépôt source public.

Le seul publish manuel de toute la vie du projet est le **premier** (bootstrap) : npm ne
sait pas initialiser un paquet inexistant via OIDC → première version publiée en
interactif (`bun run release` + OTP), le reste passe par la CI.

### Politique de versions (actée — simplifiée)

**Canal unique `latest`.** On avait envisagé un canal `next` séparé en pré-1.0, mais
changesets, en mode pre, publie de toute façon sur **`latest`** tant qu'un paquet n'a
jamais eu de release stable (il ignore le `tag` de `pre.json`). On s'aligne sur ce
comportement plutôt que de le combattre.

- **Pré-1.0 (0.x)** : semver **propre**, sans suffixe → `0.1.0`, `0.2.0`, `0.5.0`,
  `0.9.0`… publié sur **`latest`**. Le `0.x` **est** le signal « pré-1.0/instable » par
  convention semver — pas besoin de suffixe `-next.N`. Mode pre changesets **désactivé**
  (`changeset pre exit`).
- **1.0.0** : passage stable, toujours sur **`latest`**, puis semver normal
  (1.0.1, 1.1.0…).
- **Pré-release ponctuelle** (si un jour besoin d'un vrai canal beta) : `changeset pre
  enter <tag>` au coup par coup, puis `pre exit`. Pas le mode par défaut.

Template CLI : `@echoppe/client` épinglé sur **`latest`** (résout toujours la dernière
version publiée). À figer sur un caret `^x.y.z` si on veut borner au palier 1.0.

> Historique : les `0.1.0-next.0` / `0.1.0-next.1` initiales (mode pre) ont été
> **unpubliées** (fenêtre npm 72h) et le tag `next` retiré → npm est **pristine en
> `0.1.0`** (`@echoppe/client` en `0.1.1` après correction des imports ESM `.js`).

## Versioning : unités indépendantes (ADR-0023)

> **Amendé par [ADR-0023](../adr/ADR-0023-versioning-tags.md)** : le SDK n'est **plus co-versionné**
> avec l'API. Chaque unité (runtime api+admin, sdk, content, cli) est versionnée **indépendamment**
> par changesets, ne bumpant que quand *son* code change (fini les bumps à changelog vide).

Le SDK est généré depuis le contrat de l'API et reste **régénéré/publié dans le même commit** (intérêt
du monorepo). Mais il porte sa **propre version** : une boutique déclare la compatibilité (« SDK ≥
0.3, API ≥ 0.5 »), elle n'est plus imposée par un numéro partagé. Côté tags git : **une seule épine
`v*`** (le runtime déployable) ; les packages vivent sur **npm** (pas de tag git). Cf. ADR-0023.

## Ordre de réalisation — ✅ livré en 0.1.0

1. ✅ **Stabiliser l'OpenAPI** de l'API (le contrat).
2. ✅ **`@echoppe/client`** (SDK OpenAPI) → publié npm (`0.1.1`).
3. ✅ Exemple **Astro** à `apps/echoppe-store` (remplace le store Next, supprimé).
4. ✅ **`create-echoppe`** (CLI) → publié npm (`0.1.0`) : scaffolde front + `compose.yaml` + `.env`.
5. ⏳ Première **boutique réelle** (repo Astro externe via la CLI) — flux validé nativement sur arm64, reste le test grandeur nature sur VM x86.

Livré en plus : **migrations au boot** de l'API (plus de conteneur init), **images Docker
multi-arch** (amd64+arm64), **release CI par Trusted Publishing / OIDC** (aucun token),
**guide de mise à jour** selfhoster.

## Points ouverts

- ✅ Contrat externe : **B** (SDK publié) retenu.
- ✅ Template : **exemple interne** (`apps/echoppe-store`) retenu ; pas de starter clonable sorti pour l'instant.
- ✅ Sort de `apps/echoppe-store` : **remplacé par un exemple Astro** ; le Next est supprimé.
- Alignement versions SDK ↔ images API : principe acté (versionner en phase) ; à
  formaliser dans le process de release quand les contrats évolueront.
- Modules / plugins / thèmes (customisation par boutique) : **cap post-1.0** (modèle C
  « framework-as-dependency » envisagé plus tard).
- Migration runtime **Bun → pnpm/Node** : en exploration.
