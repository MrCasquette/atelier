# Backlogs du monorepo

Point d'entrée unique du travail ouvert. Chaque tâche appartient à un seul périmètre ; les ADR,
audits et notes de design portent le détail et les décisions.

| Périmètre | Backlog | Roadmap |
|---|---|---|
| Échoppe — framework e-commerce | [Échoppe](docs-internal/backlog/echoppe.md) | [roadmap publique](docs/roadmap.md) |
| Prisme — CMS headless config-as-code | [Prisme](docs-internal/backlog/prisme.md) | [roadmap interne](docs-internal/design/roadmap-prisme.md) |
| Socle partagé — packages et architecture commune | [Shared](docs-internal/backlog/shared.md) | — |

## Règles de classement

- Une capacité propre au commerce va dans **Échoppe**.
- Une capacité propre au CMS autonome va dans **Prisme**.
- Une brique utilisée ou destinée aux deux produits va dans **Shared**.
- Une tâche n'est jamais dupliquée entre les trois listes. Un autre périmètre peut seulement la
  citer comme dépendance.
- La roadmap exprime une trajectoire produit ; le backlog porte les actions concrètes et leur état.
- L'historique du livré vit dans Git, le changelog et les ADR, pas dans un journal parallèle.

Légende commune : `[ ]` ouvert · 🔴 fort impact · 🟠 moyen · 🟡 faible / durcissement · ⚪ dépendant.

## Références transverses

- [Décisions architecturales](docs-internal/adr/README.md)
- [Pipeline de publication](docs-internal/release/pipeline-release.md)
- [Contraintes d'outillage](docs-internal/reference/contraintes-outillage.md)
