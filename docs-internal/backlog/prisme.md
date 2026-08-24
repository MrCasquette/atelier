# Backlog — Prisme

Travail propre au CMS Prisme. La [roadmap produit](../roadmap/prisme.md) décrit les jalons ;
ce fichier ne contient que les actions V1 encore ouvertes, et l'après vit dans la même
roadmap, § V2. Les packages réutilisables vivent dans le
[backlog shared](./shared.md).

## V1 — prouver le produit headless

**Le vertical slice vient tôt**, juste après les quatre chantiers de forme du
[backlog socle](./shared.md#lordre-du-moment). Trois raisons, dans l'ordre de force :

1. **Il débloque l'identité.** [ADR-0051](../adr/ADR-0051-garde-credentials.md) conditionne
   explicitement le choix du mode — garde locale, OIDC, service géré — à l'existence de **deux
   usages réels**. Prisme est ce second usage : sans lui, la décision ne s'instruit pas, quel que
   soit le temps qu'on y passe.
2. **Les décisions suspendues au second consommateur attendent avec elle** : l'injection DB, la
   fusion des petits paquets, la réorganisation des domaines internes.
3. **La garde d'isolation dort.** `product-isolation` sort en succès silencieux tant qu'un seul
   scope possède une application — la frontière entre produits n'est donc pas vérifiée aujourd'hui.

Il ne conditionne en revanche **pas** la V1 stable d'Échoppe, qui ne promet que ses surfaces
publiées ([ADR-0023](../adr/ADR-0023-versioning-tags.md), amendement). Prisme prouve l'architecture,
pas le contrat.


- [ ] 🔴 **Poursuivre le vertical slice.** Le squelette boote (2026-08-24) : `prisme-core` possède
  ses migrations — dix-sept tables, aucune du commerce —, `prisme-api` sert `/`, `/-/health` et
  `/-/docs` sur le rang 1, applique ses migrations au boot et refuse de démarrer sans
  `DATABASE_URL`. `product-isolation` garde enfin une vraie frontière.

  Restent, dans cet ordre : **auth admin** (et l'extraction des en-têtes de sécurité, dont c'est la
  deuxième occurrence), **le contrat de faute de Prisme** — celui d'Échoppe appartient à Échoppe
  ([ADR-0050](../adr/ADR-0050-contrat-de-faute.md)) —, puis **une page, une entité, un média**.
- [ ] 🟠 **Décider si les en-têtes de sécurité deviennent un paquet partagé.** Le plugin d'Échoppe
  est product-agnostique ; `prisme-api` en aura besoin au premier écran. Ne pas le copier.
- [ ] 🟠 **Sortir `elysia` des paquets partagés** — cinq paquets le déclarent
  (`fields`, `entities`, `menus`, `pages`, `pages-registry`) et sept fichiers l'importent. Un paquet
  partagé qui exige Elysia ne peut pas servir un produit qui n'est pas une API Elysia : c'est une
  exigence de forme, et c'est Prisme qui la porte.

  **Rattaché au client Prisme, et non au slice** — corrigé le 2026-08-24, à la lecture du terrain.
  L'arbitrage précédent (« pendant le slice ») reposait sur l'idée que le second consommateur
  exercerait la contrainte. Il ne l'exercera pas : `prisme-api` EST une API Elysia, donc un paquet
  partagé qui exige Elysia ne le gêne en rien. Ce qui l'exercera vraiment, c'est le premier
  consommateur qui n'est pas une API Elysia — le **client Prisme**. C'est donc là que la tâche vit.

  Ce n'est pas une migration : `@sinclair/typebox` s'importe directement, aucune route n'est touchée.
  La vraie réserve est la **double version de TypeBox** — l'une venue d'Elysia, l'autre déclarée — à
  tenir par plage de version ou alias de paquet. C'est ce qu'il faut instruire avant d'agir.
- [ ] 🔴 **Définir la topologie de déploiement V1** : images, base dédiée, migrations, bootstrap et
  stratégie de mise à jour.
- [ ] 🟠 **Créer `prisme-admin`** sur les surfaces V1 réellement nécessaires.
- [ ] 🟠 **Créer le client Prisme** après stabilisation du contrat HTTP et trancher son scope npm.
- [ ] 🟠 **Définir le cycle de déploiement config-as-code** : `check`, `push`, sauvegarde, concurrence,
  reprise après échec et compatibilité entre code et schéma.
- [ ] 🟡 **Documenter un parcours développeur complet** : déclaration, vérification, push, édition et
  lecture depuis un front personnalisé.

## Décisions encore nécessaires

- [ ] 🟠 Granularité de remplacement du rendu futur : par type de champ, par entité ou les deux.
- [ ] 🟠 Emplacement de la liste des langues et localisation éventuelle des statuts.
- [ ] 🟠 Mécanisme de prévisualisation des brouillons.
- [ ] 🟡 i18n de l'interface d'administration.
