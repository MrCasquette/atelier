# Roadmap

Échoppe est un **framework e-commerce headless** pensé pour le marché français : une
API et un admin clés en main, un SDK typé, et un front que **vous** possédez. Cette
page donne le cap du projet — pas des dates fermes, mais une direction :
**Maintenant / Ensuite / Plus tard**.

> La roadmap suit les besoins réels des boutiques en production.

## ✅ Disponible aujourd'hui

Le socle tourne en production (`0.2.x`) :

- **API e-commerce complète** — catalogue (produits, variantes, options, médias),
  catégories, collections, panier, checkout, commandes, stock, TVA FR, clients & RBAC.
- **Admin** — dashboard de gestion (produits, commandes, médiathèque, paramètres…).
- **Paiement & livraison** — adapters Stripe / PayPal, Colissimo / Mondial Relay /
  Sendcloud, factures PDF.
- **Espace client** — inscription, connexion, profil, commandes, adresses, reset de
  mot de passe.
- **SDK typé `@axiome-apps/echoppe-client`** — généré depuis l'OpenAPI, façade namespacée.
- **Distribution** — images Docker multi-arch (API + Admin) + CLI `npm create echoppe`
  qui scaffolde un front Astro connecté.

## 🔨 Maintenant

- **Module contenu / page builder headless** — le dev déclare ses blocs (sections et
  composants réutilisables) en *config-as-code* avec `@axiome-apps/atelier-content` ; Échoppe stocke,
  valide et sert la donnée, le rendu reste le vôtre. *(Déclaration, validation, synchronisation
  CLI et typage du front par inférence livrés ; formulaires d'édition dans l'admin et menus à
  venir.)*
- **Clés d'API machine** — authentification par jeton scopé (lecture/écriture par
  ressource) pour la CLI et les intégrations, sans exposer les identifiants humains.
- **Première vraie boutique via la CLI** — validation grandeur nature du scaffolding.
- **Cette roadmap publique.**
- **Erreurs API structurées** — chaque refus de l'API porte un **code stable** et ses données
  (`not_found` + la ressource, `insufficient_stock` + les quantités…) plutôt qu'une phrase toute
  faite. Votre front choisit ses propres messages, dans sa langue, et peut réagir au code sans
  analyser du texte. *(Contrat arrêté et posé ; conversion des routes en cours — le champ `message`
  actuel reste rempli pendant toute la transition.)*

## ⏭️ Ensuite

- **Thèmes & personnalisation du store** — 2-3 thèmes de base, sélection et preview.
- **Onboarding fournisseurs simplifié** — connexion Stripe / PayPal en OAuth (fini le
  copier-coller de clés API).
- **Tests** — couverture des parcours critiques (checkout, paiement, stock) + e2e.
- **RGPD** — protocole de suppression de compte (archivage légal vs suppression),
  export des données client, bannière cookies.
- **Admin ↔ features storefront** — exposer côté admin les capacités qui le justifient.

## 🔭 Plus tard

- **Éditeur de pages visuel** dans l'admin (drag & drop), au-dessus du module contenu.
- **Optimisation d'images** — redimensionnement à la volée + formats modernes, avec un
  composant `Image` prêt à l'emploi.
- **Installeur desktop (Tauri)** — lancer Échoppe en local sans toucher au terminal.
- **Import / export CSV** — produits, commandes, clients.
- **Intégrations** — webhooks sortants, templates Zapier / n8n / Make.
- **Analytics privacy-first** — CA, conversions, top produits, sans Google Analytics.
- **Messages d'erreur personnalisables** depuis l'admin — réécrire ce que voit un client sans
  toucher au code, au-dessus des codes d'erreur stables.
- **Multi-langue**, **SEO avancé** (sitemap, JSON-LD), **mode caisse**, **PWA store**.

---

*Roadmap indicative, susceptible d'évoluer. Le socle e-commerce (V1) est livré ; la
suite construit l'expérience « boutique clé en main » autour.*
