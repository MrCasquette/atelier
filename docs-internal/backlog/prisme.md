# Backlog — Prisme

Travail propre au CMS Prisme. La [roadmap produit](../design/roadmap-prisme.md) décrit les jalons ;
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
