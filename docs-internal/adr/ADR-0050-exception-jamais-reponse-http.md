# ADR-0050 — Une exception ne compose jamais une réponse HTTP

Statut : accepté · 2026-08-15
Portée : socle

Précise [ADR-0044](./ADR-0044-surface-http-paquets-partages.md) — qui interdit à un paquet partagé
d'exposer des routes — en lui ajoutant son pendant : un paquet partagé n'écrit pas non plus le
**contenu** d'une réponse.

## Contexte

Le dépôt distingue déjà deux natures d'erreur, et le fait bien par endroits. `@repo/auth` rend des
unions discriminées — `{ outcome: 'invalid-credentials' }`, `{ outcome: 'account-disabled' }` — sans
une seule chaîne de caractères. C'est ce que prescrit la SSOT personnelle (`typescript.md` §6 :
erreur métier attendue = valeur de retour typée, exceptionnelle = catch à la frontière).

Ailleurs, la frontière est franchie sans qu'on l'ait décidé. Le chemin est traçable de bout en bout :

1. `assertRegistryCoherent` lève `` `Champs en double : ${duplicates.join(', ')}.` `` — une faute
   **métier**, parfaitement actionnable par qui pousse un registre ;
2. `syncRegistry` la rattrape et promeut son texte : `message: error instanceof Error ?
   error.message : …` ;
3. la route rend `status(422, { message })` ;
4. l'administration fait `toast.error(result.message ?? …)`.

Un message d'exception est devenu du texte d'interface. L'exception a servi de **moyen de
transport** à une faute métier — et c'est ce transport, pas la faute, qui pose problème :
`duplicateFieldNames` rendait déjà une valeur, `assertRegistryCoherent` la re-promeut en exception
pour la faire redescendre trois couches plus bas.

### Ce que les mesures disent

- **77 `throw new Error`** dans le dépôt, dont **21 en français**.
- **Aucun i18n dans l'administration** : pas de dépendance, pas de fichier de locale.
- **8 vues au moins** affichent le message brut de l'API dans un toast.
- **Aucun `onError`** dans `apps/echoppe-api` : une exception non rattrapée est traitée par le
  comportement par défaut d'Elysia, sans point de conversion explicite.

### Pourquoi ce n'est pas une question de langue

`validateSectionData` rend les erreurs TypeBox brutes (`${error.path} ${error.message}`), qui
finissent dans le même toast. Ces chaînes sont produites **par la bibliothèque, en anglais**, et
sont déjà servies telles quelles à une interface francophone.

Le dépôt sert donc aujourd'hui les deux langues à l'utilisateur, sur le même écran, sans que
personne l'ait choisi. Le défaut n'est pas la langue retenue : c'est qu'une couche technique écrive
l'interface. La question de la langue des commentaires et des messages reste ouverte et sera
tranchée séparément — cet ADR la rend indépendante.

## Options envisagées

- **Tout structurer**, y compris l'infrastructure. Un code d'erreur pour `ENCRYPTION_KEY` absent n'a
  aucun destinataire capable d'agir côté client : on paierait une cérémonie sans preneur.
- **Distinguer « métier » et « technique » par nature.** Juste dans l'intention, mais l'arbitrage se
  rejoue à chaque cas : un invariant interne violé est-il technique parce qu'il est interne, ou
  métier parce que l'utilisateur l'a déclenché ? La discussion n'a pas de fin.
- **Trancher sur la frontière franchie** — ce qui traverse HTTP, et rien d'autre.

## Décision

**INVARIANT — le `message` d'une exception n'entre jamais dans un corps de réponse HTTP.**

Le critère n'est pas la nature de la faute mais son destinataire : **peut-il agir, et reçoit-il une
réponse HTTP ?**

> ⚠️ **Ce critère est remplacé** par l'[amendement du 2026-08-16](#amendement-2026-08-16--la-surface-destinataire-et-le-contrat-de-faute) :
> il suppose une seule réponse par faute, ce qu'un cas suffit à démentir. L'invariant, lui, tient.
> La section ci-dessous est conservée comme état initial de la décision.

### 1. Faute actionnable qui traverse HTTP → valeur typée et structurée

Rendue, jamais levée. Un **code** et ses opérandes, pas une phrase :

```ts
{ code: 'duplicate_field', owner: 'article', field: 'titre' }
```

Le paquet de domaine ne compose aucune phrase destinée à être lue. Le rendu — et donc la langue —
appartient au client, qui seul connaît son public.

Bénéfice second, aligné sur la hiérarchie `types > contrats > tests > documentation > commentaires` :
une faute structurée se teste sur son code. Le test de `@repo/references` gèle aujourd'hui une
formulation française (`'Cible référençable déjà inscrite : page'`) — un verrou sur de la prose.

### 2. Faute inactionnable → exception, texte libre, jamais renvoyée

Destinée à un log et à une trace. Elle est rattrapée à la frontière et convertie en réponse
générique. C'est déjà ce que fait `apps/echoppe-api/src/modules/payment/index.ts:362`, qui journalise
le détail et rend `status(400, { message: 'Webhook verification failed' })` — le modèle à suivre.

Ces messages n'ont pas de public francophone : ils sont en **anglais**, comme le reste de ce qui
s'adresse à un opérateur.

### 3. Corollaire — un paquet de domaine n'écrit pas d'interface

Ni phrase, ni ponctuation d'affichage, ni jointure de fautes en une chaîne. `duplicateFieldNames`
rend des noms, pas `« article.titre »`.

### 4. Exemption — la CLI

`@mrcasquette/content` s'adresse à un développeur dans un terminal. `cli.ts` peut afficher un
message d'exception : sa surface n'est pas une réponse HTTP. L'invariant ne la concerne pas.

### 5. La langue devient un problème réduit

Le domaine n'a plus de langue du tout. Restent à trancher, séparément et sans urgence : la langue des
commentaires, et celle des exceptions dev qui ne traversent jamais HTTP.

## Conséquences

### Chemins qui violent l'invariant

| Chemin | Ce qui se produit |
|---|---|
| `packages/pages/src/definition-service.ts:164` | `syncRegistry` rattrape `assertRegistryCoherent` et promeut `error.message` en `{ outcome: 'incoherent' }` → 422 → toast. Le cas canonique. |
| `packages/entities/src/service.ts:396` | `plan.blockers.push(error.message)`, puis `status(422, { message: blockers.join(' · ') })`. Même schéma, chemin entités. |
| `apps/echoppe-api/src/modules/checkout/index.ts:145` | Message d'exception d'un adapter de paiement rendu en `status(400, { message })` **à l'acheteur**. Peut exposer l'état interne (`Stripe is not configured.`) à un client final. Le plus grave du lot. |

### Chemins conformes en transport, à revoir en contenu

| Chemin | Ce qui se produit |
|---|---|
| `packages/echoppe-core/src/adapters/{payment,shipping}/*`, `packages/communication/*` | `{ success: false, error: err.message }` — valeur typée, donc transport correct, mais contenu brut d'exception. `apps/echoppe-api/src/modules/communication/service.ts:99` le journalise **et** le renvoie dans `result` : à tracer jusqu'à la réponse. |
| `packages/pages/src/definition-service.ts:200`, `packages/entities/src/write-service.ts:55` | Erreurs TypeBox mappées en `errors: string[]`. Transport correct ; prose anglaise de bibliothèque servie à une interface française. |

### Ce qui ne bouge pas

- `@repo/auth` — unions discriminées, aucune prose. La référence.
- `apps/echoppe-api/src/modules/payment/index.ts:362` — détail au log, réponse générique.
- `@repo/shared` (`ENCRYPTION_KEY`), `@repo/adapters` (`Unknown provider`), `@repo/db`
  (`DATABASE_URL`) — exceptions inactionnables, en anglais, jamais renvoyées.

### Hors périmètre de cet ADR

Les exceptions françaises qui **ne traversent jamais HTTP** — `@repo/references` et `@repo/auth`
(`principal.ts`) à l'inscription au démarrage, `@mrcasquette/content` (`define.ts`) au moment où le
développeur écrit sa déclaration. Elles ne violent pas l'invariant ; elles relèvent de la décision
de langue, encore ouverte.

### Suivi

- L'invariant appelle un **`onError` explicite** dans `apps/echoppe-api` : il n'en existe aucun
  aujourd'hui, donc aucun point de conversion garanti pour une exception non rattrapée.
- La forme exacte de la faute structurée — union discriminée par paquet, ou type commun — se décide
  à l'implémentation, sur le premier chemin converti.
- **Le refactor n'est pas lancé.** Cet ADR fixe la règle et l'inventaire ; le chantier est à
  planifier.

## Amendement 2026-08-16 — la surface destinataire, et le contrat de faute

L'invariant ne change pas. Le **critère** qui l'accompagnait, si — il était faux — et le contrat que
l'ADR laissait ouvert est ici fixé.

### Ce que cet amendement corrige

La décision initiale tranchait sur « peut-il agir, et reçoit-il une réponse HTTP ? ». Ce critère
suppose que « peut-il agir ? » a **une** réponse par faute. Un cas suffit à le briser :
`payment_provider_not_configured` est inactionnable pour l'acheteur et parfaitement actionnable pour
l'administrateur. La faute est la même, le destinataire change, le binaire n'a plus de valeur de
vérité.

Le défaut de fond : un seul critère portait deux questions indépendantes — **qui écrit le texte**
(jamais le domaine, et ça reste vrai) et **quelle faute est montrée à qui** (une décision par
surface). La frontière HTTP est un fait, pas un destinataire : plusieurs surfaces la franchissent
avec des droits différents.

### 1. Le critère devient la surface destinataire

Trois étages, et la protection vit au deuxième — pas au premier :

1. **Le domaine émet** une faute structurée complète, **une seule fois**, sans savoir qui lira.
2. **La route projette** selon l'audience avant de sérialiser : elle retire des champs. C'est une
   opération mécanique, côté serveur, et c'est le seul endroit où la divulgation se décide.
3. **La surface rend** le texte à partir de ce qu'elle a reçu.

La présentation est côté client, mais **la redaction est côté serveur**. Compter sur la surface pour
« choisir d'afficher un message générique » ne protège rien : un storefront headless tourne dans un
navigateur, et ce qu'il a reçu est lisible.

### 2. Une seule émission, un seul vocabulaire

Pas de code public distinct d'un code interne. Une table de correspondance entre deux vocabulaires
serait un second artefact à tenir synchronisé, pour un gain nul.

**Le code n'est pas un vecteur de divulgation** : c'est une clé, au même titre qu'une clé i18n, et
une clé n'est pas un secret. L'utilisateur ne voit jamais `payment.provider_not_configured` ; il voit
ce que sa surface en a fait. Le vecteur, c'est la **donnée** — `provider: 'stripe'` — pas le nom de
la faute.

### 3. La redaction porte sur les champs, et se justifie par classe

Retirer par défaut est un réflexe, pas un raisonnement. Chaque champ se juge :

| Classe | Décision |
|---|---|
| Déjà public par construction (nom de prestataire, devise, route publique) | **Laisser.** `stripe` est visible dans les scripts chargés, les redirections et la CSP : le retirer coûte de la précision à l'admin pour protéger une information publiée ailleurs. |
| Topologie interne (noms de tables, chemins, identifiants internes, versions) | Retirer. Aucune valeur pour le lecteur, valeur cumulative pour qui cartographie. |
| **État énumérable** | La seule classe réellement dangereuse : le champ transforme l'endpoint en **oracle**. |
| Secrets, données personnelles | Retirer. |

Quand un champ a été retiré, l'enveloppe peut porter un **identifiant de corrélation** opaque : il ne
signifie rien par construction, ne divulgue donc rien, et permet au support de rebrancher un
utilisateur sur la cause réelle via les logs. C'est là que l'opacité travaille — sur la corrélation,
jamais sur les codes.

### 4. Fusionner deux fautes à l'émission : seulement contre un oracle

Rare, et à justifier explicitement. `authenticate` en est l'exemple canonique : rendre
`invalid-credentials` pour « adresse inconnue » **et** pour « mauvais mot de passe » n'est pas un
choix de présentation remonté trop haut, c'est le domaine qui affirme que ces deux situations sont
la même faute, comme propriété de sécurité. Aucun catalogue de lecture ne pourrait rattraper la
distinction si elle était émise.

Partout ailleurs : **émettre précisément**, et laisser les surfaces rendre.

### 5. Le contrat de faute

#### Ce que la mesure a établi

Sur les **214 réponses d'erreur** de `echoppe-api` : **100 % ont la forme `{ message: string }`**,
pour **80 messages distincts**, dont **10 seulement** portent une donnée interpolée.

Un premier classement par message donnait une ligne dense (`not_found`, 94 occurrences sur 17
ressources) et ~24 fautes « spécifiques ». Ce classement décrivait l'historique du code, pas le
domaine. **Reclassées par la garde qui les produit**, ces ~24 fautes se réduisent à **7 concepts**,
dont 4 transverses :

- `Pays de livraison invalide` est un `if (!snapshot)` — un `not_found` déguisé par sa formulation ;
- `Mode de paiement X non disponible` et `Provider X non configuré` sont **la même garde**
  (`!adapter.isConfigured()`) écrite deux fois ;
- `Cette commande a déjà été payée`, `Seuls les paiements complétés…`, `Cet utilisateur est déjà le
  propriétaire` et `Variante non disponible` sont un même concept — **`invalid_state`** — invisible
  jusque-là parce que chaque module le formulait dans ses propres termes métier.

#### La forme retenue : union discriminée plate

```ts
type Fault =
  | { code: 'not_found'; resource: Resource }
  | { code: 'invalid_state'; resource: Resource; current: string; expected: string }
  | { code: 'configuration_missing'; target: string }
  | { code: 'required_data_missing'; field: string }
  | { code: 'insufficient_stock'; available: number; requested: number }
  | { code: 'invalid_token' }
  | { code: 'external_operation_failed'; operation: string };

/** Métadonnées de transport : à côté de la faute, jamais dedans. */
type ErrorResponse = { fault: Fault; incident?: string };
```

`code` est le discriminant.

#### Où le vocabulaire se ferme — et pourquoi pas dans le socle

`Resource` est une **union fermée**, mais **pas ici**. Dans le socle, `Fault.resource` est une
`string`.

La raison est celle d'[ADR-0032](./ADR-0032-cibles-referencables.md), et l'ignorer referait la même
faute : `product`, `order`, `variant` sont du vocabulaire de commerce, et `Fault` doit vivre **sous**
`@repo/pages`, `@repo/entities`, `@repo/menus` et `@repo/communication`, qui émettent tous des
fautes. Écrire le commerce dans le socle, c'est le faire entrer dans ce que Prisme doit consommer —
exactement ce qu'ADR-0032 a dû retirer de sept endroits.

**La fermeture se fait par COMPOSITION, jamais par héritage entre produits :**

1. **Chaque paquet partagé déclare les ressources qu'il possède** — `AssetsResource`,
   `AuthResource`, `PagesResource`… Même règle que `pageReferenceTarget()`, qui vit dans
   `@repo/pages` « parce que la TABLE vit ici ».
2. **Chaque produit compose** : `EchoppeResource = SharedResource | CommerceResource`. Prisme
   composera le même `SharedResource` avec le sien.
3. **Les constructeurs du produit ferment le vocabulaire** au point d'usage
   (`echoppe-core/src/constants/fault.ts`). Une faute de frappe y échoue à la compilation — c'est ce
   que la fermeture achète, sans que le socle connaisse le commerce.

**Aucune flèche entre produits.** Échoppe est conceptuellement Prisme plus le commerce, mais
`echoppe-core` n'importe rien de `prisme-core` : les deux prennent le même socle. La flèche
d'[ADR-0025](./ADR-0025-deux-produits-un-repo.md) reste intacte, et Échoppe reste correct sans que
Prisme existe.

#### Ce vocabulaire est distinct de celui du RBAC

`EchoppeResource` n'est **pas** `ProtectedResource`
([ADR-0038](./ADR-0038-ressources-ouvertes-delegation.md)), et ce n'est pas un oubli. Le RBAC est
volontairement **grossier** — sa granularité est celle de la permission : `content` protège les pages
**et** les menus (9 gardes), `media` protège les dossiers (8 gardes).

Une faute doit distinguer « Page introuvable » de « Menu introuvable » de « Dossier non trouvé ». Les
fusionner coupleraient la granularité des messages à celle des droits : il faudrait soit grossir tous
les messages, soit faire exploser la matrice de permissions pour satisfaire des besoins de rédaction.

Deux vocabulaires, donc, parce qu'ils répondent à deux questions : « qu'est-ce que je protège » et
« de quoi je parle à l'utilisateur ».

Seule exception : `permission_denied.resource` reste une `string` libre, parce que le RBAC porte
l'espace ouvert `entity:<nom>`, inconnu à la compilation par nature.

#### Pourquoi pas les trois autres formes

- **`{ code, params: {...} }`** — `params` est présent dans 100 % des membres avec un sens invariant :
  une profondeur qui ne distingue rien. Elle avait été justifiée par l'i18n, à tort : un moteur de
  rendu prend un sac et **ignore ce qu'il n'utilise pas**, donc `t(fault.code, fault)` fonctionne sur
  une union plate. L'argument ne survit pas à l'examen de la couche qui l'avait motivé.
- **`{ resource, error }`** — impose `resource` alors que `configuration_missing` porte une variable
  d'environnement et `insufficient_stock` deux quantités ; et fige deux champs quand `invalid_state`
  en demande trois. C'est la forme retenue, mal généralisée.
- **`{ code: 'product.not_found' }`** — fusionner les deux dimensions demanderait une vingtaine de
  codes pour un seul concept, et autant d'entrées de catalogue ne différant que par un nom commun.

#### Quand un opérande a le droit d'être facultatif

**Un opérande facultatif n'est admis que lorsque la surface ne peut pas reconstruire l'information
depuis sa propre requête. Sinon, l'opérande est soit obligatoire parce qu'il constitue la faute, soit
absent.**

Le risque que ce critère écarte est précis : voir chaque variante du contrat grossir de ses propres
données de diagnostic, ajoutées par confort, jusqu'à ce que `Fault` redevienne un sac. Un champ
facultatif est le point d'entrée naturel de cette dérive, parce qu'il ne casse rien en arrivant.

La règle se vérifie en une question : **l'appelant sait-il déjà ?** S'il a soumis un identifiant, on
ne le lui renvoie pas ; s'il a soumis une liste, on ne la lui répète pas. Ce qu'il ne peut pas
savoir, en revanche, ne se déduit d'aucune requête.

Deux familles en découlent, et elles couvrent tout le contrat :

1. **La liste EST la faute** — `validation_failed.details`, `unknown_reference_targets.targets`,
   `unknown_scopes.scopes`, `undelegatable_grants.grants`. Le code ne dit rien d'actionnable sans
   elle : « validation échouée » sans ses détails est vide. Ces opérandes sont obligatoires.
2. **La faute se lit sans l'opérande** — un seul membre sur 21, `rank_reserved.grants?`, et un seul
   site qui le remplit : la révocation en masse. `PUT /roles/:id/permissions` **remplace** l'ensemble
   des droits, donc ce qui disparaît n'est pas ce que l'appelant a soumis. Il ne peut pas le
   reconstruire ; la faute doit donc le nommer.

La cause n'est pas le rang, c'est la sémantique **remplace-tout**. Elle se répète — `PUT
/content/entities` est explicitement « remplace-tout », et son refus destructif nomme lui aussi ce
qu'il aurait détruit. La différence est que ce second cas tombe sur un code dont la liste est
obligatoire : un plan qui détruit n'a aucun sens sans dire quoi. Le motif se reproduit donc, mais il
ne produit pas un second champ facultatif.

Mesuré avant de trancher, sur les réponses non encore migrées : 8 sites interpolent une liste dans
leur message, 11 une valeur unique. **Aucun** n'ajoute du contexte à une faute qui existerait sans
lui — tous tombent dans la première famille. Le champ facultatif reste donc un cas, pas un motif, et
ce critère est ce qui l'empêche d'en devenir un.

### 6. Un catalogue par surface, avec repli obligatoire

Chaque surface tient sa table `code → texte` : l'administration nomme le prestataire, la boutique
reste générique, la CLI affiche la faute brute. Le catalogue est **indexé par le discriminant**, donc
aucune surface ne manipule les formes génériquement — elle n'applique qu'une règle : un discriminant,
le reste est de la donnée de message.

Un repli est obligatoire : l'API livrera un jour un code qu'une surface déployée plus tôt ne connaît
pas. Sans lui, l'utilisateur voit une clé brute.

Le catalogue français mappe `not_found` + `resource: 'order'` vers « Commande introuvable » — ce qui
règle au passage l'accord en genre, que le domaine n'a pas à connaître.

## Conséquences de l'amendement

**Le vocabulaire des codes entre dans le contrat d'API**, au sens d'[ADR-0007](./ADR-0007-contrat-sdk.md) :
un client headless fera un `switch` dessus. Règle de versionnement — **ajouter un membre à l'union ou
un champ à un membre est additif ; renommer un code est cassant.**

**La V1 et la V2 consomment le même vocabulaire.** En V1 le développeur écrit son catalogue ; en V2 un
utilisateur non technique l'édite depuis l'administration. La V2 devient un écran posé sur une table
existante, pas une refonte.

**Environ 30 codes pour 80 messages** — 7 concepts transverses et une vingtaine de codes propres au
domaine.

### Deux défauts trouvés en remontant aux gardes

- `checkout/index.ts:87` et `:90` rendent **le même message pour deux concepts distincts** — aucun
  panier actif, et panier existant mais vide.
- `payment/index.ts:419` (`Transaction ID manquant`) n'est pas une faute utilisateur : la garde porte
  sur un paiement déjà `completed` dépourvu d'identifiant de transaction, donc sur un **invariant
  interne violé**. Sous le présent ADR, ce doit être une exception, pas un 400.

### Suivi

- La migration **n'est pas lancée**. L'ordre retenu : harmoniser la taxonomie, puis convertir surface
  par surface. `message` reste rempli en parallèle pendant la transition — l'administration le lit
  dans huit vues — puis est déprécié.
- **Deux amorces existent déjà et sont à absorber par cette migration**, pas à traiter séparément :
  `apps/echoppe-api/src/lib/response.ts` porte un helper `notFound(entity)` dont le commentaire
  diagnostique exactement le problème mesuré ici — il n'est employé que **11 fois contre 89** 404
  écrits à la main. Et `errorSchema`, marqué `@deprecated` au profit des schémas spécifiques, reste
  employé **51 fois**. Les corriger avant la migration serait du travail jeté : elle réécrit les 214
  réponses de toute façon. `notFound(entity)` est d'ailleurs la forme dont `common.not_found` +
  paramètre `resource` est l'aboutissement — l'intention était déjà là.
- Les fautes d'énumération de `authenticate` relèvent d'un **chantier sécurité distinct**, où la
  priorité est la sécurité et non la qualité du message.

## Note d'implémentation 2026-08-16 — première tranche verticale

`catalog/product` migré (26 réponses), plus le `onError` global. Trois points que la décision
laissait ouverts et que l'implémentation a tranchés.

### La forme du socle est paramétrée par sa ressource

`Fault<R extends string = string>`, et `EchoppeFault = Fault<EchoppeResource>`. Le socle reste
littéralement conforme à la décision — `resource` y est une `string` par défaut, aucun vocabulaire de
produit n'y entre.

La raison du paramètre : sans lui, la fermeture ne valait qu'à l'**entrée** des constructeurs. Leur
retour annoncé `Fault` reperdait `resource` en `string`, et rien en aval — ni un schéma qui sort sur
le fil, ni un catalogue de surface — ne pouvait énumérer les ressources. Seul
`permission_denied.resource` reste ouvert, comme prévu.

### Le schéma de transport est spécialisé par produit, et vit dans l'application

`apps/echoppe-api/src/lib/fault-schema.ts`, pas `@repo/shared`. Deux raisons distinctes :

1. TypeBox est une préoccupation de **transport** — OpenAPI, validation de réponse, inférence Eden.
   Le faire remonter dans le paquet le plus bas du socle imposerait une dépendance de frontière à
   tout paquet qui refuse quelque chose, y compris ceux qui ne servent jamais de HTTP.
2. Le schéma **énumère un vocabulaire**, qui est celui d'un produit. `prisme-api` écrira le sien sur
   `PrismeResource`, avec les mêmes 19 codes. Un schéma unique dans le socle devrait retomber sur
   `t.String()` et ne documenterait plus rien.

La forme est donc écrite deux fois. Le prix est payé une fois et **verrouillé** par trois gardes de
compilation (`Equal<Static<schema>, EchoppeFault>`) : un code ajouté, un champ renommé ou une
ressource déclarée par un paquet partagé cassent `type-check`.

### Le `$ref` partagé est acquis, et le coût du contrat est constant

Le schéma est un **modèle nommé**, donc un `$ref` unique. Une première tentative avait conclu que
c'était impossible : les routes devenaient intypables, avec des erreurs accusant l'union discriminée
(`resource: never`). Le diagnostic était faux, et la cause bien plus petite.

`as const` sur la constante partagée des réponses (`{ 404: 'ErrorResponse' }`) ajoute `readonly`, et
le littéral ne survit alors pas au spread dans les helpers de `lib/response.ts` : il s'élargit en
`string`, Elysia cesse d'y voir un nom de modèle et lit `404` comme un statut textuel. Une simple
**annotation de type** à la place le préserve. Quatre représentations ont été comparées sur banc —
modèle nommé, `t.Ref`, `$id` inline, inline nu — et deux formes de helper, avant de conclure.

Ce qui reste vrai, et qui est une contrainte réelle d'Elysia :

- un `t.Union` construit par `.map` sur un tableau se résout en `never` côté inférence de réponse ;
  les littéraux doivent former un **tuple écrit à la main** ;
- l'union des ressources ne peut pas être un modèle nommé imbriqué : un `t.Ref` ne se résout pas
  dans `Static`, ce qui ferait tomber les gardes de compilation. Elle reste inline **dans** le
  composant.

Résultat mesuré : **+1 607 lignes de contrat, une fois**, dont 1 511 pour le composant lui-même. Une
route migrée n'ajoute plus que son `$ref`. Le coût ne croît pas avec la migration.

## Note d'implémentation 2026-08-16 — la tranche 401/403

Deuxième tranche verticale : les **40 réponses** d'authentification et de droits — 14 en 401, 26 en
403 —, réparties dans `auth`, `user`, `role`, `api-key`, `cart`, `payment` et `content/entity`.

### La tranche ne pouvait pas être découpée

La roadmap annonçait « le middleware, dans sa propre tranche ». C'était faux, et pour une raison
technique : le schéma d'un statut n'est pas déclaré par la route mais par les **helpers partagés**
de `lib/response.ts`. Dès qu'un helper annonce `ErrorResponse` en 403, toute route qui l'utilise et
rend encore `{ message }` échoue à la validation de réponse d'Elysia. Les 40 sites basculent
ensemble ou pas du tout ; `unauthorizedResponse` et `forbiddenResponse` ont disparu.

Effet de bord mesuré : 18 modules ont dû recevoir `.use(models)`. Un nom de modèle n'est visible que
dans l'instance qui le monte — c'est une contrainte d'Elysia, pas un choix.

### Trois codes ajoutés, un retiré

Comme pour la taxonomie initiale, les 16 réponses sans code évident ont été **classées par la garde
qui les produit**, jamais par leur formulation. Cinq d'entre elles retombaient sur des codes
existants (`protected_subject` pour `existing.isOwner` et `existing.isSystem`, `invalid_state` pour
`account-disabled`). Les onze autres ont fait apparaître trois prédicats réels :

- **`undelegatable_grants`** — `!holds(...)` : on n'accorde que ce qu'on détient (ADR-0038) ;
- **`rank_reserved`** — un seuil de RANG, pas une possession ; c'est ce qui autorise à retirer un
  droit qu'on ne détient pas soi-même (ADR-0047) ;
- **`self_only`** — l'acte n'est permis que sur soi, miroir exact de `self_action_forbidden`.

`owner_only` est **retiré**, absorbé par `rank_reserved`, qui porte le seuil exigé et sait donc
distinguer « réservé au propriétaire » de « réservé au premier rang ». Les gardes testent bien deux
hauteurs — `isTheOwner` et `isFirstRank` — que le code précédent confondait.

Un troisième seuil existe, `privileged` (`@repo/auth`), qui sépare l'admin et la clé machine du
public et du client. Il n'est **pas** un rang : il dit qui est de confiance, pas qui gouverne. Ses
trois sites continuent d'émettre `permission_denied`, comme le faisait déjà leur message.

### L'échelle de rang est du produit, donc un second paramètre de type

`Fault<R, K>`. Le socle ne connaît aucun rang : `@repo/auth` ne sait décrire que des **étendues de
droits** (`Authority`, trois formes). Le rang vit dans `FIRST_RANK_ROLE_KEYS`, côté produit, et
`rbac.ts` annonce déjà qu'un rang sur mesure viendra — l'union est additive, il s'ajoutera sans que
rien de ce qui lit ne bouge. Même raisonnement, même mécanisme que pour les ressources.

### Une prose voyageait dans un opérande

`undelegatableGrants` (`packages/auth/src/permission.ts`) évaluait **trois** prédicats distincts et
aplatissait son verdict dans une `string[]` dont un élément portait sa raison **rédigée en
français** : `` `${resource} (tient au rang, non délégable)` ``. C'est exactement ce que cet ADR
interdit — la surface ne peut ni la traduire ni la reformater. La fonction rend désormais
`{ grant, reason }[]`, et ses tests peuvent enfin distinguer « non détenu » de « tient au rang »,
ce que `toContain` sur une phrase ne permettait pas.

### Deux formulations que la migration a corrigées

- « Toucher au premier rang est réservé au propriétaire » serait devenu « Supprimer est réservé au
  propriétaire », ce qui est **faux** : supprimer un utilisateur ordinaire reste permis. Le
  catalogue écrit « Cet acte — supprimer — est réservé… », qui ne généralise pas.
- `rank_reserved` porte un `grants?` **optionnel**, rempli par un seul site : la révocation en masse,
  où la route remplace l'ensemble des droits et où l'appelant ne peut donc pas déduire de sa propre
  soumission ce qu'il allait retirer. Un test d'intégration l'attestait déjà ; le retirer aurait été
  une régression. C'est le seul champ facultatif du contrat, et il a fait écrire le critère qui
  l'autorise (§5, « Quand un opérande a le droit d'être facultatif ») — mesuré sur les réponses
  restantes avant d'être figé, pour vérifier qu'il restait un cas et non un motif.

### Le contrat rétrécit

Le composant `ErrorResponse` existait déjà. 401 et 403 cessent d'inscrire leur `{ message }` inline
dans chaque route pour ne plus porter qu'un `$ref` : **−222 lignes** de contrat SDK. La migration ne
coûte plus rien au contrat, elle lui en rend.

## Note d'implémentation 2026-08-16 — la tranche 404

**82 réponses, un seul code.** La plus grosse tranche du chantier, et la seule qui ne prenne aucune
décision : `not_found(resource)` partout, l'opérande se lit dans la garde qui l'a produite
(`if (!found)`). Elle a été migrée d'un seul diff, ce que l'interdiction d'un « big-bang » n'exclut
pas : ce qu'elle vise est le mélange de familles hétérogènes, pas le nombre de sites d'une famille
homogène.

### Ce que l'uniformisation a révélé

Le helper `notFound(entity)` couvrait 11 sites sur 89 et produisait une phrase. Les 71 autres
écrivaient la leur, avec le résultat attendu : **cinq messages restés en anglais** (`Option not
found`, `Variant not found`, `Media not found`…) et **trois orthographes concurrentes** pour la même
idée — « introuvable », « non trouvé », « non trouvée ». Le contrat les supprime toutes d'un coup,
parce qu'il n'y a plus qu'un endroit où la phrase s'écrit.

### Les deux jeux de helpers fusionnent

`withCrudFaults` et `withNotFoundFault` n'existaient que pour la coexistence : tant qu'une route
rendait `{ message }` en 404, un helper unique ne pouvait pas annoncer `ErrorResponse`. Le dernier
site basculé, ils rejoignent `withCrudErrors` et `withNotFound`. `notFoundResponse` et le helper
`notFound()` disparaissent avec eux.

C'est la forme que prendra la fin de la migration : chaque famille migrée retire un schéma hérité
au lieu d'ajouter une variante.

### Un opérande perdu, et le critère qui dit que ce n'est pas une perte

Deux sites interpolaient le nom demandé : `` `Cible référençable inconnue : ${params.name}` `` et
`` `Unknown payment provider: ${params.provider}` ``. La faute ne le porte pas — et n'a pas à le
porter : ce nom vient de l'URL que l'appelant a lui-même construite. C'est exactement le test posé
en §5 (« l'appelant sait-il déjà ? »), appliqué pour la première fois à un cas réel.

### Le contrat rétrécit encore

**−254 lignes** de contrat SDK. Les 404 cessent d'inscrire leur `{ message }` dans chaque route pour
ne porter qu'un `$ref`. Cumulé avec la tranche 401/403 : −476 lignes depuis que le composant existe.

## Note d'implémentation 2026-08-16 — la tranche 400, et ce qu'une route peut porter

Les 44 réponses en 400, classées par garde : **37 tombent sur des codes existants**, aucun nouveau
code n'était requis pour elles. Deux prédictions de l'amendement se vérifient, dont une largement
sous-estimée — « Pays de livraison invalide » est bien un `not_found` déguisé, mais il y en a **six**
et non un ; et « Provider non configuré » / « Mode de paiement non disponible » sont bien la même
garde, écrite **treize** fois avec `!isEncryptionConfigured()`.

### Une route n'a qu'un schéma par statut

Sur les 37, **23 seulement** ont pu être migrées. Les 14 autres partagent leur route avec un cas
laissé ouvert : le `POST /checkout` porte à lui seul sept réponses migrables, une garde anti
open-redirect et une exception promue. Migrer leur corps aurait imposé de basculer le 400 de la
route entière, donc de trancher les cas exclus dans le même diff.

C'est une contrainte que le découpage par famille ne montre pas, et qu'il faut anticiper pour la
suite : **l'unité migrable n'est pas la réponse, c'est la route.** Une famille homogène ne se migre
d'un bloc que si aucune de ses routes n'est mixte.

### Deux défauts de rendu que la tranche a fait sortir

Le premier `invalid_state` servi aurait affiché : « Action impossible : **ce** utilisateur est
« **disabled** », il doit être « **active** » ».

- **L'élision manquait.** `demonstrative(gender)` ne connaissait que le genre ; il lui faut la
  première lettre du mot. Corrigé dans les deux catalogues, ce qui répare aussi `in_use`,
  `protected_subject` et `forbidden_resource`, qui produisaient la même faute en silence.
- **Les états sortaient bruts, en anglais.** `invalid_state` porte `current` et `expected` comme
  codes — c'est correct, le domaine ne parle aucune langue —, mais aucune surface ne les traduisait.
  Une table `STATES` s'ajoute aux tables `ACTIONS` et `RANKS` déjà là, pour la même raison.

C'est la démonstration de ce que le contrat achète : ces deux corrections se font **à un endroit**,
et profitent à tous les codes qui nomment une ressource ou un état. Avec des phrases écrites dans
les routes, il aurait fallu les chercher dans 44 fichiers.

## Note d'implémentation 2026-08-16 — les cas ouverts du 400

Trois gardes restaient à trancher. Chacune a été vérifiée contre le reste du dépôt avant qu'un code
ne soit créé : **un code général réservé à un seul domaine est moins honnête qu'un code spécifique.**

### `redirect_url_rejected` — la fusion est la décision

`isAllowedRedirectUrl` fusionne quatre prédicats en un booléen : URL non parsable, protocole non web,
http en production, hôte hors whitelist. La fusion est **maintenue sur le fil**, au titre de §4 : les
distinguer renseignerait un attaquant sur la configuration de l'installation. Seul le CHAMP voyage,
parce que l'intégrateur connaît déjà ses propres URL.

Le nom a été choisi contre un `value_not_allowed` général, qui aurait menti : l'un des quatre
prédicats refuse une valeur qui n'est même pas syntaxiquement valide. Et la mesure ne trouve **aucune
autre garde de ce genre** dans le dépôt — la whitelist MIME annoncée au backlog n'existe pas encore.

### `personalization_rejected` — l'identifiant, jamais le libellé

Trois prédicats — clé non déclarée, champ requis vide, dépassement de `maxLength` — aplatis dans une
phrase qui interpolait `field.label`, du texte **saisi par le marchand**. Le libellé ne voyage plus :
la surface a affiché le formulaire, donc elle a la déclaration, donc elle retrouve seule le libellé
**et** le `maxLength`. Le critère §5 tranche ainsi un opérande facultatif avant qu'il n'existe.

Vérifié avant de créer le code : `@repo/fields` valide bien des valeurs contre des champs déclarés,
mais par **TypeBox compilé**, et ses fautes alimentent les 9 réponses 422. Le triplet n'existe qu'ici.

### Le provider requis — le schéma mentait

`shipping:223` teste `if (!provider)` sur un paramètre que son propre schéma déclare
`t.Optional(t.String())`, puis le caste vers l'union des transporteurs. Le corps passe à
`required_data_missing`, code existant. La vraie correction — un schéma non optionnel sur une union
de littéraux, qui ferait rendre un 422 par Elysia et supprimerait garde et cast — appartient au
chantier des statuts.

### Ce que la règle « une route, un schéma » a produit ici

Trancher ces gardes débloque **trois routes sur cinq** : `POST /payments/initiate`,
`POST /cart/items` et `GET /shipping/tracking`, soit 9 réponses de plus. Les deux autres restent
bloquées par un chemin mal exposé, pas par un cas ouvert.

`POST /checkout` en est l'illustration : son corps `redirect_url_rejected` est prêt, mais la route
porte encore une exception promue. Elle rend donc la forme héritée — dont le **texte vient désormais
du catalogue**, seule source de phrases. C'est la bonne façon d'attendre : le contenu est déjà
conforme, seule l'enveloppe ne l'est pas.

## Note d'implémentation 2026-08-16 — les trois chemins mal exposés

### `checkout` — la violation nommée dans cet ADR est fermée

Le tableau des « chemins qui violent l'invariant » désignait
`apps/echoppe-api/src/modules/checkout/index.ts` comme **le plus grave du lot** : le message d'une
exception d'adapter rendu en 400 **à l'acheteur**, capable de lui servir `Stripe is not configured.`.
Il est fermé.

Le correctif n'est pas une faute structurée, et l'analyse des causes explique pourquoi. `createCheckout`
peut lever trois natures : configuration absente (déjà gardée en amont), invariant du prestataire
violé (« session created without URL »), échec réseau. **Aucune n'est actionnable par un acheteur** —
il ne configure rien et ne corrige rien. La route relance donc, une fois la commande annulée, et le
`onError` global fait ce pour quoi il a été écrit : détail au log sous un identifiant de corrélation,
réponse qui ne porte que celui-ci.

Le rollback reste **avant** la relance : annuler la commande est une décision de domaine, la
conversion en réponse n'en est pas une.

### `payment` — un état impossible n'est pas une faute client

Un paiement `completed` sans `providerTransactionId` était rendu en 400, comme si l'appelant avait
mal demandé. Il n'a rien à corriger : ce sont **nos** données qui sont incohérentes. La garde lève
désormais, et rejoint le même point de conversion.

C'est le pendant de la décision §2 : ce qui est inactionnable ne se structure pas, et surtout ne se
déguise pas en faute métier.

### `shipping` — l'exigence remonte au schéma

`query: t.Optional(t.String())` puis `if (!provider)` puis `as ShippingProvider` : le schéma mentait
deux fois, et le cast rattrapait le mensonge. Le schéma déclare maintenant l'union des trois
transporteurs, non optionnelle. La garde disparaît, le cast aussi, et **Elysia refuse lui-même**
l'absence comme la valeur hors liste.

Seul changement de statut observable de ce lot, et il est la conséquence directe du correctif : ce
chemin rend désormais 422 au lieu de 400. Les autres requalifications de statut restent groupées
dans leur propre chantier.

## Note d'implémentation 2026-08-16 — `insufficient_stock` porte sa variante

Le dernier blocage du 400 était `validateStock`, dont le message nommait le produit en rupture. La
question posée : fallait-il un **second** opérande facultatif pour dire quelle ligne du panier est
concernée ?

Les quatre gardes qui émettent `insufficient_stock` ont été relues avant d'ajouter quoi que ce soit.
Résultat : **les quatre ont l'identifiant de variante sous la main**, gratuitement — chacune vient de
lire la ligne dont elle compare le stock. Et deux d'entre elles servent un appelant qui ne peut pas
le reconstruire : `PATCH /cart/items/:id` reçoit un identifiant de LIGNE, pas de variante ; `POST
/checkout` ne reçoit aucune ligne du tout.

Un champ facultatif aurait donc été rempli à moitié — non parce que l'information est parfois
inutile, mais parce que deux appelants sur quatre l'ont déjà. Or « l'appelant l'a déjà » justifie de
ne pas *ajouter* un champ ; ça ne justifie pas de le rendre incertain quand il constitue la faute.

**Et il la constitue.** `available: 2, requested: 5` ne désigne rien. Même structure qu'`in_use`, qui
porte `resource` et `usedBy` sans que l'un soit facultatif. Le champ est donc **obligatoire**, et
`rank_reserved.grants` reste le seul opérande facultatif du contrat.

Il s'appelle `variant` et non `resource` : ce n'est pas une valeur du vocabulaire de fautes mais
l'identifiant d'une ligne. Et il remplace `item.product.name` — une donnée saisie par le marchand,
qui voyageait dans un message. La surface a affiché le panier ; elle retrouve le libellé.

### Un bug d'opérande révélé par la structuration

`POST /cart/items`, sur la fusion de deux lignes, teste `newQuantity > availableStock` mais rendait
`body.quantity` comme quantité demandée. L'écart était invisible tant que le message n'affichait que
le stock disponible. Exposer l'opérande l'a fait apparaître : `requested` porte désormais
`newQuantity`, ce que la garde compare réellement.
