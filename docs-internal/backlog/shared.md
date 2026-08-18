# Backlog — socle partagé

Travail sur les packages, contrats et décisions qui concernent Échoppe et Prisme. Une abstraction
nouvelle doit avoir deux usages réels ; à défaut, elle reste dans le produit qui la porte.

## Workspace et outillage (`atelier`)

Le conteneur, distinct des produits qu'il héberge. Principe acquis : **l'outillage découvre, il
n'énumère pas** — et il découvre par *capacité* (le fichier qui prouve qu'un workspace sait faire
quelque chose) ou par *déclaration* (le workspace le dit dans son manifeste), jamais par convention
de nom, qui tiendrait sans que rien ne la vérifie.

Livré le 2026-08-17, chaque point vérifié en créant un squelette `prisme-*` jetable et en observant
ce qui cassait :

- [x] **Le workspace se nomme `atelier`** (`package.json`), aligné sur le remote `MrCasquette/atelier`
  qui portait déjà ce nom. Échoppe cesse d'être le produit du dépôt.
- [x] **`test`, `build`, `lint` génériques.** L'ancien `test` énumérait 14 workspaces : un test
  délibérément cassé dans un workspace non listé sortait en **0**. `--filter '*'` sort en 1 et
  n'en perd aucun (15 contre 14). `build` respecte la topologie — vérifié à froid, `dist/` retirés.
- [x] **`tsconfig.base.json` : `paths` supprimés.** Vestige — `tsc` résout par les symlinks de
  `node_modules`. 19 workspaces verts sans eux. Aucune entrée par produit à maintenir.
- [x] **ESLint linter unique, Biome formateur.** Biome ne résout pas les références d'un
  `<template>` : 880 faux positifs sur `echoppe-admin`, 13 sur `echoppe-store`, concentrés sur
  `noUnusedVariables`/`noUnusedImports`. La frontière devient « linter / formateur », orthogonale au
  code, au lieu de « quel fichier va à quel linter » — qui laissait `echoppe-store`, `prisme-admin`,
  `docs` et **tout `scripts/`** sans couverture. Passe de 309 à **481 fichiers** pour 3 corrections.
- [x] **`scripts/drift-guard.ts`** — découvre les `drizzle.config.ts` et lit `out` dans la config.
  Vérifié sur deux schémas simultanés : l'un validé, l'autre refusé.
- [x] **`scripts/contract-targets.ts` + `contracts.ts`** — le client déclare sa source
  (`contract.source` / `contract.frozen`). Le gate de release T4 consomme la même déclaration ; les
  deux listes de fichiers figés qui pouvaient diverger n'en font plus qu'une.
- [x] **`scripts/product-isolation.ts`** — garde d'isolation entre produits frères, sur les
  dépendances déclarées **et** les imports réels (une dep non déclarée résout par hoisting).
- [x] **`packages/client` → `packages/echoppe-client`** (dossier seul ; `@echoppe/client` et sa
  version `0.6.0` sont inchangés, le contrat figé ne bouge pas d'un octet), et
  `ECHOPPE_API_URL` → `CONTRACT_API_URL` — `scripts/` n'étant pas publié, le changement ne sort pas
  du dépôt.
- [x] **Drapeau de tests `ECHOPPE_SMOKE` → `SMOKE_RUN`** — la garde « base jetable » du harness API
  sera recopiée telle quelle par `prisme-api` ; elle ne nomme plus un produit. Même famille lexicale
  que `SMOKE_DATABASE_URL`, déjà neutre.

Reste ouvert :

- [ ] 🟠 **`dev`, `db:*` et `test:integration` restent câblés sur Échoppe** (`--cwd apps/echoppe-*`,
  `packages/echoppe-core`). Ce sont les derniers scripts racine qui nomment un produit.
- [ ] 🟠 **Distribution mono-produit** : `Dockerfile` (19 `COPY packages/*/package.json` énumérés,
  targets `api`/`admin`, user système `echoppe`), `docker-build.yml` (`IMAGE_PREFIX`), `release.yml`
  (version runtime = `apps/echoppe-api/package.json`), `ship.ts` (4 canaux Échoppe), `compose.yaml`
  et `compose.yaml`. **Volontairement différé** : Prisme n'a aucun cycle de publication, et
  paramétrer avant d'avoir un second artefact serait de l'abstraction par anticipation. Piège à
  connaître : l'image n'est construite qu'**à la release** (`docker-build.yml` → `integration.ts`),
  jamais par `ci.yml` — une dérive du `Dockerfile` ne se voit qu'au moment de publier. Ne jamais
  renommer un volume Compose : la donnée de production y est attachée.
- [ ] 🟡 **Renommer le dossier de travail local** `~/dev/Axiome/echoppe` → `…/atelier`. Le dépôt n'en
  dépend pas : aucun chemin absolu n'est codé en dur et le remote s'appelle déjà `atelier`. Deux
  précautions seulement — relancer `bun install` (les liens de `node_modules` pointent l'ancien
  chemin) et rouvrir les sessions d'outils dont le répertoire courant devient invalide.
- [ ] 🟡 **`docs/` est le site d'Échoppe** (`@echoppe/docs`, 22 fichiers), pas la doc du workspace.
  À trancher avec `prisme-admin`.
- [ ] 🟡 **La garde d'isolation s'endort sous deux produits.** Elle sort en succès silencieux tant
  qu'un seul scope possède une application — donc dès que le squelette `prisme-*` disparaîtra, et
  jusqu'au vrai `prisme-api`.
- [ ] 🟡 **Dette Biome révélée** : `$schema` figé en 2.3.9 alors que Biome est en 2.5.2, et
  `linter.rules.recommended` déprécié au profit de `preset` (`biome migrate`). Par ailleurs
  l'organisation automatique des imports, qui venait de `biome check`, disparaît avec le linter —
  `biome format` ne la fait pas.
- [ ] 🟡 **18 warnings ESLint** : 17 `no-non-null-assertion` (statut inchangé, la règle était déjà
  en `warn` sous Biome) et 1 `vue/no-v-html` dans la doc — celui-ci est un signal de sécurité.

## Contenu config-as-code

- [ ] 🔴 **Migrer `richText` de HTML vers Markdown** selon [ADR-0030](../adr/ADR-0030-texte-riche-markdown.md) :
  convertir les données, désactiver le HTML brut et tester le rendu contre le XSS stocké.
- [x] 🟠 **Préserver l'ordre déclaré des champs** : choisir une représentation explicitement
  ordonnée plutôt que dépendre de l'ordre d'un objet stocké en `jsonb`. → `json` au lieu de `jsonb`
  sur `content_definition.fields` et `entity_definition.fields` ; `jsonb` normalise les clés.
- [x] 🟠 **Extraire la grammaire des champs hors de `@repo/pages`** ; trancher le nom du package
  avec le lexique. → `@repo/fields`, sans aucune dépendance : la primitive et sa compilation sont
  parties, les dérivations sont restées — DDL côté entités, registre à deux rôles côté pages.
  `@repo/entities` ne dépend plus de `@repo/pages`.
- [x] 🟠 **Implémenter l'interpolation V1** après stabilisation de Markdown : jeu fini de variables,
  substitution sans évaluation, une passe, littéral conservé pour une inconnue.
- [x] 🔴 **Sortir le vocabulaire Échoppe du contrat public de `@mrcasquette/content`** — c'est **le
  DSL config-as-code de Prisme autant que d'Échoppe**, et sa CLI réclamait pourtant une clé nommée
  d'après un seul des deux. → `ECHOPPE_API_KEY` → `CONTENT_API_KEY`, `ECHOPPE_CONTENT_CONFIG` →
  `CONTENT_CONFIG`, sans lecture de repli : la variable manquante arrête la CLI en la nommant, donc
  la migration se voit au premier `push`. Changeset **major** (surface publiée, contrairement à
  `CONTRACT_API_URL` qui ne sortait pas du dépôt). Le nom suit désormais le package, pas le produit
  qui le consomme. Le scope neutre était déjà conforme à
  [ADR-0033](../adr/ADR-0033-organisation-monorepo.md) et n'était pas en cause.
  Reste, hors périmètre env : le mot-clé npm `echoppe` (positionnement produit, pas outillage) et le
  `CHANGELOG` qui nomme `@echoppe/content` en 0.1.0 — exact pour cette version-là.
- [ ] 🟡 **Type-gen du DSL** pour les sections et composants de front.
- [ ] 🟡 **Générateur de formulaires admin** depuis le registre.
- [ ] 🟡 Menus imbriqués, champs custom, fichiers/assets et i18n des enums.
- [ ] 🟡 Durcir les clés API et documenter la portabilité liée à PostgreSQL/`jsonb`.

## Architecture et contrats

- [ ] 🟠 **Trancher l'injection DB** dans un ADR : singleton, factory de service, contexte de requête
  et unité transactionnelle. L'éprouver d'abord dans le vertical slice Prisme.
- [ ] 🟠 **Retirer le singleton de `@repo/communication` au profit d'une composition injectable.**
  `email.ts` résout son adapter via `getActiveCommunicationAdapter()`, importé d'un singleton de
  module aux fabriques câblées en dur : **aucune couture** ne permet d'en substituer un faux. Les
  credentials sont bien injectés (DIP), mais les stuber supprime la dépendance à la base, **pas au
  réseau** — un adapter muni de credentials valides appelle la véritable API.

  Ce qui protège les tests aujourd'hui est qu'aucun provider n'est configuré dans la base de test :
  une propriété de la donnée, pas de l'architecture, sur un Postgres que tous les fichiers partagent.

  Sortie retenue : une fabrique `createCommunicationRegistry(factories)` composée par le produit au
  démarrage — la forme « acteur », conforme au sens de la flèche d'ADR-0025. Écarté : un garde
  `NODE_ENV`, qui serait un test d'environnement dans du code de domaine, invisible au type, et ne
  protégerait que le chemin qui pense à le consulter. Touche les 4 appelants de `sendEmail` plus le
  câblage au boot. Débloque les tests du chemin d'envoi, aujourd'hui impossibles.
  Détail : [audit de couverture documentaire](../audits/audit-couverture-documentaire.md).
- [ ] 🟡 **Séparer la partie pure de `@repo/pages` de sa partie connectée**, sur le modèle déjà
  appliqué dans `@repo/auth` (`permission.ts` / `permission-cache.ts`). `definition-service.ts`
  importe `db` au niveau module et `@repo/db` **lève à l'import** sans `DATABASE_URL` : la logique
  pure — `assertRegistryCoherent`, `unknownRefTargets` — est soudée à la connexion par le graphe
  d'imports alors qu'elle n'interroge rien. Ses tests doivent poser une URL factice, contournement
  consigné dans le fichier de test. La convention existe déjà dans le dépôt ; ce module ne l'applique
  pas. Détail : [audit de couverture documentaire](../audits/audit-couverture-documentaire.md).
- [ ] 🟠 **Encaisser le découpage en packages** — le constat, mesuré le 2026-08-12 : les frontières
  existent dans l'arborescence mais pas dans les imports. L'API compte **61 imports de
  `@echoppe/core` contre 29 de `@repo/*`**, et **46 usages de symboles qui vivent dans un `@repo/*`**
  y entrent par le barrel du cœur — 14 fois `media`, 7 fois `user`, 4 fois `menu`, 3 fois `site`.
  `packages/echoppe-core/src/db/schema/index.ts` réexporte les tables de sept packages, sous le
  commentaire « réexporté pour ne pas changer la surface ». Rien n'empêche donc de contourner un
  package : il y a juste un chemin plus court, et il gagne.

  Rien de dramatique — aucune indirection gratuite, le code interne est cohérent et testé. Mais
  l'extraction a été **payée sans être encaissée**, et une frontière que personne n'emprunte cesse
  d'être vraie : un package que plus rien n'importe directement finit par accueillir n'importe quoi.

  Deux gestes, dans cet ordre. Le premier seul compte, le second est de l'hygiène :

  1. **Faire tomber le barrel de réexport du cœur.** Que `media` s'importe depuis `@repo/assets` et
     nulle part ailleurs. Mécanique, vérifiable par une règle de lint — c'est ce qui transforme le
     découpage de décor en structure. Sans lui, tout le reste est cosmétique. Attention : le barrel
     de `db/schema/index.ts` doit **survivre pour les migrations** — `drizzle.config.ts` ne lit que
     lui. C'est son usage comme raccourci d'import qui doit tomber, pas son existence.
  2. **Refondre les feuilles sous ~100 lignes** dans leur consommateur unique, ou les regrouper.
     Cinq packages sont concernés : `assets` (**32 lignes**, deux tables et un `export`), `shared`
     (88), `db` (90), `identity` (92), `adapters` (102). Aucun n'achète ce qu'une frontière est
     censée acheter : ils sont `private` (pas de publication), tous en `0.0.1` sans tests propres
     (pas de versionnage), et `assets` n'a aucune dépendance sortante — la frontière n'empêche donc
     rien. À ressortir en dix minutes le jour où un deuxième lecteur apparaît.

  Réserve honnête : le découpage vise un second produit qui n'existe pas encore, donc quatre
  packages (`assets`, `identity`, `menus`, `pages`) n'ont qu'**un seul consommateur**. C'est du
  partitionnement anticipé, pas de la sur-abstraction — ça se défait en fusionnant deux dossiers,
  là où une mauvaise abstraction ne se défait pas. Le pari reste ouvert ; ce qui ne l'est pas, c'est
  de le porter sans l'appliquer.
- [ ] 🟠 **Définir la compatibilité runtime/API/SDK** : matrice, dépréciation et politique pré-1.0.
- [ ] 🟡 Réorganiser les domaines internes uniquement à l'apparition d'un deuxième consommateur.
- [ ] 🟡 Compiler en CI les exemples des packages publics et une configuration de contenu témoin.

## Sécurité

- [ ] 🔴 **Trancher la garde des credentials au moment d'implémenter l'authentification commune** :
  comparer un package local partagé, un fournisseur d'identité externe (OIDC) et un service géré
  par une éventuelle offre Échoppe Cloud. Le choix doit couvrir les administrations de Prisme et
  d'Échoppe, puis traiter séparément le cycle client propre à Échoppe. Ne pas introduire d'adapter
  avant deux usages réels. Séparer les packages d'identité humaine, d'authentification et
  d'autorisation/RBAC ; renommer ou déplacer l'actuel `@repo/identity`, qui porte en réalité
  l'identité du site et de son entité légale. Consigner la décision finale en amendant
  l'[ADR-0051](../adr/ADR-0051-garde-credentials.md) et, si nécessaire,
  l'[ADR-0008](../adr/ADR-0008-auth-sessions.md).

Relevés par l'[audit de couverture documentaire](../audits/audit-couverture-documentaire.md)
(lot 2, 2026-08-16). Aucun n'est exploité aujourd'hui ; tous reposent sur une propriété
circonstancielle plutôt que sur une garde.

- [ ] 🟠 **Échapper les données utilisateur du gabarit `contact-form`**
  (`packages/communication/src/templates.ts:117`). `name`, `email`, `phone`, `subject` et `message`
  sont interpolés bruts dans le HTML de l'e-mail, et proviennent d'un formulaire **public et non
  authentifié**. N'importe qui peut donc faire arriver du HTML arbitraire dans la boîte de
  l'administrateur — liens, pixels de traçage, mise en page usurpée. Les clients mail bloquent les
  scripts, donc pas de XSS : le risque réel est un hameçonnage qui paraît émis par la boutique
  elle-même. Vérifier au passage les autres gabarits, qui interpolent selon le même motif.
- [ ] 🟠 **Fermer les deux oracles d'énumération de `authenticate`**
  (`packages/auth/src/service.ts:162-167`). Deux problèmes distincts :
  - **Explicite** — `account-disabled` est rendu **avant** la vérification du mot de passe : on
    confirme qu'une adresse correspond à un compte désactivé sans aucun identifiant valide.
    Correctif : vérifier le mot de passe d'abord, ne consulter `isActive` qu'ensuite. On n'apprend
    l'état de son compte qu'après avoir prouvé qu'il est le sien.
  - **Temporel** — le chemin « adresse inconnue » retourne sans exécuter `Bun.password.verify`, qui
    est volontairement coûteux. L'écart est de plusieurs ordres de grandeur et porte sur **tous** les
    comptes. Il touche aussi le login client
    (`apps/echoppe-api/src/modules/auth/customer-service.ts:163`), donc une surface publique.
    Correctif : vérifier contre un **hash leurre** calculé une fois au chargement, avec les mêmes
    paramètres de coût. Ça ne rend pas les durées identiques — la requête SQL diffère aussi — mais
    supprime le seul écart mesurable à distance de façon fiable.

  Ce volet temporel était déjà tracé dans le backlog Échoppe (« Timing du login : vérification
  factice lorsqu'un utilisateur est introuvable »). Il est consolidé ici parce que `authenticate`
  vit dans `@repo/auth`, un paquet partagé, et que les deux volets se corrigent d'un seul geste.

  Dépendance, pas doublon : la **limitation de débit** sur les endpoints d'authentification est
  suivie dans le [backlog Échoppe](./echoppe.md) (« Rate-limit fail-open sans Redis »). Sans elle,
  l'énumération reste possible, seulement plus lente — aucun des correctifs ci-dessus ne la remplace.

  Arbitrage séparé, à décider et non à corriger : l'inscription client rend `email-taken`
  (`customer-service.ts:104`), une énumération explicite sur un endpoint public. Le durcissement
  imposerait le schéma « on vous a envoyé un e-mail » à tous les inscrits légitimes. Sur une
  boutique, le coût ergonomique paraît supérieur au gain.

## Documentation et gouvernance

- [ ] 🟠 **Ajouter à l'index ADR les états d'implémentation, de vérification et d'horizon**, sans
  réécrire le statut historique de décision.
- [ ] 🟡 **Resserrer le maillage documentaire** : liens depuis le code, références actives vérifiées
  et liens vers les ADR successeurs.
- [ ] 🟡 Corriger les chemins, versions et exemples devenus obsolètes dans les README actifs.
- [ ] 🟡 Distinguer explicitement documentation historique, référence active et vision.
- [ ] 🟡 **Passe de nettoyage des commentaires narratifs**, selon le critère d'[ADR-0053](../adr/ADR-0053-commentaire-passe-agissant.md) :
  *si je supprime cette phrase, quelqu'un peut-il refaire l'erreur ?* Un balayage donne une
  trentaine d'occurrences dont la majorité sont des **faux positifs** — « avant le `listen` »,
  « avant l'`ALTER` » sont des antériorités logiques, pas des souvenirs. Restent une dizaine de vrais
  candidats : `content/sync.ts`, `menus/schema.ts`, `pages/definition-model.ts`,
  `admin/useCatalogRef.ts`, `api/lib/fault.ts`, `api/lib/response.ts`, `catalog/product/option.ts`.
  Deux cas à ne PAS traiter au grep : `tests/permission-delegation.test.ts` est un garde-fou déguisé
  (son commentaire dit ce que le test empêche de revenir), et `tests/products-guards.test.ts` se dit
  « filet AVANT le découpage de products.ts » — à vérifier plutôt qu'à supprimer, le découpage ayant
  peut-être eu lieu. Aucun risque fonctionnel ; se livre en diff, pas en rapport.

## Intendance transverse

- [ ] 🟡 Vérifier les trusted publishers npm/OIDC des trois artefacts publics.
- [ ] 🟡 Purger l'ancien registre Docker Hub après migration des consommateurs encore concernés.
- [ ] 🟡 Garder npm 11 tant que Changesets est incompatible avec npm 12.
- [ ] 🟢 **Garde de découverte des variables d'environnement.** ADR-0055 fait de
  `docs/guide/configuration.md` la référence des variables, et le `.env.example` du contributeur ne
  porte plus que le nécessaire — la référence peut donc diverger du code sans que rien ne le
  signale. Une garde scannerait les `process.env.*` d'`apps` et `packages` et échouerait sur toute
  variable que ni le fichier ni la doc ne mentionnent, comme `drift-guard` / `product-isolation` /
  `reserved-space` découvrent au lieu de connaître. **Volontairement différé** : le code lit 24
  variables et la surface bouge encore (identité/OIDC, stockage média, Redis) ; une garde écrite
  maintenant figerait une nomenclature qu'on est en train de remuer. À reprendre quand la file de
  décisions de configuration sera vidée.
