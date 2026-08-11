# Plan : Journal d'audit + Audit RBAC

> **Statut (2026-07-20) — largement implémenté.** Le **journal d'audit** est livré (route
> `audit-logs.ts`, vue `AuditLogsView.vue`, helper `logAudit()` câblé dans les routes). Ce qui
> **reste ouvert** = la **partie 3** (nettoyage matrice RBAC par scope admin/store, guards PATCH
> explicites) → suivie dans le [backlog Échoppe](../backlog/echoppe.md). Document conservé comme détail de ce
> reste et trace de conception.

## Contexte

L'audit du système RBAC a révélé :
- **Journal d'audit** : Table `auditLog` existe mais aucune route API ni vue admin
- **Ressources orphelines** : `cart`, `wishlist`, `address`, `audit_log` ont des permissions mais aucune route
- **Routes non protégées** : Certaines routes PATCH sans guard explicite
- **Incohérences** : `folder` protégé via `media`, `invoice` via `orders`

---

## Partie 1 : Journal d'audit - Backend

### 1.1 Helper d'enregistrement

**Fichier** : `apps/api/src/lib/audit.ts` (nouveau)

```typescript
export async function logAudit(params: {
  userId?: string;
  action: string;        // 'product.create', 'order.update', etc.
  entityType?: string;
  entityId?: string;
  data?: Record<string, unknown>;
  ipAddress?: string;
}): Promise<void>
```

### 1.2 Route API

**Fichier** : `apps/api/src/routes/audit-logs.ts` (nouveau)

```typescript
// GET /audit-logs
// - Pagination : page, limit (défaut 50)
// - Filtres : action, entityType, userId, dateFrom, dateTo
// - Tri : dateCreated DESC
// - Protection : permissionGuard('audit_log', 'read')
// - Jointure user pour afficher nom/email
```

**Modification** : `apps/api/src/index.ts` - Monter la route

### 1.3 Intégration logging dans routes existantes

**Routes critiques à instrumenter** :

| Route | Actions à logger |
|-------|------------------|
| `products.ts` | create, update, delete |
| `orders.ts` | status change, notes update |
| `users.ts` | create, update, login |
| `roles.ts` | create, update, delete, permissions update |
| `categories.ts` | create, update, delete |
| `collections.ts` | create, update, delete |
| `media.ts` | upload, delete |
| `settings.ts` | company update |

---

## Partie 2 : Journal d'audit - Frontend

### 2.1 Composable

**Fichiers** : `apps/admin/src/composables/audit/`
- `types.ts` : Types inférés de l'API
- `useAuditLogs.ts` : État + actions
- `index.ts` : Exports

### 2.2 Vue complète

**Fichier** : `apps/admin/src/views/AuditLogsView.vue`

**Fonctionnalités** :
- DataTable avec colonnes : Date, Utilisateur, Action, Type entité, ID entité, IP
- Panel de filtres avancés :
  - Sélecteur d'utilisateur (dropdown)
  - Type d'action (dropdown)
  - Type d'entité (dropdown)
  - Période (date range picker)
- Pagination complète
- Badges colorés par catégorie d'action (create=vert, update=bleu, delete=rouge)
- Modal de détails JSON pour la colonne `data`
- Export CSV (optionnel)

**Modification** : `apps/admin/src/router/index.ts` - Route `/audit`

---

## Partie 3 : Audit RBAC - Corrections

### 3.1 Simplification matrice permissions admin

**Fichier** : `apps/admin/src/composables/roles/types.ts`

Créer `ADMIN_RESOURCE_GROUPS` et `STORE_RESOURCE_GROUPS` distincts :

```typescript
// Pour scope 'admin' : retirer cart, wishlist, address
// Pour scope 'store' : garder cart, wishlist, address avec selfOnly
```

### 3.2 Nettoyage seed

**Fichier** : `packages/core/src/db/seed.ts`

- Retirer `cart`, `wishlist`, `address` des permissions admin/propriétaire
- Garder pour rôles Client/Public

### 3.3 Guards PATCH explicites

**Fichiers** :
- `apps/api/src/routes/categories.ts` : Guard avant `/batch/order`
- `apps/api/src/routes/products.ts` : Vérifier guards PATCH

---

## Fichiers à créer

| Fichier | Description |
|---------|-------------|
| `apps/api/src/lib/audit.ts` | Helper logAudit |
| `apps/api/src/routes/audit-logs.ts` | Route GET /audit-logs |
| `apps/admin/src/composables/audit/types.ts` | Types |
| `apps/admin/src/composables/audit/useAuditLogs.ts` | Composable |
| `apps/admin/src/composables/audit/index.ts` | Exports |
| `apps/admin/src/views/AuditLogsView.vue` | Vue admin |

## Fichiers à modifier

| Fichier | Modification |
|---------|--------------|
| `apps/api/src/index.ts` | Import auditLogsRoutes |
| `apps/api/src/routes/products.ts` | Appels logAudit |
| `apps/api/src/routes/orders.ts` | Appels logAudit |
| `apps/api/src/routes/users.ts` | Appels logAudit |
| `apps/api/src/routes/roles.ts` | Appels logAudit |
| `apps/api/src/routes/categories.ts` | Appels logAudit + guard PATCH |
| `apps/api/src/routes/collections.ts` | Appels logAudit |
| `apps/api/src/routes/media.ts` | Appels logAudit |
| `apps/api/src/routes/settings.ts` | Appels logAudit |
| `apps/admin/src/router/index.ts` | Route /audit |
| `apps/admin/src/composables/roles/types.ts` | Séparer RESOURCE_GROUPS par scope |
| `packages/core/src/db/seed.ts` | Nettoyer permissions admin |

---

## Ordre d'exécution

1. Helper `logAudit`
2. Route API `/audit-logs`
3. Composable + types frontend
4. Vue `AuditLogsView`
5. Intégration logging dans routes (products, orders, users, roles, etc.)
6. Nettoyage matrice permissions (types.ts)
7. Nettoyage seed
8. Guards PATCH explicites
9. Tests manuels
