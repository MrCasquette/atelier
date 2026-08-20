# ADR-0027 — Entités en vraies tables, déclarées en code et poussées

Statut : accepté · 2026-08-02
Portée : content

> **Amendement 2026-08-02 — comment la table est créée.** La première rédaction disait « le dev écrit
> la table Drizzle », sans dire comment elle atteignait une image Docker opaque — ce qui n'ouvrait
> que le fork. La déclaration devient la SSOT et la table en est **dérivée**, poussée par la CLI. La
> décision de fond — vraies tables, vraies clés étrangères — est inchangée.

## Contexte

Une entité est de la donnée ([ADR-0026](./ADR-0026-sections-entites.md)). Reste à décider **où elle
est stockée** et **comment sa structure atteint l'API**.

Le repo est déjà souverain partout — `product`, `order`, `customer`, `media` sont de vraies tables
lisibles par n'importe quel outil. **Le module contenu est le seul endroit qui suit le modèle
WordPress** (tout en jsonb). Généraliser cette exception pour en faire le cœur d'un CMS reviendrait à
généraliser l'écart, pas la règle.

Ordre de priorité retenu, du plus important au moins important :

1. Fonctionnalités SQL, dont les **clés étrangères**
2. Config-as-code **typé**
3. GUI **typé**
4. GUI non typé

## Options envisagées

| Approche | SQL / FK | Typé TS | GUI | Config as code |
|---|---|---|---|---|
| **Déclaration poussée, table dérivée** | ✅ | ✅ | ⬜ ultérieurement | ✅ |
| **Tables Drizzle compilées dans l'image** | ✅ | ✅ | ❌ | ✅ *au prix d'un fork* |
| **DDL piloté par un GUI** (modèle Directus) | ✅ | ❌ | ✅ | ❌ |
| **jsonb + vues SQL** | ❌ | ✅ | ✅ | ✅ |

## Décision

**Le dev déclare son entité dans son code ; la CLI la pousse ; l'API en dérive la table.**

```
prisme:check   →  l'API compare la déclaration à son schéma réel et renvoie le SQL qu'elle appliquerait
prisme:push    →  l'API applique
```

C'est le chemin qui existe déjà pour le contenu — `content:push` alimente `content_definition` via
une route protégée — étendu aux entités. **Aucun fork**, l'image reste opaque et standard. Et c'est
l'ergonomie de `drizzle-kit` : un `check` qui montre, un `push` qui applique.

### Ce n'est pas le modèle Directus

Ce qui rend Directus lourd, c'est que **sa base est l'autorité** : sans artefact en code, il lui faut
un mécanisme de snapshot/apply pour transporter un type d'un environnement à l'autre.

Ici la SSOT reste les fichiers du dev. Le DDL n'est pas un acte d'écriture, c'est la **conséquence**
d'une déclaration versionnée en git. Les fichiers *sont* le snapshot, git *est* l'historique, `push`
*est* l'apply.

### jsonb + vues SQL est écarté

C'est la seule option qui échoue au critère n°1. Ce qu'elle fait perdre n'est pas de la capacité —
presque tout reste faisable avec de la mécanique générée — mais des **garanties** :

- savoir ce qui référence quoi, donc pas de « impossible de supprimer, utilisé sur 3 pages » fiable ;
- `ON DELETE CASCADE` / `RESTRICT` ;
- l'intégrité sous concurrence (une vérification applicative lit avant et écrit après : TOCTOU) ;
- **l'intégrité dès qu'un autre outil écrit** — or c'est le scénario même que la souveraineté vise.
  Une garantie applicative ne protège que de l'intérieur ; une clé étrangère protège quel que soit
  l'écrivain.

Pour un CMS dont le modèle est un graphe d'entités qui se référencent, ces garanties sont
l'infrastructure.

## Conséquences

- **Une seule source, donc aucune divergence possible.** La première rédaction notait comme dette que
  « le dev écrit deux choses — la table et la déclaration d'UI — qui peuvent diverger », et réclamait
  un garde CI. Le problème disparaît au lieu d'être surveillé.
- **Les tables d'entités sont hors drift guard**, conformément à [ADR-0028](./ADR-0028-activation-entites.md) :
  le schéma d'une installation n'est plus entièrement déterminé par les fichiers de migration.
- **Du SQL est généré depuis des identifiants venus d'un fichier** : leur échappement est une
  question de sécurité, au même titre que pour [ADR-0035](./ADR-0035-interpolation-variables.md).
- **Modifier une déclaration devient un `ALTER TABLE`**, potentiellement destructif. `check` est
  obligatoire avant : `push` refuse toute perte de données sans confirmation explicite. Jamais de
  destruction implicite.
- **L'expressivité est bornée à ce que le DSL sait dire.** Une contrainte `CHECK` exotique, un index
  composite particulier, une colonne générée n'y entrent pas. Ces cas passent par un fork — marginal,
  et sans effet sur le chemin courant.
- **Créer une entité reste un geste de dev** : commit, `check`, `push`. L'utilisateur standard n'est
  pas affecté — il édite du contenu, il ne définit pas de schémas.
- La liste des ressources RBAC **cesse d'être fermée** : une entité déclarée est une ressource à
  protéger, inconnue à la compilation du framework. Cf. le sujet auth.

## Questions ouvertes

- **La permission de modifier le schéma** — réservée Owner / Admin / dev. Relève du RBAC, à traiter
  dans ce sujet, **avant** l'implémentation de ce mécanisme.
- **Un GUI de conception d'entités**, ultérieurement. Il est purement additif : il écrirait les
  fichiers de déclaration, et le chemin `check` / `push` resterait inchangé.

## Amendement 2026-08-10 — la lecture d'une entité passe par une route générique

Question laissée ouverte par [`systeme-contenu-leger.md`](../backlog/systeme-contenu-leger.md) :
endpoint générique ou endpoints dédiés par entité. Tranchée avant d'implémenter, parce qu'elle
décide de la forme du contrat.

```
GET /entities/:name          → liste
GET /entities/:name/:slug    → une instance
```

**Ce qui décide, c'est le contrat figé.** `contracts:check` fige l'OpenAPI de la surface publique, et
`@echoppe/client` est publié depuis ce contrat. Des routes dérivées du registre rendraient l'OpenAPI
**dépendant de l'installation** : deux boutiques n'exposeraient plus les mêmes routes, le SDK ne
serait plus générable depuis un contrat unique, et le drift guard routes↔SDK perdrait son objet.

L'argument des routes dédiées — un contrat riche et auto-documenté — vise le bon besoin mais au
mauvais endroit : le typage fin d'une entité vient du **type-gen depuis les fichiers du dev**, comme
pour les sections (P2c), pas de l'OpenAPI. Le dev a déjà sa déclaration ; l'API n'a pas à la lui
renvoyer sous forme de schéma.

Coût assumé : une URL moins jolie. `+2` routes au contrat, une fois pour toutes.
