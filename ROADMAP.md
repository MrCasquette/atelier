# Roadmap d'exécution — Échoppe / Prisme

État de travail établi le 2026-08-16 à partir du code, des ADR, des backlogs et du worktree réels.
Cette roadmap ordonne les prochains chantiers ; elle ne remplace ni les décisions d'architecture ni
les backlogs par produit.

Références :

- [Backlogs du monorepo](./BACKLOG.md)
- [Backlog Échoppe](./docs-internal/backlog/echoppe.md)
- [Backlog Prisme](./docs-internal/backlog/prisme.md)
- [Backlog shared](./docs-internal/backlog/shared.md)
- [Roadmap produit Prisme](./docs-internal/design/roadmap-prisme.md)
- [Index des ADR](./docs-internal/adr/README.md)
- [Bilan de l'audit de couverture documentaire](./docs-internal/audits/audit-couverture-documentaire.md)
  — d'où viennent les mesures citées ici

## État acquis

- Le chantier RBAC d'ADR-0047 est livré : autorité unifiée, Administrateur par soustraction,
  protection et transfert de propriété, délégation bornée.
- Invitation et récupération admin sont unifiées par ADR-0048.
- L'ordre déclaré des champs survit au stockage.
- Le schéma de contenu est une séquence ordonnée selon ADR-0049.
- L'interpolation V1 est livrée.
- La grammaire commune est extraite dans `@repo/fields`.
- Les principaux packages partagés ont une charte documentaire et une première couverture de tests.
- ADR-0050 définit le contrat structuré des fautes et interdit qu'un message d'exception compose une
  réponse HTTP.
- Le découpage physique Échoppe / shared existe.

Prisme n'a cependant encore aucun artefact exécutable : ni `prisme-core`, ni `prisme-api`, ni admin,
ni client. La prochaine preuve architecturale doit désormais venir d'un second produit réel.

## Jalon 0 — Mettre en usage le contrat d'ADR-0050

Le commit `0b5ecb1` pose `Fault`, `ErrorResponse`, les ressources possédées par les packages, les
constructeurs typés d'Échoppe et le catalogue de transition — sans migrer aucune route. Partir de ce
contrat et terminer une première tranche verticale avant de changer de sujet.

- [x] Stabiliser `Fault`, `ErrorResponse` et la composition des ressources par produit.
- [x] Introduire les constructeurs typés côté Échoppe → `packages/echoppe-core/src/constants/fault.ts`,
  seul endroit où le vocabulaire se ferme.
- [x] Conserver temporairement `message` comme compatibilité explicitement dépréciée → `@deprecated`
  sur `ErrorResponse.message`, rempli par `apps/echoppe-api/src/lib/fault-message.ts`.
- [x] Vérifier lint, type-check et tests ciblés.
- [x] Ajouter les tests unitaires du contrat et de ses **constructeurs** →
  `packages/echoppe-core/src/constants/fault.test.ts`. L'exhaustivité tient par un
  `Record<FaultCode, …>` : un code ajouté sans constructeur ne compile plus.
- [x] Paramétrer `Fault<R>` et spécialiser `EchoppeFault`. Sans ça, la fermeture ne valait qu'à
  l'**entrée** des constructeurs — leur retour reperdait `resource` en `string`, et rien en aval ne
  pouvait énumérer les ressources.
- [x] Migrer un premier chemin complet domaine → route → surface : les **26 réponses** des 7 fichiers
  de `catalog/product`, le schéma de frontière (`lib/fault-schema.ts`, vérifié contre le type par
  trois gardes de compilation), et la lecture côté administration (`lib/fault.ts` + `apiError.ts`).
- [x] Ajouter le `onError` global → `apps/echoppe-api/src/error-handler.ts` (également listé au
  jalon 1).

Ne pas migrer les 214 réponses d'erreur dans un seul diff. Procéder verticalement, par famille de
fautes et avec une surface consommatrice à chaque étape.

**Critère de sortie** : atteint — le contrat est consommé par les routes produit et par
l'administration ; il n'est plus seulement déclaré dans les barrels.

### Ce que la première tranche a révélé, à traiter avant d'élargir

- **Le schéma de faute est spécialisé par produit, et vit dans l'application.** TypeBox est une
  préoccupation de transport : le faire entrer dans `@repo/shared` imposerait une dépendance de
  frontière à tout paquet qui refuse quelque chose. `prisme-api` écrira le sien sur `PrismeResource`.
- **Le `$ref` partagé est acquis** : `ErrorResponse` est un modèle nommé, le contrat coûte
  +1 607 lignes **une fois** et une route migrée n'ajoute plus que sa référence. Le premier
  diagnostic — « `.model()` casse l'inférence » — était faux : la cause était `as const` sur la
  constante de réponses, dont le `readonly` empêche le littéral de survivre au spread des helpers.
  Restent deux contraintes réelles d'Elysia, documentées sur place : un `t.Union` construit par
  `.map` se résout en `never`, et l'union des ressources ne peut pas être un modèle imbriqué sans
  faire tomber les gardes de compilation.
- **Les 401/403 ne sont pas migrés** : ils sont émis par le middleware d'authentification, pas par
  les routes. C'est leur propre tranche.

## Jalon 1 — Fermer les vulnérabilités courtes et exposées

- [ ] **Échapper les données utilisateur des gabarits HTML d'e-mail.** Point de départ :
  `packages/communication/src/templates.ts:117`, où `name`, `email`, `phone`, `subject` et `message`
  sont interpolés bruts et proviennent d'un formulaire **public non authentifié**. Vérifier les
  autres gabarits, qui suivent le même motif. Pas de XSS — les clients mail bloquent les scripts —
  mais liens, pixels de traçage et mise en page usurpée passent.
- [ ] **Fermer l'oracle explicite d'`authenticate`** (`packages/auth/src/service.ts:162-167`) :
  `account-disabled` est rendu **avant** `Bun.password.verify`. Inverser l'ordre — on n'apprend
  l'état de son compte qu'après avoir prouvé qu'il est le sien.
- [ ] **Fermer l'oracle temporel** : le chemin « adresse inconnue » saute entièrement la vérification,
  volontairement coûteuse. Vérifier contre un **hash leurre calculé une fois au chargement**, avec
  les mêmes paramètres de coût. Touche aussi le login client
  (`apps/echoppe-api/src/modules/auth/customer-service.ts:163`), donc une surface publique. Ne rend
  pas les durées identiques — la requête SQL diffère — mais supprime le seul écart mesurable à
  distance de façon fiable.
- [ ] Corriger le rate limiting sans Redis. **Aucun des correctifs ci-dessus ne le remplace** : sans
  lui l'énumération reste possible, seulement plus lente.
- [ ] Définir et tester la politique de proxy de confiance.
- [ ] Hasher les tokens de session stockés en base.
- [ ] Durcir les uploads média : contenu, taille, nom serveur et téléchargement sûr.
- [x] **Ajouter le `onError` global garanti par ADR-0050** (livré au jalon 0) →
  `apps/echoppe-api/src/error-handler.ts`. Il ne convertit que l'exception non rattrapée : le détail
  part au log avec un identifiant de corrélation, la réponse ne porte que celui-ci. Validation,
  route inconnue et corps illisible restent à Elysia — aucun message d'exception n'y transite.
- [ ] Borner les webhooks sans substituer le rate limiting à leur signature et à leur idempotence.

Arbitrage à décider et non à corriger : l'inscription client rend `email-taken`
(`customer-service.ts:104`), une énumération explicite sur un endpoint public. Le durcissement
imposerait « on vous a envoyé un e-mail » à tous les inscrits légitimes — sur une boutique, le coût
ergonomique paraît supérieur au gain.

**Critère de sortie** : login, session, formulaire de contact et upload possèdent chacun un test de
refus ou d'abus.

## Jalon 2 — Rendre le socle réellement composable

Ne réaliser ici que les travaux nécessaires au second produit.

- [ ] **Remplacer le singleton de `@repo/communication` par une factory injectable.**
  `email.ts:39` résout son adapter via `getActiveCommunicationAdapter()`, importé d'un singleton de
  module aux fabriques câblées en dur : aucune couture. Les credentials sont injectés (DIP), mais
  les stuber supprime la dépendance à la base, **pas au réseau**. Cible :
  `createCommunicationRegistry(factories)` composée par le produit au démarrage. Touche les
  4 appelants de `sendEmail` plus le boot. Écarté : un garde `NODE_ENV` — test d'environnement dans
  du code de domaine, invisible au type. **Débloque les tests du chemin d'envoi**, aujourd'hui
  impossibles.
- [ ] **Séparer la partie pure de `@repo/pages` de sa partie connectée.** `definition-service.ts`
  importe `db` au niveau module et `@repo/db` lève à l'import sans `DATABASE_URL` : la logique pure
  (`assertRegistryCoherent`, `unknownRefTargets`) est soudée à la connexion par le graphe d'imports.
  Modèle déjà appliqué dans `@repo/auth` (`permission.ts` / `permission-cache.ts`). Supprime le
  contournement consigné dans `definition-service.test.ts`.
- [ ] **Faire tomber les réexports fonctionnels de `@echoppe/core`.** Mesuré : l'API compte 61
  imports de `@echoppe/core` contre 29 de `@repo/*`, et 46 usages de symboles vivant dans un `@repo/*`
  y entrent par le barrel du cœur.
- [ ] Conserver le barrel de schéma nécessaire à Drizzle, sans l'utiliser comme raccourci applicatif.
  `drizzle.config.ts` ne lit que `db/schema/index.ts` : c'est son usage comme raccourci d'import qui
  doit tomber, pas son existence.
- [ ] Ajouter une règle empêchant le retour des imports contournant les packages. **C'est ce qui
  transforme le découpage de décor en structure** — sans elle, le reste est cosmétique.
- [ ] Trancher l'injection DB à partir d'un cas concret du vertical slice Prisme.

Ne pas fusionner les petits packages à ce stade. Prisme permettra d'identifier lesquels ont
réellement deux consommateurs.

**Critère de sortie** : une application peut assembler auth, pages, entités, communication et
références sans importer `@echoppe/core`.

## Jalon 3 — Stabiliser le contenu partagé

- [ ] Migrer `richText` de HTML vers Markdown selon ADR-0030.
- [ ] Convertir explicitement et de façon vérifiable les données existantes.
- [ ] Interdire ou neutraliser le HTML brut.
- [ ] Définir un rendu Markdown sûr côté front.
- [ ] Tester les attributs sémantiques, sauts de ligne et caractères échappés.
- [ ] Vérifier l'interaction avec l'interpolation déjà livrée.

Ordre attendu du pipeline :

```text
stockage Markdown
    → interpolation échappée
    → parsing Markdown
    → rendu HTML sûr
```

**Critère de sortie** : une valeur provenant du contenu ou d'une variable interpolée ne peut pas
injecter de HTML exécutable.

## Jalon 4 — Faire naître Prisme par un vertical slice

### 4.1 — `packages/prisme-core`

- [ ] Agréger le schéma partagé sans table commerce.
- [ ] Posséder les migrations Prisme.
- [ ] Composer explicitement les packages partagés.

### 4.2 — `apps/prisme-api`

- [ ] Ajouter bootstrap, configuration et fermeture propre des ressources.
- [ ] Composer l'authentification admin.
- [ ] Exposer identité, médias, pages, sections, entités, références et menus.
- [ ] Utiliser le contrat de faute d'ADR-0050 dès la première route.
- [ ] Produire un contrat HTTP propre à Prisme.

### 4.3 — Fixture config-as-code

- [ ] Déclarer une page.
- [ ] Déclarer une entité liste et une entité singleton.
- [ ] Utiliser un champ image, une référence et une variable interpolée.

### 4.4 — Preuve de bout en bout

- [ ] Démarrer sur une base vierge et appliquer les migrations.
- [ ] Exécuter `content check`, puis `content push`.
- [ ] Écrire du contenu via la surface admin de l'API.
- [ ] Lire ce contenu via la surface publique.

Ne pas commencer par `prisme-admin`. La fixture et l'API doivent révéler la surface réelle dont
l'administration aura besoin.

**Critère de sortie** : Prisme démarre sur une base vide, pousse puis sert du contenu sans importer
une seule brique commerce.

## Jalon 5 — Rendre Prisme V1 utilisable

- [ ] Définir la topologie de déploiement V1 : images, base, migrations, bootstrap et mises à jour.
- [ ] Créer un `prisme-admin` minimal : login, pages, entités, médias, menus, utilisateurs et droits.
- [ ] Créer le client Prisme depuis son contrat OpenAPI.
- [ ] Trancher le scope npm du client.
- [ ] Définir le cycle de production config-as-code : sauvegarde, plan, confirmation destructive,
  concurrence, reprise et compatibilité code/schéma.
- [ ] Documenter le parcours développeur complet.
- [ ] Ajouter les smoke tests fresh, upgrade et idempotence.

**Critère de sortie** : un développeur extérieur au monorepo peut déclarer, pousser, éditer et lire
du contenu sans connaître l'implémentation interne.

## Jalon 6 — Consolider Échoppe avec les garanties éprouvées

- [ ] Tester capture Stripe, échecs, webhooks, stock et idempotence.
- [ ] Tester une boutique externe créée par `create-echoppe`.
- [ ] Compiler en CI les exemples publics du SDK et du package content.
- [ ] Épingler les versions compatibles générées par la CLI.
- [ ] Ajouter logger structuré, corrélation de requête et fermeture propre des ressources.
- [ ] Reprendre catalogue, checkout invité et expérience storefront selon la priorité produit.

## Explicitement hors de cette séquence

Ces sujets ne sécurisent pas le système et ne prouvent pas la frontière entre les produits. Ils
restent dans leurs backlogs, sans entrer dans cette roadmap courte :

- `prisme-store` et rendu générique V2 ;
- presets et activation V2 ;
- thèmes et GUI de conception d'entités ;
- i18n généralisée ;
- interpolation avancée ;
- type-gen du DSL ;
- migration Bun vers Node/pnpm ;
- fusion des petits packages ;
- refactors purement esthétiques ;
- OAuth providers et intégrations tierces.

## Séquence synthétique

```text
ADR-0050 en cours
        ↓
Sécurité courte et exposée
        ↓
Composition réelle des packages
        ↓
Markdown sécurisé
        ↓
prisme-core + prisme-api
        ↓
Fixture et smoke Prisme
        ↓
prisme-admin + client + déploiement V1
        ↓
Consolidation production Échoppe
        ↓
V2 Prisme
```

---

> **Document temporaire.** Ce fichier a vocation à disparaître au profit des véritables roadmaps et
> backlogs actionnables par produit. Il n'est qu'un artefact de pilotage à court terme destiné à
> ordonner la transition entre l'état actuel du dépôt et ces sources de vérité durables.
