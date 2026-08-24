# `atelier` — manuel d'opération

> **Ce fichier est la SSOT des instructions agent**, quel que soit l'outil (Claude Code, Cursor,
> Copilot, Codex…). `CLAUDE.md` n'en est qu'un pointeur (`@AGENTS.md`) — ne jamais y écrire, tout
> se modifie ici.

Ce n'est **pas** un corpus de conventions : c'est un manuel court qui dit où se trouve la vérité.
Toute règle détaillée vit ailleurs, et ce fichier y renvoie. S'il commence à décrire du code, c'est
qu'une règle est au mauvais endroit.

## Ce qu'est ce dépôt

`atelier` n'est **pas un produit**. C'est le **lieu où l'on fabrique les outils du web** — le niveau
entre l'organisation et les produits finaux, celui dont les paquets partagés portent le nom en
préfixe ([ADR-0063](docs-internal/adr/ADR-0063-appartenance-des-paquets.md)). Il héberge deux
produits **frères** — aucun n'est le produit principal :

| Produit | Ce que c'est | Applications |
|---|---|---|
| **Échoppe** | framework e-commerce | `apps/echoppe-api`, `apps/echoppe-admin`, `apps/echoppe-store` |
| **Prisme** | CMS headless config-as-code | `apps/prisme-api`, `apps/prisme-admin` |

**La frontière est un invariant.** Les deux produits partagent des capacités par les paquets
`@repo/*`, jamais par l'autre produit : Échoppe ne dépend pas de Prisme, et réciproquement. Ce n'est
pas une intention, c'est gardé — `bun run product-isolation` refuse toute dépendance croisée,
déclarée **ou seulement importée**.

**Frères, mais pas de même périmètre** ([ADR-0058](docs-internal/adr/ADR-0058-fraternite-des-produits.md)).
Ils le sont en dépendance et en priorité ; ils ne le sont pas en recomposition — Échoppe recompose
les mêmes paquets de contenu que Prisme, **plus** ceux du commerce. Échoppe n'empaquette pas Prisme
pour autant : aucun des deux n'est traversé par l'autre.

D'où la règle de placement : **une capacité qui ne parle que de contenu appartient aux paquets
partagés ; une capacité qui parle de commerce appartient à `echoppe-core`.** Le critère est le
vocabulaire du code, pas son lieu de naissance — le dépôt a été écrit dans l'ordre `Échoppe →
Prisme`, l'inverse de l'ordre logique.

Un chantier se découpe par **portée de décision**, pas par arborescence.

## Où vit la vérité

La documentation a **cinq natures**, et une seule question mène à chacune
([ADR-0060](docs-internal/adr/ADR-0060-natures-de-la-documentation.md)) :

| Question | Nature | Où |
|---|---|---|
| Comment le système est fait **aujourd'hui** | architecture | [`docs-internal/architecture/`](docs-internal/architecture/overview.md) |
| **Pourquoi** une décision a été prise | ADR | [`docs-internal/adr/`](docs-internal/adr/README.md) |
| Comment on **écrit du code** ici | conventions | [`docs-internal/conventions.md`](docs-internal/conventions.md) |
| Ce qu'un **mot** veut dire | glossaire | [`docs-internal/glossaire.md`](docs-internal/glossaire.md) |
| Comment on **publie et exploite** | runbook | [`docs-internal/runbook/`](docs-internal/runbook/pipeline-release.md) |
| La charte d'un **paquet** | — | le `README.md` de ce paquet |
| Ce qu'il reste à faire (V1) | — | [`BACKLOG.md`](BACKLOG.md) → un backlog par périmètre |
| Ce qui vient après la V1 | — | [`ROADMAP.md`](ROADMAP.md) |

**Un ADR est un journal, pas une référence.** Il ne se réécrit pas : une coquille se corrige, une
décision qui change s'écrit dans un **nouvel** ADR. Et il **parle au passé daté** — il peut montrer
une arborescence ou un chemin si c'est la photographie qui rend la décision compréhensible, jamais
comme l'état courant. Ce qui décrit le présent pour qu'on s'en serve vit dans l'architecture, qui se
remplace. `backlog/` et `audits/` sont des artefacts de travail, sans autorité.

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
[conventions § L'outillage découvre](docs-internal/conventions.md#loutillage-découvre-il-nénumère-pas).

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
