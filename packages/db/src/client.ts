import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';

// Connexion applicative — singleton de module, une par processus. Une installation d'Échoppe et
// une de Prisme sont deux applications, deux déploiements, deux bases : elles ne cohabitent jamais
// dans le même processus. Le mécanisme de connexion n'a donc rien de spécifique à un produit,
// contrairement au schéma et aux migrations, qui restent la propriété de chaque cœur (ADR-0025).
//
// `db` n'est PAS lié à un schéma : `drizzle(client, { schema })` ne sert qu'aux Relational Queries
// (`db.query.*`), dont le projet ne fait aucun usage — mesuré, 0 occurrence. C'est ce qui permet à
// ce paquet de ne dépendre d'aucune structure. Un cœur qui en aurait besoin un jour construit sa
// propre liaison à partir du même `client` : une connexion, plusieurs liaisons possibles.
//
// Le throw à l'import est délibéré, mais il n'est PAS le message d'erreur destiné à l'opérateur :
// c'est `apps/*/src/env.ts` qui produit le diagnostic lisible, en s'évaluant avant ce module.
const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error('DATABASE_URL environment variable is not set');
}

export const client = postgres(connectionString);

export const db = drizzle(client);

export type Database = typeof db;
