# Bonnes Pratiques - Échoppe

## Conventions Générales

- **Runtime** : Bun (pas Node)
- **Typage** : Strict, jamais `any` sans type guard
- **Styling** : TailwindCSS (sauf animations/effets complexes)
- **Langue** : Code/API en anglais, URLs frontend en français (`/produits`), UI en français

## API (Elysia)

### Routes
- Fichier par ressource : `apps/echoppe-api/src/routes/[resource].ts`
- Valider avec `t.Object()` pour body/params
- Importer DB depuis `@echoppe/core`

```typescript
export const productsRoutes = new Elysia({ prefix: '/products' })
  .use(authPlugin)
  .get('/', async () => db.select().from(product))
  .post('/', async ({ currentUser, body }) => {
    return db.insert(product).values(body).returning();
  }, { auth: true, body: productBody });
```

### Auth
- Sessions + Cookies HTTP-only (pas de JWT)
- `authPlugin` avec macro `auth`
- Route publique : pas d'option `auth`
- Route protégée : `{ auth: true }` → injecte `currentUser`, `currentRole`

## Dashboard (Vue 3)

### Structure
- Imports : alias `@/` (`@/lib/api`, `@/components/atoms`)
- Atomic Design : `atoms/` → `molecules/` → `organisms/`
- Composables : un par feature, retourne `{ state, actions }`

### Imports de composants (IMPORTANT)
**Pas de barrel files (index.ts) pour les composants Vue.** Toujours utiliser les imports directs.

```typescript
// ❌ INTERDIT - barrel files
import { Button, Modal } from '@/components/atoms';
import { SearchInput } from '@/components/molecules';

// ✅ CORRECT - imports directs
import Button from '@/components/atoms/Button.vue';
import Modal from '@/components/atoms/Modal.vue';
import SearchInput from '@/components/molecules/SearchInput.vue';
import CloseIcon from '@/components/atoms/icons/CloseIcon.vue';
```

**Exception** : Les composables/types/utils peuvent utiliser des barrel files.
```typescript
// ✅ OK pour les composables
import type { Media, FolderNode } from '@/composables/media';
import { useMedia, getMediaUrl } from '@/composables/media';
```

### Types depuis Eden (IMPORTANT)
**Ne jamais définir d'interfaces manuelles pour les données API.**

```typescript
// ❌ INTERDIT
interface Product { id: string; name: string; }

// ✅ CORRECT - inférer depuis l'API
type Product = NonNullable<Awaited<ReturnType<typeof api.products.get>>['data']>[number];
```

## Base de données (Drizzle)

- Schema : `packages/echoppe-core/src/db/schema/` (un fichier par domaine)
- Imports : `import { db, eq } from '@echoppe/core'`
- Tables : `import { product } from '@echoppe/core/schema'`

## Commandes

```bash
bun run dev              # API + Admin
bun run db:push --force  # Push schema (--force obligatoire, évite le prompt interactif)
bun run db:seed          # Seed data
bun run db:studio        # Drizzle Studio
```

## Git

**INTERDICTION ABSOLUE** dans les messages de commit :
- Toute mention de Claude, IA, ou assistant
- Jamais de "Generated with Claude Code"
- Jamais de "Co-Authored-By: Claude"
- Seul le nom de l'utilisateur doit apparaître

## Credentials Dev

- Admin : `admin@echoppe.dev` / `admin123`
- DB : `postgresql://echoppe:echoppe@localhost:5432/echoppe`
