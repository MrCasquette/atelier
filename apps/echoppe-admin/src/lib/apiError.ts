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

/**
 * Message d'erreur Eden, dans l'ordre où le contrat le prescrit (ADR-0050) :
 *
 * 1. la FAUTE, si le catalogue de cette administration connaît son code — c'est cette surface qui
 *    écrit son texte, pas le serveur ;
 * 2. le texte fourni par l'appelant, qui ne sert que si le catalogue ne connaît pas le code.
 *
 * Il y avait une étape intermédiaire, `message`, que l'API composait pour ses lecteurs. Elle a
 * disparu avec le champ : le serveur n'écrit plus de français. Le second repli reste indispensable —
 * l'API livrera un jour un code qu'une administration déployée plus tôt ne connaîtra pas.
 */
export function errorMessage(error: { value: unknown }, fallback: string): string {
  const fault = faultOf(error);
  return (fault ? faultText(fault) : null) ?? fallback;
}
