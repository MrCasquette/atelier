import './env'; // garde-fou config — DOIT précéder tout import de @repo/db / @prisme/core / ./app
import { MIGRATIONS_DIR } from '@prisme/core';
import { runMigrations } from '@repo/db';
import { app } from './app';

export type { App } from './app';

// Rang 1 de la grille : `8200` appartient au produit installé, `8201` à `bun run dev` depuis les
// sources, `8202` à la validation de l'image (ADR-0054). Le port INTERNE du conteneur vaudra
// toujours `8200` — c'est l'instance qui possède le mapping, jamais le produit.
const port = process.env.API_PORT ?? 8200;

// Migrations SQL versionnées appliquées au boot (activé en image via RUN_MIGRATIONS ; off en
// développement, où l'on utilise `db:push`). Idempotent.
if (process.env.RUN_MIGRATIONS) {
  await runMigrations(process.env.MIGRATIONS_DIR ?? MIGRATIONS_DIR);
  console.log('[Migrate] Schéma à jour');
}

app.listen({ port: Number(port), hostname: '0.0.0.0' });

console.log(`🔷 Prisme API running at http://localhost:${port}`);

// Arrêt gracieux : SIGTERM en Docker, SIGINT en développement.
let stopping = false;

async function dispose(signal: string): Promise<void> {
  if (stopping) return;
  stopping = true;
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
