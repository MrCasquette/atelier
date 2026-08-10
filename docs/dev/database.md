# Base de données

Échoppe utilise PostgreSQL avec Drizzle ORM.

## Schéma

Le schéma complet est défini dans `packages/echoppe-core/src/db/schema/`.

### Tables principales

| Table | Description |
|-------|-------------|
| `product` | Produits |
| `product_variant` | Variantes de produits |
| `product_option` | Options (Taille, Couleur...) |
| `product_option_value` | Valeurs d'options |
| `category` | Catégories |
| `collection` | Collections |
| `order` | Commandes |
| `order_item` | Lignes de commande |
| `customer` | Clients |
| `user` | Utilisateurs admin |
| `role` | Rôles |
| `permission` | Permissions |
| `media` | Fichiers uploadés |
| `media_folder` | Dossiers de la médiathèque |

### Relations

```
product ──┬── product_variant (1:N)
          ├── product_option (1:N)
          ├── product_media (N:M)
          └── category (N:1)

order ────┬── order_item (1:N)
          ├── customer (N:1)
          ├── payment (1:1)
          └── shipment (1:1)

user ─────┬── role (N:1)
          └── user_session (1:N)

role ─────── role_permission (N:M) ── permission
```

## Commandes Drizzle

```bash
# Appliquer le schéma (dev)
bun run db:push --force

# Générer une migration
bun run db:generate

# Appliquer les migrations (prod)
bun run db:migrate

# Interface graphique
bun run db:studio

# Seed des données de test
bun run db:seed
```

## Utilisation

### Connexion

```typescript
import { db } from '@echoppe/core';
```

### Requêtes

```typescript
import { db, eq } from '@echoppe/core';
import { product, productVariant } from '@echoppe/core/schema';

// Select
const products = await db.select().from(product);

// Select avec relation
const productWithVariants = await db.query.product.findFirst({
  where: eq(product.id, id),
  with: {
    variants: true,
    category: true,
  },
});

// Insert
const [newProduct] = await db
  .insert(product)
  .values({ name, slug, categoryId })
  .returning();

// Update
await db
  .update(product)
  .set({ name: 'Nouveau nom' })
  .where(eq(product.id, id));

// Delete
await db.delete(product).where(eq(product.id, id));
```

### Transactions

```typescript
import { db } from '@echoppe/core';

await db.transaction(async (tx) => {
  const [order] = await tx.insert(order).values({...}).returning();
  await tx.insert(orderItem).values(items.map(i => ({ ...i, orderId: order.id })));
});
```

## Migrations

En production, ce sont les **migrations versionnées** qui font foi, pas `db:push`.
L'image `api` embarque le dossier `drizzle/` et **applique les migrations au
démarrage** (`RUN_MIGRATIONS=1`) : le selfhoster n'a rien à lancer. Côté framework,
après un changement de schéma :

```bash
# Générer une migration après modification du schéma
bun run db:generate

# Appliquer les migrations
bun run db:migrate
```

Les fichiers de migration sont dans `packages/echoppe-core/drizzle/`.

::: danger `db:push` ≠ `db:generate` — piège de dérive
`db:push` applique le schéma en dev **sans créer de fichier de migration**. L'image
publiée n'embarque que les migrations : un schéma poussé par `push` seul est **absent
de l'image** → 500 au runtime pour toute boutique (base fraîche ou upgradée).

**Règle** : après toute modif de `src/db/schema/`, lancer `db:generate` et committer
le `.sql` + le `meta/*_snapshot.json`. Un second `db:generate` doit afficher
« No schema changes ». Réserver `db:push` au prototypage local jetable.

Détail complet du process : [Publier une version](/dev/releasing).
:::
