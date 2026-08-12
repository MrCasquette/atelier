import type { Authority, Principal } from './principal';

// Les RÈGLES de droits : qui peut quoi, qui peut déléguer quoi. Pures — aucune base, aucun
// transport. La lecture des droits en base et son cache vivent dans `permission-cache.ts` : les
// séparer garde ces règles testables sans connexion, et elles sont ce qu'il y a de plus important
// à tester.
//
// Les gardes qui traduisent un refus en 403 sont du produit (ADR-0044).

export type Action = 'create' | 'read' | 'update' | 'delete';

const FLAG_OF: Record<Action, 'canCreate' | 'canRead' | 'canUpdate' | 'canDelete'> = {
  create: 'canCreate',
  read: 'canRead',
  update: 'canUpdate',
  delete: 'canDelete',
};

/**
 * **Le** prédicat d'autorité (ADR-0047) : ce principal détient-il cette action sur cette ressource ?
 *
 * Posé aux deux endroits qui se le demandaient séparément — le garde (« as-tu le droit ? ») et la
 * délégation (« peux-tu le donner ? »). Ils lisaient tous les deux la carte de droits directement,
 * et court-circuitaient le propriétaire chacun de leur côté.
 *
 * `resource` est une chaîne et non une union fermée : l'espace des ressources s'ouvre aux entités
 * déclarées (ADR-0038). C'est le produit qui garde une union à SA frontière — `permissionGuard`
 * prend un `Resource` — pendant que le socle raisonne sur des noms.
 */
export function holds(authority: Authority, resource: string, action: Action): boolean {
  switch (authority.kind) {
    case 'total':
      return true;
    case 'except':
      if (authority.reserved.has(resource)) return false;
      if (authority.readOnly.has(resource)) return action === 'read';
      return true;
    case 'granted':
      return authority.permissions.get(resource)?.[FLAG_OF[action]] ?? false;
  }
}

/**
 * Ce droit est-il borné aux lignes dont on est le sujet ?
 *
 * Jamais pour `total` : le propriétaire n'est borné par rien.
 */
export function isSelfOnly(authority: Authority, resource: string): boolean {
  switch (authority.kind) {
    case 'total':
      return false;
    case 'except':
      return authority.ownRowsOnly.has(resource);
    case 'granted':
      return authority.permissions.get(resource)?.selfOnly ?? false;
  }
}

// Un droit tel qu'on demande à l'accorder à un rôle.
export type PermissionGrant = {
  resource: string;
  canCreate: boolean;
  canRead: boolean;
  canUpdate: boolean;
  canDelete: boolean;
  selfOnly?: boolean;
};

/**
 * Ressources qui tiennent au RANG et non à la possession (ADR-0038, amendement du 2026-08-10) :
 * jamais transmises par délégation, même par quelqu'un qui les détient. Le seed les accorde au
 * premier rang, et rien d'autre ne peut les accorder.
 *
 * C'est le seul endroit où le socle nomme une ressource, et c'est délibéré. `schema` — le droit de
 * redéfinir la forme des données — n'est pas du vocabulaire produit : il existe dans tout produit
 * bâti sur ce socle, et c'est une garantie de sécurité. La passer en argument la rendrait
 * OUBLIABLE par omission, c'est-à-dire exactement la faille qu'elle ferme.
 */
export const RANK_BOUND_RESOURCES: ReadonlySet<string> = new Set(['schema']);

const GRANTABLE_ACTIONS = [
  ['create', 'canCreate'],
  ['read', 'canRead'],
  ['update', 'canUpdate'],
  ['delete', 'canDelete'],
] as const;

const ALL_ACTIONS: readonly Action[] = GRANTABLE_ACTIONS.map(([action]) => action);

/**
 * L'autre sens d'`undelegatableGrants` : non plus « refuse-t-on cette demande ? » mais **« que
 * peut-on offrir ? »**. Renvoie les actions que ce principal peut accorder sur cette ressource,
 * vide s'il ne peut rien en donner.
 *
 * Les deux DOIVENT rester d'accord : ce que celle-ci propose, l'autre l'accepte. D'où la même règle
 * de rang et le même court-circuit du propriétaire, ici plutôt qu'une seconde lecture de la carte
 * de droits — une matrice qui proposerait ce que l'enregistrement refuse serait un mensonge, et un
 * refus qu'on ne comprend qu'après coup.
 */
export function delegatableActions(principal: Principal<unknown>, resource: string): Action[] {
  // Le propriétaire peut tout donner, `schema` compris — le don venu du sommet n'est pas une
  // élévation (cf. `undelegatableGrants`).
  if (principal.authority.kind === 'total') return [...ALL_ACTIONS];

  if (RANK_BOUND_RESOURCES.has(resource)) return [];

  return ALL_ACTIONS.filter((action) => holds(principal.authority, resource, action));
}

/**
 * Délégation (ADR-0038) : **on ne peut accorder que ce qu'on détient**, action par action.
 *
 * Sans cette règle, quiconque a `permission:update` peut s'attribuer n'importe quel droit via son
 * propre rôle — le drapeau `locked` ne protège que les lignes qu'on a pensé à verrouiller, pas le
 * principe. L'alternative écartée par l'ADR, une portée d'administration par catégories, laissait
 * justement passer cette élévation ; la délégation la rend structurellement impossible.
 *
 * Renvoie les droits demandés que le principal ne détient pas — vide s'il peut tout accorder.
 * Rendre la liste plutôt qu'un booléen permet de dire à l'appelant CE QUI est refusé.
 */
export function undelegatableGrants(
  principal: Principal<unknown>,
  grants: PermissionGrant[],
): string[] {
  // Le propriétaire court-circuite ICI, et pour une seule raison : la règle de rang ci-dessous, qui
  // refuse une ressource même à qui la détient. `holds` suffirait pour tout le reste.
  if (principal.authority.kind === 'total') return [];

  const refused: string[] = [];

  for (const grant of grants) {
    const grantsAnything = GRANTABLE_ACTIONS.some(([, flag]) => grant[flag]);

    // Une ressource de rang ne se transmet pas, même par qui la détient — sans quoi « tient au
    // rang » ne veut rien dire : un administrateur la recopierait sur un rôle sur mesure et la
    // possession redeviendrait le critère.
    //
    // Le propriétaire de l'installation, lui, court-circuite en amont, comme partout ailleurs.
    // Ce n'est pas une brèche : il peut déjà nommer quelqu'un administrateur, donc lui donner ce
    // droit ne lui ouvre aucune capacité nouvelle. La règle vise l'ÉLÉVATION — obtenir plus que ce
    // qu'on a —, pas le don venu du sommet.
    if (grantsAnything && RANK_BOUND_RESOURCES.has(grant.resource)) {
      refused.push(`${grant.resource} (tient au rang, non délégable)`);
      continue;
    }

    for (const [action, flag] of GRANTABLE_ACTIONS) {
      if (grant[flag] && !holds(principal.authority, grant.resource, action)) {
        refused.push(`${grant.resource}:${action}`);
      }
    }

    // `selfOnly` borne un droit aux lignes dont on est le sujet. L'accorder SANS cette borne quand
    // on ne le détient qu'avec, c'est accorder plus large que ce qu'on a — même interdit, autre
    // dimension. L'ADR ne l'explicitait pas ; c'est la lecture fidèle de la règle.
    if (
      grantsAnything &&
      isSelfOnly(principal.authority, grant.resource) &&
      grant.selfOnly !== true
    ) {
      refused.push(`${grant.resource}:selfOnly`);
    }
  }

  return refused;
}

// Ce qu'un scope de clé d'API recouvre. `write` est COMPOSITE, façon GitHub : create + update +
// delete. Le détail granulaire reste au RBAC des rôles humains ; les clés machine restent simples.
const SCOPE_WRITE_ACTIONS = ['create', 'update', 'delete'] as const satisfies readonly Action[];

/**
 * Une clé d'API est une DÉLÉGATION D'AUTORITÉ : la règle d'`undelegatableGrants` s'y applique
 * telle quelle (ADR-0038, amendement du 2026-08-10).
 *
 * Sans elle, `api_key:create` est un droit universel déguisé — qui le détient se forge une clé
 * portant n'importe quel scope, y compris ce qu'il ne peut pas faire lui-même. La validation
 * existante ne vérifiait que le VOCABULAIRE : « ce scope existe-t-il », jamais « l'as-tu ».
 *
 * Renvoie les scopes refusés. Vide si l'émetteur peut tout déléguer.
 */
export function undelegatableScopes(principal: Principal<unknown>, scopes: string[]): string[] {
  // Le propriétaire de l'installation court-circuite, comme partout ailleurs.
  if (principal.authority.kind === 'total') return [];

  const refused: string[] = [];

  for (const scope of scopes) {
    // Découpe sur le PREMIER `:` seulement : une ressource peut en contenir (`write:entity:article`).
    const separator = scope.indexOf(':');
    const action = scope.slice(0, separator);
    const resource = scope.slice(separator + 1);

    const covered =
      action === 'read'
        ? holds(principal.authority, resource, 'read')
        : SCOPE_WRITE_ACTIONS.every((write) => holds(principal.authority, resource, write));
    if (!covered) {
      refused.push(scope);
      continue;
    }

    // `selfOnly` borne un droit aux lignes dont on est le sujet. Une clé machine n'a pas de sujet
    // (`hasSubject: false`), donc elle ne PEUT PAS porter cette borne : lui déléguer un droit qu'on
    // ne détient que borné le rendrait illimité entre ses mains. Refusé, faute de pouvoir le
    // restreindre.
    if (isSelfOnly(principal.authority, resource)) {
      refused.push(scope);
    }
  }

  return refused;
}

/**
 * Y a-t-il révocation ? `PUT /roles/:id/permissions` remplace l'ensemble des droits : tout ce qui
 * n'est pas soumis est supprimé. Une soumission peut donc retirer sans en avoir l'air.
 *
 * Renvoie les droits que la soumission ferait disparaître — vide si elle ne fait qu'ajouter.
 *
 * `current` ne doit contenir que les lignes NON verrouillées : une ligne `locked` n'est jamais
 * supprimée, elle ne peut donc pas être révoquée.
 */
export function revokedByGrants(
  current: PermissionGrant[],
  submitted: PermissionGrant[],
): string[] {
  const revoked: string[] = [];
  const next = new Map(submitted.map((grant) => [grant.resource, grant]));

  for (const existing of current) {
    const after = next.get(existing.resource);

    for (const [action, flag] of GRANTABLE_ACTIONS) {
      if (existing[flag] && !(after?.[flag] ?? false)) {
        revoked.push(`${existing.resource}:${action}`);
      }
    }

    // Poser `selfOnly` sur un droit qui ne l'avait pas retire de la portée sans retirer d'action :
    // c'est une révocation, même si aucun bit CRUD ne bouge.
    if (!existing.selfOnly && (after?.selfOnly ?? false)) {
      revoked.push(`${existing.resource}:selfOnly`);
    }
  }

  return revoked;
}
