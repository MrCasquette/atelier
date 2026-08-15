# `@repo/adapters` — la mécanique commune aux familles d'adapters

Ce qui se répétait à l'identique dans les trois familles — paiement, livraison, communication — sans
aucun provider ni aucune table ([ADR-0011](../../docs-internal/adr/ADR-0011-adapters-providers.md)).

## Frontière

**Ce paquet ne dépend de rien** : ni base, ni schéma, ni `drizzle`. C'est du code pur. Aucun provider
concret n'y entre — un adapter Stripe ou Colissimo appartient au cœur produit qui l'utilise.

## Ce qu'il porte

**Le registre déclaratif** (OCP). Il remplace le trio dupliqué `switch` + singletons `let xAdapter` +
boucle `getAvailable` + `reset` : on déclare une map `provider → fabrique`, tout le reste en dérive.
Ajouter un provider devient **une entrée**.

**L'abstraction d'injection des credentials** (DIP). Un adapter dépend d'une *source* de credentials,
pas du module `config` concret — lequel importe `db`. Le registre injecte le store réel, adossé à la
base et rendant des credentials déchiffrés ; un test injecte un stub. C'est ce qui rend la couche
adapter testable **sans base de données**.

## Dépendances

Aucune.
