# API Échoppe

Backend Elysia pour le e-commerce.

## Structure

```
src/
├── index.ts          # Entry point, monte les routes
├── plugins/
│   └── auth.ts       # Auth plugin (sessions, macro)
└── routes/
    ├── auth.ts       # /auth (login, logout, me)
    ├── categories.ts # /categories
    ├── collections.ts# /collections
    ├── media.ts      # /media (upload, folders)
    ├── products.ts   # /products (variantes, options, médias)
    ├── tax-rates.ts  # /tax-rates
    ├── assets.ts     # /assets (servir fichiers)
    ├── settings.ts   # /settings (paramètres boutique)
    ├── stock.ts      # /stock (mouvements, alertes)
    ├── orders.ts     # /orders (commandes, factures)
    ├── payments.ts   # /payments (Stripe, PayPal)
    ├── shipping.ts   # /shipping (Colissimo, MondialRelay, Sendcloud)
    └── pagination.ts # Utilitaire pagination
```

## Ajouter une route

```typescript
// src/routes/example.ts
import { Elysia, t } from 'elysia';
import { db, eq } from '@echoppe/core';
import { example } from '@echoppe/core/schema';
import { authGuard } from '../plugins/auth';

export const exampleRoutes = new Elysia({ prefix: '/example' })
  .use(authGuard)  // Protection auth
  .get('/', async () => {
    return db.select().from(example);
  })
  .get('/:id', async ({ params }) => {
    return db.select().from(example).where(eq(example.id, params.id));
  }, {
    params: t.Object({ id: t.String() })
  })
  .post('/', async ({ body }) => {
    return db.insert(example).values(body).returning();
  }, {
    body: t.Object({
      name: t.String(),
    })
  });
```

Puis dans `src/index.ts` :
```typescript
import { exampleRoutes } from './routes/example';
// ...
.use(exampleRoutes)
```

## Auth

- **Sessions** stockées en DB (table `session`)
- **Cookie** : `echoppe_admin_session` (HTTP-only, SameSite strict)
- **Guard** : `authGuard` vérifie la session sur chaque requête

```typescript
// Récupérer l'utilisateur courant
const session = await getSessionFromToken(cookie.echoppe_admin_session.value);
if (!session) return error(401, { message: 'Non authentifié' });
```

## Commandes

```bash
bun run dev:api      # Lance l'API seule (port 8000)
bun run dev          # Lance API + Admin
```

## Endpoints

| Method | Path | Description |
|--------|------|-------------|
| POST | /auth/login | Login |
| POST | /auth/logout | Logout |
| GET | /auth/me | User courant |
| GET/POST/PUT/DELETE | /categories | CRUD catégories |
| GET/POST/PUT/PATCH/DELETE | /products | CRUD produits + variantes + options |
| GET/POST/PUT/DELETE | /collections | CRUD collections |
| GET/POST/PUT/DELETE | /media | CRUD médias + dossiers |
| POST | /media/upload | Upload fichier(s) |
| GET | /tax-rates | Liste taux TVA |
| GET | /assets/:id | Servir fichier uploadé |
| GET/PUT | /settings | Paramètres boutique |
| GET/POST | /stock | Mouvements de stock + alertes |
| GET/PATCH | /orders | Commandes + statuts + factures |
| GET/PUT/POST | /payments | Configuration + checkout + webhooks |
| GET/PUT/POST | /shipping | Configuration + tarifs + étiquettes |
