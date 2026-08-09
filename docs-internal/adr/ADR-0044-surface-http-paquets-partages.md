# ADR-0044 — Un paquet partagé n'expose pas de routes

Statut : accepté · 2026-08-06
Portée : socle

> Tranche la première des deux questions qu'[ADR-0042](./ADR-0042-structure-api-modules.md) a
> délibérément laissées ouvertes. Débloque `#11` (l'extraction des paquets).

## Contexte

40 % de l'API est générique et serait recopié dans `prisme-api`. ADR-0042 a recensé ce qui était déjà
mesuré — `app.ts` est un pur assemblage, la génération du SDK interroge le spec OpenAPI de l'API en
cours d'exécution et ignore l'origine des routes, Elysia laisse la dernière déclaration écraser la
précédente, les sous-chemins d'export permettraient d'isoler la dépendance à Elysia — puis a arrêté
la discussion sur un chiffre reconnu faux : « 2 903 lignes de routes dupliquées » comparait
tout-partagé à tout-dupliqué, alors que la vraie alternative sépare déclaration et logique.

Le chiffre manquant a été mesuré. Il portait la décision.

### La mesure

Onze fichiers de routes génériques, corps de handler contre déclaration Elysia. Les schémas sont
exclus : ils vivent déjà dans `model.ts` et sont partagés dans **toutes** les options — 423 lignes qui
ne pèsent dans aucune.

| Module | Lignes | Logique | Déclaration |
|---|---|---|---|
| `auth` (`customer`, `admin`) | 772 | 473 (61 %) | 299 |
| `media` (`item`, `folder`, `asset`) | 472 | 287 (61 %) | 185 |
| `communication` | 220 | 139 (63 %) | 81 |
| `content` (`page`, `definition`) | 325 | 129 (40 %) | 196 |
| `identity` | 138 | 80 (57 %) | 58 |
| `contact` | 58 | 27 (46 %) | 31 |
| **Total** | **1 985** | **1 135 (57 %)** | **850 (43 %)** |

**Le prix de la duplication est 850 lignes, pas 2 903.** Et il est encore surestimé : il suppose que
les deux produits exposent la même surface. Ils ne l'exposent pas — les 9 routes de `auth/customer.ts`,
soit 191 lignes de déclaration à elles seules, tiennent au panier, aux commandes et à la liste
d'envies. Prisme n'a pas de client.

### Ce que la mesure a révélé en plus

**Les modules génériques n'ont presque pas de `service.ts`.** Les six qui existent — `checkout`,
`audit`, `personalization`, `api-key`, `menu`, `content/definition` — sont du commerce, à une exception
près. Les 1 135 lignes de logique générique vivent **dans les corps de handler**.

La troisième voie n'est donc pas un ré-emballage : c'est une extraction qui n'a jamais été faite.

## Options envisagées

- **Le paquet expose ses routes** (`@repo/assets/routes`, le produit fait `.use()`). Zéro
  duplication. Mécaniquement viable : le graphe des `package.json` est acyclique, rien ne s'y oppose.
- **Le paquet expose `service.ts` + `model.ts` seulement.** Chaque produit écrit son controller.
- **Les deux** : service et model toujours, plus un routeur prêt à l'emploi, optionnel.

## Décision

**Un paquet partagé expose `service.ts` et `model.ts`. Jamais de routes.**

> La formule initiale disait « jamais de dépendance à Elysia ». Elle était trop large et a été
> corrigée par l'amendement du 2026-08-09 : ce qui est proscrit est la **surface HTTP**, pas l'usage
> de TypeBox qu'Elysia réexporte.

L'argument décisif d'ADR-0042 tient toujours — une route est la **surface publique d'un produit**,
versionnée avec lui, alimentant son SDK publié — et la mesure montre qu'il coûte 43 % de lignes
déclaratives, pas 100 %. Le partage porte sur ce qui doit être commun : la logique et les schémas. La
divergence porte sur ce qui **doit** diverger : les chemins, l'ordre des gardes, la carte des
réponses. Deux contrats qui dérivent ne sont pas un défaut ici — c'est la définition de deux produits
versionnés séparément.

**Ce qui a écarté l'option « le paquet expose ses routes »**, au-delà du principe : la surcharge par
dernière-déclaration-gagne est **silencieuse**. Elle fonctionne, mais elle fait dépendre le contrat
d'un produit d'un ordre d'appel dans `app.ts`, sans aucune erreur si quelqu'un se trompe. Un
mécanisme de correction qui ne signale pas son propre échec n'est pas un garde-fou.

**Ce qui a écarté l'option mixte** : elle ne choisit pas. Le routeur optionnel réintroduit exactement
le couplage ci-dessus pour qui s'en sert, et double la surface à maintenir dans le paquet — pour un
gain qui n'existe que si un produit accepte de ne pas posséder son contrat, ce que la décision refuse
justement.

**Coût assumé** : extraire 1 135 lignes de corps de handler vers des `service.ts` qui n'existent pas.
Ce n'est pas du travail ajouté par cette décision — c'est la forme `index` / `service` / `model`
qu'ADR-0042 prescrit déjà et que `#22` n'a appliquée qu'aux modules qui l'avaient déjà.

**Limite assumée** : rien n'empêchera les deux produits de diverger sur une route qui aurait dû rester
identique. Aucun mécanisme ne le détectera. C'est le revers exact de la propriété du contrat, et il
est préféré au revers inverse — un bump de paquet qui modifie deux SDK en silence.

## Conséquences

- Les paquets partagés n'exposent **aucune surface HTTP**. Pas de sous-chemin `./routes`, aucune
  route déclarée. Le test d'admission est mécanique — voir l'amendement ci-dessous pour sa
  formulation exacte.
- **`#11` est débloqué**, et son geste est précisé : extraire un concept, c'est déplacer `service.ts`
  et `model.ts`, en **laissant `index.ts` dans le produit**.
- **Une tâche préalable apparaît** : extraire la logique des handlers génériques vers des `service.ts`.
  Elle se fait module par module, dans `apps/echoppe-api`, **avant** tout déplacement — conformément
  au principe du plan, ne jamais déplacer un fichier qui n'est pas encore correct.
- Le garde anti-dérive routes↔SDK est **inchangé** : il compare le contrat d'Échoppe à son SDK, et
  cette décision garantit que ce contrat reste écrit dans Échoppe.
- **`#24` (injection de dépendance) n'est pas résolu mais borné.** Les services partagés attraperont
  toujours le `db` global ; en revanche, le couplage ne s'étend pas à la couche HTTP, ce qui était
  l'aggravation que redoutait ADR-0042. Les deux sujets sont désormais séparables.

## Amendement 2026-08-09 — le test d'admission visait la mauvaise chose

Le test posé initialement — « un paquet qui importe `elysia` viole cet ADR » — est **faux**, et la
première tentative d'application (`#28`, module `contact`) l'a montré immédiatement.

Il confond deux choses : **dépendre d'Elysia** et **exposer une surface HTTP**. Seule la seconde est
visée par cet ADR. Trois faits mesurés l'établissent :

- Les **17 `model.ts`** importent `t` depuis `elysia`. Or `t` **est** TypeBox — Elysia le réexporte.
  Un schéma n'est pas du transport.
- Ils dépendent des **extensions Elysia** absentes de TypeBox nu : `t.Nullable` (~85 usages),
  `t.File` et `t.Numeric` dans `media`. Basculer les paquets sur `@sinclair/typebox` en direct
  supposerait de réécrire tous les modèles — coût réel, gain nul.
- `content/definition/service.ts` importe `elysia/type-system` **à l'exécution** (`TypeCompiler`,
  `FormatRegistry`) pour valider les entités déclarées dynamiquement. C'est un besoin de validation,
  pas de HTTP, et il est irréductible.

**Test d'admission corrigé.** Un paquet partagé ne doit contenir aucune des trois constructions
suivantes :

1. `new Elysia(...)` — instancier une application ou un plugin ;
2. une déclaration de route — `.get`, `.post`, `.put`, `.patch`, `.delete` ;
3. `status(...)` ou tout autre mapping vers un code HTTP.

Ce qui reste **autorisé** : importer `t`, `type Static`, `type TSchema` depuis `elysia`, et
`elysia/type-system` pour la validation à l'exécution.

Ce que l'amendement ne change pas : le produit possède son contrat, écrit ses controllers, et aucune
route ne vit dans un paquet. La substance de la décision est intacte — seule sa vérification
mécanique était mal cadrée.

## Amendement 2026-08-09 — `model.ts` se scinde par nature

La décision dit que le paquet emporte `model.ts` **et** que le produit possède son contrat. Les deux
phrases se contredisent dès qu'un `model.ts` mélange deux natures de schéma — ce qu'ils font tous.

**Règle** : ce qui part dans le paquet, ce sont les **schémas d'entité** — la forme de la donnée,
commune aux deux produits. Ce qui reste dans le produit, ce sont les schémas **propres à une route** :
corps de requête, paramètres de requête, cartes de réponse. Ceux-là *sont* le contrat, et le contrat
appartient au produit.

Le critère est simple à appliquer : si le schéma décrit **ce qu'est** un média, un site, une page, il
est partagé. S'il décrit **ce qu'une route accepte ou renvoie**, il reste.

Conséquence pratique : chaque `model.ts` générique est à relire et à couper en deux avant son
déplacement, ce qui est du ressort de `#28`. Un module dont tout le `model.ts` est du contrat n'a
simplement pas de `model.ts` à donner — c'est le cas de `contact`, dont le seul schéma est un corps de
requête, laissé dans `index.ts`.
