# API REST

L'API Échoppe est construite avec [Elysia](https://elysiajs.com/) et expose une documentation OpenAPI.

## Documentation interactive

Accédez à Swagger UI : http://localhost:8100/swagger

## Base URL

```
http://localhost:8100  # Développement
https://api.votresite.com  # Production
```

## Authentification

L'API utilise des cookies de session (pas de JWT).

### Login

```bash
curl -X POST http://localhost:8100/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@echoppe.dev","password":"admin123"}' \
  -c cookies.txt
```

### Requête authentifiée

```bash
curl http://localhost:8100/auth/me -b cookies.txt
```

## Endpoints principaux

### Auth
| Méthode | Endpoint | Description |
|---------|----------|-------------|
| POST | `/auth/login` | Connexion |
| POST | `/auth/logout` | Déconnexion |
| GET | `/auth/me` | Utilisateur courant |

### Produits
| Méthode | Endpoint | Description |
|---------|----------|-------------|
| GET | `/products` | Liste des produits |
| GET | `/products/:id` | Détail d'un produit |
| POST | `/products` | Créer un produit |
| PUT | `/products/:id` | Modifier un produit |
| DELETE | `/products/:id` | Supprimer un produit |

### Catégories
| Méthode | Endpoint | Description |
|---------|----------|-------------|
| GET | `/categories` | Liste des catégories |
| POST | `/categories` | Créer une catégorie |
| PUT | `/categories/:id` | Modifier |
| DELETE | `/categories/:id` | Supprimer |

### Commandes
| Méthode | Endpoint | Description |
|---------|----------|-------------|
| GET | `/orders` | Liste des commandes |
| GET | `/orders/:id` | Détail d'une commande |
| PATCH | `/orders/:id/status` | Changer le statut |

Voir la [documentation interactive](#documentation-interactive) (Swagger) pour tous les endpoints.

## Client Eden (TypeScript)

Le client Eden génère un client type-safe à partir des schémas Elysia.

### Installation

```bash
bun add @elysiajs/eden
```

### Utilisation

```typescript
import { treaty } from '@elysiajs/eden';
import type { App } from '@echoppe/api';

const api = treaty<App>('http://localhost:8100');

// Requêtes type-safe
const { data } = await api.products.get();
const { data: product } = await api.products({ id: '123' }).get();
```

## Gestion des erreurs

### Format des erreurs

```json
{
  "message": "Description de l'erreur"
}
```

### Codes HTTP

| Code | Signification |
|------|---------------|
| 200 | Succès |
| 201 | Créé |
| 400 | Requête invalide |
| 401 | Non authentifié |
| 403 | Accès refusé |
| 404 | Non trouvé |
| 500 | Erreur serveur |

## Rate Limiting

Certains endpoints sont protégés par rate limiting :

| Endpoint | Limite |
|----------|--------|
| `/auth/login` | 5 req/min |
| `/auth/register` | 3 req/min |
| `/payments/checkout` | 10 req/min |
