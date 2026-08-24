# @echoppe/admin

## 0.8.0

### Minor Changes

- c736fc2: Le pays d'une facture n'est plus `[object Object]`.

  L'adresse de facturation est stockée en `jsonb`. Trois endroits en décrivaient la forme, et aucun
  ne s'accordait : le checkout écrit `country` comme un objet `{ code, name }`, le seed comme une
  chaîne, et la facture l'affirmait `string` à la lecture. Une facture émise plaçait donc l'objet
  entier dans son champ pays.

  La colonne porte désormais son type (`$type<BillingAddress>()`), déclaré d'après ce que le checkout
  écrit — le seul chemin réel. Les trois autres divergences que l'affirmation masquait sont corrigées
  au passage : `company` et `street2` sont nullables et non optionnels, `phone` existe.

  Aucune migration : le typage `jsonb` est déclaratif. Les commandes déjà enregistrées avec un pays en
  chaîne — jeux de démonstration uniquement — doivent être régénérées par `db:seed`.

- abde6e2: La liste des fournisseurs d'e-mail annonce enfin lesquels.

  `GET /communications/providers` rendait `id: string` alors que `POST /communications/test` exige
  `resend | brevo | smtp`. Le dashboard réaffirmait donc le fournisseur entre les deux appels, pour
  recoller un vocabulaire que le contrat connaissait mais ne disait pas. Les deux routes partagent
  maintenant la même déclaration.

  Le SDK est régénéré : le champ passe de `string` à l'union. C'est une restriction du type, sans
  changement des valeurs rendues.

- 667537d: Le cœur cesse de prêter sa surface aux paquets partagés.

  `@echoppe/core` réexportait 54 symboles empruntés à sept paquets `@repo/*`. Chacun est retourné à
  son paquet d'origine, et l'API déclare enfin les quatre dépendances qu'elle consommait sans les
  nommer. Le manifeste de migration vit désormais dans un fichier hors des `exports` du paquet, donc
  inatteignable par un import : le raccourci devient impossible plutôt qu'interdit.

  Aucun changement de comportement ni de contrat HTTP — c'est une réorganisation interne. L'image est
  reconstruite parce que 65 fichiers du runtime ont bougé, pas parce qu'elle fait autre chose.

- 5ff77c7: L'envoi d'e-mails devient un acteur composé au démarrage.

  `sendEmail` résolvait son adapter par un singleton de module aux fabriques câblées en dur, et lisait
  la base directement pour l'identité du site, le journal et la disponibilité des providers. Aucune
  couture ne permettait de substituer un faux : seule l'absence de provider configuré dans la base de
  test empêchait un envoi réel depuis une suite.

  `CommunicationService` reçoit désormais ses quatre dépendances, que le produit branche dans sa
  racine de composition et qu'un test remplace. Le chemin d'envoi est couvert pour la première fois —
  sans base, sans réseau. `@repo/identity` sort au passage des dépendances de `@repo/communication`.

  Aucun changement de contrat HTTP ni de comportement observable.

- b3bd334: Rembourser un paiement par virement ou par chèque répond une faute, plus une erreur serveur.

  La colonne `payment.provider` accepte quatre valeurs — `stripe`, `paypal`, `bank_transfer`,
  `check` — mais seules les deux premières ont un adapter. La route de remboursement affirmait que
  toute valeur lue en base était un provider outillé, ce qui envoyait les deux autres dans
  `getPaymentAdapter`, où elles levaient « Unknown provider » : une 500 avec incident, là où c'est un
  refus métier parfaitement clair. Un virement se rembourse hors ligne, et l'API le dit désormais.

  Le jeton de session est également vérifié avant usage : Elysia expose les valeurs de cookies en
  `unknown` — c'est une frontière — et onze endroits affirmaient y trouver une chaîne.

- 2e81b07: Le vocabulaire des événements de paiement se ferme, et le test d'e-mail passe par le journal.

  `payment_event.type` était un `varchar` libre dont le commentaire annonçait cinq valeurs, dont deux
  n'ont jamais été écrites — tandis qu'une sixième l'était sans être annoncée. Surtout, un
  remboursement s'inscrivait `refund` à un endroit et `refunded` à un autre : deux valeurs pour un
  même événement, qu'une colonne libre acceptait sans broncher. La colonne devient un enum
  PostgreSQL, et la correspondance statut → événement une table exhaustive.

  Le test de configuration d'un provider écrivait sa propre ligne dans `communication_log`, en
  dupliquant jusqu'à la traduction du statut ; il passe désormais par le service, comme tout envoi.

  **Migration incluse.** Elle convertit `payment_event.type` en enum. Les lignes portant une valeur
  hors du nouvel ensemble feraient échouer la conversion — aucune installation n'est concernée à ce
  stade.

### Patch Changes

- 3e23f1e: Les tests de l'API sont vérifiés par le compilateur.

  Leur `tsconfig` n'incluait que `src/**` : ni les suites, ni les scripts n'étaient type-checkés. Les
  types locaux y avaient donc dérivé sans que rien ne le signale, et les assertions s'y étaient
  multipliées — puisque rien ne pouvait les contredire.

  Les corps de réponse se lisent désormais par des fonctions qui vérifient et disent ce qu'elles ont
  reçu. Une route qui change de forme fait échouer le test à l'endroit où la réponse arrive, avec son
  contenu, au lieu d'un `undefined` plusieurs lignes plus bas.

  Aucun changement de comportement : c'est de l'outillage de test.

- Updated dependencies [c736fc2]
- Updated dependencies [abde6e2]
- Updated dependencies [667537d]
- Updated dependencies [5ff77c7]
- Updated dependencies [b3bd334]
- Updated dependencies [3e23f1e]
- Updated dependencies [2e81b07]
  - @echoppe/api@0.8.0

## 0.7.0

### Patch Changes

- Updated dependencies [7d0f246]
  - @echoppe/api@0.7.0

## 0.6.0

### Patch Changes

- Updated dependencies [4e5a8b4]
  - @echoppe/api@0.6.0
