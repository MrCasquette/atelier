import { faults } from '@echoppe/core';
import { issuesFrom } from '@repo/fields';
import { Elysia } from 'elysia';
import { faultBody } from './lib/fault';

// Le point de conversion garanti qu'ADR-0050 exige, et qui n'existait pas : sans lui, une exception
// non rattrapée était rendue par le comportement par défaut d'Elysia — donc, selon les cas, avec le
// `message` de l'exception dans le corps. C'est très exactement l'invariant que l'ADR interdit :
// « le message d'une exception n'entre jamais dans un corps de réponse HTTP ».
//
// Ce qu'il ne fait PAS, et volontairement :
//
// - il ne convertit ni les routes inconnues (`NOT_FOUND`), ni les corps illisibles (`PARSE`). Ces
//   deux-là ne transportent aucun message d'exception métier, et Elysia leur rend déjà une forme
//   stable que le contrat n'améliore pas ;
// - il ne rend pas une `Fault` pour les pannes. ADR-0050 a explicitement écarté « tout structurer, y
//   compris l'infrastructure » : un code d'erreur pour une clé de chiffrement absente n'a aucun
//   destinataire capable d'agir. La réponse générique reste `{ message }`, en anglais, comme tout ce
//   qui s'adresse à un opérateur.
//
// Ce qu'il ajoute, c'est `incident` : l'identifiant opaque de l'amendement. Le détail part au log,
// l'utilisateur ne reçoit que la corrélation, et le support rebranche les deux.
//
// ── Les erreurs de VALIDATION, et le piège qu'elles contiennent ───────────────────────────────
//
// Elles étaient laissées à Elysia, et c'était défendable tant que nos propres 422 étaient eux aussi
// des `{ message }` : les deux formes coïncidaient. Elles ne coïncident plus, et `COMMON_ERRORS`
// ne déclare qu'UN schéma par statut — donc le 422 se rend d'un seul endroit, ici.
//
// Ce que la forme native d'Elysia servait, et qui disparaît sans regret : `message` et `summary` en
// anglais TypeBox, `expected`, et surtout `found` — les valeurs que l'appelant venait de soumettre,
// réfléchies dans la réponse.
//
//   VALIDATION (Elysia) — la source est dans `error.type`
//   ├── body      ┐
//   ├── query     │
//   ├── params    ├─→ 422 `validation_failed` : l'appelant a soumis quelque chose de refusé
//   ├── headers   │
//   ├── cookie    ┘
//   └── response  ─→ 500 + incident   ⚠ PAS un 422
//
// `response` mérite d'être lu deux fois. Elysia le classe sous `VALIDATION` comme les autres, et
// c'est trompeur : il ne signale pas une requête invalide mais une RÉPONSE de ce serveur qui ne
// respecte pas le schéma qu'elle déclare. C'est notre bug, pas celui de l'appelant. Le rendre en 422
// lui disait que sa requête était fautive — et lui envoyait au passage `property` et `found`,
// c'est-à-dire la structure interne de notre propre corps.
//
// Il emprunte donc exactement le chemin des exceptions non rattrapées : log complet, 500, incident.
// Résister à la tentation de l'aligner sur ses voisins.

/** Les cinq sources qui décrivent la requête. `response` en est délibérément absente. */
const REQUEST_VALIDATION = new Set(['body', 'query', 'params', 'headers', 'cookie']);

/**
 * La source d'un échec de validation, quand elle décrit la requête.
 *
 * Lue par garde et non par accès direct : `type` ne figure pas dans le type public de l'erreur
 * d'Elysia. Une version qui cesserait de le porter ferait tomber le cas dans le chemin d'incident —
 * un 500 de trop, jamais une fuite.
 */
function isRequestValidation(error: unknown): boolean {
  if (typeof error !== 'object' || error === null || !('type' in error)) return false;
  const { type } = error;
  return typeof type === 'string' && REQUEST_VALIDATION.has(type);
}

/** L'identifiant ne signifie rien par construction — c'est ce qui lui permet de ne rien divulguer. */
const newIncidentId = (): string => crypto.randomUUID();

export const errorHandler = new Elysia({ name: 'error-handler' }).onError(
  { as: 'global' },
  ({ code, error, status, request }) => {
    if (code === 'VALIDATION') {
      if (isRequestValidation(error)) {
        return status(422, faultBody(faults.validationFailed(issuesFrom(error.all))));
      }
      // Tout le reste — `response` en tête — tombe dans le chemin d'incident ci-dessous.
    } else if (code !== 'UNKNOWN' && code !== 'INTERNAL_SERVER_ERROR') {
      return;
    }

    const incident = newIncidentId();

    // `console.error` en attendant le logger structuré (jalon 6). C'est le SEUL endroit où le
    // détail d'une exception est écrit, et il n'en sort pas.
    console.error(
      `[incident ${incident}] ${request.method} ${new URL(request.url).pathname}`,
      error instanceof Error ? (error.stack ?? error.message) : error,
    );

    return status(500, { message: 'Internal server error', incident });
  },
);
