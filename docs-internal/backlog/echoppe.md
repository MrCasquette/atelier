# Backlog — Échoppe

Travail propre au framework e-commerce. Les briques communes et le CMS Prisme ont leurs
[backlogs dédiés](../../BACKLOG.md).

## Finition V1

### Catalogue storefront

- [ ] 🟠 **Facettes catalogue** : fourchette de prix, `inStock`, puis facettes par option →
  [détail](../design/facettes-catalogue.md).
- [ ] 🟡 **Signal low-stock public** : exposer `isLowStock`, jamais le seuil →
  [détail](../design/signal-low-stock.md), [ADR-0006](../adr/ADR-0006-visibilite-catalogue.md).

### Compte et checkout

Détail : [audit compte/checkout](../audits/audit-compte-checkout.md).

- [ ] 🔴 **Checkout invité** : trancher puis implémenter l'achat sans compte.
- [ ] 🟠 **RGPD self-service** : export et protocole de suppression avec rétention légale.
- [ ] 🟡 **Double opt-in** à l'inscription.
- [ ] ⚪ **Suivi de commande invité**, dépendant du checkout invité.

### Sécurité et durcissement

Détail : [audit sécurité](../audits/security-audit.md).

- [ ] 🔴 **Rate-limit fail-open sans Redis et IP de confiance** : choisir fallback mémoire ou
  démarrage refusé sans backend ; définir la politique de proxy de confiance.
- Timing du login → consolidé dans le [backlog socle](./shared.md) § Sécurité, avec l'oracle
  explicite du même code : `authenticate` vit dans `@repo/auth`, et les deux se corrigent ensemble.
- [ ] 🟠 **Upload média** : whitelist MIME/extension, taille maximale, nom serveur et
  `Content-Disposition` sûr.
- [ ] 🟠 **Hasher les tokens de session** stockés en base.
- [ ] 🟠 **Rate limiting des webhooks** Stripe et PayPal.
- [x] 🟡 **Handler d'erreur global et contrat 5xx commun** →
  `apps/echoppe-api/src/error-handler.ts`, point de conversion garanti d'[ADR-0050](../adr/ADR-0050-exception-jamais-reponse-http.md).
  Il ne traite que l'exception non rattrapée : le détail part au log avec un identifiant de
  corrélation, la réponse ne porte que celui-ci. Validation, route inconnue et corps illisible
  restent à Elysia — aucun message d'exception n'y transite. La journalisation reste à structurer
  (cf. logger ci-dessous).
- [x] 🟡 **Reset de mot de passe admin** : câbler le flux jeton déjà disponible. → ADR-0048, même
  jeton que l'invitation — inviter et débloquer sont le même acte.

### RBAC et observabilité

- [x] 🟠 **Achever ADR-0047** : prédicat `Authority/holds`, Administrateur par soustraction et
  protection des utilisateurs de premier rang. → plus la propriété en drapeau et son transfert.
- [x] 🟡 **Borner `GET /roles/resources`** à ce que le demandeur peut déléguer, sans empêcher la
  révocation d'un droit existant. → `delegatableActions`, miroir d'`undelegatableGrants`.
- [ ] 🟡 **Livrer l'écran « Clés d'API »** : lister les clés propres au principal, créer avec des
  scopes bornés, révéler le secret une fois et révoquer.
- [ ] 🟡 **Nettoyer la matrice RBAC par surface** : ressources admin/public, gardes PATCH explicites →
  [audit RBAC](../audits/audit-rbac-plan.md).

### Stock et paiement

Détail : [ADR-0005](../adr/ADR-0005-panier-stock.md).

- [ ] 🔴 **Prérequis production** : tester capture manuelle, échecs et idempotence avec Stripe en
  mode test. Vérifier qu'une autorisation ne reste jamais indéfiniment non capturée.
- [ ] 🟠 **Page de retour checkout pilotée par le statut réel** de la commande.
- [ ] 🟡 **SEPA/BNPL** : n'activer que les moyens compatibles avec la stratégie de capture.
- [ ] ⚪ Retirer éventuellement l'enum inutilisé `stockMove: 'reservation'`.

### Qualité et exploitation

- [ ] 🟠 Extraire `enrichProductsWithMediaAndVariants()`.
- [ ] 🟡 Centraliser `productListSchema` et `defaultVariantSchema`.
- [ ] 🟡 Ajouter un logger structuré et une corrélation de requête.
- [ ] 🟡 Fermer proprement PostgreSQL, Redis et les jobs au shutdown.
- [ ] 🟡 Refactors ciblés : génération de facture et réordonnancement des variantes.
- [ ] 🟡 Uniformiser les messages d'erreur de l'API → **c'est la migration
  d'[ADR-0050](../adr/ADR-0050-exception-jamais-reponse-http.md)**, qui en fixe la forme : union
  discriminée plate sur `code`, rendue par chaque surface. 214 réponses, 80 messages distincts,
  19 codes retenus. Deux amorces existent déjà — le helper `notFound()` employé 11 fois sur 89, et
  `errorSchema` déprécié mais employé 51 fois — à absorber, pas à corriger d'abord. **Migration en
  cours, par tranche verticale** (cf. [ROADMAP](../../ROADMAP.md) jalon 0) :
  - [x] Le contrat et ses constructeurs, fermés en entrée **et en sortie** →
    `packages/shared/src/fault.ts`, `packages/echoppe-core/src/constants/fault.ts`.
  - [x] Le schéma de frontière, spécialisé par produit et verrouillé au type par trois gardes de
    compilation → `apps/echoppe-api/src/lib/fault-schema.ts`. Modèle nommé `ErrorResponse`, donc un
    `$ref` unique : le contrat coûte +1 607 lignes une fois, pas par route.
  - [x] Première tranche : les 26 réponses de `catalog/product` et leur lecture côté administration
    (`apps/echoppe-admin/src/lib/fault.ts`).
  - [x] Les **40 réponses 401/403**, en une seule tranche — le schéma d'un statut vient des helpers
    partagés, donc rien ne se découpait. `unauthorizedResponse` / `forbiddenResponse` retirés,
    trois codes ajoutés (`undelegatable_grants`, `rank_reserved`, `self_only`), `owner_only`
    absorbé, et la prose française sortie de `undelegatableGrants` (`@repo/auth`).
  - [x] Les **82 réponses 404** → `not_found(resource)`. Une seule tranche : un seul code, aucun
    arbitrage métier. Corrige au passage 5 messages restés en anglais et trois orthographes
    concurrentes. Les deux jeux de helpers fusionnent — `withCrudFaults` / `withNotFoundFault`
    disparaissent, ils n'existaient que pour la coexistence.
  - [x] **23 des 44 réponses 400**, celles dont la garde détermine déjà le code et dont la route ne
    contient aucun cas ouvert. Statuts HTTP inchangés : tranche strictement contractuelle.
  - [x] **Les 4 cas ouverts tranchés**, plus les 9 réponses que leurs routes bloquaient. Deux codes
    ajoutés après vérification qu'aucun concept plus général n'existait dans le dépôt :
    `redirect_url_rejected` (garde unique de son genre, quatre prédicats fusionnés contre un oracle
    de configuration) et `personalization_rejected` (triplet inconnu/requis/trop long, présent une
    seule fois — `@repo/fields` valide par TypeBox compilé, pas par ce triplet). Le provider requis
    retombe sur `required_data_missing`.
  - [x] **Les 3 chemins mal exposés corrigés.** `checkout` relance après rollback au lieu de
    promouvoir `error.message` **à l'acheteur** — la violation qu'ADR-0050 nommait « la plus grave
    du lot » depuis sa rédaction. `payment` lève sur un paiement `completed` sans
    `providerTransactionId` : un état impossible n'est pas une faute client. `shipping` remonte
    l'exigence de `provider` au schéma, ce qui supprime la garde **et** le cast `as`.
  - [x] **Les 7 dernières réponses de `POST /checkout`**, débloquées en rendant `variant`
    OBLIGATOIRE dans `insufficient_stock` plutôt qu'en ajoutant un second champ facultatif : les
    quatre gardes qui émettent cette faute ont toutes l'identifiant sous la main, et deux servent un
    appelant qui ne peut pas le déduire de sa requête. `rank_reserved.grants` reste donc le seul
    opérande facultatif du contrat.
  - [x] **Les 9 réponses 409.** Six retombaient sans discussion sur `already_exists` et `in_use` ;
    trois cachaient autre chose. `asConflict` (`@repo/entities`) fusionnait deux causes de `23505`
    faute de les distinguer — le discriminant retenu est la CARDINALITÉ DÉCLARÉE, pas le nom de
    contrainte généré par Postgres, puisque `slug` et `singleton` sont des colonnes mutuellement
    exclusives. D'où `cardinality_exceeded`. Le push destructif reçoit `destructive_plan`, dont les
    trois `kind` sont dérivés des seuls sites destructifs du planificateur ; `PlanStep.destructive`
    (booléen) devient `destroys?: { kind, target }` pour n'avoir qu'une source de vérité.

  **RESTE À FAIRE — 13 réponses, dans cet ordre :**

  - [ ] **Les 9 × 422** — la seule famille qui demande une analyse AVANT migration, pour deux
    raisons distinctes :
    - `validation_failed.details` est un `string[]` qui transporte des **chaînes TypeBox anglaises**
      (`validateSectionData`, `@repo/entities/write-service`). Les structurer toucherait un code
      déjà utilisé ailleurs — décider si `details` change de forme ou si un code distinct naît.
    - `packages/pages/src/definition-service.ts:164` promeut encore `error.message` en
      `{ outcome: 'incoherent' }` → 422 → toast. C'est le **chemin n°1** du tableau des violations
      d'ADR-0050, jamais corrigé. Correction de fond, pas migration.
    - Sites : `api-key:88`, `page/admin:138`, `entity/admin` ×4, `entity/index:83`, `menu/admin:116`.
  - [ ] **Les 3 × 503/500** — services externes. Petite tranche, à faire après les 422.
  - [ ] **1 × 400, le webhook** (`payment:374`) : déjà conforme (détail au log, réponse générique),
    en anglais parce que son destinataire est une machine. Ne migrera probablement pas — à trancher
    avec le chantier des statuts.
  - [ ] **Retirer le champ `message` déprécié**, une fois qu'aucune surface ne le lit plus. Vérifier
    les 8 vues de l'administration, puis supprimer le champ, `lib/fault-message.ts` et le repli
    d'`apiError`.
  - [ ] **Chantier SÉPARÉ, après la migration : les ~32 requalifications de statut HTTP.** Elles
    changent le comportement observable des clients, donc jamais mêlées aux corps. Recensées lors du
    classement des 400 : `configuration_missing` → 503 (13 sites), `invalid_state` /
    `already_exists` / `in_use` → 409 (10), `insufficient_stock` → 409 (4), `not_found` déguisé en
    400 → 404 (6). Un cas est déjà résolu au passage : `shipping` rend 422 depuis que son schéma
    exige `provider`.

  **Règles de découpage acquises**, à ne pas réapprendre :
  - L'unité migrable est la **route**, pas la réponse : une route n'a qu'un schéma par statut, donc
    elle bascule entière ou pas du tout.
  - Toujours classer **par la garde qui produit le refus**, jamais par la formulation actuelle.
  - Un opérande facultatif n'est admis que si la surface ne peut pas le reconstruire depuis sa
    propre requête (ADR-0050 §5). `rank_reserved.grants` est le seul du contrat.
  - Avant de créer un code, vérifier qu'aucun concept plus général n'existe déjà dans le dépôt ; et
    ne pas réserver un nom général à un seul domaine.

- [ ] 🟡 Inférer `Invoice` depuis le contrat dans l'admin.

### Documentation et expérience

- [ ] 🟠 Guides providers : paiements, livraison et e-mail.
- [ ] 🟠 Guide de déploiement production, sauvegardes et troubleshooting.
- [ ] 🟡 Documentation SDK avec exemples compilés en CI et captures de l'admin.
- [ ] 🟡 Loading states, toasts, alignements et responsive mobile.

## Après V1

### Distribution et validation réelle

- [ ] Créer et tester une vraie boutique Astro hors monorepo via `create-echoppe`, dont le cas x86.
- [ ] Épingler des versions compatibles dans le scaffold au lieu de dépendre implicitement de
  `latest`.
- [ ] Instruire une éventuelle migration Bun vers pnpm/Node sans la coupler aux autres chantiers.

### Administration et tests

- [ ] Exposer par vagues les contreparties admin manquantes des fonctions storefront.
- [ ] Couvrir checkout, paiements, stock, webhooks et parcours client E2E.
- [ ] Tester la compilation des exemples publics et du template `create-echoppe`.

### Capacités commerce ultérieures

- [ ] Onboarding OAuth des providers et création automatique des webhooks.
- [ ] Thèmes, personnalisation et aperçu du storefront Échoppe.
- [ ] Re-porter vers Astro les parcours riches du storefront historique encore pertinents.
- [ ] Import/export CSV produits, commandes et clients.
- [ ] Webhooks sortants et intégrations Zapier/n8n/Make.
- [ ] Protocole RGPD complet : consentement, export, archivage légal et anonymisation.
- [ ] Analytics privacy-first.
- [ ] Multi-langue, SEO avancé, mode caisse, PWA et éventuel installeur desktop.

## Publication

Avant tout bump : migration committée, SDK régénéré, smoke fresh/upgrade vert et versions alignées.
Voir [pipeline de publication](../release/pipeline-release.md).
