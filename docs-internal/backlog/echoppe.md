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
- [ ] 🟠 **Timing du login** : vérification factice lorsqu'un utilisateur est introuvable.
- [ ] 🟠 **Upload média** : whitelist MIME/extension, taille maximale, nom serveur et
  `Content-Disposition` sûr.
- [ ] 🟠 **Hasher les tokens de session** stockés en base.
- [ ] 🟠 **Rate limiting des webhooks** Stripe et PayPal.
- [ ] 🟡 **Handler d'erreur global et contrat 5xx commun** : message générique en production,
  journalisation structurée et types SDK honnêtes.
- [ ] 🟡 **Reset de mot de passe admin** : câbler le flux jeton déjà disponible.

### RBAC et observabilité

- [ ] 🟠 **Achever ADR-0047** : prédicat `Authority/holds`, Administrateur par soustraction et
  protection des utilisateurs de premier rang.
- [ ] 🟡 **Borner `GET /roles/resources`** à ce que le demandeur peut déléguer, sans empêcher la
  révocation d'un droit existant.
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
- [ ] 🟡 Uniformiser les messages d'erreur de l'API.
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
