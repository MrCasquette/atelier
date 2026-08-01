# ADR-0001 — Stack storefront : Astro hybrid + îlots Vue (topologie B)

Statut : accepté · 2026-07-05
Portée : échoppe

## Contexte

Le front e-commerce d'une boutique construite sur Échoppe n'est **pas** partie du framework (qui =
API Elysia + dashboard Vue) : c'est ce que le dev livre par-dessus, via l'API. Profil réel visé =
boutique PME/artisan (démontré par la vraie boutique Shopify Liquid `dpc`) : contenu rendu serveur +
îlots d'interactivité discrets (variant-picker, cart-drawer, search, wishlist) + checkout externalisé
(Stripe hosted / Payment Element). Exigence forte SEO / perf / a11y (Lighthouse + axe en CI).

## Options envisagées

- **Next.js** — RSC + server-first, mais poids et config monolithique surdimensionnés pour une PME.
- **Nuxt** — bon si la boutique était *app-like* (configurateur, dashboard client, temps réel), non
  représentatif du profil PME.
- **Astro hybrid + îlots Vue** — « serveur par défaut, client opt-in » sans le poids de Next, Vue
  préservé pour design/animation via les îlots.

## Décision

**Astro 5 en mode hybrid** (adapter **Bun** côté exemple, Node en prod cf. ADR-0003), îlots
interactifs **Vue**, **topologie B** (un runtime serveur front = BFF + server islands) :
- statique cache-able par route (`prerender`), server islands (`server:defer`) et endpoints BFF au
  besoin, îlots Vue (`client:load/visible/idle`) ;
- sessions via cookie HTTP-only émis par l'API Elysia, lu côté serveur (middleware → `Astro.locals`).

`apps/store` = exemple Astro dogfooding le SDK `@echoppe/client` (cf. ADR-0002/0007).

## Conséquences

- Ce que Shopify déléguait se re-matérialise dans **l'API Elysia + Stripe**, pas dans le front :
  idempotence webhooks, survente/inventaire concurrent (cf. ADR-0005), résilience self-host, emails.
- Nuxt resterait le bon choix pour une future boutique app-like (hors scope actuel).
