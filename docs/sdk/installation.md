# Installation

## Ajouter le paquet

::: code-group

```bash [pnpm]
pnpm add @axiome-apps/echoppe-client
```

```bash [bun]
bun add @axiome-apps/echoppe-client
```

```bash [npm]
npm install @axiome-apps/echoppe-client
```

:::

::: tip Déjà inclus dans les boutiques scaffoldées
`npm create echoppe@latest` génère un projet où `@axiome-apps/echoppe-client` est **déjà une
dépendance** et où le client est **déjà instancié** dans `src/lib/api.ts` :

```ts
// src/lib/api.ts (fourni par le template)
import { createEchoppeClient } from '@axiome-apps/echoppe-client';

const API_URL = import.meta.env.PUBLIC_API_URL;
export const api = createEchoppeClient({ baseUrl: API_URL });
```

Vous importez simplement `api` là où vous en avez besoin. Cette page décrit la mise en place
manuelle (intégration dans un projet existant).
:::

## Créer le client

Le client se crée une fois avec `createEchoppeClient`, puis se réutilise partout.

```ts
import { createEchoppeClient } from '@axiome-apps/echoppe-client';

export const echoppe = createEchoppeClient({
  baseUrl: process.env.PUBLIC_API_URL ?? 'http://localhost:8100',
});
```

### Options

| Option | Type | Rôle |
|--------|------|------|
| `baseUrl` | `string` | URL de base de l'API (les `/` finaux sont normalisés). **Requis**. |
| `headers` | `Record<string, string>` | En-têtes par défaut envoyés à chaque requête (utile en SSR). |
| `fetch` | `typeof fetch` | Implémentation de `fetch` à utiliser (SSR, tests). Défaut : `fetch` global. |

Le client force `credentials: 'include'` : les cookies de session sont transmis
automatiquement, ce qui fait fonctionner les routes protégées (panier, compte, commande).

## Server-Side Rendering

Les storefronts Échoppe sont en **SSR** : les appels API se font **côté serveur** (jamais
depuis le navigateur, hormis les URLs d'images publiques). En SSR, il faut relayer le cookie
de session entrant vers l'API. On crée alors un client **par requête** :

```ts
// Exemple générique (frontmatter Astro, loader Remix, etc.)
const echoppe = createEchoppeClient({
  baseUrl: process.env.PUBLIC_API_URL!,
  headers: {
    // relaie la session du visiteur vers l'API
    cookie: request.headers.get('cookie') ?? '',
  },
});
```

Pour les mutations (ajout au panier, connexion…), l'API renvoie des en-têtes `Set-Cookie`
qu'il faut **réémettre** vers le navigateur depuis la réponse SSR. Voir
[Utilisation → Session](/sdk/usage#session-et-cookies).
