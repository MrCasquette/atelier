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
