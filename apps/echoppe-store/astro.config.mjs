import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import node from '@astrojs/node';
import tailwindcss from '@tailwindcss/vite';
import { defineConfig } from 'astro/config';

// Le port se lit dans le `.env` RACINE, comme le fait le proxy Vite de l'admin — c'est là que vit
// le décalage de ports d'un poste encombré (cf. docs-internal/reference/ports.md).
//
// On lit le fichier, on ne compte ni sur `process.env` ni sur une expansion shell : Bun développe
// la ligne de script dans un shell qui n'a pas le dotenv en portée, ce qui faisait échouer
// silencieusement `--port ${STORE_PORT:-3141}` — le store restait sur 3141 quoi qu'on écrive.
const DEFAULT_PORT = 3141;

function storePort() {
  try {
    const raw = readFileSync(fileURLToPath(new URL('../../.env', import.meta.url)), 'utf8');
    const declared = raw.match(/^\s*STORE_PORT\s*=\s*(\d+)/m);
    return declared ? Number(declared[1]) : DEFAULT_PORT;
  } catch {
    return DEFAULT_PORT; // pas de .env : le port d'identité
  }
}

// SSR (topologie B) : les appels API se font côté serveur via le SDK @echoppe/client.
export default defineConfig({
  output: 'server',
  adapter: node({ mode: 'standalone' }),
  server: { port: storePort() },
  vite: {
    plugins: [tailwindcss()],
  },
});
