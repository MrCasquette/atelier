import { Elysia } from 'elysia';
import { successSchema, withCrudErrors } from '../../../lib/response';
import { permissionGuard } from '../../auth/rbac';
import { registrySchema } from './model';
import { loadRegistry, syncRegistry } from './service';

// Registre des définitions (ADR-0043). La source d'autorité, ce sont les fichiers du dev
// (`@mrcasquette/content`) ; la base n'en est que le miroir, remplacé d'un bloc par la CLI.
// Protégé par RBAC `content`.

export const definitionRoutes = new Elysia({ prefix: '/content', detail: { tags: ['Content'] } })
  // Registre des définitions (pour le générateur de formulaires admin et le type-gen front).
  .use(permissionGuard('content', 'read'))
  .get('/registry', () => loadRegistry(), {
    permission: true,
    response: withCrudErrors({ 200: registrySchema }),
  })

  // PUT /content/registry - Synchronise le registre complet (poussé par la CLI @mrcasquette/content).
  // Remplace-tout : la source d'autorité, ce sont les fichiers du dev ; la DB en est le miroir.
  .use(permissionGuard('content', 'update'))
  .put(
    '/registry',
    async ({ body, status }) => {
      const result = await syncRegistry(body);

      return result.outcome === 'incoherent'
        ? status(422, { message: result.message })
        : { success: true };
    },
    { permission: true, body: registrySchema, response: withCrudErrors({ 200: successSchema }) },
  );
