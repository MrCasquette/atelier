// Cohérence d'un `link` d'entité avec les champs qu'il nomme (ADR-0046). Fonction PURE — aucune
// base, aucun transport, et c'est délibéré : `model.ts` importe la grammaire TypeBox de
// `@repo/pages`, qui traîne la connexion. Une vérification de cohérence n'a pas à exiger une
// DATABASE_URL pour se tester.
//
// Les types d'entrée sont STRUCTURELS plutôt qu'importés du schéma : ce module n'a besoin que de
// savoir qu'un champ a un `kind`, et le découpler ainsi est ce qui le garde testable seul.

export type LinkDeclaration =
  | { mode: 'route'; route: string }
  | { mode: 'href'; field: string }
  | { mode: 'anchor'; parent: string };

type CheckedEntity = {
  name: string;
  singleton: boolean;
  link?: LinkDeclaration;
  /** Séquence, pas dictionnaire (ADR-0049) — on y cherche par nom, l'ordre n'importe pas ici. */
  fields: readonly { name: string; kind: string }[];
};

/**
 * Incohérences entre un `link` et les champs de son entité.
 *
 * Un `href` qui cite un champ inexistant, un `anchor` qui cite autre chose qu'un `ref` : ce sont
 * des liens qui ne se résoudront jamais, et rien ne le dirait avant la mise en ligne. Le DSL les
 * refuse déjà au dev, mais rien ne garantit qu'un registre poussé soit passé par ce chemin — une
 * clé d'API pousse ce qu'elle veut.
 *
 * Rend TOUTES les fautes, en clair : un dev doit savoir OÙ corriger, pas seulement que c'est
 * refusé. Même forme qu'`unknownRefTargets`.
 */
export function incoherentLinks(registry: Record<string, CheckedEntity>): string[] {
  const faults: string[] = [];

  for (const declaration of Object.values(registry)) {
    const link = declaration.link;
    if (!link) continue;
    const cite = `« ${declaration.name} »`;

    if (link.mode === 'route') {
      const hasSlug = link.route.includes(':slug');
      // Un singleton n'a pas de slug : son identité est son nom (ADR-0039).
      if (declaration.singleton && hasSlug) {
        faults.push(`${cite} est un singleton : sa route ne peut pas attendre de slug.`);
      } else if (!declaration.singleton && !hasSlug) {
        faults.push(`${cite} : la route « ${link.route} » ne contient pas « :slug ».`);
      }
      continue;
    }

    if (link.mode === 'href') {
      const field = declaration.fields.find((candidate) => candidate.name === link.field);
      if (!field) {
        faults.push(`${cite} : le lien cite « ${link.field} », champ non déclaré.`);
      } else if (field.kind !== 'text') {
        faults.push(`${cite} : « ${link.field} » doit être un champ texte pour porter une URL.`);
      }
      continue;
    }

    if (declaration.singleton) {
      faults.push(`${cite} est un singleton : il n'a pas de slug dont dériver une ancre.`);
      continue;
    }
    const parent = declaration.fields.find((candidate) => candidate.name === link.parent);
    if (!parent) {
      faults.push(`${cite} : le lien cite « ${link.parent} », champ non déclaré.`);
    } else if (parent.kind !== 'ref') {
      faults.push(`${cite} : « ${link.parent} » doit être un « ref » vers l'entité parente.`);
    }
  }

  return faults;
}
