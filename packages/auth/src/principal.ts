// Registre de principaux (ADR-0037).
//
// Un « principal », c'est la réponse à « comment tu es authentifié » — session d'administration,
// session client, clé d'API machine, anonyme. C'était une union fermée de quatre variantes
// (`RbacAuthContext`), donc quatre branches à traverser à chaque décision, et une branche morte
// garantie dans tout produit qui n'a pas de clients.
//
// Le socle déclare ici le CONTRAT ; le produit enregistre les principaux qu'il connaît. Ce qui
// distinguait les variantes devient des PROPRIÉTÉS du principal résolu — `authority`, `privileged`,
// `hasSubject` — si bien que la vérification de permission n'a plus une seule branche par type.
//
// Ce fichier ne connaît ni cookie, ni table, ni schéma — c'est ce qui lui permet de vivre ici.

export type PermissionSet = {
  canCreate: boolean;
  canRead: boolean;
  canUpdate: boolean;
  canDelete: boolean;
  selfOnly: boolean;
};

/**
 * Ce qu'un principal détient (ADR-0047).
 *
 * Une `Map` dit un ensemble FINI. « Tout sauf » est un complémentaire — aucune carte ne l'exprime
 * sans énumérer l'univers, c'est-à-dire sans redevenir la liste qu'on remplace, et qui ne peut pas
 * contenir ce qui n'existait pas quand on l'a écrite.
 *
 * `total` remplace l'ancien drapeau `bypass` : ce n'est plus une dérogation testée à part dans
 * chaque décision, c'est un cas de l'union que `holds` traite comme les autres.
 */
export type Authority =
  /** Le propriétaire de l'installation. Détient tout, n'est borné par rien. */
  | { kind: 'total' }
  /**
   * Détient tout, moins ce qui est nommé. Ce qui s'énumère est ce qu'on RETIRE — donc toute
   * ressource future est détenue par défaut, y compris celles qui n'existent pas encore
   * (`entity:<nom>`).
   */
  | {
      kind: 'except';
      /** Pas détenu du tout — le sensible, qui reste au propriétaire. */
      reserved: ReadonlySet<string>;
      /** Lu, jamais écrit — un journal qui se modifie ne vaut rien. */
      readOnly: ReadonlySet<string>;
      /** Détenu, mais borné aux lignes dont on est le sujet. */
      ownRowsOnly: ReadonlySet<string>;
    }
  /** Ce que des lignes en base ont accordé. Le cas de tout rôle qui n'est pas du premier rang. */
  | { kind: 'granted'; permissions: Map<string, PermissionSet> };

/** Autorité d'un rôle ordinaire, depuis ses lignes de permission. */
export const granted = (permissions: Map<string, PermissionSet>): Authority => ({
  kind: 'granted',
  permissions,
});

// Tout ce qu'un résolveur a le droit de regarder pour reconnaître l'appelant.
export type PrincipalRequest = {
  cookie: Record<string, { value?: string }>;
  authHeader?: string;
};

export type Principal<Identity> = {
  // Clé du registre. Sert au diagnostic et aux journaux — jamais à brancher : tout ce dont une
  // décision a besoin est porté par les champs ci-dessous.
  type: string;
  // Ce que ce principal détient. `total` court-circuite toute vérification (propriétaire de
  // l'installation) : seul un résolveur déclaré `mayBypass` a le droit de le rendre — cf.
  // `PrincipalResolver`.
  authority: Authority;
  // Principal de confiance : humain de l'administration ou machine authentifiée. Sert aux routes
  // dont la VISIBILITÉ dépend de l'appelant, et à l'option `adminOnly` des guards.
  privileged: boolean;
  // Y a-t-il un compte personnel derrière ce principal ? Si oui, le drapeau `selfOnly` d'une
  // permission peut s'appliquer — il y a un « soi » sur lequel filtrer. Faux pour une clé machine
  // et pour l'anonyme : filtrer sur un sujet inexistant ne renverrait jamais rien, en silence.
  hasSubject: boolean;
  // Identité projetée dans le contexte des routes. Sa forme appartient au produit.
  identity: Identity;
};

// Rend un principal s'il reconnaît l'appelant, `null` sinon — auquel cas le registre passe au
// suivant, dans l'ordre d'enregistrement.
export type PrincipalResolver<Identity> = {
  type: string;
  // Ce résolveur a-t-il le droit de rendre un principal qui court-circuite toute vérification ?
  //
  // Sans ce drapeau, l'autorité `total` serait une donnée qu'un résolveur pose à chaque requête :
  // tout principal enregistré pourrait se déclarer propriétaire. Le déclarer à l'ENREGISTREMENT
  // déplace la décision de confiance d'une donnée par requête vers un acte délibéré, écrit une
  // fois, greppable. Un résolveur non déclaré qui tente le coup échoue franchement.
  mayBypass?: boolean;
  resolve(request: PrincipalRequest): Promise<Principal<Identity> | null>;
};

// Répond toujours : c'est le principal de l'appelant que personne n'a reconnu (l'anonyme). Le
// distinguer d'un résolveur ordinaire garantit à `resolve()` un type de retour non nullable —
// aucun appelant n'a de cas « pas de principal » à traiter.
export type FallbackPrincipalResolver<Identity> = {
  type: string;
  resolve(request: PrincipalRequest): Promise<Principal<Identity>>;
};

export interface PrincipalRegistry<Identity> {
  register(resolver: PrincipalResolver<Identity>): void;
  registerFallback(resolver: FallbackPrincipalResolver<Identity>): void;
  resolve(request: PrincipalRequest): Promise<Principal<Identity>>;
  // Principaux enregistrés, dans l'ordre d'essai. Pour le diagnostic et les tests.
  types(): string[];
}

export function createPrincipalRegistry<Identity>(): PrincipalRegistry<Identity> {
  const resolvers: PrincipalResolver<Identity>[] = [];
  let fallback: FallbackPrincipalResolver<Identity> | null = null;

  return {
    register(resolver) {
      if (resolvers.some((existing) => existing.type === resolver.type)) {
        throw new Error(`Principal déjà enregistré : ${resolver.type}`);
      }
      resolvers.push(resolver);
    },

    registerFallback(resolver) {
      fallback = resolver;
    },

    async resolve(request) {
      for (const resolver of resolvers) {
        const principal = await resolver.resolve(request);
        if (!principal) continue;
        if (principal.authority.kind === 'total' && !resolver.mayBypass) {
          throw new Error(
            `Le principal « ${resolver.type} » n'est pas autorisé à court-circuiter les vérifications`,
          );
        }
        return principal;
      }
      if (!fallback) {
        throw new Error("Aucun principal de dernier recours n'est enregistré");
      }
      // Le dernier recours est l'appelant que personne n'a reconnu : jamais total, par nature.
      const principal = await fallback.resolve(request);
      if (principal.authority.kind === 'total') {
        throw new Error('Le principal de dernier recours ne peut pas court-circuiter');
      }
      return principal;
    },

    types() {
      return [...resolvers.map((r) => r.type), ...(fallback ? [fallback.type] : [])];
    },
  };
}
