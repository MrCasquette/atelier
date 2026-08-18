/**
 * Lecture d'un cookie par son nom, vérifiée.
 *
 * Elysia type le pot à cookies avec des valeurs `unknown` : il ne sait pas ce que le client a
 * envoyé, et il a raison — c'est une frontière. Onze appels affirmaient `{ value?: string }` pour
 * s'en accommoder, ce qui ne vérifiait rien : un cookie manipulé portant un objet ou un nombre
 * traversait l'affirmation et partait en jeton de session.
 */
export function cookieValue(
  jar: Record<string, { value?: unknown }>,
  name: string,
): string | undefined {
  const value = jar[name]?.value;
  return typeof value === 'string' ? value : undefined;
}

/**
 * Le pot à cookies réduit à ce qui est lisible : les entrées dont la valeur est une chaîne.
 *
 * `@repo/auth` déclare son `PrincipalRequest.cookie` avec des valeurs `string`, et il a raison —
 * un résolveur de principal n'a pas à se demander ce qu'est un cookie. C'est donc au produit, qui
 * seul connaît Elysia, de franchir la frontière avant d'entrer dans le socle.
 */
export function readableCookies(
  jar: Record<string, { value?: unknown }>,
): Record<string, { value?: string }> {
  const readable: Record<string, { value?: string }> = {};
  for (const [name, entry] of Object.entries(jar)) {
    if (typeof entry?.value === 'string') readable[name] = { value: entry.value };
  }
  return readable;
}
