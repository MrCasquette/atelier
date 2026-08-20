# Backlog — Échoppe

Travail propre au framework e-commerce, **cible V1**. Les briques communes et le CMS Prisme ont
leurs [backlogs dédiés](../../BACKLOG.md) ; ce qui vient après la V1 vit dans la
[roadmap Échoppe](../roadmap/echoppe.md).

## Finition V1

### Catalogue storefront

- [ ] 🟠 **Facettes catalogue** : fourchette de prix, `inStock`, puis facettes par option →
  [détail](../backlog/facettes-catalogue.md).
- [ ] 🟡 **Signal low-stock public** : exposer `isLowStock`, jamais le seuil →
  [détail](../backlog/signal-low-stock.md), [ADR-0006](../adr/ADR-0006-visibilite-catalogue.md).

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

### RBAC et observabilité

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
- [ ] 🔴 **Requalifier ~32 statuts HTTP — dernière rupture connue du contrat HTTP, donc frontière
  de `1.0.0` ([ADR-0023](../adr/ADR-0023-versioning-tags.md), amendement).** Chantier SÉPARÉ, qui n'a jamais fait partie
  d'[ADR-0050](../adr/ADR-0050-exception-jamais-reponse-http.md) — celle-ci a fixé la forme des
  CORPS, celui-ci change le comportement observable des clients, donc jamais mêlé au précédent.
  Recensé lors du classement des 400 : `configuration_missing` → 503 (13 sites), `invalid_state` /
  `already_exists` / `in_use` → 409 (10), `insufficient_stock` → 409 (4), `not_found` déguisé en
  400 → 404 (6). Trois cas sont déjà résolus au passage : `shipping` rend 422 depuis que son schéma
  exige `provider`, la validation de RÉPONSE d'Elysia rend 500 au lieu de 422, et le webhook rend
  500 sur une panne au lieu de 400.
- [ ] 🟡 **`undelegatable_grants` porte deux granularités** : `not_held` nomme `ressource:action`,
  `rank_bound` nomme la ressource seule. Les deux sont exacts, mais un consommateur qui découpe sur
  `:` obtient deux formes. À trancher si le besoin apparaît — ce n'est pas une fuite.
- [ ] 🟡 Inférer `Invoice` depuis le contrat dans l'admin.

### Documentation et expérience

- [ ] 🟠 Guides providers : paiements, livraison et e-mail.
- [ ] 🟠 Guide de déploiement production, sauvegardes et troubleshooting.
- [ ] 🟡 Documentation SDK avec exemples compilés en CI et captures de l'admin.
- [ ] 🟡 Loading states, toasts, alignements et responsive mobile.

## Publication

Avant tout bump : migration committée, SDK régénéré, smoke fresh/upgrade vert et versions alignées.
Voir [pipeline de publication](../runbook/pipeline-release.md).
