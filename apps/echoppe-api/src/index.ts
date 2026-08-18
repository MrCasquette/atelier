import './env'; // garde-fou config — DOIT précéder tout import de @echoppe/core / ./app (cf. env.ts)
import { fileURLToPath } from 'node:url';
import { db, runMigrations } from '@repo/db';
import { user } from '@repo/auth';
import { app } from './app';
import { cleanupExpiredOrders } from './jobs/cleanup-expired-orders';
import { syncEntityReferences } from './modules/reference/sync';

// Le contrat de faute sort par la même porte que le type de l'application : une surface qui lit une
// réponse d'erreur en a besoin pour la RENDRE, et le réécrire chez elle serait exactement
// l'interface manuelle que le projet s'interdit.
export type { EchoppeErrorResponse as ErrorResponse, EchoppeFault as Fault } from '@echoppe/core';
export type { App } from './app';

// Sous-commandes d'amorçage. L'image runtime ne porte qu'un binaire compilé — ni sources, ni
// `package.json`, ni `node_modules` —, donc `bun run <script>` n'y existe pas. Les commandes
// d'exploitation passent par le binaire lui-même :
//
//   docker compose exec -it api ./api admin:create
//   docker compose exec api ./api api-key:create --name front --scopes write:schema
//
// L'argument est retiré d'`argv` avant délégation : chaque script voit la même ligne de commande
// qu'en local, où `bun run --cwd apps/echoppe-api <script>` reste le chemin d'appel.
const SUBCOMMANDS: Record<string, () => Promise<unknown>> = {
  'admin:create': () => import('./scripts/create-admin'),
  'api-key:create': () => import('./scripts/create-api-key'),
};

const subcommand = SUBCOMMANDS[process.argv[2] ?? ''];
if (subcommand) {
  process.argv.splice(2, 1);
  await subcommand();
  process.exit(0);
}

const port = process.env.API_PORT ?? 8100;

// Migrations SQL versionnées appliquées au boot (activé dans l'image via
// RUN_MIGRATIONS ; off en dev, où l'on utilise `db:push`). Idempotent.
if (process.env.RUN_MIGRATIONS) {
  const migrationsFolder =
    process.env.MIGRATIONS_DIR ??
    fileURLToPath(new URL('../../../packages/echoppe-core/drizzle', import.meta.url));
  await runMigrations(migrationsFolder);
  console.log('[Migrate] Schéma à jour');
}

// Cibles référençables des entités déclarées (ADR-0046). Avant le `listen` : une entité déclarée
// avant le dernier redémarrage doit rester citable dès la première requête, et non à partir du
// prochain push.
await syncEntityReferences();

app.listen({ port: Number(port), hostname: '0.0.0.0' });

console.log(`🏪 Échoppe API running at http://localhost:${port}`);

// Amorçage du propriétaire (ADR-0057) : aucun compte ne naît d'une variable d'environnement. Une
// installation vide se signale ici, sinon elle n'aboutit qu'à un formulaire de connexion qu'aucun
// identifiant n'ouvre.
db.select({ id: user.id })
  .from(user)
  .limit(1)
  .then(([existing]) => {
    if (existing) return;
    console.log('\n⚠️  Aucun compte. Créez le propriétaire :');
    console.log('    docker compose exec -it api ./api admin:create\n');
  })
  .catch((err) => {
    console.error('[Init] Vérification du propriétaire impossible :', err);
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
