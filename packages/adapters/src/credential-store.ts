// Abstraction injectée dans les adapters (DIP) : un adapter dépend d'une SOURCE de credentials, pas
// du module `config` concret (qui importe `db`). Le registre injecte le store réel (adossé à la base,
// credentials déchiffrés) ; un test injecte un stub. C'est ce qui rend la couche adapter testable
// sans base de données.
export interface CredentialStore<T> {
  // Renvoie les credentials utilisables (déchiffrés, provider activé), ou `null` sinon.
  get(): Promise<T | null>;
}
