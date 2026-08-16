import { type TSchema, t } from 'elysia';
import type { ModelName } from '../model';

// ============================================
// Schemas de réponse communs
// ============================================

/**
 * Schema d'erreur générique avec message.
 * @deprecated Utiliser les schémas spécifiques (notFoundResponse, badRequestResponse, etc.)
 */
export const errorSchema = t.Object({
  message: t.String({ description: "Description de l'erreur" }),
});

/** Schema de succès simple */
export const successSchema = t.Object({
  success: t.Literal(true, { description: 'Opération réussie' }),
});

/** Schema de message de succès */
export const messageSchema = t.Object({
  message: t.String({ description: 'Message de confirmation' }),
});

// ============================================
// Réponses d'erreur HTTP communes
// ============================================

/** 429 Too Many Requests - Rate limit dépassé */
export const rateLimitResponse = t.Object(
  {
    message: t.String({ description: "Temps d'attente avant nouvelle tentative" }),
  },
  { description: 'Trop de requêtes - Limite de débit dépassée' },
);

/** 500 Internal Server Error - Erreur serveur */
export const serverErrorResponse = t.Object(
  {
    message: t.String({ description: 'Erreur interne' }),
    // Rempli par le `onError` global : le détail reste au log, l'appelant n'a que la corrélation.
    incident: t.Optional(t.String({ description: 'Corrélation opaque vers la trace serveur' })),
  },
  { description: 'Erreur serveur interne' },
);

// ============================================
// Types de réponse
// ============================================

// Une réponse peut être un schéma (TSchema) OU le nom d'un modèle enregistré dans le
// registre central (src/models) — union stricte `ModelName`, pas un `string` permissif.
// Un nom → référence $ref dans l'OpenAPI (composant réutilisable).
type ResponseMap = Record<number, TSchema | ModelName>;

// ============================================
// Helpers pour combiner les réponses
// ============================================
//
// Chaque helper ajoute :
// - un SOCLE UNIVERSEL d'erreurs (422 validation d'input, émise auto par Elysia ; 500
//   serveur) présent sur quasiment toutes les routes ;
// - les codes spécifiques au type de route (401/403/404/429/503…).
// `const T` préserve les littéraux (noms de modèles) passés en entrée.
//
// 401, 403 et 404 sont CONTRACTUELS : ils rendent `ErrorResponse`, le modèle nommé d'ADR-0050, donc
// un `$ref` unique dans l'OpenAPI au lieu d'un `{ message }` recopié par route. Il n'existe plus de
// second jeu de helpers « migrés » : `withCrudFaults` et `withNotFoundFault` ont fusionné avec
// `withCrudErrors` et `withNotFound` le jour où le dernier des 82 sites 404 a basculé. Deux jeux
// n'avaient de raison d'être que pendant la coexistence.
//
// Restent hérités, en `{ message }`, les statuts dont aucune tranche n'est encore passée : 429, 500
// et 503.

/**
 * Socle d'erreurs universel : validation d'entrée (422) + erreur serveur (500).
 *
 * Le 422 est contractuel depuis que le `onError` global convertit les erreurs de validation
 * d'Elysia. Il fallait qu'il le devienne : ce statut a SIX producteurs — les cinq sources de requête
 * validées par Elysia, plus nos propres handlers —, et un statut ne déclare qu'un schéma. Tant que
 * les deux formes coexistaient, celle qu'annonçait le contrat était fausse pour l'autre moitié.
 *
 * Le 500, lui, reste `{ message }` : il s'adresse à un opérateur, pas à un appelant capable d'agir.
 */
const COMMON_ERRORS: { 422: 'ErrorResponse'; 500: typeof serverErrorResponse } = {
  422: 'ErrorResponse',
  500: serverErrorResponse,
};

/**
 * Les codes contractuels, par MODÈLE NOMMÉ.
 *
 * L'annotation de type n'est pas décorative et `as const` ne la remplace PAS : `as const` ajoute
 * `readonly`, et le littéral `'ErrorResponse'` ne survit alors pas au spread — il s'élargit en
 * `string`, Elysia cesse d'y voir un nom de modèle, et lit le statut comme du texte. Les routes
 * deviennent intypables, avec des messages qui accusent l'union discriminée (`resource: never`)
 * alors que la cause est ici. Mesuré sur les deux formes.
 */
const AUTH_ERRORS: { 401: 'ErrorResponse'; 403: 'ErrorResponse' } = {
  401: 'ErrorResponse',
  403: 'ErrorResponse',
};

const NOT_FOUND_ERROR: { 404: 'ErrorResponse' } = { 404: 'ErrorResponse' };

/** Routes publiques de lecture (liste/détail sans not-found) : uniquement le socle. */
export function withReadErrors<const T extends ResponseMap>(responses: T) {
  return { ...responses, ...COMMON_ERRORS };
}

/** Routes protégées par auth : 401 + 403 (+ socle). */
export function withAuthErrors<const T extends ResponseMap>(responses: T) {
  return { ...COMMON_ERRORS, ...AUTH_ERRORS, ...responses };
}

/** Routes avec rate limiting : 429 (+ socle). */
export function withRateLimitErrors<const T extends ResponseMap>(responses: T) {
  return { ...responses, ...COMMON_ERRORS, 429: rateLimitResponse };
}

/** Routes d'authentification (login/register) : 401 + 403 + 429 (+ socle). */
export function withLoginErrors<const T extends ResponseMap>(responses: T) {
  return { ...COMMON_ERRORS, ...AUTH_ERRORS, 429: rateLimitResponse, ...responses };
}

/** Routes CRUD protégées : 401 + 403 + 404 (+ socle). */
export function withCrudErrors<const T extends ResponseMap>(responses: T) {
  return { ...COMMON_ERRORS, ...AUTH_ERRORS, ...NOT_FOUND_ERROR, ...responses };
}

/** Routes publiques pouvant ne pas trouver la ressource : 404 (+ socle). */
export function withNotFound<const T extends ResponseMap>(responses: T) {
  return { ...COMMON_ERRORS, ...NOT_FOUND_ERROR, ...responses };
}

/**
 * Routes dépendant de services externes : 503 (+ socle, qui inclut déjà 500).
 *
 * Le 503 est contractuel. Son unique appelant sert un visiteur ANONYME, à qui la faute est réduite —
 * `service_unavailable` sans opérande, là où le domaine sait dire pourquoi (cf. `contact`).
 */
export function withServiceErrors<const T extends ResponseMap>(responses: T) {
  return { ...responses, ...COMMON_ERRORS, 503: 'ErrorResponse' as const };
}

/** Combinaison complète CRUD + rate limit : 401 + 403 + 404 + 429 (+ socle). */
export function withFullErrors<const T extends ResponseMap>(responses: T) {
  return {
    ...COMMON_ERRORS,
    ...AUTH_ERRORS,
    ...NOT_FOUND_ERROR,
    429: rateLimitResponse,
    ...responses,
  };
}
