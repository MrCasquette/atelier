import { db, sql } from '@repo/db';
import type { SerializedField } from '@repo/pages';
import {
  type EntityProjection,
  linkUrl,
  type ReferenceRegistry,
  type ReferenceTarget,
} from '@repo/references';
import { entityResourceName, entityTableName } from './ddl';
import type { EntityDeclaration, EntityRegistry } from './model';

// Une entité déclarée devient une cible référençable, sans code (ADR-0032, tenu par ADR-0046).
//
// Un SEUL descripteur sert toutes les entités : c'est ce qui fait qu'il n'y a rien à écrire. Là où
// `product` a le sien parce que sa table est connue à la compilation, une entité n'existe qu'au
// journal — on interroge donc sa table dérivée, dont les identifiants sont passés par la liste
// blanche de `ddl.ts`. Comme partout ici, les identifiants entrent dans le texte SQL, les valeurs
// sont liées.

/**
 * Champ qui sert de libellé dans un sélecteur : le PREMIER champ texte déclaré.
 *
 * Dérivé plutôt que déclaré. Un réglage de plus dans le DSL pour dire « c'est celui-là le titre »
 * se paierait sur chaque entité, alors que l'ordre de déclaration porte déjà l'intention : on écrit
 * le titre en premier. À défaut, le slug — qui est toujours lisible.
 */
function labelColumn(declaration: EntityDeclaration): string | null {
  for (const [name, field] of Object.entries(declaration.fields)) {
    if ((field as SerializedField).kind === 'text') return name;
  }
  return null;
}

/**
 * Colonne d'identité d'une occurrence. Un singleton n'a pas de slug : son identité est son nom
 * (ADR-0039), qu'on rend donc comme tel. Le littéral est sûr sans échappement — le nom est passé
 * par la liste blanche `[a-z][a-z0-9_]*`, qui ne laisse passer aucune apostrophe.
 */
function slugExpression(declaration: EntityDeclaration): string {
  return declaration.singleton ? `'${declaration.name}'::text as slug` : 'slug';
}

type RawRow = { id: string; slug: string; name: string | null; href: string | null };

/**
 * Ce qu'il faut lire pour projeter, selon le mode de lien.
 *
 * `href` demande la valeur du champ qui porte l'URL ; `anchor` demande l'identifiant du parent,
 * résolu ensuite. `route` ne demande rien de plus — le slug suffit, et c'est ce qui en fait le
 * cas courant.
 */
function hrefExpression(declaration: EntityDeclaration): string {
  const link = declaration.link;
  if (link?.mode === 'href') return `${link.field} as href`;
  if (link?.mode === 'anchor') return `${link.parent}::text as href`;
  return 'null::text as href';
}

function selection(declaration: EntityDeclaration): string {
  const label = labelColumn(declaration);
  return [
    'id',
    slugExpression(declaration),
    label ? `${label} as name` : 'null::text as name',
    hrefExpression(declaration),
  ].join(', ');
}

/**
 * URL d'une ancre : la route de l'entité parente, puis `#slug`.
 *
 * Deux niveaux de projection, et c'est irréductible — le lien d'une ancre n'est pas dans sa propre
 * ligne. On délègue le premier niveau à la cible parente, via le registre : elle seule sait où elle
 * vit, et `linkUrl` sait déjà en tirer une URL. Une parente disparue rend `null`, ce qui est un
 * lien cassé et non une panne (ADR-0032).
 */
async function anchorUrls(
  declaration: EntityDeclaration,
  rows: RawRow[],
  registry: ReferenceRegistry,
): Promise<Map<string, string | null>> {
  const link = declaration.link;
  if (link?.mode !== 'anchor') return new Map();

  const parentField = declaration.fields[link.parent] as SerializedField | undefined;
  const parentName = parentField?.kind === 'ref' ? parentField.to : undefined;
  const parent = parentName ? registry.get(parentName) : undefined;
  if (!parent) return new Map();

  const ids = [...new Set(rows.map((row) => row.href).filter((id): id is string => id !== null))];
  if (ids.length === 0) return new Map();

  const parents = new Map(
    (await parent.project(ids)).map((projection) => [projection.id, projection]),
  );

  const urls = new Map<string, string | null>();
  for (const row of rows) {
    const projected = row.href ? parents.get(row.href) : undefined;
    const base = projected ? linkUrl(parent, projected) : null;
    urls.set(row.id, base ? `${base}#${row.slug}` : null);
  }
  return urls;
}

async function toProjections(
  declaration: EntityDeclaration,
  rows: RawRow[],
  registry: ReferenceRegistry,
): Promise<EntityProjection[]> {
  const anchors = await anchorUrls(declaration, rows, registry);
  const mode = declaration.link?.mode;

  return rows.map((row) => ({
    id: row.id,
    slug: row.slug,
    // Le nom affiché retombe sur le slug plutôt que sur du vide : un sélecteur doit rester lisible
    // même pour une entité qui n'a aucun champ texte.
    name: row.name ?? row.slug,
    ...(mode === 'href' ? { url: row.href } : {}),
    ...(mode === 'anchor' ? { url: anchors.get(row.id) ?? null } : {}),
  }));
}

/**
 * Descripteur de cible d'une entité déclarée.
 *
 * Le registre est reçu en argument et lu à l'APPEL, pas à la construction : une ancre a besoin de
 * sa cible parente, qui peut être inscrite après elle. Le figer ici rendrait l'ordre d'inscription
 * signifiant, ce qu'aucune déclaration ne dit.
 */
export function entityReferenceTarget(
  declaration: EntityDeclaration,
  registry: ReferenceRegistry,
): ReferenceTarget {
  const table = entityTableName(declaration.name);
  const columns = selection(declaration);
  const label = labelColumn(declaration);

  return {
    // `entity:<nom>` partout : ressource RBAC comme cible référençable. La collision avec une cible
    // native — une entité nommée `page` — devient impossible par construction (ADR-0032, amendé).
    name: entityResourceName(declaration.name),
    label: declaration.label ?? declaration.name,
    // Une entité n'entre au registre que si elle déclare un lien : l'appelant l'a vérifié.
    link: declaration.link ?? { mode: 'route', route: `/${declaration.name}/:slug` },
    storage: { table },

    async project(ids) {
      if (ids.length === 0) return [];
      const rows = await db.execute<RawRow>(
        sql`${sql.raw(`select ${columns} from ${table} where id in `)}(${sql.join(
          ids.map((id) => sql`${id}`),
          sql`, `,
        )})`,
      );
      return toProjections(declaration, rows, registry);
    },

    async search(term, limit) {
      const bounded = Math.trunc(limit);
      // Sans champ texte, il n'y a rien où chercher : on rend les premières, ce qui reste utile.
      const rows =
        term && label
          ? await db.execute<RawRow>(
              sql`${sql.raw(`select ${columns} from ${table} where ${label} ilike `)}${`%${term}%`}${sql.raw(` limit ${bounded}`)}`,
            )
          : await db.execute<RawRow>(sql.raw(`select ${columns} from ${table} limit ${bounded}`));
      return toProjections(declaration, rows, registry);
    },
  };
}

const ENTITY_PREFIX = 'entity:';

/**
 * Aligne les cibles `entity:` du registre sur le journal.
 *
 * Appelée au démarrage et après chaque push : la SSOT, ce sont les fichiers du dev, et le registre
 * n'en est que le miroir — exactement le rapport qu'entretient la ressource RBAC (ADR-0038).
 *
 * Ne touche QUE les cibles `entity:`. `product`, `page`, `collection` sont inscrites par le produit
 * à l'import et ne doivent jamais disparaître parce qu'une entité a changé.
 */
export function syncEntityTargets(registry: ReferenceRegistry, journal: EntityRegistry): void {
  for (const name of registry.names()) {
    if (name.startsWith(ENTITY_PREFIX)) registry.unregister(name);
  }

  for (const declaration of Object.values(journal)) {
    // Pas de lien déclaré, pas de cible : ce qui rend une entité référençable est d'avoir une URL,
    // pas d'être déclarée (ADR-0032). Le silence la rend invisible dans le sélecteur, sans qu'on
    // ait à la marquer négativement.
    if (!declaration.link) continue;
    registry.register(entityReferenceTarget(declaration, registry));
  }
}
