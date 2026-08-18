# Ports

Référence d'application de [ADR-0054](../adr/ADR-0054-ports-rang-de-pile.md), qui porte la décision
et ses raisons.

## La grille

Trois chiffres, et rien d'autre :

- **le millier dit la nature** — `8` un serveur, `3` un navigateur ;
- **la centaine dit le produit** — `1` Échoppe, `2` Prisme ;
- **l'unité dit le rang de l'instance sur la machine** — `0` la première, celle du produit lorsqu'il
  y en a un.

La dizaine distingue plusieurs surfaces de même nature au sein d'un produit. Un seul usage
aujourd'hui : `1` pour le serveur Vite du dashboard.

## L'allocation

| Pile | Échoppe | Prisme | Où le rang est écrit |
|------|---------|--------|----------------------|
| API — le produit | `8100` | `8200` | `Dockerfile` (interne), `src/index.ts`, template `create-echoppe` |
| API — `bun run dev` | `8101` | `8201` | `apps/echoppe-api/package.json` |
| API — l'image publiée | `8102` | `8202` | `compose.yaml`, profil `release` |
| API — le gate d'intégration | `8103` | — | `apps/echoppe-api/scripts/test-image.ts` |
| Vitrine du dépôt | `3100` | `3200` | `apps/echoppe-store/astro.config.mjs` |
| Dashboard, serveur Vite | `3110` | `3210` | `apps/echoppe-admin/vite.config.ts` |
| PostgreSQL · Redis | `5432` · `6379` | idem | `compose.yaml` |

Deux ports vivent hors grille, délibérément : `8109` pour `serve-contract` lancé à la main — il ne
doit viser aucun rang, sinon il meurt en silence sur un rang occupé et le contrat se régénère depuis
l'API d'à côté — et `5440` pour la base jetable du gate d'intégration.

Le front d'une boutique n'a pas de rang : il vit dans le dépôt du consommateur (ADR-0002) et garde
le port par défaut d'Astro, `4321`.

## Ce qu'il faut en retenir

**Le port interne du conteneur vaut `8100` partout.** C'est celui du `Dockerfile`, de son `EXPOSE`
et de son healthcheck. Il ne se négocie pas, ne se configure pas, et ne change pas d'une pile à
l'autre. Seul le mapping vers l'hôte varie.

**Les rangs sont des littéraux, pas de la configuration.** Aucun `.env` ne les porte, aucun script
ne les alloue. Les trois piles d'Échoppe — une boutique, `bun run dev`, l'image publiée — cohabitent
par construction, sans rien à renseigner.

**`API_PORT` reste la variable de l'exploitant.** La renseigner déplace le mapping publié, jamais le
port interne. C'est la seule qu'un hébergeur ait à connaître.

**Aucun `container_name` dans les composes.** Un nom de conteneur est global à la machine : deux
piles qui en partagent un ne démarrent pas ensemble, quels que soient leurs ports. C'est la
collision qui mord en premier, avant celle des ports. Compose préfixe par le nom du projet, ce qui
suffit.

## Les deux piles du dépôt

```bash
docker compose up -d                    # PostgreSQL + Redis — l'infra de `bun run dev`
bun run dev                             # API :8101 · dashboard :3110 · vitrine :3100

docker compose --profile release up -d  # l'image publiée sur :8102 (validation post-publication)
```

Redis n'est pas optionnel en développement : sans lui, `/auth/login` remonte une page d'erreur Bun
au lieu d'échouer proprement.

## Consommateurs à connaître

`packages/echoppe-client/scripts/generate.ts` interroge `http://localhost:8101/-/docs/json` pour
régénérer le SDK — l'API des sources, donc, pas un conteneur. `CONTRACT_API_URL` le fait viser
ailleurs, ce dont se sert le gate d'intégration pour interroger l'API du conteneur qu'il teste.
