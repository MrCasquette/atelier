# Backlog — Échoppe

Backlog **interne, activable**, point d'entrée unique du travail ouvert (remplace l'ancien `TODO.md`).
Une ligne = une tâche à cocher ; le **détail** vit dans un doc dédié (ADR, audit, note de design sous
`docs-internal/`) que la ligne pointe. Ce fichier porte l'**état**, pas le contenu.

- **Roadmap publique** ≠ ce backlog → [`docs/roadmap.md`](docs/roadmap.md) (à retravailler post-V1).
- **Décisions structurantes** → [ADR](docs-internal/adr/README.md). L'**historique du fait** = git +
  CHANGELOG + ADR (on ne tient pas de journal parallèle).
- **Publication** → [pipeline-release.md](docs-internal/release/pipeline-release.md).

Légende : `[ ]` ouvert · 🔴 fort impact · 🟠 moyen · 🟡 faible / durcissement · ⚪ dépendant.

---

## Ouvert — finition V1

### Catalogue storefront
- [ ] 🟠 **Facettes catalogue** (endpoints scopés) → [détail](docs-internal/design/facettes-catalogue.md)
      — tri livré (B4) ; reste fourchette prix + `inStock`, puis facettes par option.
- [ ] 🟡 **Signal low-stock public** (B10) → [détail](docs-internal/design/signal-low-stock.md)
      — booléen `isLowStock`, jamais le seuil ([ADR-0006](docs-internal/adr/ADR-0006-visibilite-catalogue.md)).
      *(≠ des alertes seuil bas **admin**, déjà livrées.)*

### Compte & checkout — détail : [audit-compte-checkout.md](docs-internal/audits/audit-compte-checkout.md)
- [ ] 🔴 **Checkout invité (guest)** — `POST /checkout` exige un compte ; décision produit à trancher.
- [ ] 🟠 **RGPD self-service** — export + suppression. ⚠️ La suppression est un **protocole**, pas un
      bouton delete (rétention légale) → voir « RGPD (protocole complet) » en V2.
- [ ] 🟡 **Double opt-in** à l'inscription (vérification email).
- [ ] ⚪ **Suivi de commande invité** (lookup n° + email) — dépend du checkout invité.

### Sécurité / durcissement — détail : [security-audit.md](docs-internal/audits/security-audit.md)
- [ ] 🔴 **Rate-limit fail-open sans Redis** + IP de confiance (X-Forwarded-For spoofable).
      ⚠️ *Deux remèdes à trancher* : **fallback in-memory** (rester protégé) vs **fail-closed + warning
      bruyant au boot** (refuser de démarrer sans backend).
- [ ] 🟠 **Timing login** — verify factice sur user introuvable (anti-énumération).
- [ ] 🟠 **Whitelist upload média** (MIME/extension + cap taille) + `Content-Disposition: attachment`.
- [ ] 🟠 **Hasher les tokens de session** (en clair aujourd'hui, incohérent avec clés API / reset).
- [ ] 🟠 **Rate limiting sur webhooks** Stripe/PayPal.
- [ ] 🟡 **`onError` global** (message générique en prod) + sanitize extension upload + hardening divers.
- [ ] 🟡 **Reset mot de passe oublié côté ADMIN** — `sendResetPasswordEmail` prête ; câbler le flux jeton
      pour les users admin (`auth.ts`). Même angle mort que le client, résolu côté client en 2026-07.

### RBAC & observabilité
- [ ] 🟡 **Nettoyage matrice RBAC par scope** — séparer ressources admin vs store (`cart`/`wishlist`/
      `address` en store `selfOnly`), guards PATCH explicites →
      [détail](docs-internal/audits/audit-rbac-plan.md) (partie 3). *(Le **journal d'audit** est livré.)*

### Refactoring / qualité
- [ ] 🟠 **Extraire `enrichProductsWithMediaAndVariants()`** (dupliqué categories/collections/products).
- [ ] 🟡 **Centraliser `productListSchema` + `defaultVariantSchema`** (`schemas/product.ts`).
- [ ] 🟡 **Logger structuré (pino)** — remplacer ~17 `console.log/error` (v1-optionnel).
- [ ] 🟡 **Refactors ciblés** : `GET …/invoices/:id/pdf` (77 l), `handleVariantReorder` (43 l).
- [ ] 🟡 **Uniformiser les messages d'erreur** API (français vs anglais).
- [ ] 🟡 **Inférer `Invoice` depuis Eden** dans `OrderDetailView.vue` (pas d'interface manuelle).

### Stock & paiement (reste) — détail : [ADR-0005](docs-internal/adr/ADR-0005-panier-stock.md)
- [ ] 🔴 ⚠️ **Prérequis prod** : tester le flux capture manuelle en mode test Stripe (`stripe listen` +
      `stripe trigger`). Sans capture au webhook, un paiement resterait autorisé sans être débité.
- [ ] 🟠 **Page retour `success_url` pilotée par le statut réel** de la commande (succès vs « rupture,
      non débité ») — **côté front store**.
- [ ] 🟡 Si ajout **SEPA / BNPL** : n'activer que les moyens compatibles capture manuelle, ou fallback
      capture immédiate + refund.
- [ ] ⚪ (optionnel) Retirer l'enum `stockMove: 'reservation'` (inoffensif ; retrait = migration enum PG).

### Documentation
- [ ] 🟠 **Guides providers** : Stripe, PayPal, Colissimo, Mondial Relay, Sendcloud, email (Resend/Brevo/SMTP).
- [ ] 🟠 **Guide déploiement prod** (reverse proxy Nginx/Caddy, SSL, backups) + **FAQ/troubleshooting**.
- [ ] 🟡 **Doc SDK** (installation, usage, exemples) + **screenshots** admin & parcours client.

### UI/UX
- [ ] 🟡 Feedbacks visuels (loading states, toasts) — *toasts partiellement faits (audit lot 2 #1)*.
- [ ] 🟡 Espacements/alignements dashboard admin · **Responsive mobile** du store.

### Architecture interne
- [ ] 🟡 **Refactor `domain/<concept>/` dans `core`** (slicing vertical, différé) →
      [conventions.md § core](docs-internal/reference/conventions.md). Déclencheur = 2ᵉ consommateur. **ADR avant exécution.**

---

## Plus tard — V2 (vision, non planifié ; sera reventilé dans `roadmap.md` post-V1)

### Module contenu — page-builder headless (reste) → [ADR-0012](docs-internal/adr/ADR-0012-module-contenu.md) · [content-module.md](docs-internal/reference/content-module.md)
> Pages en **sections** déclarées config-as-code (`@mrcasquette/content`). Boucle end-to-end validée.
- [ ] **P2c** type-gen (CLI lit `defineContent` → types TS des sections/components pour le front).
- [ ] **P3** générateur de formulaires admin depuis le registre (widgets par type) — gros morceau UX.
- [ ] **Page admin « Clés d'API »** (lister selfOnly, créer avec scopes hiérarchiques, révéler une fois, révoquer).
- [ ] **P4** menus imbriqués, entités hors « page », champs custom (bridge code→admin), `file`/`asset`, i18n enum.
- [ ] Durcissement API-key (interdire aux principals `apikey` la gestion des clés) · **portabilité DB** (le
      `jsonb` couple à Postgres) · publier `@mrcasquette/content` sur npm quand P2c prêt.

### Système de contenu léger (entités extensibles) → [design](docs-internal/design/systeme-contenu-leger.md)
> **Distinct** du page-builder : un CMS **type Directus allégé** pour créer des **entités diverses**
> (singleton/liste) et laisser le dev **étendre les fonctionnalités**. Absorbe B9 (prose) + B11 (onglets
> produit). **ADR requis** ; décision format HTML vs Markdown à trancher.
- [ ] ⚠️ **Trancher le format du texte riche : HTML sanitisé vs Markdown** (= le cœur de B9) — du
      contenu est **déjà en HTML**, donc Markdown impose une **migration/homogénéisation** de l'existant.
      **Bloque toute impl prose.**
- [ ] Concevoir + acter l'ADR du système (modèle d'entités, édition admin, surface storefront).

### Distribution & repo → [distribution-architecture.md](docs-internal/reference/distribution-architecture.md) · [ADR-0002](docs-internal/adr/ADR-0002-distribution.md)
- [ ] Créer/tester une **vraie boutique** (repo Astro hors monorepo) via la CLI — reste le test x86.
- [ ] **Migration Bun → pnpm/Node** — en exploration (différée, cf. mémoire runtime-pm).

### Admin — brancher les pendants des features storefront
- [ ] Passer en revue les features storefront récentes et exposer leur contrepartie admin (hors front-only), par vagues.

### Tests
- [ ] Unitaires services critiques (checkout/payments/stock) · e2e Playwright (parcours client) ·
      endpoints API critiques · webhooks Stripe CLI + mocks PayPal.

### Onboarding providers (OAuth, moins de clés manuelles)
- [ ] **Stripe Connect** (OAuth 1-clic) · **PayPal Commerce Platform** (Partner Referrals) · webhook auto
      à la connexion · explorer OAuth shipping (Colissimo/Mondial Relay/Sendcloud).

### Store — thèmes & personnalisation
- [ ] Système de thèmes (structure, variables CSS, assets) + 2-3 thèmes + sélecteur/preview admin.
- [ ] Éditeur **drag & drop** (blocs réutilisables, pages perso, responsive preview).
- [ ] **Re-porter les features riches** du store Next→Astro (checkout, espace client, filtres, recherche).

### Export / Import
- [ ] CSV produits (export + import avec mapping) · CSV commandes · CSV clients (RGPD).

### Intégrations
- [ ] Webhooks sortants · templates Zapier/n8n/Make · API publique documentée pour tiers.

### RGPD (protocole complet — pas un bouton delete)
> Une boutique doit **conserver/tracer** certains documents légaux (transactions, factures). La
> suppression est un **protocole**, pas une opération directe.
- [ ] Bannière cookies (consentement granulaire) · CGU/CGV personnalisables admin · export données (art. 20).
- [ ] Suppression : **demande** via formulaire (pas de route directe) → distinguer données **à conserver**
      (légal) vs **à supprimer** → **archivage légal** (statut `archived` + anonymisation des champs non requis).

### Analytics (privacy-first, sans GA)
- [ ] Dashboard stats (CA, commandes, panier moyen) · top produits/catégories · taux conversion · events tracking.

### Autres
- [ ] Multi-langue (i18n admin + store) · SEO avancé (sitemap, meta, JSON-LD) · mode caisse simplifié ·
      PWA store · **installeur desktop Tauri** (lancer Échoppe en local sans terminal).

---

## Livré (repères)

Le socle V1 tourne (API catalogue/panier/checkout/commandes/stock/TVA FR/RBAC, admin, SDK, adapters
paiement/livraison, factures PDF, distribution Docker+CLI, module contenu bouclé). **Détail = ADR +
CHANGELOG + git**, pas de journal ici. Jalons storefront récents (verrouillés par test) :

| Lot | Contenu | Détail |
|-----|---------|--------|
| A1–A3, B1 | Variante par défaut (exclusivité, fallback publié) + `featuredImage` | [ADR-0009](docs-internal/adr/ADR-0009-variante-defaut-image.md) |
| B2 | Personnalisation produit (champs, addon prix) | [ADR-0010](docs-internal/adr/ADR-0010-personnalisation-produit.md) |
| B3 | Tags produit storefront | [ADR-0019](docs-internal/adr/ADR-0019-tags-produit.md) |
| B4 | Tri sur endpoints scopés | — |
| B5 | Stratégie images : pas de resize serveur, dimensions exposées (`imageRef`) | [ADR-0021](docs-internal/adr/ADR-0021-strategie-images.md) |
| B7 | Wishlist | — |
| B8 | Produits liés (curation + fallback) | [ADR-0022](docs-internal/adr/ADR-0022-produits-lies.md) |
| Options | Options typées & swatches (oklch) | [ADR-0020](docs-internal/adr/ADR-0020-colormetadata-double-representation.md) |
| Sécu/stock | Rate-limit, capture manuelle Stripe + garde atomique, idempotence webhook | [ADR-0005](docs-internal/adr/ADR-0005-panier-stock.md) |
| Audits | Lot A + lot 2 (#1–#7) | — |

## Rappel publication

Avant tout bump : migration committée (pas `push`), SDK régénéré (`bun run contracts`), smoke
fresh+upgrade verts (gate T2–T5), versions alignées. Détail : [pipeline-release.md](docs-internal/release/pipeline-release.md).
