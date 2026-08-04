import './env'; // garde-fou config — DOIT précéder tout import de @echoppe/core / ./app (cf. env.ts)
import { fileURLToPath } from 'node:url';
import { runMigrations } from '@echoppe/core';
import { app } from './app';
import { cleanupExpiredOrders } from './jobs/cleanup-expired-orders';
import { initAdmin } from './lib/init-admin';

export type { App } from './app';

const port = process.env.API_PORT ?? 7532;

// Migrations SQL versionnées appliquées au boot (activé dans l'image via
// RUN_MIGRATIONS ; off en dev, où l'on utilise `db:push`). Idempotent.
if (process.env.RUN_MIGRATIONS) {
  const migrationsFolder =
    process.env.MIGRATIONS_DIR ??
    fileURLToPath(new URL('../../../packages/core/drizzle', import.meta.url));
  await runMigrations(migrationsFolder);
  console.log('[Migrate] Schéma à jour');
}

app.listen({ port: Number(port), hostname: '0.0.0.0' });

console.log(`🏪 Échoppe API running at http://localhost:${port}`);

// Create admin user if ADMIN_EMAIL and ADMIN_PASSWORD are set
initAdmin().catch((err) => {
  console.error('[Init] Admin creation error:', err);
});

// Job de nettoyage des commandes expirées : au boot puis toutes les 15 min. Le cycle de vie du
// timer est borné et on refuse de démarrer un run pendant l'extinction (cf. typescript.md §7 —
// dispose des timers/souscriptions).
const CLEANUP_INTERVAL_MS = 15 * 60 * 1000;
const shutdown = new AbortController();

function runCleanup(context: string): void {
  if (shutdown.signal.aborted) return;
  cleanupExpiredOrders().catch((err) => {
    console.error(`[Cleanup] ${context} error:`, err);
  });
}

const cleanupTimer = setInterval(() => runCleanup('interval'), CLEANUP_INTERVAL_MS);
runCleanup('initial');

// Arrêt gracieux : stoppe le timer et le serveur HTTP à réception d'un signal d'extinction
// (SIGTERM en Docker, SIGINT en dev) plutôt qu'une coupure brutale.
async function dispose(signal: string): Promise<void> {
  if (shutdown.signal.aborted) return;
  shutdown.abort();
  clearInterval(cleanupTimer);
  console.log(`[Shutdown] ${signal} reçu — arrêt gracieux`);
  await app.stop();
  process.exit(0);
}

for (const signal of ['SIGTERM', 'SIGINT'] as const) {
  process.on(signal, () => {
    dispose(signal).catch((err) => {
      console.error('[Shutdown] Error:', err);
      process.exit(1);
    });
  });
}
