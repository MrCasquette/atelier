// Synchronisation du registre vers l'API (P2b) + vérification de dérive (P2c). Fonctions de lib
// DEP-FREE (fetch natif) : le dev peut les appeler depuis son propre script, ou via la CLI
// (cli.ts). `pushRegistry` sérialise et pousse en `PUT /content/registry` ; `checkRegistry` compare
// le registre local au registre déployé (GET) pour détecter un oubli de push. Auth par clé (Bearer).

import { serialize } from './serialize.js';
import type { ContentDefinition } from './types.js';

export interface PushOptions {
  apiUrl: string; // origine de l'API, ex. http://localhost:7532
  apiKey: string; // clé machine (scope write:schema pour push, read:content pour check), ex. eck_…
  fetch?: typeof fetch; // injectable (tests)
}

export interface PushResult {
  ok: boolean;
  status: number;
  message?: string;
}

// Résultat de `checkRegistry`. `ok` = le GET a abouti ; `synced` = registre local === déployé.
export interface CheckResult {
  ok: boolean;
  status: number;
  synced?: boolean;
  message?: string;
}

// Tente de récupérer le message d'erreur structuré de l'API ({ message }).
async function extractMessage(response: Response): Promise<string | undefined> {
  try {
    const body: unknown = await response.json();
    if (body && typeof body === 'object' && 'message' in body && typeof body.message === 'string') {
      return body.message;
    }
  } catch {
    // corps non-JSON — message indéfini
  }
  return undefined;
}

// Sérialisation canonique (clés triées, `undefined` omis comme le fait JSON) : rend la comparaison
// insensible à l'ordre des clés et aligne le local (qui porte des `undefined`) sur le distant (JSON).
function canonical(value: unknown): string {
  if (Array.isArray(value)) {
    return `[${value.map(canonical).join(',')}]`;
  }
  if (value && typeof value === 'object') {
    const record = value as Record<string, unknown>;
    const keys = Object.keys(record)
      .filter((key) => record[key] !== undefined)
      .sort();
    return `{${keys.map((key) => `${JSON.stringify(key)}:${canonical(record[key])}`).join(',')}}`;
  }
  return JSON.stringify(value) ?? 'null';
}

export async function pushRegistry(
  content: ContentDefinition,
  options: PushOptions,
): Promise<PushResult> {
  const registry = serialize(content);
  const doFetch = options.fetch ?? fetch;
  const url = new URL('/content/registry', options.apiUrl);

  const response = await doFetch(url, {
    method: 'PUT',
    headers: {
      'content-type': 'application/json',
      authorization: `Bearer ${options.apiKey}`,
    },
    body: JSON.stringify(registry),
  });

  if (response.ok) {
    return { ok: true, status: response.status };
  }
  return { ok: false, status: response.status, message: await extractMessage(response) };
}

export async function checkRegistry(
  content: ContentDefinition,
  options: PushOptions,
): Promise<CheckResult> {
  const local = serialize(content);
  const doFetch = options.fetch ?? fetch;
  const url = new URL('/content/registry', options.apiUrl);

  const response = await doFetch(url, {
    headers: { authorization: `Bearer ${options.apiKey}` },
  });

  if (!response.ok) {
    return { ok: false, status: response.status, message: await extractMessage(response) };
  }
  const remote: unknown = await response.json();
  return { ok: true, status: response.status, synced: canonical(local) === canonical(remote) };
}
