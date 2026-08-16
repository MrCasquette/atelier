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
  une régression.

### Le contrat rétrécit

Le composant `ErrorResponse` existait déjà. 401 et 403 cessent d'inscrire leur `{ message }` inline
dans chaque route pour ne plus porter qu'un `$ref` : **−222 lignes** de contrat SDK. La migration ne
coûte plus rien au contrat, elle lui en rend.
