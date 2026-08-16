import type { RegistryIssue } from '@repo/shared';

// Cohérence d'un `link` d'entité avec les champs qu'il nomme (ADR-0046). Fonction PURE — aucune
// base, aucun transport, et c'est délibéré : une vérification de cohérence n'a pas à exiger une
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
 * Rend TOUTES les fautes, localisées. Sept `push` rédigeaient naguère sept phrases distinctes ;
 * remontés à leur prédicat, ils n'en font que TROIS — les paires ne différaient que par la
 * formulation. Un singleton dont la route attend un slug et une liste dont la route n'en a pas sont
 * la même faute vue des deux côtés : le mode de lien contredit la cardinalité.
 */
export function incoherentLinks(registry: Record<string, CheckedEntity>): RegistryIssue[] {
  const faults: RegistryIssue[] = [];

  for (const declaration of Object.values(registry)) {
    const link = declaration.link;
    if (!link) continue;
    const at = declaration.name;

    if (link.mode === 'route') {
      // Un singleton n'a pas de slug : son identité est son nom (ADR-0039).
      const hasSlug = link.route.includes(':slug');
      if (declaration.singleton === hasSlug) {
        faults.push({ path: at, reason: 'link_cardinality' });
      }
      continue;
    }

    if (link.mode === 'href') {
      faults.push(...citedField(at, declaration, link.field, 'text'));
      continue;
    }

    if (declaration.singleton) {
      faults.push({ path: at, reason: 'link_cardinality' });
      continue;
    }
    faults.push(...citedField(at, declaration, link.parent, 'ref'));
  }

  return faults;
}

/**
 * Le champ qu'un lien cite : présent, et du bon type.
 *
 * Deux prédicats que `href` et `anchor` évaluaient chacun de leur côté, avec des phrases différentes
 * pour la même chose. Seul le `kind` attendu les distingue.
 */
function citedField(
  at: string,
  declaration: CheckedEntity,
  name: string,
  expected: string,
): RegistryIssue[] {
  const field = declaration.fields.find((candidate) => candidate.name === name);
  if (!field) return [{ path: `${at}.${name}`, reason: 'link_unknown_field' }];
  if (field.kind !== expected) return [{ path: `${at}.${name}`, reason: 'link_field_type' }];
  return [];
}
