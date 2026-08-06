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

**Un paquet partagé expose `service.ts` et `model.ts`. Jamais de routes, jamais de dépendance à
Elysia.**

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

- Les paquets partagés n'ont **aucune dépendance HTTP**. Pas de sous-chemin `./routes`, pas d'Elysia
  dans leurs `dependencies`. Le test d'admission est mécanique : un paquet qui importe `elysia` viole
  cet ADR.
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
