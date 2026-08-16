import { faultOf, faultText } from '@/lib/fault';

// Ce que le serveur A DIT, plutôt qu'un message générique de l'interface.
//
// Les refus de l'API sont explicites — « Droits non détenus, donc non délégables : schema »,
// « Ce slug est déjà pris » — et les remplacer par « Erreur lors de la mise à jour » retire à
// l'utilisateur la seule chose qui lui dit quoi faire. Le repli ne sert que si le serveur s'est tu.

/** Issue d'un enregistrement : le message n'accompagne que l'échec. */
export interface SaveResult {
  ok: boolean;
  message?: string;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/**
 * Message d'erreur Eden, dans l'ordre où le contrat le prescrit (ADR-0050) :
 *
 * 1. la FAUTE, si la route est migrée et que le catalogue de l'administration connaît son code —
 *    c'est cette surface qui écrit son texte, pas le serveur ;
 * 2. `message`, encore rempli par l'API pendant la transition — le repli obligatoire du §6 ;
 * 3. le texte fourni par l'appelant, qui ne sert que si le serveur s'est tu.
 *
 * L'étape 2 disparaîtra avec `message` ; l'ordre, lui, ne changera pas.
 */
export function errorMessage(error: { value: unknown }, fallback: string): string {
  const fault = faultOf(error);
  const fromCatalog = fault ? faultText(fault) : null;
  if (fromCatalog) return fromCatalog;

  const value = error.value;
  if (isRecord(value) && typeof value.message === 'string') return value.message;
  return fallback;
}
