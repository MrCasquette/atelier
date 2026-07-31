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
- **SDK typé `@echoppe/client`** — généré depuis l'OpenAPI, façade namespacée.
- **Distribution** — images Docker multi-arch (API + Admin) + CLI `npm create echoppe`
  qui scaffolde un front Astro connecté.

## 🔨 Maintenant

- **Module contenu / page builder headless** — le dev déclare ses blocs (sections et
  composants réutilisables) en *config-as-code* avec `@echoppe/content` ; Échoppe stocke,
  valide et sert la donnée, le rendu reste le vôtre. *(Déclaration, validation, synchronisation
  CLI et typage du front par inférence livrés ; formulaires d'édition dans l'admin et menus à
  venir.)*
- **Clés d'API machine** — authentification par jeton scopé (lecture/écriture par
  ressource) pour la CLI et les intégrations, sans exposer les identifiants humains.
- **Première vraie boutique via la CLI** — validation grandeur nature du scaffolding.
- **Cette roadmap publique.**

## ⏭️ Ensuite

- **Thèmes & personnalisation du store** — 2-3 thèmes de base, sélection et preview.
- **Onboarding fournisseurs simplifié** — connexion Stripe / PayPal en OAuth (fini le
  copier-coller de clés API).
- **Tests** — couverture des parcours critiques (checkout, paiement, stock) + e2e.
- **RGPD** — protocole de suppression de compte (archivage légal vs suppression),
  export des données client, bannière cookies.
- **Admin ↔ features storefront** — exposer côté admin les capacités qui le justifient.
- **Erreurs API structurées** — codes + messages clairs, exploitables côté client.

## 🔭 Plus tard

- **Éditeur de pages visuel** dans l'admin (drag & drop), au-dessus du module contenu.
- **Optimisation d'images** — redimensionnement à la volée + formats modernes, avec un
  composant `Image` prêt à l'emploi.
- **Installeur desktop (Tauri)** — lancer Échoppe en local sans toucher au terminal.
- **Import / export CSV** — produits, commandes, clients.
- **Intégrations** — webhooks sortants, templates Zapier / n8n / Make.
- **Analytics privacy-first** — CA, conversions, top produits, sans Google Analytics.
- **Multi-langue**, **SEO avancé** (sitemap, JSON-LD), **mode caisse**, **PWA store**.

---

*Roadmap indicative, susceptible d'évoluer. Le socle e-commerce (V1) est livré ; la
suite construit l'expérience « boutique clé en main » autour.*
