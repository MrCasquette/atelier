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

/** Message d'erreur Eden : `error.value` porte `{ message }` sur 403, 409, 422, 404… */
export function errorMessage(error: { value: unknown }, fallback: string): string {
  const value = error.value;
  if (isRecord(value) && typeof value.message === 'string') return value.message;
  return fallback;
}
