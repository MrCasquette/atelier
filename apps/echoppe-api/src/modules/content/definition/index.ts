import { faults } from '@echoppe/core';
import { loadRegistry, syncRegistry } from '@repo/pages';
import { registrySchema } from '@repo/pages-registry';
import { Elysia } from 'elysia';
import { faultBody } from '../../../lib/fault';
import { successSchema, withCrudErrors } from '../../../lib/response';
import { models } from '../../../model';
import { permissionGuard } from '../../auth/rbac';
import { references } from '../../reference/targets';

// Registre des définitions (ADR-0043). La source d'autorité, ce sont les fichiers du dev
// (`@axiome-apps/atelier-content`) ; la base n'en est que le miroir, remplacé d'un bloc par la CLI.
// Protégé par RBAC `content`.

export const definitionRoutes = new Elysia({ prefix: '/content', detail: { tags: ['Content'] } })
  .use(models)
  // Registre des définitions (pour le générateur de formulaires admin et le type-gen front).
  .use(permissionGuard('content', 'read'))
  .get('/registry', () => loadRegistry(), {
    permission: true,
    response: withCrudErrors({ 200: registrySchema }),
  })

  // PUT /content/registry - Synchronise le registre complet (poussé par la CLI @axiome-apps/atelier-content).
  // Remplace-tout : la source d'autorité, ce sont les fichiers du dev ; la DB en est le miroir.
  //
  // Gardé par `schema` et non `content` : pousser un registre redéfinit ce qu'EST une section et
  // peut invalider des données existantes. C'est un acte de STRUCTURE, pas d'édition — un éditeur
  // ne doit pouvoir qu'éditer. Ce droit tient au rang (ADR-0038), donc la clé de la CLI porte
  // `write:schema`, émissible par le seul premier rang.
  .use(permissionGuard('schema', 'update'))
  .put(
    '/registry',
    async ({ body, status }) => {
      const result = await syncRegistry(body, references.names());

      switch (result.outcome) {
        case 'incoherent':
          return status(422, faultBody(faults.registryIncoherent(result.issues)));
        case 'unknown_targets':
          return status(422, faultBody(faults.unknownReferenceTargets(result.targets)));
        case 'synced':
          return { success: true };
      }
    },
    { permission: true, body: registrySchema, response: withCrudErrors({ 200: successSchema }) },
  );
