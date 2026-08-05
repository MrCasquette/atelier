import { parseArgs } from 'node:util';
import { apiKey, db } from '@echoppe/core';
import { generateApiKey, isValidScope } from '../modules/api-key/service';

// Commande serveur d'AMORÇAGE d'une clé d'API (P2b) — accès DB direct, sans HTTP ni cookie.
// Usage typique au premier run / en CI, avant que l'admin ait une page de gestion :
//
//   bun run --cwd apps/echoppe-api api-key:create --name "CLI DPC" --scopes read:content,write:content
//   docker compose exec api bun run api-key:create --name CI --scopes write:content --expires 2027-01-01
//
// La clé est affichée UNE seule fois. `createdBy` est null (clé système, sans propriétaire humain
// → visible/révocable uniquement par l'Owner en gouvernance, cf. plugins/rbac).

function fail(message: string): never {
  console.error(`✗ ${message}`);
  process.exit(1);
}

const { values } = parseArgs({
  options: {
    name: { type: 'string' },
    scopes: { type: 'string' },
    expires: { type: 'string' },
  },
});

const name = values.name?.trim();
if (!name) {
  fail('--name requis (libellé lisible de la clé).');
}

const scopes = (values.scopes ?? '')
  .split(',')
  .map((scope) => scope.trim())
  .filter(Boolean);
if (scopes.length === 0) {
  fail('--scopes requis (ex. read:content,write:content).');
}
const invalidScopes = scopes.filter((scope) => !isValidScope(scope));
if (invalidScopes.length > 0) {
  fail(`Scopes invalides : ${invalidScopes.join(', ')}`);
}

const expiresAt = values.expires ? new Date(values.expires) : null;
if (expiresAt && Number.isNaN(expiresAt.getTime())) {
  fail('--expires doit être une date ISO valide (ex. 2027-01-01).');
}

const { plaintext, hash } = generateApiKey();
const [created] = await db
  .insert(apiKey)
  .values({ name, hash, scopes, createdBy: null, expiresAt })
  .returning();

console.log(`✓ Clé « ${created.name} » créée.`);
console.log(`  scopes : ${scopes.join(', ')}`);
if (expiresAt) {
  console.log(`  expire : ${expiresAt.toISOString()}`);
}
console.log('\n  Clé (copiez-la maintenant, non récupérable ensuite) :\n');
console.log(`  ${plaintext}\n`);
process.exit(0);
