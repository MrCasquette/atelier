import type { Action } from '@repo/auth';
import { entityDeclarationSchema, loadEntities } from '@repo/entities';
import { Elysia, t } from 'elysia';
import { forbiddenResponse } from '../../../lib/response';
import { checkPermission, getPrincipal } from '../../auth/rbac';

// Ce que l'administration a le droit d'éditer — la question de la NAVIGATION, pas celle du journal.
//
// Le journal complet (`GET /content/entities`) tient à `schema:read`, et doit y tenir : lire la
// structure de toutes les entités est un acte de structure. Mais un rédacteur à qui l'on vient
// d'accorder `entity:article` ne détient pas `schema` — sans cette route, il n'aurait aucun chemin
// vers son propre écran.
//
// La réponse porte donc les DÉCLARATIONS, `fields` compris : c'est ce dont le générateur de
// formulaires a besoin, et c'est ce qui évite un second aller-retour par entité. Elle ne rend que
// les entités sur lesquelles le principal détient `read`, chacune avec les actions qu'il détient —
// on ne montre que ce qu'on détient, comme on n'accorde que ce qu'on détient (ADR-0038).

const ACTIONS = ['read', 'create', 'update', 'delete'] as const satisfies readonly Action[];

const actionSchema = t.Union([
  t.Literal('read'),
  t.Literal('create'),
  t.Literal('update'),
  t.Literal('delete'),
]);

const grantedEntitySchema = t.Object({
  ...entityDeclarationSchema.properties,
  /** Les actions que l'appelant détient sur cette entité, `read` toujours comprise. */
  actions: t.Array(actionSchema),
});

export const entityMineRoutes = new Elysia({
  prefix: '/content/entities',
  detail: { tags: ['Content'] },
}).get(
  '/mine',
  async ({ cookie, headers, status }) => {
    const principal = await getPrincipal(
      cookie as Record<string, { value?: string }>,
      headers.authorization,
    );

    // Le rôle Public peut détenir `entity:<nom>` en lecture pour servir le front (ADR-0027) : ce
    // n'est pas une raison pour lui rendre la déclaration, qui est de l'administration.
    if (!principal.privileged) {
      return status(403, { message: 'Permission refusée' });
    }

    const declarations = Object.values(await loadEntities());
    const granted = declarations.flatMap((declaration) => {
      const actions = ACTIONS.filter(
        (action) => checkPermission(principal, `entity:${declaration.name}`, action).allowed,
      );
      return actions.includes('read') ? [{ ...declaration, actions }] : [];
    });

    return { entities: granted };
  },
  {
    response: {
      200: t.Object({ entities: t.Array(grantedEntitySchema) }),
      403: forbiddenResponse,
    },
  },
);
