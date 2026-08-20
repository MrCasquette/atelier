# Audit de couverture documentaire — bilan

> **Statut (2026-08-16) — terminé.** Les quatre lots sont passés. Ce qui reste ouvert est tracé
> ailleurs : deux relevés de sécurité et deux dettes d'architecture dans le
> [backlog socle](../backlog/shared.md), la migration du contrat de faute dans
> [ADR-0050](../adr/ADR-0050-exception-jamais-reponse-http.md). Aucun de ces chantiers n'a été
> ouvert par l'audit.

## Ce que l'audit a cherché

Pas « les commentaires sont-ils bons ». Le point de départ a été inversé : partir de ce qui **doit**
être porté quelque part — surface publique, invariants, règles métier, décisions — et regarder par
quel support c'est tenu, en constatant les trous.

La hiérarchie de référence : `types > contrats > tests > documentation > commentaires`. Le
commentaire est le support de dernier recours, celui qui reste quand rien de vérifiable ne peut
porter l'information.

Découpage par **portée ADR-0024** (`socle` / `<package>` / `échoppe`), pas par arborescence — le
dépôt porte deux produits, et `echoppe-core` est le cœur de l'un d'eux, pas celui du monorepo.

## Méthode

Chaque lot lu en entier avant toute modification, puis appliqué en commits séparés **par nature de
correction** plutôt que par fichier — ce qui permet de rejeter une catégorie entière d'un coup. Pas
de rapport intermédiaire : un audit qui prêche `types > … > commentaires` ne peut pas livrer un
document comme produit principal. Seules les décisions qui n'appartenaient pas à l'auditeur ont été
remontées avant d'agir.

## Les quatre lots, et leur biais

| Lot | Périmètre | Biais dominant |
|---|---|---|
| Pilote | `fields` | **Péremption** — 3 affirmations vérifiables avaient dérivé, dont un fichier de test inexistant |
| 1 | `shared`, `references`, `adapters`, `db`, `identity`, `assets` | **Paraphrase**, concentrée dans le seul `shared` ; les cinq autres n'avaient presque rien |
| 2 | `content`, `auth`, `entities`, `communication`, `menus`, `pages`, `client` | **Verrou manquant** — prose excellente partout, mais trois paquets sans aucun script `test` |
| Produit | `echoppe-core`, `echoppe-api`, `echoppe-admin`, `echoppe-store` | **Prescription non propagée** — des règles écrites, justes, jamais adoptées |

**Aucun biais n'était prévisible depuis le lot précédent.** C'est le résultat méthodologique le plus
important de l'audit, et il a coûté deux lots à admettre : la grille de départ anticipait de la
paraphrase partout, et `fields` — le pilote — n'en contenait pas une ligne.

## Leçons

| Constat | Leçon |
|---|---|
| `notFound()` employé 11 fois sur 89 ; `errorSchema` déprécié et employé 51 fois | **Une convention non contrainte n'est pas une convention.** Ce qui n'est vérifié ni par un lint, ni par un type, ni par un test reste une intention. |
| Chaque lot avait un biais dominant différent, jamais celui du précédent | **Ne pas spécialiser la grille d'après le lot précédent.** Le profil d'un paquet ne se déduit pas de son voisin. |
| Cinq affirmations chiffrées ou nominatives avaient dérivé | **Un commentaire qui cite un fichier, un symbole ou un nombre est une assertion que personne ne vérifie.** Seul axe entièrement mécanisable — candidat à une règle de lint. |
| `menus`, `pages`, `communication` documentaient des garanties sans les tester | **Un invariant énoncé sans verrou exécutable est une intention, pas une garantie.** Et un verrou qui ne tourne pas est pire qu'absent : on se croit couvert. |
| `communication` cache son adapter derrière un singleton de module | **Une dépendance non injectée déplace la sûreté vers la donnée.** Ce qui protégeait les tests était l'absence de configuration en base, pas l'architecture. |
| `pages` ne se charge pas sans `DATABASE_URL` | **Le graphe d'imports fait partie du contrat d'un module.** Un import au niveau module se propage à tous ses consommateurs — `auth` l'avait résolu, `pages` ne l'appliquait pas. |

## Livré

**14 commits.** `type-check` propre, Biome propre, 199 tests unitaires verts.

- **75 tests ajoutés** — `fields` (22), `shared` (19), `menus` (10), `pages` (10), `communication`
  (7), `entities` (+7 sur le chemin destructeur).
- **5 paquets câblés à la CI** — `fields`, `shared`, `menus`, `pages`, `communication` n'avaient
  aucun script `test` ou n'étaient pas au script racine. Le dépôt passe de 8 à 13 espaces de travail
  testés.
- **13 README de charte**, sous une convention actée dans
  [conventions.md](../conventions.md) : la charte vit dans le README, le barrel garde la
  règle impérative et y renvoie. Les paquets publiés sont exemptés — leur README est la page npm.
- **[ADR-0050](../adr/ADR-0050-exception-jamais-reponse-http.md)** et son amendement : une exception
  ne compose jamais une réponse HTTP.
- **5 affirmations périmées corrigées**, dont la docstring de `smoke.ts` qui annonçait ne lancer
  qu'un fichier de test là où elle en lance vingt-six.

## Ce que l'audit n'a pas fait, et pourquoi

**Il n'a pas réduit le volume de commentaire.** Il l'a augmenté — les tests ajoutés portent leur
propre argumentation. C'était l'objectif : déplacer l'information vers des supports vérifiables, pas
en supprimer.

**Il n'a pas corrigé `notFound()` ni `errorSchema`.** La migration d'ADR-0050 réécrit les 214
réponses d'erreur de toute façon ; les traiter d'abord serait du travail jeté. `notFound(entity)` est
d'ailleurs la forme dont `common.not_found` + paramètre `resource` est l'aboutissement — l'intention
y était déjà.

**Il n'a pas ouvert les chantiers qu'il a révélés.** Diagnostiquer et refactorer sont deux actes
distincts ; les mélanger empêche de juger l'un sans subir l'autre.

**Il ne s'est pas prononcé sur la langue.** Environ 6 300 lignes de commentaire françaises citent une
cinquantaine d'ADR français et un lexique français. La question n'est pas « les commentaires en
anglais » mais « le système documentaire passe-t-il en anglais », et c'est une décision de
positionnement — publication ouverte ou non — pas de style. Un parc à moitié traduit serait pire que
l'un ou l'autre des deux états.

## Reste ouvert

| Chantier | Où |
|---|---|
| Échappement du gabarit `contact-form` (formulaire public → boîte admin) | [backlog socle](../backlog/shared.md) § Sécurité |
| Oracles d'énumération de `authenticate` (explicite et temporel) | [backlog socle](../backlog/shared.md) § Sécurité |
| Suppression du singleton de `communication` | [backlog socle](../backlog/shared.md) § Architecture |
| Séparation pure/connectée de `pages` | [backlog socle](../backlog/shared.md) § Architecture |
| Migration du contrat de faute | [ADR-0050](../adr/ADR-0050-exception-jamais-reponse-http.md) § Suivi |
| README de charte des paquets publiés | Exemptés par convention — leur README est la page npm |
