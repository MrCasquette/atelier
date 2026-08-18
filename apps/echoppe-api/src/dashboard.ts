// Service statique du dashboard sous `/-/admin` (ADR-0052) : repli SPA, cache immuable sur les
// assets hachés, compression.
//
// Monté SEULEMENT si le dossier existe (l'image le copie ; en dev il n'est pas construit, et Vite
// sert le dashboard avec son HMR). Le repli est borné à ce préfixe : hors de lui, un chemin inconnu
// reste une faute JSON — une SPA rendue à la place d'un 404 casserait le contrat d'ADR-0050.
import { existsSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { Elysia } from 'elysia';

const DIR = resolve(process.env.DASHBOARD_DIR ?? join(import.meta.dir, '../../../dashboard'));
const INDEX = join(DIR, 'index.html');
const PREFIX = '/-/admin';

const MIME: Record<string, string> = {
  html: 'text/html; charset=utf-8',
  js: 'text/javascript; charset=utf-8',
  css: 'text/css; charset=utf-8',
  json: 'application/json; charset=utf-8',
  svg: 'image/svg+xml',
  ico: 'image/x-icon',
  png: 'image/png',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  webp: 'image/webp',
  woff: 'font/woff',
  woff2: 'font/woff2',
};

// Compressible = texte. Les images et polices sont déjà compressées ; les re-gziper coûte du CPU
// pour quelques octets.
const COMPRESSIBLE = new Set(['html', 'js', 'css', 'json', 'svg']);

/** Le dossier `assets/` de Vite porte un hash par fichier → son contenu ne change jamais. */
function cacheControl(path: string): string {
  return path.startsWith('assets/') ? 'public, max-age=31536000, immutable' : 'no-cache';
}

// Le dist entier tient en mémoire (~1,2 Mo) : on gzip une fois, à la première demande.
const gzipped = new Map<string, Blob>();

async function body(
  file: Bun.BunFile,
  key: string,
  ext: string,
  acceptsGzip: boolean,
): Promise<{ data: Blob | Bun.BunFile; encoding?: 'gzip' }> {
  if (!acceptsGzip || !COMPRESSIBLE.has(ext)) return { data: file };
  let data = gzipped.get(key);
  if (!data) {
    data = new Blob([Bun.gzipSync(new Uint8Array(await file.arrayBuffer()))]);
    gzipped.set(key, data);
  }
  return { data, encoding: 'gzip' };
}

async function serve(relative: string, request: Request): Promise<Response> {
  // Le chemin vient du réseau : on le résout et on vérifie qu'il n'échappe pas du dossier
  // (`..%2f` et compagnie). Sans cette borne, le dashboard servirait tout le conteneur.
  const target = resolve(join(DIR, relative));
  const inside = target === DIR || target.startsWith(`${DIR}/`);
  const file = inside ? Bun.file(target) : Bun.file(INDEX);
  const exists = inside && relative !== '' && (await file.exists());

  const path = exists ? relative : 'index.html';
  const served = exists ? file : Bun.file(INDEX);
  const ext = path.split('.').pop() ?? 'html';

  const acceptsGzip = (request.headers.get('accept-encoding') ?? '').includes('gzip');
  const { data, encoding } = await body(served, path, ext, acceptsGzip);

  const headers: Record<string, string> = {
    'content-type': MIME[ext] ?? 'application/octet-stream',
    'cache-control': cacheControl(path),
  };
  if (encoding) headers['content-encoding'] = encoding;

  return new Response(data, { headers });
}

// Pas de redirection de `/-/admin` vers `/-/admin/` : Elysia normalise le slash final, donc les
// deux formes atteignent la même route et une redirection boucle. Les deux servent l'index — les
// assets sont référencés en absolu (`base` de Vite), le slash n'a donc aucune importance.
export const dashboard = existsSync(INDEX)
  ? new Elysia({ name: 'dashboard' })
      .get(PREFIX, ({ request }) => serve('', request))
      .get(`${PREFIX}/*`, ({ params, request }) => serve(params['*'] ?? '', request))
  : new Elysia({ name: 'dashboard' });
