# Backlog — socle partagé

Travail sur les packages, contrats et décisions qui concernent Échoppe et Prisme. Une abstraction
nouvelle doit avoir deux usages réels ; à défaut, elle reste dans le produit qui la porte.

## Contenu config-as-code

- [ ] 🔴 **Migrer `richText` de HTML vers Markdown** selon [ADR-0030](../adr/ADR-0030-texte-riche-markdown.md) :
  convertir les données, désactiver le HTML brut et tester le rendu contre le XSS stocké.
- [x] 🟠 **Préserver l'ordre déclaré des champs** : choisir une représentation explicitement
  ordonnée plutôt que dépendre de l'ordre d'un objet stocké en `jsonb`. → `json` au lieu de `jsonb`
  sur `content_definition.fields` et `entity_definition.fields` ; `jsonb` normalise les clés.
- [x] 🟠 **Extraire la grammaire des champs hors de `@repo/pages`** ; trancher le nom du package
  avec le lexique. → `@repo/fields`, sans aucune dépendance : la primitive et sa compilation sont
  parties, les dérivations sont restées — DDL côté entités, registre à deux rôles côté pages.
  `@repo/entities` ne dépend plus de `@repo/pages`.
- [x] 🟠 **Implémenter l'interpolation V1** après stabilisation de Markdown : jeu fini de variables,
  substitution sans évaluation, une passe, littéral conservé pour une inconnue.
- [ ] 🟡 **Type-gen du DSL** pour les sections et composants de front.
- [ ] 🟡 **Générateur de formulaires admin** depuis le registre.
- [ ] 🟡 Menus imbriqués, champs custom, fichiers/assets et i18n des enums.
- [ ] 🟡 Durcir les clés API et documenter la portabilité liée à PostgreSQL/`jsonb`.

## Architecture et contrats

- [ ] 🟠 **Trancher l'injection DB** dans un ADR : singleton, factory de service, contexte de requête
  et unité transactionnelle. L'éprouver d'abord dans le vertical slice Prisme.
- [ ] 🟠 **Retirer le singleton de `@repo/communication` au profit d'une composition injectable.**
  `email.ts` résout son adapter via `getActiveCommunicationAdapter()`, importé d'un singleton de
  module aux fabriques câblées en dur : **aucune couture** ne permet d'en substituer un faux. Les
  credentials sont bien injectés (DIP), mais les stuber supprime la dépendance à la base, **pas au
  réseau** — un adapter muni de credentials valides appelle la véritable API.

  Ce qui protège les tests aujourd'hui est qu'aucun provider n'est configuré dans la base de test :
  une propriété de la donnée, pas de l'architecture, sur un Postgres que tous les fichiers partagent.

  Sortie retenue : une fabrique `createCommunicationRegistry(factories)` composée par le produit au
  démarrage — la forme « acteur », conforme au sens de la flèche d'ADR-0025. Écarté : un garde
  `NODE_ENV`, qui serait un test d'environnement dans du code de domaine, invisible au type, et ne
  protégerait que le chemin qui pense à le consulter. Touche les 4 appelants de `sendEmail` plus le
  câblage au boot. Débloque les tests du chemin d'envoi, aujourd'hui impossibles.
  Détail : [audit de couverture documentaire](../audits/audit-couverture-documentaire.md).
- [ ] 🟡 **Séparer la partie pure de `@repo/pages` de sa partie connectée**, sur le modèle déjà
  appliqué dans `@repo/auth` (`permission.ts` / `permission-cache.ts`). `definition-service.ts`
  importe `db` au niveau module et `@repo/db` **lève à l'import** sans `DATABASE_URL` : la logique
  pure — `assertRegistryCoherent`, `unknownRefTargets` — est soudée à la connexion par le graphe
  d'imports alors qu'elle n'interroge rien. Ses tests doivent poser une URL factice, contournement
  consigné dans le fichier de test. La convention existe déjà dans le dépôt ; ce module ne l'applique
  pas. Détail : [audit de couverture documentaire](../audits/audit-couverture-documentaire.md).
- [ ] 🟠 **Encaisser le découpage en packages** — le constat, mesuré le 2026-08-12 : les frontières
  existent dans l'arborescence mais pas dans les imports. L'API compte **61 imports de
  `@echoppe/core` contre 29 de `@repo/*`**, et **46 usages de symboles qui vivent dans un `@repo/*`**
  y entrent par le barrel du cœur — 14 fois `media`, 7 fois `user`, 4 fois `menu`, 3 fois `site`.
  `packages/echoppe-core/src/db/schema/index.ts` réexporte les tables de sept packages, sous le
  commentaire « réexporté pour ne pas changer la surface ». Rien n'empêche donc de contourner un
  package : il y a juste un chemin plus court, et il gagne.

  Rien de dramatique — aucune indirection gratuite, le code interne est cohérent et testé. Mais
  l'extraction a été **payée sans être encaissée**, et une frontière que personne n'emprunte cesse
  d'être vraie : un package que plus rien n'importe directement finit par accueillir n'importe quoi.

  Deux gestes, dans cet ordre. Le premier seul compte, le second est de l'hygiène :

  1. **Faire tomber le barrel de réexport du cœur.** Que `media` s'importe depuis `@repo/assets` et
     nulle part ailleurs. Mécanique, vérifiable par une règle de lint — c'est ce qui transforme le
     découpage de décor en structure. Sans lui, tout le reste est cosmétique. Attention : le barrel
     de `db/schema/index.ts` doit **survivre pour les migrations** — `drizzle.config.ts` ne lit que
     lui. C'est son usage comme raccourci d'import qui doit tomber, pas son existence.
  2. **Refondre les feuilles sous ~100 lignes** dans leur consommateur unique, ou les regrouper.
     Cinq packages sont concernés : `assets` (**32 lignes**, deux tables et un `export`), `shared`
     (88), `db` (90), `identity` (92), `adapters` (102). Aucun n'achète ce qu'une frontière est
     censée acheter : ils sont `private` (pas de publication), tous en `0.0.1` sans tests propres
     (pas de versionnage), et `assets` n'a aucune dépendance sortante — la frontière n'empêche donc
     rien. À ressortir en dix minutes le jour où un deuxième lecteur apparaît.

  Réserve honnête : le découpage vise un second produit qui n'existe pas encore, donc quatre
  packages (`assets`, `identity`, `menus`, `pages`) n'ont qu'**un seul consommateur**. C'est du
  partitionnement anticipé, pas de la sur-abstraction — ça se défait en fusionnant deux dossiers,
  là où une mauvaise abstraction ne se défait pas. Le pari reste ouvert ; ce qui ne l'est pas, c'est
  de le porter sans l'appliquer.
- [ ] 🟠 **Définir la compatibilité runtime/API/SDK** : matrice, dépréciation et politique pré-1.0.
- [ ] 🟡 Réorganiser les domaines internes uniquement à l'apparition d'un deuxième consommateur.
- [ ] 🟡 Compiler en CI les exemples des packages publics et une configuration de contenu témoin.

## Sécurité

Relevés par l'[audit de couverture documentaire](../audits/audit-couverture-documentaire.md)
(lot 2, 2026-08-16). Aucun n'est exploité aujourd'hui ; tous reposent sur une propriété
circonstancielle plutôt que sur une garde.

- [ ] 🟠 **Échapper les données utilisateur du gabarit `contact-form`**
  (`packages/communication/src/templates.ts:117`). `name`, `email`, `phone`, `subject` et `message`
  sont interpolés bruts dans le HTML de l'e-mail, et proviennent d'un formulaire **public et non
  authentifié**. N'importe qui peut donc faire arriver du HTML arbitraire dans la boîte de
  l'administrateur — liens, pixels de traçage, mise en page usurpée. Les clients mail bloquent les
  scripts, donc pas de XSS : le risque réel est un hameçonnage qui paraît émis par la boutique
  elle-même. Vérifier au passage les autres gabarits, qui interpolent selon le même motif.
- [ ] 🟠 **Fermer les deux oracles d'énumération de `authenticate`**
  (`packages/auth/src/service.ts:162-167`). Deux problèmes distincts :
  - **Explicite** — `account-disabled` est rendu **avant** la vérification du mot de passe : on
    confirme qu'une adresse correspond à un compte désactivé sans aucun identifiant valide.
    Correctif : vérifier le mot de passe d'abord, ne consulter `isActive` qu'ensuite. On n'apprend
    l'état de son compte qu'après avoir prouvé qu'il est le sien.
  - **Temporel** — le chemin « adresse inconnue » retourne sans exécuter `Bun.password.verify`, qui
    est volontairement coûteux. L'écart est de plusieurs ordres de grandeur et porte sur **tous** les
    comptes. Il touche aussi le login client
    (`apps/echoppe-api/src/modules/auth/customer-service.ts:163`), donc une surface publique.
    Correctif : vérifier contre un **hash leurre** calculé une fois au chargement, avec les mêmes
    paramètres de coût. Ça ne rend pas les durées identiques — la requête SQL diffère aussi — mais
    supprime le seul écart mesurable à distance de façon fiable.

  Ce volet temporel était déjà tracé dans le backlog Échoppe (« Timing du login : vérification
  factice lorsqu'un utilisateur est introuvable »). Il est consolidé ici parce que `authenticate`
  vit dans `@repo/auth`, un paquet partagé, et que les deux volets se corrigent d'un seul geste.

  Dépendance, pas doublon : la **limitation de débit** sur les endpoints d'authentification est
  suivie dans le [backlog Échoppe](./echoppe.md) (« Rate-limit fail-open sans Redis »). Sans elle,
  l'énumération reste possible, seulement plus lente — aucun des correctifs ci-dessus ne la remplace.

  Arbitrage séparé, à décider et non à corriger : l'inscription client rend `email-taken`
  (`customer-service.ts:104`), une énumération explicite sur un endpoint public. Le durcissement
  imposerait le schéma « on vous a envoyé un e-mail » à tous les inscrits légitimes. Sur une
  boutique, le coût ergonomique paraît supérieur au gain.

## Documentation et gouvernance

- [ ] 🟠 **Ajouter à l'index ADR les états d'implémentation, de vérification et d'horizon**, sans
  réécrire le statut historique de décision.
- [ ] 🟡 **Resserrer le maillage documentaire** : liens depuis le code, références actives vérifiées
  et liens vers les ADR successeurs.
- [ ] 🟡 Corriger les chemins, versions et exemples devenus obsolètes dans les README actifs.
- [ ] 🟡 Distinguer explicitement documentation historique, référence active et vision.

## Intendance transverse

- [ ] 🟡 Vérifier les trusted publishers npm/OIDC des trois artefacts publics.
- [ ] 🟡 Purger l'ancien registre Docker Hub après migration des consommateurs encore concernés.
- [ ] 🟡 Garder npm 11 tant que Changesets est incompatible avec npm 12.

