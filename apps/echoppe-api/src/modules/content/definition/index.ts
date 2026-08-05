import { contentDefinition, db } from '@echoppe/core';
import { Elysia } from 'elysia';
import { successSchema, withCrudErrors } from '../../../lib/response';
import { permissionGuard } from '../../auth/rbac';
import { type Registry, registrySchema } from './model';
import { assertRegistryCoherent, invalidateRegistryCache, loadRegistry } from './service';

// Registre des définitions (ADR-0043). La source d'autorité, ce sont les fichiers du dev
// (`@mrcasquette/content`) ; la base n'en est que le miroir, remplacé d'un bloc par la CLI.
// Protégé par RBAC `content`.

// Aplati le registre (sections + components) en lignes `content_definition` (une par définition).
function registryToRows(registry: Registry): (typeof contentDefinition.$inferInsert)[] {
  const toRow =
    (role: 'section' | 'component') => (entry: [string, Registry['sections'][string]]) => {
      const [name, def] = entry;
      return { name, role, label: def.label ?? null, icon: def.icon ?? null, fields: def.fields };
    };
  return [
    ...Object.entries(registry.sections).map(toRow('section')),
    ...Object.entries(registry.components).map(toRow('component')),
  ];
}

export const definitionRoutes = new Elysia({ prefix: '/content', detail: { tags: ['Content'] } })
  // Registre des définitions (pour le générateur de formulaires admin et le type-gen front).
  .use(permissionGuard('content', 'read'))
  .get('/registry', async () => loadRegistry(), {
    permission: true,
    response: withCrudErrors({ 200: registrySchema }),
  })

  // PUT /content/registry - Synchronise le registre complet (poussé par la CLI @mrcasquette/content).
  // Remplace-tout : la source d'autorité, ce sont les fichiers du dev ; la DB en est le miroir.
  .use(permissionGuard('content', 'update'))
  .put(
    '/registry',
    async ({ body, status }) => {
      // Refuse un registre incohérent (ref de component introuvable, cycle) AVANT de persister.
      try {
        assertRegistryCoherent(body);
      } catch (error) {
        return status(422, {
          message: error instanceof Error ? error.message : 'Registre de contenu invalide',
        });
      }

      await db.transaction(async (tx) => {
        await tx.delete(contentDefinition);
        const rows = registryToRows(body);
        if (rows.length > 0) {
          await tx.insert(contentDefinition).values(rows);
        }
      });
      invalidateRegistryCache();
      return { success: true };
    },
    { permission: true, body: registrySchema, response: withCrudErrors({ 200: successSchema }) },
  );
