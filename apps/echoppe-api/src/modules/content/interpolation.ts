import { db, legalEntity, site } from '@echoppe/core';
import type { SerializedField } from '@repo/fields';
import { loadRegistry } from '@repo/pages';

// Interpolation de variables dans le contenu (ADR-0035, V1 humble).
//
// Une mention légale cite la raison sociale et le SIREN. Sans mécanisme, l'utilisateur les recopie
// à la main et elles se périment en silence. On stocke donc `{{ legal.name }}` EN CLAIR, jamais
// résolu à l'écriture — un outil externe lit une référence explicite plutôt qu'un nom mort —, et on
// substitue **à la lecture**, côté API : le front reçoit du texte prêt à afficher.
//
// ────────────────────────────────────────────────────────────────────────────────────────────────
// SUBSTITUER, JAMAIS ÉVALUER — INVARIANT (ADR-0035).
//
// Aucune expression, condition, boucle ni appel de fonction. Ce n'est pas une orientation, c'est une
// interdiction : la pente de tout gabarit est d'accueillir « juste une condition », puis « juste un
// filtre », et l'aboutissement est l'injection de gabarit côté serveur — quiconque édite du contenu
// exécute du code. Un besoin de logique relève d'une section déclarée, rendue par le front.
//
// Ce fichier ne doit donc JAMAIS gagner d'analyseur d'expression. S'il en gagne un, c'est que le
// besoin était ailleurs.
// ────────────────────────────────────────────────────────────────────────────────────────────────

type Identity = {
  site: typeof site.$inferSelect | undefined;
  legal: typeof legalEntity.$inferSelect | undefined;
};

/**
 * Le jeu de variables : **déclaré et fini**. Pas de chemin libre vers la base — `{{ user.passwordHash }}`
 * ou `{{ settings.stripeSecret }}` fuiterait dans du contenu public.
 *
 * Cet objet est la SSOT : le type union `ContentVariable` en dérive, donc ajouter une variable ici
 * suffit — la validation à l'écriture et l'autocomplétion de l'éditeur liront le même jeu.
 */
const VARIABLE_SOURCES = {
  'site.name': (i: Identity) => i.site?.name,
  'site.url': (i: Identity) => i.site?.url,
  'site.description': (i: Identity) => i.site?.description,
  'site.email': (i: Identity) => i.site?.publicEmail,
  'site.phone': (i: Identity) => i.site?.publicPhone,
  'site.publisher': (i: Identity) => i.site?.publisherName,
  'site.host': (i: Identity) => i.site?.hostName,
  'site.hostAddress': (i: Identity) => i.site?.hostAddress,
  'site.hostPhone': (i: Identity) => i.site?.hostPhone,
  'legal.name': (i: Identity) => i.legal?.name,
  'legal.form': (i: Identity) => i.legal?.legalForm,
  'legal.siren': (i: Identity) => i.legal?.siren,
  'legal.siret': (i: Identity) => i.legal?.siret,
  'legal.tva': (i: Identity) => i.legal?.tvaIntra,
  'legal.capital': (i: Identity) => i.legal?.shareCapital,
  'legal.rcsCity': (i: Identity) => i.legal?.rcsCity,
  'legal.street': (i: Identity) => i.legal?.street,
  'legal.postalCode': (i: Identity) => i.legal?.postalCode,
  'legal.city': (i: Identity) => i.legal?.city,
} as const satisfies Record<string, (identity: Identity) => string | null | undefined>;

/** Le jeu exposé, en union — SSOT unique (ADR-0035). */
export type ContentVariable = keyof typeof VARIABLE_SOURCES;

export const CONTENT_VARIABLES = Object.keys(VARIABLE_SOURCES) as ContentVariable[];

// `{{ nom.chemin }}`, espaces tolérés. Rien d'autre : pas d'argument, pas de filtre, pas d'appel.
const PLACEHOLDER = /\{\{\s*([a-z][a-zA-Z0-9_]*(?:\.[a-zA-Z0-9_]+)*)\s*\}\}/g;

/**
 * Échappe une valeur destinée à du Markdown (ADR-0030) : une raison sociale contenant `*` ou `[`
 * ne doit pas produire du balisage. Les champs `text` ne sont pas du Markdown et n'en ont pas
 * besoin — d'où le paramètre plutôt qu'un échappement systématique, qui afficherait les
 * antislashs.
 *
 * Jeu RESTREINT aux caractères qui produisent du balisage **où qu'ils soient** : emphase, code,
 * lien, HTML brut, tableau. Volontairement pas `.` `-` `#` `+` `!` `(` `)`, qui ne sont spéciaux
 * qu'en tête de ligne ou accolés à autre chose : les échapper partout rendrait
 * `bonjour@atelier\.test` là où une adresse doit simplement se lire.
 */
function escapeMarkdown(value: string): string {
  return value.replace(/[\\`*_[\]<>|]/g, (char) => `\\${char}`);
}

/**
 * Substitue les variables connues. **Une seule passe** : `String.replace` ne re-balaie jamais ce
 * qu'il vient d'insérer, donc une valeur qui contiendrait elle-même `{{ … }}` reste telle quelle et
 * la résolution ne peut pas boucler.
 *
 * Variable inconnue : le littéral reste. Jamais vider — une mention légale avec un trou blanc passe
 * inaperçue, `{{ legal.siren }}` affiché tel quel se voit tout de suite.
 */
export function interpolate(
  text: string,
  values: ReadonlyMap<string, string>,
  markdown: boolean,
): string {
  return text.replace(PLACEHOLDER, (literal, name: string) => {
    const value = values.get(name);
    if (value === undefined) return literal;
    return markdown ? escapeMarkdown(value) : value;
  });
}

/**
 * Lit l'identité et résout le jeu. Une variable dont la source est vide n'entre PAS dans la carte :
 * elle est alors traitée comme inconnue, donc laissée en littéral — c'est le comportement voulu,
 * un SIREN non renseigné doit se voir.
 */
export async function loadVariables(): Promise<ReadonlyMap<string, string>> {
  const [siteRow] = await db.select().from(site).limit(1);
  const [legalRow] = await db.select().from(legalEntity).limit(1);
  const identity: Identity = { site: siteRow, legal: legalRow };

  const values = new Map<string, string>();
  for (const [name, read] of Object.entries(VARIABLE_SOURCES)) {
    const value = read(identity);
    if (value !== null && value !== undefined && value !== '') values.set(name, value);
  }
  return values;
}

/**
 * Parcourt la donnée d'une section EN SUIVANT SA DÉCLARATION : seuls les champs `text` et `richText`
 * sont substitués (V1 humble). Guidé par la déclaration et non par la forme de la donnée, pour ne
 * jamais toucher à ce qui n'est pas du texte rédigé — un slug, une URL, un UUID de média.
 */
function interpolateFields(
  data: unknown,
  fields: readonly SerializedField[],
  context: Context,
): unknown {
  if (data === null || typeof data !== 'object' || Array.isArray(data)) return data;

  const source = data as Record<string, unknown>;
  const result: Record<string, unknown> = { ...source };

  // La DÉCLARATION est une séquence (ADR-0049), la DONNÉE reste indexée par nom de champ : on
  // parcourt donc la première pour adresser la seconde. L'ordre n'a ici aucune importance — on
  // réécrit des valeurs en place — mais suivre la déclaration reste la règle du parcours.
  for (const field of fields) {
    const key = field.name;
    const value = source[key];

    if ((field.kind === 'text' || field.kind === 'richText') && typeof value === 'string') {
      result[key] = interpolate(value, context.values, field.kind === 'richText');
      continue;
    }

    // Les trois formes composites. On descend dans TOUTES : le texte rédigé d'une page vit autant
    // dans un composant réutilisable ou une ligne de répéteur que dans un champ de premier niveau,
    // et n'en traiter qu'une partie ferait un mécanisme dont on ne peut pas dire où il s'applique.
    //
    // Pas de garde anti-cycle : le registre est refusé à la poussée s'il en contient un
    // (`assertRegistryCoherent`), donc la descente termine.
    if (field.kind === 'repeater' && Array.isArray(value)) {
      result[key] = value.map((item) => interpolateFields(item, field.fields, context));
      continue;
    }

    if (field.kind === 'component') {
      const of = context.components[field.of];
      if (of) result[key] = interpolateFields(value, of.fields, context);
      continue;
    }

    if (field.kind === 'list' && Array.isArray(value)) {
      const of = context.components[field.of];
      if (of) result[key] = value.map((item) => interpolateFields(item, of.fields, context));
    }
  }

  return result;
}

/** Ce qu'il faut sous la main pour descendre : les valeurs, et de quoi résoudre un composant. */
type Context = {
  values: ReadonlyMap<string, string>;
  components: Record<string, { fields: readonly SerializedField[] }>;
};

export type ResolvedSection = { id: string; type: string; data: unknown };

/**
 * Substitue dans les sections d'une page. Une section dont le type n'est plus au registre passe
 * intacte : le contenu ne se perd pas parce qu'une déclaration a disparu.
 */
export async function interpolateSections<T extends ResolvedSection>(sections: T[]): Promise<T[]> {
  if (sections.length === 0) return sections;

  const [registry, values] = await Promise.all([loadRegistry(), loadVariables()]);
  const context: Context = { values, components: registry.components };

  return sections.map((section) => {
    const declaration = registry.sections[section.type];
    if (!declaration) return section;
    return { ...section, data: interpolateFields(section.data, declaration.fields, context) };
  });
}
