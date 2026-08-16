import { permission } from '@repo/auth';
import { db, inArray, sql } from '@repo/db';
import { duplicateFieldNames } from '@repo/fields';
import type { PlanBlocker, RegistryIssue } from '@repo/shared';
import { TypeCompiler } from 'elysia/type-system';
import {
  addColumnSql,
  type ColumnSpec,
  createTableSql,
  dropColumnSql,
  dropTableSql,
  entityResourceName,
  entityTableName,
  fieldColumns,
  foreignKeyDdl,
  foreignKeys,
  IDENTITY_COLUMNS,
  isValidIdentifier,
  type OnDelete,
  type ReferenceTables,
} from './ddl';
import { incoherentLinks } from './link';
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

/**
 * Ce qu'une étape destructive détruit. Trois formes, et pas une de plus : elles sont DÉRIVÉES des
 * trois seuls endroits du planificateur qui posent une étape destructive, pas inventées d'avance.
 */
export type DestructiveKind =
  /** La cardinalité change : la table est refaite, donc vidée. */
  | 'recreate_table'
  /** Une colonne disparaît, et les données qu'elle portait avec elle. */
  | 'drop_column'
  /** L'entité n'est plus déclarée : sa table part. */
  | 'drop_table';

/**
 * Une opération du plan.
 *
 * `destroys` remplace l'ancien booléen `destructive`, et c'est la SEULE source de vérité sur le
 * sujet : sa présence dit qu'on détruit, son contenu dit quoi. Un booléen à côté d'un `kind` aurait
 * été deux vérités pour une question, avec la dérive que ça promet.
 *
 * `summary` reste, mais n'est PAS contractuel : c'est du diagnostic, lu par un développeur dans un
 * terminal — la seule surface qu'ADR-0050 exempte (§4). Il ne traverse jamais HTTP ; ce qui part sur
 * le fil, c'est `destroys`.
 */
export type PlanStep = {
  sql: string;
  summary: string;
  destroys?: { kind: DestructiveKind; target: string };
};

export type EntityPlan = {
  steps: PlanStep[];
  /**
   * La DÉCLARATION est fautive : le dev corrige ses fichiers, la base n'est pas en cause.
   *
   * Même vocabulaire que le registre de sections, et ce n'est pas un rapprochement de circonstance :
   * les deux moteurs partagent leur grammaire de champs (ADR-0026), donc leurs façons d'être mal
   * déclarés. `duplicate_field` était déjà commun aux deux.
   */
  issues: RegistryIssue[];
  /**
   * La déclaration est bonne, mais l'ÉTAT de la base empêche de l'appliquer.
   *
   * Distinct d'`issues`, parce que le geste de correction l'est : vider une table, retirer un champ
   * qui référence. Les deux voyageaient naguère dans une seule liste de phrases, ce qui obligeait le
   * lecteur à deviner, à chaque ligne, laquelle des deux choses on lui demandait.
   */
  blockers: PlanBlocker[];
};

// ── Lecture du schéma RÉEL ────────────────────────────────────────────────────────────────────

/** Une clé étrangère telle qu'elle EXISTE, avec le nom que Postgres lui a donné. */
type LiveForeignKey = { constraint: string; table: string; onDelete: OnDelete };

type LiveTable = {
  columns: Map<string, string>;
  /** Contraintes réelles, par colonne porteuse. */
  foreignKeys: Map<string, LiveForeignKey>;
  rows: number;
  singleton: boolean;
};

/**
 * Clés étrangères réellement portées par une table.
 *
 * On les lit par COLONNE et non par nom : le nom est celui que Postgres a fabriqué, il peut avoir
 * été tronqué à 63 octets, et rien ne garantit qu'une contrainte posée à la main s'appelle comme
 * la nôtre. La colonne, elle, ne ment pas (ADR-0045).
 */
async function readForeignKeys(table: string): Promise<Map<string, LiveForeignKey>> {
  const rows = await db.execute<{
    constraint_name: string;
    column_name: string;
    foreign_table: string;
    delete_rule: string;
  }>(sql`
    select
      tc.constraint_name,
      kcu.column_name,
      ccu.table_name as foreign_table,
      rc.delete_rule
    from information_schema.table_constraints tc
    join information_schema.key_column_usage kcu
      on kcu.constraint_name = tc.constraint_name
    join information_schema.constraint_column_usage ccu
      on ccu.constraint_name = tc.constraint_name
    join information_schema.referential_constraints rc
      on rc.constraint_name = tc.constraint_name
    where tc.table_schema = 'public'
      and tc.table_name = ${table}
      and tc.constraint_type = 'FOREIGN KEY'
  `);

  return new Map(
    rows.map((row) => [
      row.column_name,
      {
        constraint: row.constraint_name,
        table: row.foreign_table,
        // Postgres rend la règle en majuscules et sans souligné (`SET NULL`), notre vocabulaire est
        // celui du DDL. Tout ce qui n'est pas `SET NULL` est traité comme un refus de supprimer :
        // c'est le sens de `NO ACTION` comme de `RESTRICT`, et confondre les deux ici n'aurait pour
        // effet que de proposer un remplacement inutile.
        onDelete: row.delete_rule === 'SET NULL' ? 'set null' : 'restrict',
      },
    ]),
  );
}

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
    foreignKeys: await readForeignKeys(table),
    rows: counted?.total ?? 0,
    singleton: columns.some((column) => column.column_name === 'singleton'),
  };
}

// ── Plan ──────────────────────────────────────────────────────────────────────────────────────

function planCreate(declaration: EntityDeclaration, tables: ReferenceTables): PlanStep[] {
  return [
    {
      sql: createTableSql(declaration.name, declaration.singleton, declaration.fields, tables),
      summary: `Créer la table de « ${declaration.name} »`,
    },
  ];
}

/**
 * Lignes dont la valeur ne désigne plus rien dans la table visée.
 *
 * Ce n'est pas une précaution : c'est de la donnée DÉJÀ cassée, que l'absence de clé étrangère
 * laissait passer. La compter avant l'`ALTER` permet de le refuser en disant combien et où, plutôt
 * que de laisser Postgres échouer sur un message qui ne dit ni l'un ni l'autre.
 *
 * Tous les identifiants viennent de la liste blanche — c'est ce qui autorise `sql.raw`.
 */
async function danglingRows(table: string, column: string, target: string): Promise<number> {
  const [counted] = await db.execute<{ total: number }>(
    sql.raw(`
      select count(*)::int as total
      from ${table} source
      where source.${column} is not null
        and not exists (select 1 from ${target} cible where cible.id = source.${column})
    `),
  );
  return counted?.total ?? 0;
}

/**
 * Ce qui référence la table d'une entité, en clair.
 *
 * Nommer ce qui retient est tout l'intérêt : un refus qui dit seulement « impossible » laisse
 * l'utilisateur chercher, et la seule issue qu'il trouverait serait la cascade.
 */
async function incomingReferences(name: string): Promise<string[]> {
  const table = entityTableName(name);
  const rows = await db.execute<{ source: string; column_name: string }>(sql`
    select tc.table_name as source, kcu.column_name
    from information_schema.table_constraints tc
    join information_schema.key_column_usage kcu
      on kcu.constraint_name = tc.constraint_name
    join information_schema.constraint_column_usage ccu
      on ccu.constraint_name = tc.constraint_name
    where tc.constraint_type = 'FOREIGN KEY'
      and ccu.table_name = ${table}
      and tc.table_name <> ${table}
  `);
  // Chemins NUS — `lecteur_externe.cible`. Ces noms entourent un opérande de faute jusqu'à la
  // surface qui l'affiche (ADR-0050 §3) : la ponctuation appartient à celle-ci, qui ne saurait pas
  // la retirer si on la posait ici. Même règle que `duplicateFieldNames`.
  return rows.map((row) => `${row.source}.${row.column_name}`);
}

/**
 * Aligne les contraintes réelles sur celles qu'implique la déclaration (ADR-0045).
 *
 * Sans ça, seules les entités créées APRÈS ADR-0045 auraient leurs garanties : les tables déjà
 * poussées garderaient des colonnes `uuid` nues, indéfiniment.
 *
 * Ajouter ou retirer une contrainte ne détruit aucune donnée — ces opérations passent donc sans
 * confirmation. Ce qu'elles peuvent faire, c'est ÉCHOUER sur de la donnée pendante, et c'est
 * exactement ce que le refus doit dire.
 */
async function planForeignKeys(
  declaration: EntityDeclaration,
  live: LiveTable,
  plan: EntityPlan,
  tables: ReferenceTables,
  /** Colonnes que ce même plan vient d'ajouter : vides par construction, rien à vérifier. */
  added: Set<string>,
): Promise<void> {
  const table = entityTableName(declaration.name);
  const declared = new Map(foreignKeys(declaration.fields, tables).map((key) => [key.column, key]));

  for (const [column, key] of declared) {
    const existing = live.foreignKeys.get(column);
    if (existing && existing.table === key.table && existing.onDelete === key.onDelete) continue;

    if (!added.has(column)) {
      const pending = await danglingRows(table, column, key.table);
      if (pending > 0) {
        // Le COMPTE ne traverse pas : il ne change pas le geste — corriger ces valeurs — et
        // l'appelant ne pourrait rien en faire de plus (ADR-0050 §5). La table visée, si : elle ne
        // se déduit pas de la déclaration, qui ne dit pas où pointent les valeurs stockées.
        plan.blockers.push({
          reason: 'dangling_rows',
          target: `${declaration.name}.${column}`,
          references: key.table,
        });
        continue;
      }
    }

    // Une contrainte existante qui ne dit plus la bonne chose — la cible a changé, ou `required` a
    // changé la politique — est remplacée. Retirer une garantie pour la reposer aussitôt ne perd
    // aucune donnée ; c'est le seul moyen de la corriger, Postgres ne sachant pas l'altérer.
    if (existing) {
      plan.steps.push({
        sql: `alter table ${table} drop constraint ${existing.constraint};`,
        summary: `Remplacer la contrainte de « ${column} » sur « ${declaration.name} »`,
      });
    }

    plan.steps.push({
      sql: `alter table ${table} add ${foreignKeyDdl(key)};`,
      summary: `Contraindre « ${column} » de « ${declaration.name} » à ${key.table} (${key.onDelete})`,
    });
  }

  // Contraintes que la déclaration ne demande plus : la cible s'est tue, ou le champ a changé de
  // nature. On les retire — laisser une garantie que la déclaration ne dit plus ferait diverger la
  // base des fichiers, qui font foi.
  for (const [column, existing] of live.foreignKeys) {
    if (declared.has(column)) continue;
    plan.steps.push({
      sql: `alter table ${table} drop constraint ${existing.constraint};`,
      summary: `Retirer la contrainte de « ${column} » sur « ${declaration.name} » — la déclaration ne la demande plus`,
    });
  }
}

async function planAlter(
  declaration: EntityDeclaration,
  live: LiveTable,
  plan: EntityPlan,
  tables: ReferenceTables,
): Promise<void> {
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
      plan.blockers.push({ reason: 'rows_present', target: declaration.name });
      return;
    }
    plan.steps.push(
      {
        sql: dropTableSql(declaration.name),
        destroys: { kind: 'recreate_table', target: declaration.name },
        summary: `Refaire la table de « ${declaration.name} » : changement de cardinalité`,
      },
      ...planCreate(declaration, tables),
    );
    return;
  }

  const added = new Set<string>();
  for (const [name, column] of declared) {
    const liveType = live.columns.get(name);
    if (!liveType) {
      added.add(name);
      plan.steps.push({
        sql: addColumnSql(declaration.name, column),
        summary: `Ajouter « ${name} » à « ${declaration.name} »`,
      });
    }
  }

  for (const name of live.columns.keys()) {
    if (IDENTITY_COLUMNS.includes(name) || declared.has(name)) continue;
    if (!isValidIdentifier(name)) {
      plan.blockers.push({
        reason: 'unmanaged_column',
        target: `${declaration.name}.${name}`,
      });
      continue;
    }
    plan.steps.push({
      sql: dropColumnSql(declaration.name, name),
      destroys: { kind: 'drop_column', target: `${declaration.name}.${name}` },
      summary: `Supprimer « ${name} » de « ${declaration.name} » — et les données de cette colonne`,
    });
  }

  // En dernier : une contrainte se pose sur une colonne qui existe, donc après les ajouts.
  await planForeignKeys(declaration, live, plan, tables, added);
}

/**
 * Compare la déclaration reçue au schéma réel et rend ce qu'il faudrait appliquer.
 *
 * Le changement de TYPE d'un champ existant n'est pas planifié : le rendre sûr demande de décider
 * comment convertir chaque valeur déjà écrite, ce qu'aucune déclaration ne dit. Un champ dont le
 * type change se renomme — ajout puis retrait, deux opérations dont la seconde est visiblement
 * destructrice, ce qui est exactement ce qu'elle est.
 */
/**
 * Tables cibles connues, ÉLARGIES aux entités du registre soumis.
 *
 * Sans ça, deux entités poussées ensemble ne pourraient pas se référencer : la cible ne s'inscrit
 * au registre qu'APRÈS le push, donc la première passe ne verrait rien où pointer et la clé
 * étrangère manquerait — silencieusement, jusqu'au push suivant. L'ordre de déclaration deviendrait
 * signifiant, ce qu'aucune déclaration ne dit.
 *
 * Seules les entités qui déclarent un lien sont ajoutées : c'est ce qui les rend citables, donc
 * référençables (ADR-0032). Une entité muette n'est la cible de personne.
 */
function withDeclaredEntities(registry: EntityRegistry, tables: ReferenceTables): ReferenceTables {
  const targets = { ...tables.targets };
  for (const declaration of Object.values(registry)) {
    if (!declaration.link || !isValidIdentifier(declaration.name)) continue;
    targets[entityResourceName(declaration.name)] = entityTableName(declaration.name);
  }
  return { ...tables, targets };
}

export async function planEntities(
  registry: EntityRegistry,
  declaredTables: ReferenceTables,
): Promise<EntityPlan> {
  const tables = withDeclaredEntities(registry, declaredTables);
  const plan: EntityPlan = { steps: [], issues: [], blockers: [] };

  // Un lien qui cite un champ inexistant ne se résoudra jamais. Le DSL le refuse déjà au dev, mais
  // rien ne garantit qu'un registre poussé soit passé par ce chemin (ADR-0046).
  plan.issues.push(...incoherentLinks(registry));

  // Deux champs de même nom (ADR-0049). Postgres refuserait le DDL de toute façon — mais au PUSH,
  // après qu'un `check` a dit que tout allait bien, et sans nommer l'entité fautive. Un blocage ici
  // le dit là où on le demande.
  for (const declaration of Object.values(registry)) {
    const duplicates = duplicateFieldNames(declaration.name, declaration.fields);
    if (duplicates.length > 0) {
      plan.issues.push(
        ...duplicates.map((path): RegistryIssue => ({ path, reason: 'duplicate_field' })),
      );
    }
  }

  for (const [key, declaration] of Object.entries(registry)) {
    if (key !== declaration.name) {
      plan.issues.push({ path: key, reason: 'name_mismatch' });
      continue;
    }
    if (!isValidIdentifier(declaration.name)) {
      plan.issues.push({ path: declaration.name, reason: 'invalid_name' });
      continue;
    }

    // PAS de try/catch ici, et c'est délibéré (ADR-0050). Ce qui suit ne lit que le catalogue
    // Postgres et compte des lignes : une exception y est une panne d'infrastructure, jamais un
    // refus métier. Le nom d'entité, seule chose qui pourrait être refusée en aval, vient d'être
    // validé juste au-dessus.
    //
    // L'attraper la transformait en blocage : l'appelant recevait un 422 « votre déclaration est
    // refusée » portant le diagnostic brut du driver. Faux deux fois — le statut, et la fuite. Une
    // base indisponible doit remonter à la frontière et devenir un 500.
    const live = await readLiveTable(declaration.name);
    if (!live) {
      plan.steps.push(...planCreate(declaration, tables));
    } else {
      await planAlter(declaration, live, plan, tables);
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
      plan.blockers.push({ reason: 'rows_present', target: known.name });
      continue;
    }

    // Second motif de refus, celui qu'ADR-0045 ajoute : une table visée par une clé étrangère ne
    // se supprime pas. Postgres le refuserait de toute façon, mais sur une erreur qui ne dit pas
    // QUI retient — et la seule façon de passer outre serait une cascade, que le mécanisme refuse
    // partout (ADR-0028).
    const holders = await incomingReferences(known.name);
    if (holders.length > 0) {
      // `holders` traverse : sans elles, le dev sait qu'il est bloqué sans savoir où retirer les
      // champs, et il ne peut pas les déduire — ce sont d'AUTRES entités que la sienne.
      plan.blockers.push({ reason: 'still_referenced', target: known.name, holders });
      continue;
    }

    plan.steps.push({
      sql: dropTableSql(known.name),
      destroys: { kind: 'drop_table', target: known.name },
      summary: `Supprimer l'entité « ${known.name} » et sa table`,
    });
  }

  return plan;
}

// ── Application ───────────────────────────────────────────────────────────────────────────────

export type PushOutcome =
  | { outcome: 'applied'; steps: PlanStep[] }
  /** La déclaration poussée est fautive : rien à faire côté base. */
  | { outcome: 'incoherent'; issues: RegistryIssue[] }
  /** Refus définitif — l'état de la base ne permet pas d'appliquer le plan. */
  | { outcome: 'blocked'; blockers: PlanBlocker[] }
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
  tables: ReferenceTables,
  confirmDestructive = false,
): Promise<PushOutcome> {
  const plan = await planEntities(registry, tables);
  // La déclaration d'abord : inutile de reprocher à la base son état si les fichiers sont fautifs.
  if (plan.issues.length > 0) return { outcome: 'incoherent', issues: plan.issues };
  if (plan.blockers.length > 0) return { outcome: 'blocked', blockers: plan.blockers };

  const destructive = plan.steps.filter((step) => step.destroys !== undefined);
  if (destructive.length > 0 && !confirmDestructive) {
    return { outcome: 'destructive', steps: destructive };
  }

  // Une entité qui meurt emporte ses permissions. La RESSOURCE, elle, n'a jamais été écrite —
  // elle est dérivée du registre — mais les droits ACCORDÉS sont bien des lignes : sans purge, un
  // nom réutilisé hériterait des droits de son homonyme, silencieusement.
  const dropped = (await db.select({ name: entityDefinition.name }).from(entityDefinition))
    .map((row) => row.name)
    .filter((name) => !registry[name]);

  await db.transaction(async (tx) => {
    for (const step of plan.steps) {
      await tx.execute(sql.raw(step.sql));
    }

    if (dropped.length > 0) {
      await tx
        .delete(permission)
        .where(inArray(permission.resource, dropped.map(entityResourceName)));
    }

    // Le journal est remplacé d'un bloc : la déclaration du dev fait foi, la base en est le miroir.
    await tx.delete(entityDefinition);
    const rows = Object.values(registry).map((declaration) => ({
      name: declaration.name,
      label: declaration.label ?? null,
      icon: declaration.icon ?? null,
      singleton: declaration.singleton,
      link: declaration.link ?? null,
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
        // `?? undefined` et non `?? null` : le schéma déclare `link` optionnel, pas nullable — une
        // entité qui ne se cite pas n'a pas de lien, elle n'en a pas un qui vaut « rien ».
        link: row.link ?? undefined,
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
