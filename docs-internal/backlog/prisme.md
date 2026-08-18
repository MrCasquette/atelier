# Backlog — Prisme

Travail propre au CMS Prisme. La [roadmap produit](../design/roadmap-prisme.md) décrit les jalons ;
ce fichier ne contient que les actions V1 encore ouvertes, et l'après vit dans la même
roadmap, § V2. Les packages réutilisables vivent dans le
[backlog shared](./shared.md).

## V1 — prouver le produit headless

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
