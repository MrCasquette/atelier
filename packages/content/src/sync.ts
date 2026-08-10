// Synchronisation du registre vers l'API (P2b) + vérification de dérive (P2c). Fonctions de lib
// DEP-FREE (fetch natif) : le dev peut les appeler depuis son propre script, ou via la CLI
// (cli.ts). Auth par clé (Bearer).
//
// Deux surfaces, un seul geste. Les définitions de blocs sont du jsonb miroir des fichiers du dev
// et se remplacent d'un bloc (`PUT /content/registry`) ; les entités deviennent de VRAIES TABLES
// et passent donc par le chemin check/push d'ADR-0027 (`/content/entities`). Les entités partent
// EN PREMIER : une section peut référencer une entité, l'inverse n'arrive pas.

import { serialize } from './serialize.js';
import type { ContentDefinition, Registry } from './types.js';

export interface PushOptions {
  apiUrl: string; // origine de l'API, ex. http://localhost:7532
  apiKey: string; // clé machine (scope write:schema pour push, read:content pour check), ex. eck_…
  fetch?: typeof fetch; // injectable (tests)
  /** Autorise un push qui DÉTRUIT des données (colonne ou table supprimée). Jamais par défaut. */
  confirmDestructive?: boolean;
}

export interface PushResult {
  ok: boolean;
  status: number;
  message?: string;
}

/** Une opération que le push appliquerait aux tables d'entités. */
export interface PlanStep {
  sql: string;
  destructive: boolean;
  summary: string;
}

// Résultat de `checkRegistry`. `ok` = les appels ont abouti ; `synced` = rien à pousser, ni
// définitions ni tables. `plan` dit, en clair, ce qu'un push ferait aux tables d'entités.
export interface CheckResult {
  ok: boolean;
  status: number;
  synced?: boolean;
  plan?: PlanStep[];
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

// Registre des définitions SEUL : c'est ce que `PUT /content/registry` attend, et c'est aussi
// exactement le JSON que ce dépôt poussait avant que les entités existent.
const definitionsOf = (registry: Registry): Omit<Registry, 'entities'> => ({
  version: registry.version,
  sections: registry.sections,
  components: registry.components,
});

type Requester = (path: string, init?: RequestInit) => Promise<Response>;

const requester =
  (options: PushOptions): Requester =>
  (path, init) =>
    (options.fetch ?? fetch)(new URL(path, options.apiUrl), {
      ...init,
      headers: {
        ...(init?.body ? { 'content-type': 'application/json' } : {}),
        authorization: `Bearer ${options.apiKey}`,
      },
    });

// Le plan arrive de l'API en `unknown` : on le réduit par un garde plutôt que de l'affirmer.
// Volontairement tolérant sur le contenu des étapes — ce qui compte ici, c'est qu'il y en ait, et
// combien. Les afficher est la seule chose qu'on en fasse.
function readPlan(body: unknown): { steps: PlanStep[]; blockers: string[] } | null {
  if (!body || typeof body !== 'object') return null;
  const { steps, blockers } = body as { steps?: unknown; blockers?: unknown };
  if (!Array.isArray(steps) || !Array.isArray(blockers)) return null;
  return {
    steps: steps.filter(
      (step): step is PlanStep =>
        !!step && typeof step === 'object' && 'sql' in step && 'summary' in step,
    ),
    blockers: blockers.filter((blocker): blocker is string => typeof blocker === 'string'),
  };
}

const failure = async (response: Response): Promise<PushResult> => ({
  ok: false,
  status: response.status,
  message: await extractMessage(response),
});

export async function pushRegistry(
  content: ContentDefinition,
  options: PushOptions,
): Promise<PushResult> {
  const registry = serialize(content);
  const request = requester(options);

  // Les entités d'abord : une section peut les référencer, et le registre refuse une cible
  // inconnue. Dans l'autre ordre, un premier push échouerait toujours.
  if (registry.entities) {
    const applied = await request('/content/entities', {
      method: 'PUT',
      body: JSON.stringify({
        entities: registry.entities,
        confirmDestructive: options.confirmDestructive === true,
      }),
    });
    if (!applied.ok) return failure(applied);
  }

  const synced = await request('/content/registry', {
    method: 'PUT',
    body: JSON.stringify(definitionsOf(registry)),
  });
  if (!synced.ok) return failure(synced);

  return { ok: true, status: synced.status };
}

export async function checkRegistry(
  content: ContentDefinition,
  options: PushOptions,
): Promise<CheckResult> {
  const local = serialize(content);
  const request = requester(options);

  const deployed = await request('/content/registry');
  if (!deployed.ok) {
    return { ok: false, status: deployed.status, message: await extractMessage(deployed) };
  }
  const remote: unknown = await deployed.json();
  const synced = canonical(definitionsOf(local)) === canonical(remote);

  // Pour les entités, comparer les déclarations ne suffirait pas : ce qui compte, c'est l'écart au
  // schéma RÉEL de la base — l'API seule sait le calculer, et le rendre en SQL lisible.
  const planned = await request('/content/entities/check', {
    method: 'POST',
    body: JSON.stringify({ entities: local.entities ?? {} }),
  });
  if (!planned.ok) {
    return { ok: false, status: planned.status, message: await extractMessage(planned) };
  }
  const plan = readPlan(await planned.json());
  if (!plan) {
    return { ok: false, status: planned.status, message: "Plan d'entités illisible." };
  }
  if (plan.blockers.length > 0) {
    return { ok: false, status: planned.status, message: plan.blockers.join(' · ') };
  }

  return {
    ok: true,
    status: deployed.status,
    synced: synced && plan.steps.length === 0,
    plan: plan.steps,
  };
}
