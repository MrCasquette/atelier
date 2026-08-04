import { type TSchema, t } from 'elysia';
import type { ModelName } from '../models';

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

// Corps 404 uniforme (UI FR, accents corrects) : `status(404, notFound('Collection'))`. Évite les
// messages disparates (« Collection non trouvee » sans accent / « Collection not found » en anglais).
export function notFound(entity: string): { message: string } {
  return { message: `${entity} introuvable` };
}

// ============================================
// Réponses d'erreur HTTP communes
// ============================================

/** 400 Bad Request - Requête invalide */
export const badRequestResponse = t.Object(
  {
    message: t.String({ description: "Détail de l'erreur de validation" }),
  },
  { description: 'Requête invalide - Données manquantes ou incorrectes' },
);

/** 401 Unauthorized - Non authentifié */
export const unauthorizedResponse = t.Object(
  {
    message: t.String({ description: "Raison du refus d'authentification" }),
  },
  { description: 'Non authentifié - Session invalide ou expirée' },
);

/** 403 Forbidden - Permission refusée */
export const forbiddenResponse = t.Object(
  {
    message: t.String({ description: 'Permission manquante' }),
  },
  { description: 'Permission refusée - Droits insuffisants' },
);

/** 404 Not Found - Ressource non trouvée */
export const notFoundResponse = t.Object(
  {
    message: t.String({ description: 'Ressource non trouvée' }),
  },
  { description: 'Ressource non trouvée' },
);

/** 409 Conflict - Conflit de données */
export const conflictResponse = t.Object(
  {
    message: t.String({ description: 'Détail du conflit' }),
  },
  { description: 'Conflit - La ressource existe déjà ou est en conflit' },
);

/** 422 Unprocessable Entity - Erreur de validation métier */
export const unprocessableResponse = t.Object(
  {
    message: t.String({ description: "Détail de l'erreur métier" }),
  },
  { description: 'Entité non traitable - Règle métier non respectée' },
);

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
  },
  { description: 'Erreur serveur interne' },
);

/** 503 Service Unavailable - Service indisponible */
export const serviceUnavailableResponse = t.Object(
  {
    message: t.String({ description: 'Service temporairement indisponible' }),
  },
  { description: 'Service indisponible - Réessayez plus tard' },
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
// NOTE : les shapes d'erreur restent INLINE pour l'instant ; le passage au modèle nommé
// `ErrorResponse` (dédup + type client) se fera au flip final, une fois toutes les routes
// migrées sur `.use(models)` (contrainte de propagation enfant→parent des modèles Elysia).

/** Socle d'erreurs universel : validation d'input (422) + erreur serveur (500). */
const COMMON_ERRORS = { 422: unprocessableResponse, 500: serverErrorResponse };

/** Routes publiques de lecture (liste/détail sans not-found) : uniquement le socle. */
export function withReadErrors<const T extends ResponseMap>(responses: T) {
  return { ...responses, ...COMMON_ERRORS };
}

/** Routes protégées par auth : 401 + 403 (+ socle). */
export function withAuthErrors<const T extends ResponseMap>(responses: T) {
  return { ...responses, ...COMMON_ERRORS, 401: unauthorizedResponse, 403: forbiddenResponse };
}

/** Routes avec rate limiting : 429 (+ socle). */
export function withRateLimitErrors<const T extends ResponseMap>(responses: T) {
  return { ...responses, ...COMMON_ERRORS, 429: rateLimitResponse };
}

/** Routes d'authentification (login/register) : 401 + 403 + 429 (+ socle). */
export function withLoginErrors<const T extends ResponseMap>(responses: T) {
  return {
    ...responses,
    ...COMMON_ERRORS,
    401: unauthorizedResponse,
    403: forbiddenResponse,
    429: rateLimitResponse,
  };
}

/** Routes CRUD protégées : 401 + 403 + 404 (+ socle). */
export function withCrudErrors<const T extends ResponseMap>(responses: T) {
  return {
    ...responses,
    ...COMMON_ERRORS,
    401: unauthorizedResponse,
    403: forbiddenResponse,
    404: notFoundResponse,
  };
}

/** Routes publiques pouvant ne pas trouver la ressource : 404 (+ socle). */
export function withNotFound<const T extends ResponseMap>(responses: T) {
  return { ...responses, ...COMMON_ERRORS, 404: notFoundResponse };
}

/** Routes dépendant de services externes : 503 (+ socle, qui inclut déjà 500). */
export function withServiceErrors<const T extends ResponseMap>(responses: T) {
  return { ...responses, ...COMMON_ERRORS, 503: serviceUnavailableResponse };
}

/** Combinaison complète CRUD + rate limit : 401 + 403 + 404 + 429 (+ socle). */
export function withFullErrors<const T extends ResponseMap>(responses: T) {
  return {
    ...responses,
    ...COMMON_ERRORS,
    401: unauthorizedResponse,
    403: forbiddenResponse,
    404: notFoundResponse,
    429: rateLimitResponse,
  };
}
