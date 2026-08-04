// Garde-fou de configuration — validé au tout début du bootstrap (importé EN PREMIER par index.ts).
//
// Le framework est self-hostable : l'opérateur d'une boutique doit obtenir une erreur CLAIRE et
// immédiate si sa config est incomplète, pas un crash cryptique tardif (ex. `ENCRYPTION_KEY` absente
// qui n'échoue qu'au premier paiement, ou le throw brut du client Drizzle sur `DATABASE_URL`).
//
// Contrainte de conception : ce module ne DOIT importer ni `@echoppe/core` ni `./app` — leur
// évaluation instancie le client DB qui throw lui-même sur `DATABASE_URL` absente, AVANT qu'on ait
// pu afficher un message propre. Il est donc volontairement autonome (revalide `ENCRYPTION_KEY`
// localement plutôt que via `core.isEncryptionConfigured`). N'est jamais chargé par `app.ts` (pure)
// ni par les tests → ne touche pas leur exécution.

// ENCRYPTION_KEY = 32 octets en base64 (même contrainte que `core/utils/crypto`), sans importer core.
function encryptionKeyValid(): boolean {
  const key = process.env.ENCRYPTION_KEY;
  if (!key) return false;
  try {
    return Buffer.from(key, 'base64').length === 32;
  } catch {
    return false;
  }
}

interface EnvCheck {
  readonly name: string;
  readonly ok: boolean;
  readonly hint: string;
}

// Variables CRITIQUES uniquement — leur absence casse le runtime ou la sécurité. Les optionnelles
// (API_PORT, REDIS_URL, ADMIN_URL, STORE_URL, UPLOAD_DIR, ADMIN_EMAIL/PASSWORD…) ont des défauts sûrs.
export function validateEnv(): void {
  const checks: readonly EnvCheck[] = [
    {
      name: 'DATABASE_URL',
      ok: Boolean(process.env.DATABASE_URL),
      hint: 'chaîne de connexion Postgres (postgres://user:pass@host:5432/db)',
    },
    {
      name: 'ENCRYPTION_KEY',
      ok: encryptionKeyValid(),
      hint: 'clé de chiffrement des secrets — 32 octets en base64 (openssl rand -base64 32)',
    },
  ];

  const invalid = checks.filter((c) => !c.ok);
  if (invalid.length === 0) return;

  console.error('[Env] Démarrage refusé — configuration invalide :');
  for (const c of invalid) console.error(`  ✗ ${c.name} : ${c.hint}`);
  process.exit(1);
}

validateEnv();
