/**
 * Le guard qu'on écrit quand on lit du JSON qu'on n'a pas produit.
 *
 * Il vit ici parce qu'il était en train d'apparaître partout à l'identique — credentials
 * déchiffrés, réponses d'API tierces, corps de requête. Sa place naturelle est le paquet qui n'a
 * aucune dépendance : tout le monde peut l'atteindre, il ne tire rien avec lui.
 *
 * `Array.isArray` est exclu délibérément : un tableau est un objet en JavaScript, et le confondre
 * avec un enregistrement est exactement l'erreur qu'une assertion laissait passer.
 */
export const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);
