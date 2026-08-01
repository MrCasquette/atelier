# ADR-0027 — Prisme : entités en vraies tables, définies en code

Statut : accepté · 2026-08-01
Portée : prisme

## Contexte

Une entité est de la donnée ([ADR-0026](./ADR-0026-sections-entites.md)). Reste à décider **où elle
est stockée** et **qui peut la définir**.

Le repo est déjà souverain partout — `product`, `order`, `customer`, `media` sont de vraies tables
lisibles par n'importe quel outil. **Le module contenu est le seul endroit qui suit le modèle
WordPress** (tout en jsonb). Généraliser cette exception pour en faire le cœur de Prisme reviendrait
à généraliser l'écart, pas la règle.

Ordre de priorité retenu, du plus important au moins important :

1. Fonctionnalités SQL, dont les **clés étrangères**
2. Config-as-code **typé**
3. GUI **typé**
4. GUI non typé

## Options envisagées

| Approche | SQL / FK | Typé TS | GUI | Config as code |
|---|---|---|---|---|
| **Tables Drizzle écrites en code** | ✅ | ✅ | ❌ | ✅ |
| **GUI qui écrit du code** (modèle Strapi) | ✅ | ✅ | ✅ *en dev* | ✅ |
| **DDL réel à l'exécution** (modèle Directus) | ✅ | ❌ | ✅ *en prod* | ❌ |
| **jsonb + vues SQL** | ❌ | ✅ | ✅ | ✅ |

## Décision

**Tables Drizzle écrites en code.** Le dev écrit la table ; le DSL déclare la couche au-dessus —
libellés, widgets, ordre des champs, validations d'édition. La structure a pour SSOT la table.

**jsonb + vues SQL est écarté** : c'est la seule option qui échoue au critère n°1. Ce qu'elle fait
perdre n'est pas de la capacité — presque tout reste faisable avec de la mécanique générée — mais des
**garanties** :

- savoir ce qui référence quoi, donc pas de « impossible de supprimer, utilisé sur 3 pages » fiable ;
- `ON DELETE CASCADE` / `RESTRICT` ;
- l'intégrité sous concurrence (une vérification applicative lit avant et écrit après : TOCTOU) ;
- **l'intégrité dès qu'un autre outil écrit** — or c'est le scénario même que la souveraineté vise.
  Une garantie applicative ne protège que de l'intérieur ; une clé étrangère protège quel que soit
  l'écrivain.

**DDL réel à l'exécution est écarté** : il coûte le typage des entités (critère n°2), sort une partie
de la base du drift guard, et impose d'écrire un mécanisme de snapshot/apply pour transporter un type
de dev vers prod.

**Le GUI qui écrit du code reste ouvert comme ajout ergonomique ultérieur.** Il est purement additif :
partir de vraies tables ne ferme aucune porte. L'inverse est faux — une fois le contenu en jsonb, en
sortir est une migration.

## Conséquences

- Créer une entité = commit + build + déploiement. Des minutes, pas des secondes.
- **L'utilisateur standard n'est pas affecté** : il édite du contenu, il ne définit pas de schémas.
  Cette expérience est identique dans les quatre options.
- Le seul profil non servi est l'**utilisateur avancé sans dev**, qui veut définir ses propres
  entités (cf. [ADR-0029](./ADR-0029-rendu-generique.md) pour les profils).
- Le dev écrit **deux** choses — la table et la déclaration d'UI — qui peuvent diverger. À couvrir
  par un garde CI table ↔ déclaration, sur le modèle des deux existants.

## Question ouverte

Le « build » de l'utilisateur avancé, si le GUI d'édition de schémas est ajouté un jour. Deux voies :
un outil de développement local à la Strapi, ou une génération de migration appliquée à chaud — cette
seconde donnant FK réelles **et** GUI en production, au prix de tables non couvertes par le drift
guard. Non tranché.
