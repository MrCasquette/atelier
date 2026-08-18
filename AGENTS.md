# `atelier` — manuel d'opération

> **Ce fichier est la SSOT des instructions agent**, quel que soit l'outil (Claude Code, Cursor,
> Copilot, Codex…). `CLAUDE.md` n'en est qu'un pointeur (`@AGENTS.md`) — ne jamais y écrire, tout
> se modifie ici.

Ce n'est **pas** un corpus de conventions : c'est un manuel court qui dit où se trouve la vérité.
Toute règle détaillée vit ailleurs, et ce fichier y renvoie. S'il commence à décrire du code, c'est
qu'une règle est au mauvais endroit.

## Ce qu'est ce dépôt

`atelier` est un **workspace**, pas un produit. Il héberge deux produits **frères** — aucun n'est le
produit principal :

| Produit | Ce que c'est | Applications |
|---|---|---|
| **Échoppe** | framework e-commerce | `apps/echoppe-api`, `apps/echoppe-admin`, `apps/echoppe-store` |
| **Prisme** | CMS headless config-as-code | `apps/prisme-api`, `apps/prisme-admin` |

**La frontière est un invariant.** Les deux produits partagent des capacités par les paquets
`@repo/*`, jamais par l'autre produit : Échoppe ne dépend pas de Prisme, et réciproquement. Ce n'est
pas une intention, c'est gardé — `bun run product-isolation` refuse toute dépendance croisée,
déclarée **ou seulement importée**.

Un chantier se découpe par **portée de décision**, pas par arborescence.

## Où vit la vérité

| Question | Fichier |
|---|---|
| Comment on écrit le code ici | [`docs-internal/reference/conventions.md`](docs-internal/reference/conventions.md) |
| Pourquoi une décision a été prise | [`docs-internal/adr/`](docs-internal/adr/README.md) |
| Ce qu'il reste à faire (V1) | [`BACKLOG.md`](BACKLOG.md) → un backlog par périmètre |
| Ce qui vient après la V1 | [`ROADMAP.md`](ROADMAP.md) |
| Comment on publie | [`docs-internal/release/pipeline-release.md`](docs-internal/release/pipeline-release.md) |
| La charte d'un paquet | le `README.md` de ce paquet |

Une règle générale de style ou d'idiome ne s'invente pas ici : elle vient de `~/.code-conform/docs/`
(philosophie, langages, atomic design), qui est en **lecture seule**. Si `conventions.md` contredit
cette SSOT, c'est un écart à signaler, pas à trancher seul.

## Langue

**Tout est en français** — ADR, backlogs, commentaires, messages de commit, documentation. Le code
lui-même reste en anglais (identifiants, API, noms de fichiers), et les URL du frontend sont en
français (`/produits`).

C'est une divergence assumée avec d'autres dépôts qui imposent l'anglais : le corpus d'`atelier`
compte des dizaines d'ADR en français, et les traduire n'apporterait rien.

## Commandes réelles

```bash
bun run dev              # API + admin + vitrine (Échoppe)
bun run lint             # eslint
bun run type-check       # tsc --noEmit sur tous les workspaces
bun run test             # tous les workspaces
bun run test:api         # tests de l'API
bun run test:image       # l'image publiée, bootée en base vierge

bun run db:push          # pousser le schéma
bun run db:seed          # données de dev (crée admin@echoppe.dev / admin123)
bun run db:studio        # Drizzle Studio
```

Le runtime est **Bun**, jamais Node ni npm. Le `.env` racine **n'est pas hérité** : Bun ne lit que
le cwd, donc tout script de sous-paquet passe par `--env-file=../../.env`.

Avant de committer : `bun run lint && bun run type-check`.

## Les gardes

Sept scripts refusent une dérive plutôt que de la documenter — `drift-guard`,
`product-isolation`, `core-passthrough`, `reserved-space`, `image-manifests`, `release-coverage`,
`registry-gap`, plus `contracts:check` pour le SDK. Chacun se lance par `bun run <nom>`.

**Leur invariant : une garde découvre, elle n'énumère pas.** Elle ne contient jamais la liste des
paquets ou des produits qu'elle traite, elle la reconstitue à chaque exécution. En ajouter une, ou en
modifier une, se fait sous cette règle — détail et table de correspondance dans
[conventions § L'outillage découvre](docs-internal/reference/conventions.md#loutillage-découvre-il-nénumère-pas).

## Politique de commit (CRITIQUE)

**Attribution : l'auteur humain, et lui seul.** Aucun agent ne co-signe, quel qu'il soit — pas de
`Co-Authored-By` d'un assistant, pas de `Generated with`, aucune mention d'IA, d'outil ou de modèle
dans le message. Historique Git propre.

**Format** : `type(portée): description` — `feat`, `fix`, `docs`, `refactor`, `test`, `ci`, `chore`.
Un `!` avant le `:` marque une rupture.

## Méthode de travail

Décider avant de coder : question → explication → réponse construite à deux → ADR si la décision
mérite d'être figée → action. Ne pas deviner un choix métier ou technique non inférable — demander.
Demander confirmation avant tout changement d'approche.
