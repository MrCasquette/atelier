# Backlogs d'`atelier`

Point d'entrée du travail ouvert, **cible V1**. Ce fichier ne contient aucune tâche : il redirige
vers le backlog de chaque périmètre. Les ADR, audits et notes de design portent le détail et les
décisions ; ce qui vient après la V1 vit dans la [ROADMAP](./ROADMAP.md).

**`atelier` est le workspace, pas un produit.** Il héberge des produits **frères** — aucun n'est le
produit principal du dépôt. Échoppe consomme des capacités CMS par les paquets `@repo/*`, jamais le
produit Prisme ; l'inverse vaut aussi. Cette frontière n'est pas une intention : elle est gardée par
`bun run product-isolation`, qui refuse toute dépendance croisée, déclarée ou seulement importée.

| Périmètre | Backlog | Roadmap |
|---|---|---|
| **`atelier`** — workspace, outillage racine, CI et gardes | [Shared § Workspace](docs-internal/backlog/shared.md#workspace-et-outillage-atelier) | — |
| Échoppe — framework e-commerce | [Échoppe](docs-internal/backlog/echoppe.md) | [interne](docs-internal/design/roadmap-echoppe.md) · [publique](docs/roadmap.md) |
| Prisme — CMS headless config-as-code | [Prisme](docs-internal/backlog/prisme.md) | [interne](docs-internal/design/roadmap-prisme.md) |
| Socle partagé — packages et architecture commune | [Shared](docs-internal/backlog/shared.md) | — |

## Règles de classement

- Une capacité propre au commerce va dans **Échoppe**.
- Une capacité propre au CMS autonome va dans **Prisme**.
- Une brique utilisée ou destinée aux deux produits va dans **Shared**.
- Ce qui appartient au **conteneur** et non à un produit — outillage racine, CI, images, scripts,
  gardes — va dans **Shared § Workspace**. Test : si la tâche disparaîtrait en supprimant un
  produit, elle n'est pas du workspace.
- Une tâche n'est jamais dupliquée entre les trois listes. Un autre périmètre peut seulement la
  citer comme dépendance.
- Un backlog ne porte que de l'actionnable **V1**. Une idée pour plus tard va dans la
  [ROADMAP](./ROADMAP.md), qui ne porte rien d'actionnable en retour.

Légende commune : `[ ]` ouvert · 🔴 fort impact · 🟠 moyen · 🟡 faible / durcissement · ⚪ dépendant.

Comment on tient ces listes — quand supprimer une tâche plutôt que la cocher, où loger son détail —
est une convention : [conventions § Tenue des backlogs](docs-internal/reference/conventions.md#tenue-des-backlogs).

## Références transverses

- [Décisions architecturales](docs-internal/adr/README.md)
- [Pipeline de publication](docs-internal/release/pipeline-release.md)
- [Contraintes d'outillage](docs-internal/reference/contraintes-outillage.md)
