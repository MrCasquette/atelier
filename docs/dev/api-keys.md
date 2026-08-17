# Clés d'API

Les **clés d'API** authentifient une **machine** (CLI, CI, intégration) auprès de l'API
Échoppe, sans réutiliser une session humaine. C'est le mécanisme qu'emploie
`pnpm content:push` pour synchroniser le [module contenu](/dev/content).

Une clé porte des **portées** (_scopes_) : elle ne peut faire que ce que ses scopes
autorisent, jamais plus.

## Format

```
eck_<32 octets aléatoires en base64url>
```

- Envoyée en en-tête `Authorization: Bearer eck_…`.
- Stockée côté serveur **hachée** (SHA-256) : le secret en clair n'existe qu'entre vos mains.
- Affichée **une seule fois**, à la création. Non récupérable ensuite — perdue = à révoquer
  et recréer.

## Portées (scopes)

Une portée est de la forme `read:<ressource>` ou `write:<ressource>`, où `<ressource>` est une
ressource RBAC (`product`, `collection`, `content`, `order`, …).

| Scope | Autorise |
|-------|----------|
| `read:<r>` | lire la ressource |
| `write:<r>` | **créer, modifier et supprimer** la ressource |

`write` est volontairement **composite** (create + update + delete) : les clés machine restent
simples. Pour la synchronisation des définitions de contenu, la portée utile est
`write:schema` — pousser un registre est un acte de **structure**, pas d'édition.

::: warning La ressource `api_key` n'est pas scopable
Une clé ne peut **jamais** gérer d'autres clés (ni elle-même). La gestion des clés est
réservée à un **humain authentifié** dans l'admin.
:::

## Créer une clé

### Depuis l'admin (recommandé)

Rubrique **« Clés d'API »** → **Nouvelle clé** : un libellé, cochez les portées, expiration
optionnelle. Le secret s'affiche **une fois** — copiez-le immédiatement.

- Un **administrateur** ne voit et ne gère que **ses propres** clés.
- Le **propriétaire** voit et révoque **toutes** les clés (gouvernance).

### Depuis le serveur (bootstrap / CI)

Pour provisionner une première clé sans admin :

```bash
docker compose exec api bun run api-key:create \
  --name front \
  --scopes write:schema
```

La clé en clair est imprimée une fois dans la sortie.

## Utiliser une clé

```bash
curl https://votre-api/content/registry \
  -H "Authorization: Bearer eck_votre_cle"
```

Pour le module contenu, collez-la dans le `.env` du front :

```dotenv
CONTENT_API_KEY=eck_votre_cle
```

puis `pnpm content:push`.

## Révoquer une clé

Admin → **« Clés d'API »** → **Révoquer**. La révocation est **immédiate** (contrairement à
un JWT, aucune fenêtre de validité résiduelle). Recréez une clé neuve si besoin.

## Expiration

Une clé peut porter une date d'expiration. Passée cette date, elle est **refusée** à la
résolution — sans suppression automatique (elle reste visible/révocable dans l'admin).

## Bonnes pratiques

- **Une clé par usage** (un front, une CI…) avec le **minimum** de portées.
- Ne committez jamais une clé : `.env` / secrets CI uniquement.
- Renouvelez périodiquement ; le champ **« dernière utilisation »** aide à repérer les clés
  dormantes.

## API REST

| Méthode | Route | RBAC |
|---------|-------|------|
| `POST` | `/api-keys` | `api_key.create` — renvoie le clair **une fois** |
| `GET` | `/api-keys` | `api_key.read` — sans le secret (hash jamais exposé) |
| `DELETE` | `/api-keys/:id` | `api_key.delete` — révocation |

Une requête portant un `Bearer eck_…` invalide, expiré ou hors-scope est rejetée comme
n'importe quelle requête non autorisée (`401` / `403`).
