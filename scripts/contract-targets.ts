// Découverte des contrats SDK à générer — source unique, partagée par `contracts.ts` (garde CI)
// et par le gate de release (`apps/*-api/scripts/integration.ts`). Sans elle, les deux
// dupliquaient la liste des fichiers figés et pouvaient diverger.
//
// DÉCOUVERTE PAR DÉCLARATION, pas par convention de nom. Un client est généré depuis une API ;
// c'est donc à LUI de nommer sa source, dans son `package.json` :
//
//   "contract": {
//     "source": "apps/echoppe-api",
//     "frozen": ["src/openapi.ts", "src/models.ts", "src/facade.ts"]
//   }
//
// On n'infère jamais `apps/<produit>-api` depuis `packages/<produit>-client` : cette convention
// tiendrait tant que personne ne la casse, et rien ne le vérifierait. Ici, une source absente ou
// dépourvue de `serve-contract.ts` fait échouer la découverte en nommant le fautif.

import { Glob } from 'bun';
import { readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';

export const ROOT = resolve(import.meta.dir, '..');

/** Point d'entrée qui sert l'app pure sur `/docs/json`, relatif au workspace source. */
const SERVE_CONTRACT = 'src/scripts/serve-contract.ts';

export type ContractTarget = {
  /** Workspace du client généré — ex. `packages/echoppe-client`. */
  readonly client: string;
  /** Workspace de l'API dont le contrat est tiré — ex. `apps/echoppe-api`. */
  readonly source: string;
  /** Entrée à lancer pour servir le contrat, relative à la racine. */
  readonly serveContract: string;
  /** Fichiers figés à comparer, relatifs à la racine. */
  readonly frozen: readonly string[];
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function fail(message: string): never {
  console.error(`✗ ${message}`);
  process.exit(1);
}

export function contractTargets(root: string = ROOT): readonly ContractTarget[] {
  const targets: ContractTarget[] = [];
  const glob = new Glob('{packages,apps}/*/package.json');

  for (const hit of glob.scanSync({ cwd: root, onlyFiles: true })) {
    if (hit.includes('node_modules')) continue;

    const manifest: unknown = JSON.parse(readFileSync(join(root, hit), 'utf8'));
    if (!isRecord(manifest) || !isRecord(manifest.contract)) continue;

    const client = dirname(hit);
    const declaration = manifest.contract;
    const source = declaration.source;
    if (typeof source !== 'string') {
      fail(`${hit} : \`contract.source\` manquant ou non textuel.`);
    }

    const frozen = Array.isArray(declaration.frozen)
      ? declaration.frozen.filter((f): f is string => typeof f === 'string')
      : [];
    if (frozen.length === 0) {
      fail(`${hit} : \`contract.frozen\` vide — aucun fichier à garder contre la dérive.`);
    }

    const serveContract = join(source, SERVE_CONTRACT);
    if (!Bun.file(join(root, serveContract)).size) {
      fail(
        `${client} déclare sa source \`${source}\`, mais \`${serveContract}\` est introuvable.\n` +
          "  Sans lui, aucun contrat ne peut être servi hors-ligne.",
      );
    }

    targets.push({
      client,
      source,
      serveContract,
      frozen: frozen.map((f) => join(client, f)),
    });
  }

  return targets.sort((a, b) => a.client.localeCompare(b.client));
}
