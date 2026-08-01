# ADR-0017 — Génération de documents (factures / reçus via Typst)

Statut : accepté
Portée : échoppe

## Contexte

Une commande doit produire des documents légaux (facture, reçu, avoir) avec une mise en page soignée,
une numérotation continue et fiable, et un rendu PDF reproductible côté serveur self-host.

## Options envisagées

- Génération HTML→PDF (Puppeteer/Chromium) — lourd, dépendance navigateur en prod.
- Bibliothèque PDF impérative (pdfkit) — mise en page verbeuse.
- **Typst** — moteur de composition typographique, template déclaratif, binaire léger.

## Décision

- Documents composés avec **Typst** : template `packages/core/src/templates/invoice.typ`, rendu via
  `services/invoice.ts` (invocation du binaire `typst`, `Bun.spawn`).
- **Numérotation** continue par compteur en base : `company.document_prefix` / `document_next_number`
  (et `invoice_prefix` / `invoice_next_number`) ; types `receipt` / `credit_note` (`invoice` /
  `credit_note`).

## Conséquences

- Couplage runtime : dépend du binaire `typst` (+ `Bun.spawn`) — à fournir dans l'image (facteur de la
  migration runtime, cf. ADR-0003).
- Mise en page maintenable (template déclaratif) ; numérotation atomique à préserver (pas de trous).
