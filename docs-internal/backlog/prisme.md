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


- [ ] 🔴 **Créer un vertical slice exécutable** : `prisme-core` et `prisme-api`, migrations propres,
  auth admin, une page, une entité, un média et un contrat HTTP propre.
- [ ] 🔴 **Sortir `elysia` des paquets partagés, PENDANT le slice** — cinq paquets le déclarent
  (`fields`, `entities`, `menus`, `pages`, `pages-registry`) et sept fichiers l'importent. Un paquet
  partagé qui exige Elysia ne peut pas servir un produit qui n'est pas une API Elysia : c'est une
  exigence de forme, et c'est Prisme qui la porte.

  **Pendant, et non avant** — arbitré le 2026-08-24, en héritage d'un sujet ouvert le 2026-08-16 :
  c'est le second consommateur qui dira si le découplage est correct, et lui seul l'exercera.
  Découpler à l'aveugle produirait une frontière qu'aucun usage n'aurait éprouvée.

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
