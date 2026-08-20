# Roadmaps d'`atelier`

Point d'entrée des trajectoires produit. Ce fichier ne contient aucun chantier : il redirige, comme
[BACKLOG](./BACKLOG.md) le fait pour le travail ouvert.

Le partage entre les deux tient en une phrase : **ce qui vise la V1 est dans un backlog, ce qui vient
après est dans une roadmap.**

| Périmètre | Roadmap interne | Roadmap publique |
|---|---|---|
| Échoppe — framework e-commerce | [Roadmap Échoppe](docs-internal/roadmap/echoppe.md) | [docs/roadmap.md](docs/roadmap.md) |
| Prisme — CMS headless config-as-code | [Roadmap Prisme](docs-internal/roadmap/prisme.md) | — |
| Socle partagé — packages et architecture commune | ci-dessous | — |

Une roadmap interne dit le travail à venir ; une roadmap publique dit le cap au marché. La seconde
dérive de la première, elle ne la remplace pas.

## Socle partagé

- Instruire une migration de Bun vers pnpm/Node, sans la coupler à un autre chantier.

Une seule entrée : elle reste ici tant qu'elle ne justifie pas son fichier. Le jour où le socle a une
trajectoire à lui, elle rejoindra `docs-internal/roadmap/`, comme les deux produits.

## Ce qui n'est pas ici

Les tâches de V1 vivent dans les [backlogs](./BACKLOG.md). Les décisions vivent dans les
[ADR](docs-internal/adr/README.md), et l'état courant du système dans
[`docs-internal/architecture/`](docs-internal/architecture/) (ADR-0060).
