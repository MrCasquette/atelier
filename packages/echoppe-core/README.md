# `@echoppe/core` — le cœur du produit Échoppe

Le core **appartient au produit et possède la base**
([ADR-0025](../../docs-internal/adr/ADR-0025-deux-produits-un-repo.md)) : la connexion, le barrel de
schémas, `drizzle.config.ts`, le dossier de migrations. Un produit = un core = une base.

Ce n'est **pas** le cœur du monorepo. Les paquets partagés le sont ; celui-ci est le cœur d'un des
deux produits. Prisme aura le sien.

## Ce qu'il possède en propre

- **Le schéma de commerce** — produits, variantes, panier, commandes, paiements, livraison, taxes.
- **Les adapters de paiement et de livraison** (Stripe, PayPal, Colissimo, Sendcloud, Mondial Relay),
  bâtis sur la mécanique de `@repo/adapters`.
- **Les services** — facturation, calculs de commande.
- **Les migrations**, y compris celles des tables livrées par les paquets partagés.

## Le manifeste de migration, et pourquoi il est seul à énumérer

Le cœur embarque dans SES migrations les tables de sept paquets partagés — `@repo/assets`,
`@repo/auth`, `@repo/identity`, `@repo/menus`, `@repo/pages`, `@repo/entities`,
`@repo/communication`. Drizzle ne migre que ce qu'il voit depuis un point d'entrée unique : cette
énumération est donc **nécessaire**, et elle vit dans `src/db/schema/migrations.ts`, seul fichier
que `drizzle.config.ts` lit.

Ce fichier n'est **pas** dans les `exports` du paquet. C'est délibéré : rien ne peut l'importer,
donc il ne peut pas redevenir un raccourci. Le barrel visible, `src/db/schema/index.ts`, n'expose
que les tables du cœur.

Ce partage règle une dette qui était mesurée : 54 symboles de paquets partagés entraient par le
cœur — `db` dans 75 fichiers, `eq` dans 53, `user` dans 17. L'API consommait `@repo/db` et
`@repo/assets` sans même les déclarer. Une frontière que personne n'emprunte cesse d'être vraie.

**Une capacité partagée s'importe depuis son paquet, jamais depuis le cœur** — et ce n'est plus une
consigne : `bun run core-passthrough` échoue sur tout réexport atteignable depuis un point d'entrée
déclaré.

## Slicing horizontal, assumé et daté

`core` est organisé par couche technique (`db/schema/*`, `adapters/<famille>/*`, `services/*`), pas
en `domain/<concept>/`. C'est un **écart conscient** vis-à-vis du slicing vertical, acté dans
[conventions.md](../../docs-internal/reference/conventions.md) avec son seuil de bascule : on y passe
quand le wiring se duplique, typiquement à l'arrivée d'un second consommateur du cœur. À rouvrir en
ADR avant exécution, pas au fil de l'eau.

## La connexion

`@repo/db` **lève à l'import** sans `DATABASE_URL`, et importer ce paquet construit son client au
chargement du module. Tout consommateur — y compris un test unitaire ou `drizzle.config.ts` — doit
donc disposer de la variable, même quand aucune connexion n'est ouverte. La CI pose un placeholder
pour cette raison.

## Dépendances

Les sept paquets partagés ci-dessus, plus `drizzle-orm`, `postgres`, et les SDK des providers.
