import { fileURLToPath } from 'node:url';
import {
  category,
  customer,
  customerSession,
  db,
  eq,
  role,
  runMigrations,
  session,
  taxRate,
  user,
} from '@echoppe/core';
import { app } from '../src/app';

// Harness partagé des tests d'intégration API (audit test 2026-07-19, §builders/factories).
// Ces tests migrent une base et frappent l'app assemblée via `app.handle` : ce sont des tests de
// FRONTIÈRE (contrat HTTP + RBAC + SQL), volontairement adossés à une vraie base — cf. triage audit.
// Ce module factorise l'infra recopiée dans chaque fichier ; il ne porte aucune assertion.
// ⚠️ Tout ce qui migre/écrit ici suppose la base JETABLE de `bun run test:smoke`.

/** Refuse l'exécution hors base jetable balisée (`ECHOPPE_SMOKE=1`, posé par scripts/smoke.ts). */
export function requireSmokeDb(): void {
  if (process.env.ECHOPPE_SMOKE !== '1') {
    throw new Error(
      'Test à lancer via `bun run test:smoke` (base jetable). Refus hors base balisée.',
    );
  }
}

const migrationsFolder = fileURLToPath(new URL('../../../packages/core/drizzle', import.meta.url));

/** Migre la base jetable depuis `packages/core/drizzle` (idempotent : no-op si déjà à jour). */
export const migrate = (): Promise<void> => runMigrations(migrationsFolder);

export interface ReqOptions {
  cookie?: string;
  body?: unknown;
  headers?: Record<string, string>;
}

/** Requête contre l'app assemblée (la frontière testée). Sérialise `body` en JSON. */
export function req(method: string, path: string, opts: ReqOptions = {}): Promise<Response> {
  return app.handle(
    new Request(`http://localhost${path}`, {
      method,
      headers: {
        'content-type': 'application/json',
        ...(opts.cookie ? { cookie: opts.cookie } : {}),
        ...opts.headers,
      },
      ...(opts.body !== undefined ? { body: JSON.stringify(opts.body) } : {}),
    }),
  );
}

/** GET + parse JSON, typé par l'appelant. */
export async function getJson<T>(path: string, opts: ReqOptions = {}): Promise<T> {
  const res = await req('GET', path, opts);
  return res.json() as Promise<T>;
}

/**
 * Injecte en base une session admin OWNER (bypass RBAC : l'owner franchit toute permission) et
 * renvoie le cookie associé. Pas de `/auth/login` → aucune dépendance Redis/rate-limit. Les noms
 * sont uniques par appel → aucune collision entre fichiers dans un même run smoke.
 */
export async function createAdminSession(): Promise<string> {
  const suffix = crypto.randomUUID().slice(0, 8);
  const [adminRole] = await db
    .insert(role)
    .values({ name: `Test Admin ${suffix}`, scope: 'admin' })
    .returning();
  const [adminUser] = await db
    .insert(user)
    .values({
      email: `admin-${suffix}@echoppe.test`,
      passwordHash: 'x',
      firstName: 'Test',
      lastName: 'Admin',
      role: adminRole.id,
      isOwner: true,
    })
    .returning();
  const token = crypto.randomUUID().replace(/-/g, '');
  await db
    .insert(session)
    .values({ token, user: adminUser.id, expiresAt: new Date(Date.now() + 60 * 60 * 1000) });
  return `echoppe_admin_session=${token}`;
}

/**
 * Injecte en base un client + sa session, renvoie { cookie, customerId }. `userAgent` laissé null
 * → le pinning User-Agent du plugin est neutralisé (pas de header à répliquer dans le test). Emails
 * uniques par appel → aucune collision entre fichiers dans un même run.
 */
export async function createCustomerSession(): Promise<{ cookie: string; customerId: string }> {
  const suffix = crypto.randomUUID().slice(0, 8);
  const [c] = await db
    .insert(customer)
    .values({
      email: `client-${suffix}@echoppe.test`,
      passwordHash: 'x',
      firstName: 'Client',
      lastName: 'Test',
      emailVerified: true,
    })
    .returning();
  const token = crypto.randomUUID().replace(/-/g, '');
  await db
    .insert(customerSession)
    .values({ token, customer: c.id, expiresAt: new Date(Date.now() + 60 * 60 * 1000) });
  return { cookie: `echoppe_customer_session=${token}`, customerId: c.id };
}

/** FK partagée : la base vierge migrée n'a pas de catégorie. Idempotent (slug unique). */
export async function ensureCategory(slug = 'test-cat', name = 'Test'): Promise<string> {
  const [row] = await db.insert(category).values({ name, slug }).onConflictDoNothing().returning();
  return row?.id ?? (await db.select().from(category).where(eq(category.slug, slug)))[0].id;
}

/** FK partagée : la base vierge migrée n'a pas de taux de TVA. Idempotent (lookup par nom). */
export async function ensureTaxRate(name = 'TVA test', rate = '20.00'): Promise<string> {
  const [row] = await db.insert(taxRate).values({ name, rate }).onConflictDoNothing().returning();
  return row?.id ?? (await db.select().from(taxRate).where(eq(taxRate.name, name)))[0].id;
}
