# Backlog — Prisme

Travail propre au CMS Prisme. La [roadmap](../design/roadmap-prisme.md) décrit les jalons produit ;
ce fichier ne contient que les actions encore ouvertes. Les packages réutilisables vivent dans le
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

## V2 — produit utilisable sans développeur

- [ ] 🔴 Concevoir le déploiement pour utilisateur non technique : image tout-en-un, installeur ou
  hébergement.
- [ ] 🟠 Livrer `prisme-store` avec rendu générique des entités et sections listes.
- [ ] 🟠 Implémenter les presets d'entités, leur activation et leur retrait.
- [ ] 🟠 Concevoir les thèmes utilisateurs et les remplacements de rendu.
- [ ] 🟠 Concevoir la GUI de définition d'entités sans affaiblir la souveraineté du schéma.
- [ ] 🟡 Ajouter des deploy hooks après changement de contenu.
- [ ] 🟡 Réévaluer une interpolation enrichie uniquement à partir d'usages observés.

