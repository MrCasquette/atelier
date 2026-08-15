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

## Le barrel de schémas, et la dette qu'il porte

`src/db/schema/index.ts` réexporte les tables de sept paquets partagés — `@repo/assets`,
`@repo/auth`, `@repo/identity`, `@repo/menus`, `@repo/pages`, `@repo/entities`,
`@repo/communication`. C'est **volontaire et nécessaire** : le cœur les inclut dans son barrel, donc
dans ses migrations, et `drizzle.config.ts` ne lit que ce barrel.

Mais ce barrel réexporte aussi vers le reste du code, et là c'est une dette mesurée : l'API compte
**61 imports de `@echoppe/core` contre 29 de `@repo/*`**, et **46 usages de symboles vivant dans un
paquet partagé** y entrent par ce raccourci. Une frontière que personne n'emprunte cesse d'être
vraie. Le geste — faire tomber le barrel de réexport hors du besoin de migration — est tracé dans
[le backlog socle](../../docs-internal/backlog/shared.md), section « Architecture et contrats ».

**En attendant : importer une table partagée depuis son paquet, pas depuis le cœur.**

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
