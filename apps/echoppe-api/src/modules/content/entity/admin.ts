import {
  createEntityRow,
  deleteEntityRow,
  findDeclaration,
  findSingletonRow,
  listEntityRows,
  updateEntityRow,
  validateEntityData,
} from '@repo/entities';
import { loadRegistry } from '@repo/pages';
import { Elysia, t } from 'elysia';
import { getPaginationParams, paginationQuery } from '../../../lib/pagination';
import { conflictResponse, successSchema, withCrudErrors } from '../../../lib/response';
import { entityPermissionGuard } from '../../auth/rbac';

// Administration des OCCURRENCES d'une entité. La structure se pousse par la CLI (`schema`) ; ici
// on édite du contenu, et le droit est celui de l'entité elle-même — `entity:<nom>`, dérivé du
// registre à la volée (ADR-0038).
//
// Une entité déclarée est donc refusée à TOUT LE MONDE tant qu'aucun rôle ne la détient, y compris
// à celui qui vient de la pousser. C'est le bon défaut : masquer une entité, c'est ne pas accorder
// `canRead` (ADR-0028, résolu par ADR-0038), et l'inverse — visible par défaut — ne se rattrape pas.

const nameParam = t.Object({ name: t.String() });
const rowParam = t.Object({ name: t.String(), id: t.String({ format: 'uuid' }) });

const rowBody = t.Object({
  slug: t.Optional(t.String({ minLength: 1, maxLength: 150 })),
  data: t.Record(t.String(), t.Unknown()),
});

const rowSchema = t.Record(t.String(), t.Unknown());
const notDeclared = { message: 'Entité introuvable' };

export const entityAdminRoutes = new Elysia({
  prefix: '/content/entities/:name/rows',
  detail: { tags: ['Content'] },
})
  .use(entityPermissionGuard('read'))
  .get(
    '/',
    async ({ params, query, status }) => {
      const found = await findDeclaration(params.name);
      if (found.outcome === 'undeclared') return status(404, notDeclared);

      if (found.declaration.singleton) {
        const row = await findSingletonRow(found.declaration);
        return { data: row ? [row] : [] };
      }

      const { limit, offset } = getPaginationParams(query);
      const { rows } = await listEntityRows(found.declaration, limit, offset);
      return { data: rows };
    },
    {
      entityPermission: true,
      params: nameParam,
      query: paginationQuery,
      response: withCrudErrors({ 200: t.Object({ data: t.Array(rowSchema) }) }),
    },
  )

  .use(entityPermissionGuard('create'))
  .post(
    '/',
    async ({ params, body, status }) => {
      const found = await findDeclaration(params.name);
      if (found.outcome === 'undeclared') return status(404, notDeclared);

      // Le validateur est celui des sections : même déclaration, même grammaire (ADR-0026). Les
      // components viennent du registre de définitions — un champ `list` d'une entité les cite.
      const registry = await loadRegistry();
      const valid = validateEntityData(found.declaration, body.data, registry.components);
      if (!valid.ok) return status(422, { message: valid.errors.join(' · ') });

      const written = await createEntityRow(found.declaration, body);
      if (written.outcome === 'invalid') {
        return status(422, { message: written.errors.join(' · ') });
      }
      if (written.outcome === 'conflict') return status(409, { message: written.message });
      if (written.outcome === 'absent') return status(404, notDeclared);

      return written.row;
    },
    {
      entityPermission: true,
      params: nameParam,
      body: rowBody,
      response: withCrudErrors({ 200: rowSchema, 409: conflictResponse }),
    },
  )

  .use(entityPermissionGuard('update'))
  .put(
    '/:id',
    async ({ params, body, status }) => {
      const found = await findDeclaration(params.name);
      if (found.outcome === 'undeclared') return status(404, notDeclared);

      const registry = await loadRegistry();
      const valid = validateEntityData(found.declaration, body.data, registry.components);
      if (!valid.ok) return status(422, { message: valid.errors.join(' · ') });

      const written = await updateEntityRow(found.declaration, params.id, body);
      if (written.outcome === 'invalid') {
        return status(422, { message: written.errors.join(' · ') });
      }
      if (written.outcome === 'conflict') return status(409, { message: written.message });
      if (written.outcome === 'absent') return status(404, { message: 'Occurrence introuvable' });

      return written.row;
    },
    {
      entityPermission: true,
      params: rowParam,
      body: rowBody,
      response: withCrudErrors({ 200: rowSchema, 409: conflictResponse }),
    },
  )

  .use(entityPermissionGuard('delete'))
  .delete(
    '/:id',
    async ({ params, status }) => {
      const found = await findDeclaration(params.name);
      if (found.outcome === 'undeclared') return status(404, notDeclared);

      const removed = await deleteEntityRow(found.declaration, params.id);
      if (!removed) return status(404, { message: 'Occurrence introuvable' });

      return { success: true as const };
    },
    {
      entityPermission: true,
      params: rowParam,
      response: withCrudErrors({ 200: successSchema }),
    },
  );
