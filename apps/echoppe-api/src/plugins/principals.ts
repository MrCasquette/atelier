// Registre de principaux (ADR-0037).
//
// Un « principal », c'est la réponse à « comment tu es authentifié » — session d'administration,
// session client, clé d'API machine, anonyme. C'était une union fermée de quatre variantes
// (`RbacAuthContext`), donc quatre branches à traverser à chaque décision, et une branche morte
// garantie dans tout produit qui n'a pas de clients.
//
// Le socle déclare ici le CONTRAT ; le produit enregistre les principaux qu'il connaît. Ce qui
// distinguait les variantes devient des PROPRIÉTÉS du principal résolu — `bypass`, `privileged`,
// `honorsSelfOnly` — si bien que la vérification de permission n'a plus une seule branche par type.
//
// Ce fichier ne connaît ni cookie, ni table, ni schéma : il partira tel quel dans `packages/auth`.

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
  // Court-circuite toute vérification (propriétaire de l'installation).
  bypass: boolean;
  // Principal de confiance : humain de l'administration ou machine authentifiée. Sert aux routes
  // dont la VISIBILITÉ dépend de l'appelant, et à l'option `adminOnly` des guards.
  privileged: boolean;
  // Le bit `selfOnly` d'une permission s'applique-t-il ? Faux pour une clé machine (pas de sujet
  // humain à qui rapporter un « soi ») et pour l'anonyme.
  honorsSelfOnly: boolean;
  // Identité projetée dans le contexte des routes. Sa forme appartient au produit.
  identity: Identity;
};

// Rend un principal s'il reconnaît l'appelant, `null` sinon — auquel cas le registre passe au
// suivant, dans l'ordre d'enregistrement.
export type PrincipalResolver<Identity> = {
  type: string;
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
        if (principal) return principal;
      }
      if (!fallback) {
        throw new Error("Aucun principal de dernier recours n'est enregistré");
      }
      return fallback.resolve(request);
    },

    types() {
      return [...resolvers.map((r) => r.type), ...(fallback ? [fallback.type] : [])];
    },
  };
}
