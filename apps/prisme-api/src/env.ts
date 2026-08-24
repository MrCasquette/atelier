// Garde-fou de configuration — importé EN PREMIER par `index.ts`.
//
// Même contrainte que côté Échoppe : ce module ne DOIT importer ni `@repo/db`, ni `@prisme/core`,
// ni `./app`. Leur évaluation instancie le client Drizzle, qui throw lui-même sur `DATABASE_URL`
// absente — avant qu'on ait pu dire à l'exploitant CE QUI manque. Il reste donc autonome.
//
// La liste est plus courte que celle d'Échoppe, et le restera tant que Prisme n'a pas de secret à
// chiffrer : `ENCRYPTION_KEY` protège des credentials de paiement, que Prisme ne détient pas. Une
// variable s'ajoute ici quand une capacité l'exige, jamais par symétrie avec l'autre produit.

interface EnvCheck {
  readonly name: string;
  readonly ok: boolean;
  readonly hint: string;
}

export function validateEnv(): void {
  const checks: readonly EnvCheck[] = [
    {
      name: 'DATABASE_URL',
      ok: Boolean(process.env.DATABASE_URL),
      hint: 'chaîne de connexion Postgres (postgres://user:pass@host:5432/db)',
    },
  ];

  const invalid = checks.filter((c) => !c.ok);
  if (invalid.length === 0) return;

  console.error('[Env] Démarrage refusé — configuration invalide :');
  for (const c of invalid) console.error(`  ✗ ${c.name} : ${c.hint}`);
  process.exit(1);
}

validateEnv();
