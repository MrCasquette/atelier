import { Elysia } from 'elysia';

// Le point de conversion garanti qu'ADR-0050 exige, et qui n'existait pas : sans lui, une exception
// non rattrapée était rendue par le comportement par défaut d'Elysia — donc, selon les cas, avec le
// `message` de l'exception dans le corps. C'est très exactement l'invariant que l'ADR interdit :
// « le message d'une exception n'entre jamais dans un corps de réponse HTTP ».
//
// Ce qu'il ne fait PAS, et volontairement :
//
// - il ne convertit pas les erreurs de validation (`VALIDATION`), ni les routes inconnues
//   (`NOT_FOUND`), ni les corps illisibles (`PARSE`). Ces trois-là ne transportent aucun message
//   d'exception métier, et Elysia leur rend déjà une forme stable que le contrat n'améliore pas ;
// - il ne rend pas une `Fault`. ADR-0050 a explicitement écarté « tout structurer, y compris
//   l'infrastructure » : un code d'erreur pour une clé de chiffrement absente n'a aucun destinataire
//   capable d'agir. La réponse générique reste `{ message }`, en anglais, comme tout ce qui s'adresse
//   à un opérateur.
//
// Ce qu'il ajoute, c'est `incident` : l'identifiant opaque de l'amendement. Le détail part au log,
// l'utilisateur ne reçoit que la corrélation, et le support rebranche les deux.

/** L'identifiant ne signifie rien par construction — c'est ce qui lui permet de ne rien divulguer. */
const newIncidentId = (): string => crypto.randomUUID();

export const errorHandler = new Elysia({ name: 'error-handler' }).onError(
  { as: 'global' },
  ({ code, error, status, request }) => {
    if (code !== 'UNKNOWN' && code !== 'INTERNAL_SERVER_ERROR') return;

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
