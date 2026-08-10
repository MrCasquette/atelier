import { entityRegistrySchema, loadEntities, planEntities, pushEntities } from '@repo/entities';
import { Elysia, t } from 'elysia';
import { withCrudErrors } from '../../../lib/response';
import { permissionGuard } from '../../auth/rbac';

// Entités déclarées : `check` montre, `push` applique (ADR-0027). C'est le chemin qui existe déjà
// pour le registre de définitions, étendu à ce qui devient une vraie table.
//
// Gardé par `schema` et non `content` : créer une table, y ajouter une colonne, en retirer une —
// ce sont des actes de STRUCTURE. Ce droit tient au rang (ADR-0038), donc la clé de la CLI porte
// `write:schema`, émissible par le seul premier rang.
//
// Ces routes ne sont pas dans le contrat figé : elles sont gardées, jamais publiques. La surface
// de LECTURE des entités, elle, y entrera (#34).

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
  // Journal : quelles entités existent, sous quelle déclaration.
  .use(permissionGuard('schema', 'read'))
  .get('/', () => loadEntities(), {
    permission: true,
    response: withCrudErrors({ 200: entityRegistrySchema }),
  })

  // POST /content/entities/check — rend le SQL qui SERAIT appliqué, sans rien écrire. Le verbe est
  // POST parce que la déclaration voyage dans le corps, pas parce que quelque chose est modifié.
  .post('/check', ({ body }) => planEntities(body.entities), {
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
      const result = await pushEntities(body.entities, body.confirmDestructive === true);

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
