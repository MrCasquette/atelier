# Roadmap d'exécution — Échoppe / Prisme

État de travail établi le 2026-08-16 à partir du code, des ADR, des backlogs et du worktree réels.
Cette roadmap ordonne les prochains chantiers ; elle ne remplace ni les décisions d'architecture ni
les backlogs par produit.

Références :

- [Backlogs du monorepo](./BACKLOG.md)
- [Backlog Échoppe](./docs-internal/backlog/echoppe.md)
- [Backlog Prisme](./docs-internal/backlog/prisme.md)
- [Backlog shared](./docs-internal/backlog/shared.md)
- [Roadmap produit Prisme](./docs-internal/design/roadmap-prisme.md)
- [Index des ADR](./docs-internal/adr/README.md)

## État acquis

- Le chantier RBAC d'ADR-0047 est livré : autorité unifiée, Administrateur par soustraction,
  protection et transfert de propriété, délégation bornée.
- Invitation et récupération admin sont unifiées par ADR-0048.
- L'ordre déclaré des champs survit au stockage.
- Le schéma de contenu est une séquence ordonnée selon ADR-0049.
- L'interpolation V1 est livrée.
- La grammaire commune est extraite dans `@repo/fields`.
- Les principaux packages partagés ont une charte documentaire et une première couverture de tests.
- ADR-0050 définit le contrat structuré des fautes et interdit qu'un message d'exception compose une
  réponse HTTP.
- Le découpage physique Échoppe / shared existe.

Prisme n'a cependant encore aucun artefact exécutable : ni `prisme-core`, ni `prisme-api`, ni admin,
ni client. La prochaine preuve architecturale doit désormais venir d'un second produit réel.

## Jalon 0 — Mettre en usage le contrat d'ADR-0050

Le commit `0b5ecb1` pose `Fault`, `ErrorResponse`, les ressources possédées par les packages, les
constructeurs typés d'Échoppe et le catalogue de transition — sans migrer aucune route. Partir de ce
contrat et terminer une première tranche verticale avant de changer de sujet.

- [x] Stabiliser `Fault`, `ErrorResponse` et la composition des ressources par produit.
- [x] Introduire les constructeurs typés côté Échoppe → `packages/echoppe-core/src/constants/fault.ts`,
  seul endroit où le vocabulaire se ferme.
- [x] Conserver temporairement `message` comme compatibilité explicitement dépréciée → `@deprecated`
  sur `ErrorResponse.message`, rempli par `apps/echoppe-api/src/lib/fault-message.ts`.
- [x] Vérifier lint, type-check et tests ciblés.
- [ ] Ajouter les tests unitaires du contrat et de ses **constructeurs**. Le catalogue de rendu est
  couvert (8 tests, dont l'exhaustivité des 19 codes et le repli sur ressource inconnue) ; les
  constructeurs eux-mêmes ne le sont pas encore.
- [ ] Migrer un premier chemin complet domaine → route → surface comme preuve. Cible proposée :
  `catalog/product`, qui concentre 22 `not_found`.
- [ ] Ajouter le `onError` global — prérequis de la migration, pas seulement de la sécurité
  (également listé au jalon 1).

Ne pas migrer les 214 réponses d'erreur dans un seul diff. Procéder verticalement, par famille de
fautes et avec une surface consommatrice à chaque étape.

**Critère de sortie** : le contrat est réellement consommé par au moins une route et une surface ;
il n'est pas seulement déclaré dans les barrels.

## Jalon 1 — Fermer les vulnérabilités courtes et exposées

- [ ] Échapper toutes les données utilisateur injectées dans les gabarits HTML d'e-mail.
- [ ] Fermer l'oracle explicite d'`authenticate` : vérifier le mot de passe avant de révéler qu'un
  compte est désactivé.
- [ ] Fermer l'oracle temporel : vérifier un hash leurre lorsqu'un compte est inconnu.
- [ ] Corriger le rate limiting sans Redis.
- [ ] Définir et tester la politique de proxy de confiance.
- [ ] Hasher les tokens de session stockés en base.
- [ ] Durcir les uploads média : contenu, taille, nom serveur et téléchargement sûr.
- [ ] Ajouter le `onError` global garanti par ADR-0050.
- [ ] Borner les webhooks sans substituer le rate limiting à leur signature et à leur idempotence.

**Critère de sortie** : login, session, formulaire de contact et upload possèdent chacun un test de
refus ou d'abus.

## Jalon 2 — Rendre le socle réellement composable

Ne réaliser ici que les travaux nécessaires au second produit.

- [ ] Remplacer le singleton de `@repo/communication` par une factory de registre injectable.
- [ ] Séparer la partie pure de `@repo/pages` de sa partie connectée.
- [ ] Faire tomber les réexports fonctionnels de `@echoppe/core` au profit d'imports directs depuis
  `@repo/*`.
- [ ] Conserver le barrel de schéma nécessaire à Drizzle, sans l'utiliser comme raccourci applicatif.
- [ ] Ajouter une règle empêchant le retour des imports contournant les packages.
- [ ] Trancher l'injection DB à partir d'un cas concret du vertical slice Prisme.

Ne pas fusionner les petits packages à ce stade. Prisme permettra d'identifier lesquels ont
réellement deux consommateurs.

**Critère de sortie** : une application peut assembler auth, pages, entités, communication et
références sans importer `@echoppe/core`.

## Jalon 3 — Stabiliser le contenu partagé

- [ ] Migrer `richText` de HTML vers Markdown selon ADR-0030.
- [ ] Convertir explicitement et de façon vérifiable les données existantes.
- [ ] Interdire ou neutraliser le HTML brut.
- [ ] Définir un rendu Markdown sûr côté front.
- [ ] Tester les attributs sémantiques, sauts de ligne et caractères échappés.
- [ ] Vérifier l'interaction avec l'interpolation déjà livrée.

Ordre attendu du pipeline :

```text
stockage Markdown
    → interpolation échappée
    → parsing Markdown
    → rendu HTML sûr
```

**Critère de sortie** : une valeur provenant du contenu ou d'une variable interpolée ne peut pas
injecter de HTML exécutable.

## Jalon 4 — Faire naître Prisme par un vertical slice

### 4.1 — `packages/prisme-core`

- [ ] Agréger le schéma partagé sans table commerce.
- [ ] Posséder les migrations Prisme.
- [ ] Composer explicitement les packages partagés.

### 4.2 — `apps/prisme-api`

- [ ] Ajouter bootstrap, configuration et fermeture propre des ressources.
- [ ] Composer l'authentification admin.
- [ ] Exposer identité, médias, pages, sections, entités, références et menus.
- [ ] Utiliser le contrat de faute d'ADR-0050 dès la première route.
- [ ] Produire un contrat HTTP propre à Prisme.

### 4.3 — Fixture config-as-code

- [ ] Déclarer une page.
- [ ] Déclarer une entité liste et une entité singleton.
- [ ] Utiliser un champ image, une référence et une variable interpolée.

### 4.4 — Preuve de bout en bout

- [ ] Démarrer sur une base vierge et appliquer les migrations.
- [ ] Exécuter `content check`, puis `content push`.
- [ ] Écrire du contenu via la surface admin de l'API.
- [ ] Lire ce contenu via la surface publique.

Ne pas commencer par `prisme-admin`. La fixture et l'API doivent révéler la surface réelle dont
l'administration aura besoin.

**Critère de sortie** : Prisme démarre sur une base vide, pousse puis sert du contenu sans importer
une seule brique commerce.

## Jalon 5 — Rendre Prisme V1 utilisable

- [ ] Définir la topologie de déploiement V1 : images, base, migrations, bootstrap et mises à jour.
- [ ] Créer un `prisme-admin` minimal : login, pages, entités, médias, menus, utilisateurs et droits.
- [ ] Créer le client Prisme depuis son contrat OpenAPI.
- [ ] Trancher le scope npm du client.
- [ ] Définir le cycle de production config-as-code : sauvegarde, plan, confirmation destructive,
  concurrence, reprise et compatibilité code/schéma.
- [ ] Documenter le parcours développeur complet.
- [ ] Ajouter les smoke tests fresh, upgrade et idempotence.

**Critère de sortie** : un développeur extérieur au monorepo peut déclarer, pousser, éditer et lire
du contenu sans connaître l'implémentation interne.

## Jalon 6 — Consolider Échoppe avec les garanties éprouvées

- [ ] Tester capture Stripe, échecs, webhooks, stock et idempotence.
- [ ] Tester une boutique externe créée par `create-echoppe`.
- [ ] Compiler en CI les exemples publics du SDK et du package content.
- [ ] Épingler les versions compatibles générées par la CLI.
- [ ] Ajouter logger structuré, corrélation de requête et fermeture propre des ressources.
- [ ] Reprendre catalogue, checkout invité et expérience storefront selon la priorité produit.

## Explicitement hors de cette séquence

Ces sujets ne sécurisent pas le système et ne prouvent pas la frontière entre les produits. Ils
restent dans leurs backlogs, sans entrer dans cette roadmap courte :

- `prisme-store` et rendu générique V2 ;
- presets et activation V2 ;
- thèmes et GUI de conception d'entités ;
- i18n généralisée ;
- interpolation avancée ;
- type-gen du DSL ;
- migration Bun vers Node/pnpm ;
- fusion des petits packages ;
- refactors purement esthétiques ;
- OAuth providers et intégrations tierces.

## Séquence synthétique

```text
ADR-0050 en cours
        ↓
Sécurité courte et exposée
        ↓
Composition réelle des packages
        ↓
Markdown sécurisé
        ↓
prisme-core + prisme-api
        ↓
Fixture et smoke Prisme
        ↓
prisme-admin + client + déploiement V1
        ↓
Consolidation production Échoppe
        ↓
V2 Prisme
```

---

> **Document temporaire.** Ce fichier a vocation à disparaître au profit des véritables roadmaps et
> backlogs actionnables par produit. Il n'est qu'un artefact de pilotage à court terme destiné à
> ordonner la transition entre l'état actuel du dépôt et ces sources de vérité durables.
