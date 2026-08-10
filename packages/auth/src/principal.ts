// Registre de principaux (ADR-0037).
//
// Un « principal », c'est la réponse à « comment tu es authentifié » — session d'administration,
// session client, clé d'API machine, anonyme. C'était une union fermée de quatre variantes
// (`RbacAuthContext`), donc quatre branches à traverser à chaque décision, et une branche morte
// garantie dans tout produit qui n'a pas de clients.
//
// Le socle déclare ici le CONTRAT ; le produit enregistre les principaux qu'il connaît. Ce qui
// distinguait les variantes devient des PROPRIÉTÉS du principal résolu — `bypass`, `privileged`,
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

// Tout ce qu'un résolveur a le droit de regarder pour reconnaître l'appelant.
export type PrincipalRequest = {
  cookie: Record<string, { value?: string }>;
  authHeader?: string;
};

export type Principal<Identity> = {
  // Clé du registre. Sert au diagnostic et aux journaux — jamais à brancher : tout ce dont une
  // décision a besoin est porté par les champs ci-dessous.
  type: string;
  permissions: Map<string, PermissionSet>;
  // Court-circuite toute vérification (propriétaire de l'installation). Seul un résolveur déclaré
  // `mayBypass` a le droit de le poser — cf. `PrincipalResolver`.
  bypass: boolean;
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
  // Sans ce drapeau, `bypass` serait une donnée qu'un résolveur pose librement à chaque requête :
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
        if (principal.bypass && !resolver.mayBypass) {
          throw new Error(
            `Le principal « ${resolver.type} » n'est pas autorisé à court-circuiter les vérifications`,
          );
        }
        return principal;
      }
      if (!fallback) {
        throw new Error("Aucun principal de dernier recours n'est enregistré");
      }
      // Le dernier recours est l'appelant que personne n'a reconnu : jamais de bypass, par nature.
      const principal = await fallback.resolve(request);
      if (principal.bypass) {
        throw new Error('Le principal de dernier recours ne peut pas court-circuiter');
      }
      return principal;
    },

    types() {
      return [...resolvers.map((r) => r.type), ...(fallback ? [fallback.type] : [])];
    },
  };
}
