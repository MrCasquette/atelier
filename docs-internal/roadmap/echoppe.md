# Roadmap Échoppe

> Ce que devient Échoppe après sa V1. Les décisions vivent dans les [ADR](../adr/README.md) ; les
> travaux concrets de la V1 vivent dans le [backlog Échoppe](../backlog/echoppe.md), et les briques
> communes dans le [backlog shared](../backlog/shared.md). Ce document fait le lien.
>
> Sa jumelle publique est [docs/roadmap.md](../../docs/roadmap.md) : elle dit le cap au marché,
> celle-ci dit le travail à venir. L'une dérive de l'autre, elles ne se remplacent pas.

## V1 — le framework qu'un dev déploie

La V1 est décrite par son backlog, pas ici : catalogue, compte et checkout, durcissement, stock et
paiement, qualité d'exploitation. Le critère de sortie est ailleurs — un développeur extérieur au
monorepo installe une boutique, la garnit et la met en production sans lire le code du framework.

## Après la V1

### Conformité et conservation

**Conservation des factures.** Une facture est aujourd'hui un `media` ordinaire, supprimable depuis
la médiathèque, contre une obligation légale de conservation. Le sujet demande un ADR ;
l'instruction préalable est écrite : [conservation-factures.md](../backlog/conservation-factures.md).

**Protocole RGPD complet** — consentement, export, archivage légal et anonymisation. Le
self-service d'export et de suppression reste un chantier V1 ; c'est le protocole complet qui
attend, avec sa bannière de consentement et sa politique d'archivage.

### Commerce

- **Tarification de l'emballage** : déduire les colis du volume de la commande, ou appliquer un
  forfait quand un seul type d'emballage existe.
- Import/export CSV des produits, commandes et clients.
- Mode caisse, et éventuel installeur desktop.

### Intégrations

- **Onboarding OAuth des providers** et création automatique des webhooks — annoncé « Ensuite » sur
  la roadmap publique : connecter Stripe ou PayPal sans copier-coller de clés.
- Webhooks sortants et intégrations Zapier / n8n / Make.
- Analytics *privacy-first*.

### Storefront et expérience

- **Thèmes, personnalisation et aperçu** — deux ou trois thèmes de base, sélection et prévisualisation.
- Re-porter vers Astro les parcours riches du storefront historique encore pertinents.
- Multi-langue, SEO avancé et PWA.

## Ce qui n'attend pas la V2

Deux sujets reviennent souvent dans cette liste alors qu'ils appartiennent à la V1, et le rappeler
évite de les repousser par habitude :

- les **formulaires d'édition dans l'administration** pour le module contenu, annoncés
  « Maintenant » sur la roadmap publique ;
- la **couverture de tests des parcours critiques** — checkout, paiement, stock — qui conditionne
  la mise en production plus qu'elle ne l'enrichit.
