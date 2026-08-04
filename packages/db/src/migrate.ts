import { drizzle } from 'drizzle-orm/postgres-js';
import { migrate } from 'drizzle-orm/postgres-js/migrator';
import postgres from 'postgres';

/**
 * Applique les migrations SQL versionnées d'un dossier.
 *
 * Le RUNNER est générique et vit ici ; les FICHIERS de migration restent la propriété de chaque
 * cœur (ADR-0025), qui passe son propre dossier. C'est ce qui permet à deux produits d'avoir deux
 * historiques distincts sans dupliquer le mécanisme.
 *
 * Idempotent : seules les migrations non encore enregistrées (table `__drizzle_migrations`) sont
 * appliquées. Utilise une connexion dédiée (`max: 1`), fermée en fin d'exécution — indépendante du
 * pool applicatif.
 */
export async function runMigrations(migrationsFolder: string): Promise<void> {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error('DATABASE_URL is not set');
  }

  const client = postgres(connectionString, { max: 1 });
  try {
    await migrate(drizzle(client), { migrationsFolder });
  } finally {
    await client.end();
  }
}
