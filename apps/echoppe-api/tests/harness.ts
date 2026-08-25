import { fileURLToPath } from 'node:url';
import { category, customer, customerSession, taxRate } from '@echoppe/core';
import { role, session, user } from '@repo/auth';
import { db, eq, runMigrations } from '@repo/db';
import { app } from '../src/app';

// Harness partagé des tests d'intégration API (audit test 2026-07-19, §builders/factories).
// Ces tests migrent une base et frappent l'app assemblée via `app.handle` : ce sont des tests de
// FRONTIÈRE (contrat HTTP + RBAC + SQL), volontairement adossés à une vraie base — cf. triage audit.
// Ce module factorise l'infra recopiée dans chaque fichier ; il ne porte aucune assertion.
// ⚠️ Tout ce qui migre/écrit ici suppose la base JETABLE de `bun run integration echoppe api`.

/** Refuse l'exécution hors base jetable balisée (`DISPOSABLE_DB=1`, posé par scripts/test-api.ts). */
export function requireDisposableDb(): void {
  if (process.env.DISPOSABLE_DB !== '1') {
    throw new Error(
      'Test à lancer via `bun run integration echoppe api` (base jetable). Refus hors base balisée.',
    );
  }
}

const migrationsFolder = fileURLToPath(
  new URL('../../../packages/echoppe-core/drizzle', import.meta.url),
);

/** Migre la base jetable depuis `packages/echoppe-core/drizzle` (idempotent : no-op si déjà à jour). */
export const migrate = (): Promise<void> => runMigrations(migrationsFolder);

/**
 * Vide les compteurs de rate-limit.
 *
 * Ils ne mordent QUE si un Redis est joignable : sans lui, `RedisContext` échoue en ouvert. Un
 * fichier qui frappe une surface d'authentification passait donc ou non **selon l'état de la
 * machine** — CI sans Redis : muet ; poste de dev avec le conteneur allumé : 429. Le nettoyage
 * rend le verdict le même des deux côtés.
 */
export async function resetRateLimits(): Promise<void> {
  if (!process.env.REDIS_URL) return;

  const { default: Redis } = await import('ioredis');
  const redis = new Redis(process.env.REDIS_URL);
  try {
    const keys = await redis.keys('rl:*');
    if (keys.length > 0) await redis.del(...keys);
  } finally {
    await redis.quit();
  }
}

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
// ─── Lire une réponse sans l'affirmer ──────────────────────────────────────────────────────────
//
// Les tests annonçaient la forme des corps par des assertions. Quand une route changeait, le test
// échouait quand même — mais plusieurs lignes plus bas, sur un `undefined` à expliquer. Ces
// fonctions vérifient au point d'entrée et disent ce qu'elles ont reçu : c'est le travail d'un
// test, et ça n'a jamais été celui d'une assertion.

/** L'objet attendu, ou l'échec là où la réponse diverge. */
export function record(value: unknown, what = 'corps'): Record<string, unknown> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw new Error(`${what} : objet attendu, reçu ${JSON.stringify(value)?.slice(0, 200)}`);
  }
  return Object.fromEntries(Object.entries(value));
}

/** Le tableau d'objets attendu — la forme de loin la plus fréquente (`data`, listes). */
export function records(value: unknown, what = 'liste'): Record<string, unknown>[] {
  if (!Array.isArray(value)) {
    throw new Error(`${what} : tableau attendu, reçu ${JSON.stringify(value)?.slice(0, 200)}`);
  }
  return value.map((item, index) => record(item, `${what}[${index}]`));
}

/** La chaîne attendue — identifiants renvoyés par l'API, jetons, URL. */
export function text(value: unknown, what = 'valeur'): string {
  if (typeof value !== 'string') {
    throw new Error(`${what} : chaîne attendue, reçu ${JSON.stringify(value)?.slice(0, 200)}`);
  }
  return value;
}

/** Le tableau de chaînes attendu — actions RBAC, listes de noms. */
export function strings(value: unknown, what = 'liste'): string[] {
  if (!Array.isArray(value)) {
    throw new Error(`${what} : tableau attendu, reçu ${JSON.stringify(value)?.slice(0, 200)}`);
  }
  return value.map((item, index) => text(item, `${what}[${index}]`));
}

export async function getJson(path: string, opts: ReqOptions = {}): Promise<unknown> {
  const res = await req('GET', path, opts);
  return res.json();
}

/**
 * Injecte en base une session du PROPRIÉTAIRE (autorité totale : il franchit toute vérification) et
 * renvoie le cookie associé. Pas de `/auth/login` → aucune dépendance Redis/rate-limit.
 *
 * Le propriétaire est RÉUTILISÉ s'il existe déjà : depuis ADR-0047 un index unique partiel garantit
 * qu'il n'y en a qu'un, et tous les fichiers d'un même run partagent la base. En créer un par
 * fichier violerait la contrainte — ce qui est le comportement voulu, pas un obstacle à contourner.
 */
export async function createAdminSession(): Promise<string> {
  const suffix = crypto.randomUUID().slice(0, 8);
  const [existingOwner] = await db.select().from(user).where(eq(user.isOwner, true)).limit(1);

  const adminUser =
    existingOwner ??
    (await (async () => {
      const [adminRole] = await db
        .insert(role)
        .values({ name: `Test Admin ${suffix}`, scope: 'admin' })
        .returning();
      const [created] = await db
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
      return created;
    })());

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
