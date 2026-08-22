# ADR-0062 — Un paquet sort s'il tourne chez le dev, et son scope nomme l'organisation

Statut : accepté · 2026-08-22
Portée : socle

Complète [ADR-0002](./ADR-0002-distribution.md) — qui décide *quoi* distribuer, Docker pour le
runtime et npm pour le SDK — en disant ce qu'elle n'a jamais dit : **quels paquets sortent, et sous
quel nom.**

## Contexte

Trois paquets sont publiés sur npm, et ils portent **trois conventions différentes** :

| Paquet | Version | Convention |
|---|---|---|
| `@mrcasquette/content` | 0.3.0 | scope **personnel** |
| `@echoppe/client` | 0.7.0 | scope **produit** |
| `create-echoppe` | 0.2.0 | **aucun** scope |

Aucun des trois ne déclare `repository`, `homepage` ni `bugs` : leur page npm ne renvoie **nulle
part** — ni vers le code, ni vers la documentation, ni vers les issues.

Deux faits ont fermé des portes en cours de décision : **`@axiome` et `@prisme` sont déjà pris** sur
npm par des tiers. L'organisation existe en revanche sous `github.com/Axiome-Apps`.

Et un fait ouvre la fenêtre : les trois paquets sont en **`0.x`**, publiés le **18 août 2026**. Une
rupture de nom y est admise par SemVer, et l'adoption est nulle. **Ce coût ne sera jamais plus bas.**

## Décision

### 1. Le critère de publication

> **Un paquet se publie s'il tourne chez le dev. Jamais s'il tourne chez nous.**

Déclarer (`content`), appeler (`echoppe`), rendre (`prose`), démarrer (`create-echoppe`) : ce sont
quatre besoins du dev, dans son dépôt à lui. `@repo/db`, `@repo/auth`, `@repo/pages`,
`@repo/entities`, `@repo/identity` ne s'exécutent que dans l'API : ils ne sortiront **jamais**,
quelle que soit leur qualité ou leur généralité.

C'est ce qui borne la liste **par nature** plutôt que par discipline — la question « faut-il publier
celui-ci ? » a désormais une réponse mécanique.

Corollaire immédiat : `@repo/prose` doit sortir, puisqu'il rend, et que le rendu a lieu chez le
consommateur — jamais dans le framework.

### 2. `@repo/*` signifie « ne sort pas »

Le scope interne n'est pas décoratif : il **porte la décision**. Renommer un paquet, c'est décider de
le publier, et l'inverse est vrai — tant qu'il s'appelle `@repo/x`, il est interne par construction.

On lit donc d'un coup d'œil ce qui franchit la frontière, sans consulter un `private` enfoui dans un
manifeste.

Les cœurs et applications gardent leur scope produit — `@echoppe/core`, `@prisme/api` — qui dit à
quel produit ils appartiennent. Eux non plus ne sortent pas.

### 3. Un scope unique : `@axiome-apps`

Tout ce qui est publié vit sous **`@axiome-apps`**, le nom de l'organisation telle qu'elle existe
déjà sur GitHub. Le scope ne s'invente pas : il **reprend une identité vérifiable**, et le
développeur qui remonte du paquet retrouve l'organisation.

```
@axiome-apps/content     partagé — déclarer
@axiome-apps/prose       partagé — rendre
@axiome-apps/echoppe     produit — le SDK d'Échoppe
@axiome-apps/prisme      produit — le SDK de Prisme, à venir
```

**Pourquoi pas un scope par produit**, alors que `@echoppe/client` existait déjà : parce qu'un scope
n'aurait porté qu'**un seul paquet**. Un SDK par produit, et rien d'autre — le SDK est la seule chose
qu'un dev installe depuis npm, le produit lui-même étant une image Docker. Réserver un espace de noms
entier pour un membre unique est disproportionné.

Deux bénéfices s'ajoutent, et le second est durable :

- **la symétrie** — `@echoppe/client` contre `@prisme-cms/client` aurait dit qu'un produit pèse plus
  que l'autre, ce qu'[ADR-0058](./ADR-0058-fraternite-des-produits.md) refuse ;
- **la disponibilité cesse d'être un problème** — `@axiome` et `@prisme` étant pris, chaque produit
  futur aurait rouvert la chasse au nom libre. Un scope unique la ferme définitivement.

### 4. Le nom nu revient au SDK

`@axiome-apps/echoppe`, pas `@axiome-apps/echoppe-client`. C'est
[ADR-0059](./ADR-0059-nom-nu-et-prefixe-de-scission.md) appliquée : **le nom nu reste avec ce que le
mot désigne**, et rien d'autre ne peut le revendiquer — le produit ne s'installe pas depuis npm.

Le suffixe `-client` n'ajoutait qu'une redondance : on ne télécharge pas un serveur. C'est aussi la
convention dominante des SDK — `stripe`, `algoliasearch`, `openai`.

Effet mesurable : de 18 à 20 caractères pour tous les paquets, contre 27 pour la forme suffixée, et
tous de la même longueur. Si un dérivé apparaît, ADR-0059 s'applique sans révision :
`@axiome-apps/echoppe-types`.

### 5. Les initializers restent non scopés

`create-echoppe` et `create-prisme` gardent leur nom nu. Ce n'est **pas** une entorse à la règle
précédente mais une contrainte de l'outil : `npm create echoppe` exige un paquet nommé exactement
`create-echoppe`. Le scoper imposerait `npm create @axiome-apps/echoppe`, plus long et moins connu.

### 6. Un paquet publié dit d'où il vient

`repository`, `homepage`, `bugs` et `license` sont **obligatoires** sur tout paquet publié. Un paquet
dont la page npm ne renvoie nulle part n'inspire aucune confiance, et l'omission est aujourd'hui
totale sur les trois.

## Ce qui a été écarté

**`@mrcasquette`** — un scope personnel pour un produit qui vise le haut de gamme. L'intention était
juste : `content` est partagé, et le ranger sous `@echoppe` aurait dit qu'Échoppe le possède, ce
qu'ADR-0058 interdit. Seul le nom était mauvais.

**`@prisme/content` ou `@echoppe/content`** — le partagé sous un produit. Échoppe installerait alors
un paquet `@prisme/*`, ce qui *dirait* qu'il dépend de Prisme : précisément la frontière que
`product-isolation` garde.

**`@prisme-cms`** — le contournement de l'indisponibilité. Deux défauts : l'asymétrie avec
`@echoppe`, et le figement de la nature du produit dans un nom qu'on ne change plus. Même mécanique
que `@repo/markdown`, écarté au §10 d'ADR-0061 parce qu'il nommait l'outil.

**`@axiomejs`, `@axiome-dev`, `@getaxiome`** — des noms fabriqués pour l'occasion, qui n'existent
nulle part ailleurs. Le scope doit reprendre une identité, pas en inventer une.

## Conséquences

- **Trois renommages, tous en `0.x`** : `@mrcasquette/content` → `@axiome-apps/content`,
  `@echoppe/client` → `@axiome-apps/echoppe`, et `@repo/prose` → `@axiome-apps/prose` à sa
  publication. Les anciens noms peuvent recevoir un dernier `deprecated` pointant vers le nouveau.
- **`@repo/prose` change de statut.** Publié, il gagne des obligations : versionnage, changesets,
  couverture par `release-coverage`, et une surface publique qu'on ne casse plus librement — alors
  qu'elle vient d'être dessinée. C'est le prix pour qu'un front de dev puisse rendre la prose : sans
  publication, le contrat d'arbre d'ADR-0061 reste inaccessible.
- **`repository` pointerait aujourd'hui vers un dépôt privé**, donc vers un 404. Trois paquets
  publics sous licence CeCILL dont le code n'est pas consultable : c'est légal — les sources voyagent
  dans le tarball npm — mais contradictoire avec ce que la licence annonce. À traiter avec la
  question du dépôt, hors de cet ADR.
- **Aucune garde ne vérifie ces règles.** Ni que tout paquet publié porte ses métadonnées, ni qu'un
  paquet `@repo/*` ne devienne publiable par distraction. À inscrire au backlog plutôt qu'à supposer.
- **Le SDK est un contrat gardé** par `contracts:check` ([ADR-0007](./ADR-0007-contrat-sdk.md)) : le
  renommer touche un artefact vérifié, pas un simple manifeste.
