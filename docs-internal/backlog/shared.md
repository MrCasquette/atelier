# Backlog — socle partagé

Travail sur les packages, contrats et décisions qui concernent Échoppe et Prisme. Une abstraction
nouvelle doit avoir deux usages réels ; à défaut, elle reste dans le produit qui la porte.

## L'ordre du moment

Le discriminant : **ce qui change une FORME passe avant Prisme, ce qui change un COMPORTEMENT peut
passer après.** Refactorer une forme avec deux consommateurs coûte double — deux produits à migrer,
deux suites à réécrire, une décision qui doit satisfaire les deux. Corriger un comportement coûte
pareil quel que soit le moment.

D'où quatre chantiers en tête de file, marqués **⏩ avant Prisme** ci-dessous. Deux sont **faits** :
le barrel de réexport du cœur — 54 symboles retournés à leur paquet, `bun run core-passthrough`
refuse leur retour — et le singleton de `@repo/communication`, devenu un acteur composé au
démarrage.

Le troisième est **fait** : [ADR-0059](../adr/ADR-0059-nom-nu-et-prefixe-de-scission.md) a scindé
`@repo/pages` en `@repo/pages-registry` — vocabulaire et logique, **sans `@repo/db` dans son
manifeste**, donc l'import ne résout même pas — et `@repo/pages`, qui garde les tables, le cache,
`syncRegistry`, `page-service` et `reference`. `compileSections` et `definitionToSchema`, que rien ne
couvrait, sont désormais testées sans base ni `DATABASE_URL` factice.

Le quatrième, la **prose**, est **fait** : le moteur est publié sous `@axiome-apps/atelier-prose`,
l'administration le consomme — un `richText` s'édite avec sa source, son aperçu et ses constats — et
`defineDirective` a rejoint `defineSection`. Détail en § Contenu config-as-code.

Puis le [vertical slice Prisme](./prisme.md), qui débloque à lui seul les décisions suspendues à un
second consommateur — dont la garde des credentials
([ADR-0051](../adr/ADR-0051-garde-credentials.md)), qui conditionne explicitement son choix à deux
usages réels.

Le durcissement de la § Sécurité n'attend rien et peut avancer en parallèle : il ne change aucune
forme.

Cette section est périssable — elle disparaît quand le vertical slice tourne.

## Workspace et outillage (`atelier`)

Le conteneur, distinct des produits qu'il héberge. Le principe qui gouverne cet outillage —
**il découvre, il n'énumère pas** — est acquis et consigné dans les
[conventions](../conventions.md#loutillage-découvre-il-nénumère-pas).

- [ ] 🟠 **`dev`, `db:*`, `test:api` et `test:image` restent câblés sur Échoppe** (`--cwd apps/echoppe-*`,
  `packages/echoppe-core`). Ce sont les derniers scripts racine qui nomment un produit.
- [ ] 🟠 **Distribution mono-produit** : `Dockerfile` (19 `COPY packages/*/package.json` énumérés,
  targets `api`/`admin`, user système `echoppe`), `docker-build.yml` (`IMAGE_PREFIX`), `release.yml`
  (version runtime = `apps/echoppe-api/package.json`), `ship.ts` (4 canaux Échoppe) et
  `compose.yaml`. **Volontairement différé** : Prisme n'a aucun cycle de publication, et
  paramétrer avant d'avoir un second artefact serait de l'abstraction par anticipation.

  Deux pièges à connaître avant d'y toucher, tous deux vérifiés sur la donnée réelle : ne jamais
  renommer un volume Compose, la donnée de production y est attachée ; et **le nom de projet Compose
  dérive du nom du dossier de travail**, si bien qu'un simple renommage de répertoire détache la pile
  de ses volumes — les conteneurs survivants masquent la bascule jusqu'à ce qu'on les recrée sur une
  base vide.
- [ ] 🟡 **`docs/` est le site d'Échoppe** (`@echoppe/docs`, 22 fichiers), pas la doc du workspace.
  À trancher avec `prisme-admin`.
- [ ] 🟡 **La garde d'isolation s'endort sous deux produits.** Elle sort en succès silencieux tant
  qu'un seul scope possède une application — donc dès que le squelette `prisme-*` disparaîtra, et
  jusqu'au vrai `prisme-api`.
- [ ] 🟡 **Dette Biome** : `$schema` toujours figé en 2.3.9 (`biome.json:2`) alors que la dépendance
  est en `^2.5.2` — `biome migrate` reste à passer. Le volet `linter.rules.recommended` est en
  revanche **caduc** : le bloc est désormais réduit à `"linter": { "enabled": false }`, il n'y a plus
  de règle à migrer. Ce qui subsiste de ce choix, c'est que l'organisation automatique des imports
  venait de `biome check` et disparaît avec le linter — `biome format` ne la fait pas.
- [ ] 🟡 **18 warnings ESLint** : 17 `no-non-null-assertion` (statut inchangé, la règle était déjà
  en `warn` sous Biome) et 1 `vue/no-v-html` dans la doc — celui-ci est un signal de sécurité.

## Distribution npm

Tranché par [ADR-0062](../adr/ADR-0062-scope-et-critere-de-publication.md), complété par
[ADR-0063](../adr/ADR-0063-appartenance-des-paquets.md) — le scope dit qui publie, le nom dit à quoi
le paquet appartient. Les renommages sont appliqués et servis par npm ; `atelier-prose` part avec
la release en cours.

- [ ] 🟠 **Déprécier les anciens noms sur npm** — `@echoppe/client`, `@mrcasquette/content` et
  `@echoppe/content@0.1.0`. La décision attendait la publication des nouveaux noms
  ([ADR-0063](../adr/ADR-0063-appartenance-des-paquets.md)) : elle est levée. Un `npm deprecate` qui
  nomme le remplaçant, rien de plus — on ne dépublie pas, l'ancien tarball reste résolvable pour qui
  l'a épinglé.
- [ ] 🟡 **`scripts/ship.ts` porte une table `canal → nom` en dur** — l'énumération que les gardes du
  dépôt s'interdisent par ailleurs. Elle a déjà coûté une ligne à la publication de la prose. Les
  unités se découvrent (`scripts/lib/release-units.ts` le fait déjà pour deux gardes) ; reste à leur
  donner un nom court, qui est la seule chose que la table apporte.
- [ ] 🟠 **Les quatre paquets publiés n'ont ni `repository`, ni `homepage`, ni `bugs`** — leur page npm
  ne renvoie nulle part. À corriger, mais `repository` pointerait aujourd'hui vers un dépôt **privé**,
  donc vers un 404 : lié à la question du transfert vers `Axiome-Apps` et de la visibilité du dépôt,
  qui conditionne aussi le redéploiement de la doc sur Pages.
- [ ] 🟡 **Garder les règles d'ADR-0062** : qu'un paquet publié porte ses métadonnées, et qu'un
  `@repo/*` ne devienne pas publiable par distraction. Aucune ne l'est aujourd'hui.

## Contenu config-as-code

La prose est **branchée** ([ADR-0061](../adr/ADR-0061-prose-directives-declarees.md),
[ADR-0064](../adr/ADR-0064-frontiere-de-validation-de-la-prose.md)) : moteur publié, administration
qui l'édite, verbe d'authoring livré. Ce qui suit n'est pas un reste du chantier : ce sont les deux
gardes qu'aucun des deux ADR n'a posées, et des sujets voisins.

Note conservée parce qu'elle a déjà égaré ce backlog une fois : **aucun `richText` n'est en HTML**,
le champ est tenu pour du Markdown partout où il passe. Le seul HTML du dépôt est
`product.description`, une colonne du catalogue hors du modèle de champs que **rien ne rend** —
c'est la ligne qui suit, et c'est un autre sujet.

- [ ] 🟠 **Trancher le sort de `product.description`** : convertir son HTML ou repartir de zéro. À
  décider sur la donnée réelle, pas sur le seed. TipTap n'a qu'un appelant — `ProductInfoCard.vue:30`
  — et le coût de sortie ne sera jamais plus bas.
- [ ] 🟡 **Garder l'arbre hors de la base.** Rien n'empêcherait de cacher l'arbre parsé à côté du
  texte « pour la performance » : ce serait revenir à un format propriétaire avec deux sources de
  vérité, et **aucun test ne tomberait**. Seule dérive qui détruirait la thèse d'ADR-0061.
- [ ] 🟡 **Vérifier qu'un paquet partagé n'émet jamais de `class` depuis la prose** — les directives
  se stylent par leur `data-*` (ADR-0061 §5). La redéfinition du noyau, elle, **est gardée** :
  `defineDirective` la refuse, et un test le parcourt directive par directive.
- [ ] 🟡 **Type-gen du DSL** pour les sections et composants de front — l'inférence est livrée, la
  génération explicite reste à trancher.
- [ ] 🟡 Menus imbriqués, champs custom, fichiers/assets et i18n des enums.
- [ ] 🟡 Durcir les clés API et documenter la portabilité liée à PostgreSQL/`jsonb`.

## Architecture et contrats

- [ ] 🟠 **Trancher l'injection DB** dans un ADR : singleton, factory de service, contexte de requête
  et unité transactionnelle. **Pendant** Prisme, pas avant : c'est la décision de forme qui a besoin
  du second consommateur pour être bien prise, et le vertical slice est son terrain d'épreuve.
- [ ] 🟡 **Refondre les feuilles sous ~100 lignes** dans leur consommateur unique, ou les regrouper.
  Second volet d'« encaisser le découpage » — le premier, faire tomber le barrel de réexport du
  cœur, est fait ; celui-ci est de l'hygiène et ne bloque rien.

  Cinq packages sont concernés : `assets` (**32 lignes**, deux tables et un `export`), `shared`
  (88), `db` (90), `identity` (92), `adapters` (102). Aucun n'achète ce qu'une frontière est censée
  acheter : ils sont `private` (pas de publication), tous en `0.0.1` sans tests propres (pas de
  versionnage), et `assets` n'a aucune dépendance sortante — la frontière n'empêche donc rien. À
  ressortir en dix minutes le jour où un deuxième lecteur apparaît.

  Réserve honnête : le découpage vise un second produit qui n'existe pas encore, donc quatre
  packages (`assets`, `identity`, `menus`, `pages`) n'ont qu'**un seul consommateur**. C'est du
  partitionnement anticipé, pas de la sur-abstraction — ça se défait en fusionnant deux dossiers,
  là où une mauvaise abstraction ne se défait pas.
- [ ] 🟠 **Définir la compatibilité runtime/API/SDK** : matrice, dépréciation et politique pré-1.0.
- [ ] 🟡 Réorganiser les domaines internes uniquement à l'apparition d'un deuxième consommateur.
- [ ] ⚪ **Fusionner les petits paquets `@repo/*`**, une fois Prisme réel : lui seul dira lesquels ont
  vraiment deux consommateurs. Dépend du vertical slice, qui est un chantier V1 — donc la condition
  se lève pendant la V1, pas après.
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

- [ ] 🟠 **Écrire la garde de dérive documentaire**, et elle seule. Son périmètre est **clos** par
  [ADR-0060 § 4](../adr/ADR-0060-natures-de-la-documentation.md) : une affirmation n'est gardée que
  si elle est **dérivable** (sa négation se détecte sans jugement) **et volatile**. Cinq vérifications,
  pas une de plus — tout lien pointe vers un fichier existant ; tout chemin cité dans `architecture/`
  existe ; la liste des paquets d'`overview.md` correspond aux paquets découverts ; toute commande
  citée existe dans les `scripts` ; une dépendance annoncée absente l'est vraiment.

  Le brouillon de la première vérification a servi pendant la redistribution (une quinzaine de lignes,
  jetées depuis). Comme toute garde du dépôt, elle **découvre** : aucune liste de fichiers en dur.

  ⚠️ **Le piège à ne pas commettre** : élargir la garde à ce qui n'est pas dérivable — le pourquoi
  d'une frontière, ce qu'un paquet a le droit de faire, le sens d'un mot. Une garde qui prétend
  vérifier cela produit du faux positif jusqu'à ce qu'on la coupe. Quand une page affirme quelque
  chose de volatil et non dérivable, la réponse est de **retirer la phrase**, pas de coder un test.

- [ ] 🟠 **Dégonfler les ADR obèses par déménagement, jamais par réécriture.** Quatre portent de la
  référence écrite là faute d'un autre endroit : ADR-0050 (**1 099 lignes** — contrat de faute
  complet, tables par statut HTTP), ADR-0047 (264), ADR-0042 (246), ADR-0038 (223). Ce qui est de la
  référence part vers `architecture/` ; l'ADR garde sa décision et un renvoi. Le journal n'est pas
  réécrit : rien n'est reformulé, seulement déplacé.

- [ ] 🟡 **Auditer `docs/` (public) contre la nouvelle structure** — 26 fichiers, ~3 500 lignes,
  jamais passés en revue depuis la redistribution. Vérifier surtout qu'aucune page publique ne
  reprend un chemin interne déplacé, et que `docs/dev/` ne redit pas ce que `architecture/` porte
  désormais.

- [ ] 🟠 **La roadmap publique est un chantier à part entière.** Elle ne se maintient pas à la main
  à côté de l'interne : le cap est que **la roadmap interne dérive vers la publique**, l'interne
  disant le travail à venir et la publique le cap au marché. Rien n'est instruit — ni le mécanisme,
  ni ce qui se publie et ce qui reste interne, ni ce qu'ADR-0060 fait d'une nature « roadmap »
  qu'elle ne compte pas parmi ses cinq. L'ADR viendra quand on l'instruira, pas avant.

  Symptôme qui a ouvert le sujet : `docs/roadmap.md` annonce « formulaires d'édition dans l'admin et
  menus à venir » alors que les deux sont livrés, et liste « Clés d'API machine » sous *Maintenant*
  alors que l'écran l'est aussi. Une roadmap publique tenue séparément dérive sans que personne ne
  le voie.
- [ ] 🟠 **Ajouter à l'index ADR les états d'implémentation, de vérification et d'horizon**, sans
  réécrire le statut historique de décision.
- [ ] 🟡 **Resserrer le maillage documentaire** : liens depuis le code et liens vers les ADR
  successeurs. Les liens morts, eux, sont à zéro depuis la redistribution
  ([ADR-0060](../adr/ADR-0060-natures-de-la-documentation.md)) — reste à les empêcher de revenir,
  cf. la garde ci-dessous.
- [ ] 🟡 Corriger les chemins, versions et exemples devenus obsolètes dans les README actifs.
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
- [ ] 🟢 **Migrations concurrentes sous plusieurs répliques.** ADR-0004 fait migrer l'API au boot ;
  deux répliques qui démarrent ensemble rejouent les migrations en parallèle, sans `pg_advisory_lock`
  pour les sérialiser. Latent et non urgent — personne ne déploie en multi-répliques — mais à
  trancher avant que ce soit le cas, par amendement d'ADR-0004.
- [ ] 🟢 **Garde de découverte des variables d'environnement.** ADR-0055 fait de
  `docs/guide/configuration.md` la référence des variables, et le `.env.example` du contributeur ne
  porte plus que le nécessaire — la référence peut donc diverger du code sans que rien ne le
  signale. Une garde scannerait les `process.env.*` d'`apps` et `packages` et échouerait sur toute
  variable que ni le fichier ni la doc ne mentionnent, comme `drift-guard` / `product-isolation` /
  `reserved-space` découvrent au lieu de connaître. **Volontairement différé** : le code lit 24
  variables et la surface bouge encore (identité/OIDC, stockage média, Redis) ; une garde écrite
  maintenant figerait une nomenclature qu'on est en train de remuer. À reprendre quand la file de
  décisions de configuration sera vidée.
- [ ] 🟡 **Brancher `registry-gap` en fin de workflow `Release`.** La commande existe et se lance à
  la main (`bun run registry-gap`) ; elle vérifie que toute version committée est bien servie par
  son registre — npm pour les paquets, GHCR pour les images. Reste à en faire un job final de
  `release.yml`, en `needs: [release, images]` et `if: always()`, avec `packages: read` et
  `GH_TOKEN`.

  **Le placement est déjà tranché, et il est le seul qui tienne.** Ni sur une PR — une publication
  ratée y rendrait rouges des PR sans rapport, écrites par quelqu'un qui n'y peut rien —, ni au
  DÉBUT d'une release, où la version committée est légitimement absente des registres puisqu'on
  s'apprête à la publier : la garde n'aurait aucun repère. À la fin, un seul emplacement couvre les
  deux cas sans les distinguer : si ce cycle a publié, on vérifie que ça a atterri ; s'il n'a rien
  publié, on vérifie que la version du cycle précédent est toujours là. Et comme `Release` tourne à
  chaque push sur `main`, la vérification se rejoue en continu — c'est ce qui rend un job planifié
  inutile.

  **Le motif du report est tombé le 2026-08-24.** Il disait : « tout est publié et cohérent
  aujourd'hui, donc la CI ne montrerait que le chemin vert ». Le cycle `0.8.0` a produit un chemin
  rouge réel — le job `images` sauté sur un tag orphelin, et aucune image construite depuis `main`.
  Plus rien ne justifie d'attendre.
- [ ] 🟠 **`registry-gap` vérifie la présence, pas la provenance** — et la nuance a coûté cher le
  2026-08-24. Il a rendu vert sur `ghcr.io/mrcasquette/echoppe-api:0.8.0` alors que cette image
  avait été construite six jours plus tôt depuis un commit qu'aucune branche ne contient : le bon
  numéro, servi par le bon registre, avec le mauvais code. C'est conforme à sa charte, et c'est
  précisément la limite à écrire.

  Le remède tient en une comparaison : le label `org.opencontainers.image.revision` de l'image
  contre le commit que le tag `v*` désigne. **Mais ce label n'existe pas** — vérifié le 2026-08-24,
  ni le `Dockerfile` ni `docker-build.yml` ne déclarent le moindre `LABEL` ou annotation OCI, et
  `docker/build-push-action` est appelé sans `docker/metadata-action`. Le premier geste est donc
  d'inscrire la provenance, pas de la vérifier. À regarder au passage : buildx attache des
  attestations de provenance par défaut selon la version, ce qui offrirait peut-être la réponse
  sans rien ajouter. Une lecture directe du manifeste GHCR par `curl` ne rend pas les labels ;
  passer par `docker buildx imagetools inspect` ou `skopeo`.

  Même question pour npm, où elle est plus difficile : rien dans le tarball ne dit de quel commit il
  vient, sauf à réactiver l'attestation de provenance — qui exige un dépôt public, donc la même
  question de visibilité que partout ailleurs.
- [ ] 🟡 **Le tag `v0.6.0` est orphelin** (commit `33a73ad`, 2026-07-30, « Version Packages »),
  comme l'était `v0.8.0` : même cause, avant le correctif du 2026-08-24. Son image mérite le même
  examen que celle de `0.8.0` — a-t-elle été construite depuis un commit de branche ? Si oui, le
  numéro est brûlé lui aussi, et ça vaut d'être écrit quelque part plutôt que redécouvert.
