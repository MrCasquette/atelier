/**
 * Le seul guard dont ce paquet a besoin pour lire du JSON qu'il n'a pas produit.
 *
 * Il vit ici depuis son deuxième usage : `fault-text` le tenait privé, et `sync` s'en passait par
 * une assertion — laquelle n'aurait rien empêché, puisqu'elle ne vérifie rien.
 */
export const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);
