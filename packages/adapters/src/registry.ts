// Registre d'adapters déclaratif (OCP) partagé par les familles (paiement/livraison/communication).
// Remplace le trio dupliqué switch + singletons `let xAdapter` + boucle getAvailable + reset : on
// déclare une map `provider → fabrique`, tout le reste en dérive. Ajouter un provider = une entrée.
export interface AdapterRegistry<P extends string, A> {
  // Instance (lazy, mémoïsée) de l'adapter d'un provider.
  get(provider: P): A;
  // Providers « prêts » (selon le prédicat fourni, ex. configuré + activé), dans l'ordre déclaré.
  available(isReady: (provider: P) => Promise<boolean>): Promise<P[]>;
  // Purge les instances mémoïsées (ex. après rotation de credentials).
  reset(): void;
}

export function createAdapterRegistry<P extends string, A>(
  providers: readonly P[],
  factories: Record<P, () => A>,
): AdapterRegistry<P, A> {
  const instances = new Map<P, A>();

  return {
    get(provider) {
      let instance = instances.get(provider);
      if (!instance) {
        const factory = factories[provider];
        if (!factory) throw new Error(`Unknown provider: ${provider}`);
        instance = factory();
        instances.set(provider, instance);
      }
      return instance;
    },
    async available(isReady) {
      const result: P[] = [];
      for (const provider of providers) {
        if (await isReady(provider)) result.push(provider);
      }
      return result;
    },
    reset() {
      instances.clear();
    },
  };
}
