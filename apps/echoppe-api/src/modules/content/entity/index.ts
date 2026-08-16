import { getTableName, media } from '@echoppe/core';
import {
  entityRegistrySchema,
  loadEntities,
  planEntities,
  pushEntities,
  type ReferenceTables,
} from '@repo/entities';
import { storageOf } from '@repo/references';
import { Elysia, t } from 'elysia';
import { withCrudErrors } from '../../../lib/response';
import { models } from '../../../model';
import { permissionGuard } from '../../auth/rbac';
import { syncEntityReferences } from '../../reference/sync';
import { references } from '../../reference/targets';

// Entités déclarées : `check` montre, `push` applique (ADR-0027). C'est le chemin qui existe déjà
// pour le registre de définitions, étendu à ce qui devient une vraie table.
//
// Gardé par `schema` et non `content` : créer une table, y ajouter une colonne, en retirer une —
// ce sont des actes de STRUCTURE. Ce droit tient au rang (ADR-0038), donc la clé de la CLI porte
// `write:schema`, émissible par le seul premier rang.
//
// Ces routes ne sont pas dans le contrat figé : elles sont gardées, jamais publiques. La surface
// de LECTURE des entités, elle, y entrera (#34).

// Où vivent les cibles d'un champ `image` ou `ref` (ADR-0045). C'est ICI que ça se sait, et nulle
// part ailleurs : `@repo/entities` écrit le DDL sans connaître ni `media` ni le registre de
// références, ce qui est exactement ce qui lui permet de servir les deux produits.
//
// Lu à CHAQUE appel, et non une fois à l'import : depuis ADR-0046, une entité déclarée s'inscrit au
// registre à la poussée. Une photo de son état à l'import ne connaîtrait jamais les entités, et un
// `ref` vers l'une d'elles resterait un `uuid` nu — silencieusement.
const referenceTables = (): ReferenceTables => ({
  media: getTableName(media),
  targets: storageOf(references),
});

const planSchema = t.Object({
  steps: t.Array(
    t.Object({
      sql: t.String(),
      destructive: t.Boolean(),
      summary: t.String(),
    }),
  ),
  blockers: t.Array(t.String()),
});

export const entityRoutes = new Elysia({
  prefix: '/content/entities',
  detail: { tags: ['Content'] },
})
  .use(models)
  // Journal : quelles entités existent, sous quelle déclaration.
  .use(permissionGuard('schema', 'read'))
  .get('/', () => loadEntities(), {
    permission: true,
    response: withCrudErrors({ 200: entityRegistrySchema }),
  })

  // POST /content/entities/check — rend le SQL qui SERAIT appliqué, sans rien écrire. Le verbe est
  // POST parce que la déclaration voyage dans le corps, pas parce que quelque chose est modifié.
  .post('/check', ({ body }) => planEntities(body.entities, referenceTables()), {
    permission: true,
    body: t.Object({ entities: entityRegistrySchema }),
    response: withCrudErrors({ 200: planSchema }),
  })

  // PUT /content/entities — applique. Remplace-tout : la déclaration du dev fait foi, la base en
  // est le miroir.
  .use(permissionGuard('schema', 'update'))
  .put(
    '/',
    async ({ body, status }) => {
      const result = await pushEntities(
        body.entities,
        referenceTables(),
        body.confirmDestructive === true,
      );

      if (result.outcome === 'blocked') {
        return status(422, { message: result.blockers.join(' · ') });
      }
      // Jamais de destruction implicite (ADR-0027) : un plan qui détruit est REFUSÉ, et il nomme
      // ce qu'il aurait détruit. Le dev relance avec `confirmDestructive` s'il le veut vraiment.
      if (result.outcome === 'destructive') {
        return status(409, {
          message: `Ce push détruirait des données : ${result.steps
            .map((step) => step.summary)
            .join(' · ')}. Relancez avec confirmation si c'est voulu.`,
        });
      }
      // La déclaration vient de changer : le registre de cibles en est le miroir, il se réaligne
      // ici. Même événement que celui qui fait naître la ressource RBAC d'une entité (ADR-0038) —
      // et pour la même raison, ce sont les fichiers du dev qui font foi.
      await syncEntityReferences();

      return { applied: result.steps.map((step) => step.summary) };
    },
    {
      permission: true,
      body: t.Object({
        entities: entityRegistrySchema,
        confirmDestructive: t.Optional(t.Boolean()),
      }),
      response: withCrudErrors({
        200: t.Object({ applied: t.Array(t.String()) }),
        409: t.Object({ message: t.String() }),
      }),
    },
  );
