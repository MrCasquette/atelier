#!/usr/bin/env bun
// Garde de l'espace réservé `/-/` et de l'origine du dashboard (ADR-0052).
//
//   bun run reserved-space
//
// Deux règles que rien d'autre ne vérifie, et qui se perdent toutes les deux en silence.
//
// 1. LES SURFACES D'EXPLOITATION VIVENT SOUS `/-/`. Le dashboard, Scalar et le healthcheck sont
//    servis par l'API, au milieu de ses ressources. Un premier segment `-` n'étant jamais un nom
//    de ressource, la collision devient impossible — mais seulement tant que personne ne remonte
//    une de ces surfaces à la racine. C'est ce qu'on vérifie ici, plutôt que de l'espérer.
//
// 2. LE DASHBOARD N'APPREND JAMAIS L'ADRESSE DE L'API. Il est servi PAR elle et déduit sa base de
//    sa propre origine (`src/lib/api-base.ts`). `VITE_API_URL` était compilé dans le bundle, ce
//    qui rendait l'image publiée inutilisable ailleurs que sur localhost : une seule occurrence
//    qui repousse suffit à refaire le défaut, sans qu'aucun test ne tombe.

import { Glob } from 'bun';
import { readFileSync } from 'node:fs';
import { relative, resolve } from 'node:path';

const ROOT = resolve(import.meta.dir, '..');
const SCANNED = new Glob('apps/*/src/**/*.{ts,vue}');

// Ce qui doit vivre sous `/-/`, avec la trace qui prouve que ce n'est pas le cas.
//
// On vise le montage de PREMIER NIVEAU, pas le mot. `GET /products/admin` (la liste admin du
// catalogue) est une ressource parfaitement légitime : ce qui est interdit, c'est de monter une
// surface d'exploitation à la racine — un `prefix: '/admin'`, un plugin OpenAPI sur `/docs`.
const RESERVED = [
  { label: 'healthcheck', bad: /['"`]\/health['"`]/, good: '/-/health' },
  { label: 'documentation OpenAPI', bad: /path:\s*['"`]\/docs['"`]/, good: '/-/docs' },
  { label: 'dashboard', bad: /prefix:\s*['"`]\/admin['"`]/, good: '/-/admin' },
] as const;

const problems: string[] = [];

for (const hit of SCANNED.scanSync(ROOT)) {
  const path = resolve(ROOT, hit);
  const source = readFileSync(path, 'utf8');
  const where = relative(ROOT, path);

  for (const { label, bad, good } of RESERVED) {
    if (bad.test(source)) {
      problems.push(`${where} : ${label} hors de l'espace réservé — attendu sous \`${good}\`.`);
    }
  }

  // La LECTURE, pas le mot : `api-base.ts` cite la variable pour expliquer sa disparition, et
  // cette explication doit rester lisible sans faire tomber la garde.
  if (source.includes('import.meta.env.VITE_API_URL')) {
    problems.push(
      `${where} : lecture de VITE_API_URL — le dashboard déduit sa base de son origine ` +
        `(\`src/lib/api-base.ts\`), il n'apprend pas l'adresse de l'API.`,
    );
  }
}

if (problems.length > 0) {
  console.error('✗ Espace réservé `/-/` (ADR-0052) :\n');
  for (const problem of problems) console.error(`  • ${problem}`);
  console.error('\nCf. docs-internal/adr/ADR-0052-surfaces-exploitation-image-unique.md');
  process.exit(1);
}

console.log('✓ Surfaces d’exploitation sous `/-/`, et le dashboard ignore l’adresse de l’API.');
