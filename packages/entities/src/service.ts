import { db, sql } from '@repo/db';
import { TypeCompiler } from 'elysia/type-system';
import {
  addColumnSql,
  type ColumnSpec,
  createTableSql,
  dropColumnSql,
  dropTableSql,
  entityTableName,
  fieldColumns,
  IDENTITY_COLUMNS,
  isValidIdentifier,
} from './ddl';
import { type EntityDeclaration, type EntityRegistry, entityRegistrySchema } from './model';
import { entityDefinition } from './schema';

// Compilé une fois : sert à relire le journal sans truster du jsonb (cf. `loadEntities`).
const registryCheck = TypeCompiler.Compile(entityRegistrySchema);

// `check` montre, `push` applique — l'ergonomie de drizzle-kit (ADR-0027). Les deux passent par le
// MÊME plan : ce que `check` affiche est exactement ce que `push` exécutera, sans quoi le `check`
// ne servirait à rien.
//
// La source d'autorité, ce sont les fichiers du dev. Le DDL n'est pas un acte d'écriture, c'est la
// conséquence d'une déclaration versionnée en git.

/** Une opération du plan. `destructive` décide à elle seule si `push` peut passer sans aval. */
export type PlanStep = {
  sql: string;
  destructive: boolean;
  /** Ce que l'opération fait, en clair — c'est ce qu'un dev lit avant de dire oui. */
  summary: string;
};

export type EntityPlan = {
  steps: PlanStep[];
  /** Refus définitifs : rien ne les débloque, pas même une confirmation. */
  blockers: string[];
};

// ── Lecture du schéma RÉEL ────────────────────────────────────────────────────────────────────

type LiveTable = { columns: Map<string, string>; rows: number; singleton: boolean };

/**
 * État réel des tables d'entités, lu dans `information_schema`.
 *
 * C'est la base qui fait foi de ce qui EXISTE — pas le journal. Le journal dit ce qui a été
 * déclaré ; les deux peuvent diverger si quelqu'un est passé par psql, et c'est précisément le
 * genre de divergence qu'un `check` doit montrer.
 */
async function readLiveTable(name: string): Promise<LiveTable | null> {
  const table = entityTableName(name);

  const columns = await db.execute<{ column_name: string; data_type: string }>(sql`
    select column_name, data_type
    from information_schema.columns
    where table_schema = 'public' and table_name = ${table}
  `);
  if (columns.length === 0) return null;

  // `entityTableName` a validé le nom contre une liste blanche : l'identifiant peut entrer dans le
  // texte de la requête, ce qu'un paramètre lié ne permet pas pour un nom de table.
  const [counted] = await db.execute<{ total: number }>(
    sql.raw(`select count(*)::int as total from ${table}`),
  );

  return {
    columns: new Map(columns.map((column) => [column.column_name, column.data_type])),
    rows: counted?.total ?? 0,
    singleton: columns.some((column) => column.column_name === 'singleton'),
  };
}

// ── Plan ──────────────────────────────────────────────────────────────────────────────────────

function planCreate(declaration: EntityDeclaration): PlanStep[] {
  return [
    {
      sql: createTableSql(declaration.name, declaration.singleton, declaration.fields),
      destructive: false,
      summary: `Créer la table de « ${declaration.name} »`,
    },
  ];
}

function planAlter(declaration: EntityDeclaration, live: LiveTable, plan: EntityPlan): void {
  const declared = new Map<string, ColumnSpec>(
    fieldColumns(declaration.fields).map((column) => [column.name, column]),
  );

  // Changer de cardinalité (ADR-0039). Les deux sens ne se ressemblent pas : passer à singleton
  // pose une contrainte qu'une table de plusieurs lignes ne peut pas porter, et l'un comme l'autre
  // échange un slug contre un drapeau — donc perd ou invente une colonne d'identité.
  //
  // V1 : la table est refaite, ce qui n'est sûr que si elle est vide. On refuse franchement
  // au-delà, plutôt que d'inventer des slugs ou d'en jeter. Jamais de destruction implicite.
  if (live.singleton !== declaration.singleton) {
    if (live.rows > 0) {
      plan.blockers.push(
        `« ${declaration.name} » change de cardinalité mais sa table contient ${live.rows} ligne(s). Videz-la d'abord : le slug d'une liste n'a pas d'équivalent sur un singleton.`,
      );
      return;
    }
    plan.steps.push(
      {
        sql: dropTableSql(declaration.name),
        destructive: true,
        summary: `Refaire la table de « ${declaration.name} » : changement de cardinalité`,
      },
      ...planCreate(declaration),
    );
    return;
  }

  for (const [name, column] of declared) {
    const liveType = live.columns.get(name);
    if (!liveType) {
      plan.steps.push({
        sql: addColumnSql(declaration.name, column),
        destructive: false,
        summary: `Ajouter « ${name} » à « ${declaration.name} »`,
      });
    }
  }

  for (const name of live.columns.keys()) {
    if (IDENTITY_COLUMNS.includes(name) || declared.has(name)) continue;
    if (!isValidIdentifier(name)) {
      plan.blockers.push(
        `La table de « ${declaration.name} » porte une colonne « ${name} » que ce mécanisme n'a pas pu créer. Intervention manuelle requise.`,
      );
      continue;
    }
    plan.steps.push({
      sql: dropColumnSql(declaration.name, name),
      destructive: true,
      summary: `Supprimer « ${name} » de « ${declaration.name} » — et les données de cette colonne`,
    });
  }
}

/**
 * Compare la déclaration reçue au schéma réel et rend ce qu'il faudrait appliquer.
 *
 * Le changement de TYPE d'un champ existant n'est pas planifié : le rendre sûr demande de décider
 * comment convertir chaque valeur déjà écrite, ce qu'aucune déclaration ne dit. Un champ dont le
 * type change se renomme — ajout puis retrait, deux opérations dont la seconde est visiblement
 * destructrice, ce qui est exactement ce qu'elle est.
 */
export async function planEntities(registry: EntityRegistry): Promise<EntityPlan> {
  const plan: EntityPlan = { steps: [], blockers: [] };

  for (const [key, declaration] of Object.entries(registry)) {
    if (key !== declaration.name) {
      plan.blockers.push(`Entité « ${key} » déclarée sous le nom « ${declaration.name} ».`);
      continue;
    }
    if (!isValidIdentifier(declaration.name)) {
      plan.blockers.push(
        `Nom d'entité refusé : « ${declaration.name} ». Minuscules, chiffres et « _ », commençant par une lettre.`,
      );
      continue;
    }

    try {
      const live = await readLiveTable(declaration.name);
      if (!live) {
        plan.steps.push(...planCreate(declaration));
      } else {
        planAlter(declaration, live, plan);
      }
    } catch (error) {
      plan.blockers.push(error instanceof Error ? error.message : String(error));
    }
  }

  // Entités connues du journal que la déclaration ne cite plus : supprimer, et jamais en cascade.
  // Une table non vide n'est pas supprimée du tout — l'utilisateur qui veut vraiment supprimer
  // vide son contenu d'abord, ce qui est un geste explicite (ADR-0028).
  const journal = await db.select().from(entityDefinition);
  for (const known of journal) {
    if (registry[known.name]) continue;
    const live = await readLiveTable(known.name);
    if (live && live.rows > 0) {
      plan.blockers.push(
        `« ${known.name} » n'est plus déclarée mais sa table contient ${live.rows} lignes. Videz-la avant de la supprimer.`,
      );
      continue;
    }
    plan.steps.push({
      sql: dropTableSql(known.name),
      destructive: true,
      summary: `Supprimer l'entité « ${known.name} » et sa table`,
    });
  }

  return plan;
}

// ── Application ───────────────────────────────────────────────────────────────────────────────

export type PushOutcome =
  | { outcome: 'applied'; steps: PlanStep[] }
  /** Refus définitif — le plan ne peut pas être appliqué en l'état. */
  | { outcome: 'blocked'; blockers: string[] }
  /** Le plan détruit des données : il faut le vouloir explicitement. */
  | { outcome: 'destructive'; steps: PlanStep[] };

/**
 * Applique le plan, en transaction : ou tout passe, ou rien n'a bougé. Le journal est mis à jour
 * dans la même transaction que le DDL — sans quoi il pourrait annoncer une table qui n'existe pas.
 *
 * `confirmDestructive` est la confirmation explicite qu'exige ADR-0027. Jamais de destruction
 * implicite : sans elle, un plan destructeur est REFUSÉ, pas exécuté à moitié.
 */
export async function pushEntities(
  registry: EntityRegistry,
  confirmDestructive = false,
): Promise<PushOutcome> {
  const plan = await planEntities(registry);
  if (plan.blockers.length > 0) {
    return { outcome: 'blocked', blockers: plan.blockers };
  }

  const destructive = plan.steps.filter((step) => step.destructive);
  if (destructive.length > 0 && !confirmDestructive) {
    return { outcome: 'destructive', steps: destructive };
  }

  await db.transaction(async (tx) => {
    for (const step of plan.steps) {
      await tx.execute(sql.raw(step.sql));
    }

    // Le journal est remplacé d'un bloc : la déclaration du dev fait foi, la base en est le miroir.
    await tx.delete(entityDefinition);
    const rows = Object.values(registry).map((declaration) => ({
      name: declaration.name,
      label: declaration.label ?? null,
      icon: declaration.icon ?? null,
      singleton: declaration.singleton,
      fields: declaration.fields,
    }));
    if (rows.length > 0) {
      await tx.insert(entityDefinition).values(rows);
    }
  });

  return { outcome: 'applied', steps: plan.steps };
}

/**
 * Entités déclarées, telles que le journal les connaît.
 *
 * Le `fields` stocké est du jsonb : on le revalide contre sa propre grammaire avant de le rendre.
 * Ce n'est pas une seconde frontière — le push a déjà validé ce qui entrait — c'est le refus de
 * truster du jsonb non typé relu depuis la base, où un `psql` a pu passer. Une corruption devient
 * une erreur franche plutôt qu'un objet de forme inconnue baladé dans le produit.
 */
export async function loadEntities(): Promise<EntityRegistry> {
  const rows = await db.select().from(entityDefinition);
  const candidate: unknown = Object.fromEntries(
    rows.map((row) => [
      row.name,
      {
        name: row.name,
        label: row.label ?? undefined,
        icon: row.icon ?? undefined,
        singleton: row.singleton,
        fields: row.fields,
      },
    ]),
  );
  if (!registryCheck.Check(candidate)) {
    throw new Error("Journal d'entités stocké invalide (corruption ?).");
  }
  return candidate;
}

/** Noms d'entités déclarées — de quoi dériver les ressources RBAC et les cibles référençables. */
export async function listEntityNames(): Promise<string[]> {
  const rows = await db.select({ name: entityDefinition.name }).from(entityDefinition);
  return rows.map((row) => row.name);
}
