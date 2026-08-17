# @echoppe/client

SDK client **typé** pour l'API [Échoppe](https://github.com/) — généré depuis le
contrat OpenAPI de l'API. Runtime-agnostique (navigateur, Bun, Node, edge) : repose
uniquement sur `fetch`.

## Installation

```bash
bun add @echoppe/client
```

## Utilisation

```ts
import { createEchoppeClient } from '@echoppe/client';

const echoppe = createEchoppeClient({
  baseUrl: 'https://api.maboutique.fr',
});

const { data, error } = await echoppe.GET('/products/');
if (error) throw error;

// `data` est entièrement typé depuis le contrat de l'API
for (const product of data) {
  console.log(product.name);
}
```

Les méthodes suivent le contrat OpenAPI via [`openapi-fetch`](https://openapi-ts.dev/openapi-fetch/) :
`GET`, `POST`, `PUT`, `PATCH`, `DELETE`, avec `params.path`, `params.query` et `body`
typés par route.

```ts
const { data } = await echoppe.GET('/products/{id}', {
  params: { path: { id: '…' } },
});
```

### Authentification

L'API utilise des **cookies de session HTTP-only**. Le client force
`credentials: 'include'` — dans un navigateur, les cookies de session sont donc
transmis automatiquement une fois l'utilisateur connecté via les routes d'auth.

## Types

Le contrat complet est réexporté pour dériver ses propres types :

```ts
import type { paths, components } from '@echoppe/client';

type Product = components['schemas']['...'];
```

## Régénérer depuis l'API

Le SDK est généré depuis l'OpenAPI d'une API en cours d'exécution :

```bash
# API sur http://localhost:7532 par défaut
bun run generate
# ou une autre instance
ECHOPPE_API_URL=https://api.exemple.fr bun run generate
```

Cela met à jour `openapi.json` (snapshot figé du contrat) puis `src/openapi.ts`.
