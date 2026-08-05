# ADR-0042 — Structure de l'API : des modules Elysia, pas des couches techniques

Statut : accepté · 2026-08-05
Portée : échoppe

> Application directe d'[ADR-0041](./ADR-0041-hierarchie-autorites.md) : la structure se dérive
> d'Elysia (niveau 1), la réflexion produit tranche ce qu'Elysia ne couvre pas (niveau 2).

## Contexte

`apps/echoppe-api/src` — **82 fichiers, 13 821 lignes, 9 dossiers** :

| Dossier | Fichiers | Lignes |
|---|---|---|
| `routes/` | 38 | 9 567 |
| `models/` | 14 | 1 113 |
| `utils/` | 11 | 1 101 |
| `plugins/` | 7 | 906 |
| `services/` | 3 | 561 |
| `lib/` | 3 | 206 |
| `scripts/` `jobs/` racine | 6 | 367 |

**Quatre défauts mesurés :**

1. **Trois dossiers pour une idée.** `lib/`, `utils/` et `services/` ne se distinguent par aucun
   critère vérifiable. `services/menu-resolve.ts` (83 l., lit la base) et `utils/related.ts` (89 l.,
   lit *et écrit*) font la même chose dans deux dossiers différents.
2. **`utils/` n'est pas un dossier d'utilitaires.** 7 fichiers sur 11 accèdent à la base ;
   `setProductTags` et `setRelatedProducts` écrivent.
3. **`plugins/` nomme une catégorie qui n'existe pas.** 5 fichiers sur 7 déclarent `new Elysia` ;
   `apiKey.ts` et `principals.ts` non. Et la définition officielle d'Elysia — *« A part that is
   decoupled from the main instance. **Every Elysia instance** can run independently or be used as
   part of another instance »* — couvre les contrôleurs eux-mêmes. La distinction `routes/` vs
   `plugins/` est une invention locale.
4. **Un concept n'est nulle part une chose.** L'authentification est éclatée sur **11 fichiers dans
   3 dossiers**. Le catalogue sur `routes/products/`, `models/catalog.ts`, `utils/related.ts`,
   `utils/tags.ts`, `utils/product-cards.ts`, `utils/default-variant.ts`.

Le point 4 est le plus coûteux, et il a une cause précise : **l'ordre des segments du chemin décide
de ce qui est déplaçable.** Nature d'abord (`routes/`, `models/`, `utils/`), un concept est éparpillé.
Concept d'abord, un concept est un **sous-arbre** — et un sous-arbre se déplace, s'extrait, se confie,
se supprime.

## Ce que dit Elysia

La documentation prescrit une **structure par fonctionnalité, pas par couche technique** :

```
src/
  modules/
    auth/  index.ts (controller)  service.ts  model.ts
    user/  index.ts (controller)  service.ts  model.ts
  utils/
```

Avec deux règles énoncées : **« 1 instance Elysia = 1 controller »**, et le model défini comme
*« the data structure and validation for the request and response »*.

Notre `models/` + `services/` + `utils/` + `routes/` est **exactement** ce que cette page déconseille.

## Options envisagées

- **Nommer par dépendance** — `http/`, `domain/`, `pure/`. Parfaitement vérifiable, mais le chemin ne
  dit rien du sujet, et Elysia déconseille explicitement le découpage par couche.
- **Nommer par concept, façon SSOT personnelle** — `domain/<concept>/` avec `Concept.schema.ts`.
  Écarté par ADR-0041 : le framework a autorité, et sa forme (`Concept.ts` / Zod / repository) est
  pensée pour une pile Next.js qui n'est pas la nôtre.
- **Suivre Elysia.**

## Décision

### 1. `modules/<concept>/`, selon Elysia

```
src/
  modules/
    catalog/   index.ts  service.ts  model.ts  visibility.ts
    order/  checkout/  cart/  payment/  customer/
    auth/  user/  role/  api-key/  audit/
    media/  content/  page/  menu/  identity/  communication/  shipping/
  lib/       response.ts  pagination.ts  rate-limit.ts
  app.ts  model.ts  env.ts  index.ts
```

`index.ts` est le contrôleur, pas un baril. `service.ts` porte la logique métier, `model.ts` les
schémas de validation. Le dossier `plugins/` **disparaît** : tout contrôleur est déjà un plugin.

**Granularité** — un module par concept que l'utilisateur final nomme spontanément. `auth`, `user`,
`role`, `api-key`, `audit` sont cinq modules, pas un : les deux autorités concordent, « 1 instance =
1 controller » côté Elysia, « un concept = ce que l'utilisateur nomme » côté SSOT.

**Profondeur** — un concept naît fichier et devient dossier quand il porte plusieurs natures. Pas
d'arborescence posée d'avance.

### 2. La règle de propriété

> **Un fichier appartient au module de son concept, pas à celui qui l'utilise.** Plusieurs
> consommateurs, c'est une dépendance entre modules — normal. Le transverse n'accueille que ce
> qu'**aucun concept ne revendique**.

C'est la règle qui manquait, et c'est elle qui a fabriqué `utils/`. Compter les consommateurs ne
suffit pas : `personalization.ts` en a trois (panier, produits, commande) et appartient pourtant au
catalogue ; `image-ref.ts` en a deux et appartient au média.

Appliquée, elle vide les trois dossiers horizontaux sans arbitrage au cas par cas :

| Fichier | Consommateurs | Va dans |
|---|---|---|
| `utils/visibility.ts` | `collections`, `categories` | `modules/catalog/` — les 2 colonnes `isVisible` sont dans `catalog.ts` |
| `utils/personalization.ts` | `cart`, `products`, `checkout` | `modules/catalog/` |
| `utils/related.ts` `tags.ts` `product-cards.ts` `default-variant.ts` | produits | `modules/catalog/` |
| `utils/image-ref.ts` | `wishlist`, `products` | `modules/media/` |
| `utils/url-validation.ts` | `checkout`, `payments` | `modules/checkout/` — `isAllowedRedirectUrl` a **0** consommateur externe, il perd son `export` |
| `lib/audit.ts` | — | `modules/audit/` |
| `lib/init-admin.ts` | — | `modules/auth/` |
| `models/*.ts` (13) | — | le `model.ts` de leur module |

### 3. `lib/` plutôt que `utils/` — écart assumé

Trois fichiers y restent, et eux seuls :

| | Consommateurs |
|---|---|
| `response.ts` — enveloppes d'erreur + combinateurs | 35 |
| `pagination.ts` — schémas de requête de liste | 12 |
| `rate-limit.ts` — presets du plugin | 5 |

**Écart vs Elysia**, instruit par les trois questions d'ADR-0041 : la doc *montre* `utils/` dans un
schéma sans jamais le définir (autorité faible) ; le mot est **faux** pour la moitié du contenu — des
presets de configuration ne sont pas des utilitaires ; et le remplacer ne casse rien de mécanique.
`lib/` décrit une nature (non-métier) au lieu d'un statut, et il est exact à 100 % une fois la règle
de propriété appliquée.

**Le nom ne porte pas tout le test.** L'admission a deux clauses — *(a)* ≥2 modules le consomment,
*(b)* aucun concept ne le revendique. Aucun mot ne porte les deux ; la clause (b) vit dans
`conventions.md`, et c'est la plus importante.

### 4. Le registre de modèles monte à la racine

`models/index.ts` agrège les modèles de tous les modules pour les enregistrer via `.model()` — il
alimente la validation runtime, les `components.schemas` de l'OpenAPI et le type `ModelName`. C'est
de l'**assemblage**, comme `app.ts`, pas de la bibliothèque. Il devient `src/model.ts`.

### 5. Constantes : ni `lib/`, ni `.env`

`lib/config.ts` **disparaît**. Critère retenu : **`.env` porte ce qui varie d'un déploiement à
l'autre, le code porte ce qui varie d'une version à l'autre** — et une variable d'environnement a un
coût réel dans un framework auto-hébergeable (documentation, défaut, tri critique/optionnel dans
`env.ts`).

| Constante | Consommateurs | Décision |
|---|---|---|
| `UPLOAD_DIR` | `assets`, `media`, `orders` | `modules/media/` — lit déjà `process.env.UPLOAD_DIR` ; ce qui reste en code est son **défaut calculé** (chemin relatif au module) |
| `STOREFRONT_URL` | `customer-auth` | module d'auth client — dérive de `STORE_URL`, qui existe déjà. En faire une variable créerait deux sources de vérité pour la même adresse |
| `PASSWORD_RESET_PATH` | `customer-auth` | constante en code. Le storefront est remplaçable, donc ce chemin *pourrait* varier par déploiement — mais personne ne l'a demandé, et `process.env.PASSWORD_RESET_PATH ?? '/reset-password'` est un changement d'une ligne le jour venu |

`env.ts` **ne fusionne pas** avec ces constantes. Il est chargé par effet de bord en première ligne
d'`index.ts` (`import './env'`), appelle `process.exit(1)` sur configuration invalide, et n'est
jamais chargé par `app.ts` ni par les tests. Fusionner ferait de tout import de constante un
déclencheur de `validateEnv()` — donc un `process.exit(1)` dans la suite de tests. Les deux fichiers
sont de natures opposées : **un garde-fou de démarrage** contre **un porteur de valeurs**.

### 6. Trois points de nommage

**Singulier.** Les **30 tables du schéma sont au singulier** (`product`, `order`, `cart_item`) et
Elysia écrit `auth/`, `user/`. Seuls les dossiers de routes actuels sont au pluriel. Donc
`modules/product/` qui expose `/products` : le pluriel reste dans l'URL, où c'est une convention
REST, et disparaît du code, où il n'avait pas de raison d'être.

**Les plugins techniques globaux vivent à la racine.** `security-headers.ts` a **un seul
consommateur**, `app.ts`. La règle de propriété tranche sans qu'on ait à créer une catégorie : un
fichier à consommateur unique appartient à ce consommateur.

**`principal` reste, `honorsSelfOnly` devient `hasSubject`.** Le premier est le terme standard du
contrôle d'accès (AWS IAM, Kerberos, JAAS) et il est acté par [ADR-0037](./ADR-0037-principaux-surfaces.md) ;
le faux ami est en prose française, pas dans le code — une ligne de glossaire suffit. Le second
nommait l'**effet** (« il respecte le drapeau ») au lieu de la **cause** (« il y a un compte personnel
derrière ce principal »), ce qui rend le comportement des principaux non-humains inexplicable sans
lire l'implémentation.

## Conséquences

- **Aucun changement de comportement.** Déplacements de fichiers et réécritures d'imports ; la
  surface HTTP, les schémas de base et le contrat SDK sont inchangés. Les deux gardes anti-dérive
  (`ci.yml:49` schéma↔migrations, `ci.yml:66` routes↔SDK) restent valides et le prouvent.
- **`routes/`, `models/`, `utils/`, `plugins/`, `services/`, `lib/config.ts` disparaissent.** `lib/`
  survit avec trois fichiers.
- **`principals.ts` trouve sa place** — le contrat de registre de principaux ([ADR-0037](./ADR-0037-principaux-surfaces.md))
  n'était dans `plugins/` que par proximité ; il rejoint `modules/auth/`.
- **`#11` devient mécanique.** Extraire un concept vers un paquet partagé se réduit à déplacer un
  sous-arbre, au lieu de rassembler ses morceaux dans quatre dossiers.
- **La règle de propriété entre dans `conventions.md`** avec son test d'admission en deux clauses.

## Ce que cet ADR ne tranche pas

Deux décisions structurantes, sorties du périmètre pour être instruites pour elles-mêmes. L'état de
la réflexion est consigné ici pour qu'elles ne repartent pas de zéro.

### La surface HTTP des paquets partagés

40 % de l'API est générique (5 556 lignes sur 13 821) et serait recopié dans `prisme-api`.

**Ce qui est mesuré et ne fait plus débat** : `app.ts` est déjà un pur assemblage (30 imports, 30
`.use()`) ; la génération du SDK interroge le spec OpenAPI de l'API **en cours d'exécution** et
ignore donc l'origine des routes ; Elysia laisse la **dernière déclaration écraser la précédente**
(vérifié), donc un produit peut redéfinir une route de paquet sans le modifier ; et les sous-chemins
d'export (`@repo/assets/schema`) permettraient d'isoler la dépendance à Elysia dans un `./routes`
qu'un consommateur non-HTTP n'importe jamais.

**L'argument décisif contre, qui manquait** : une route n'est pas qu'un bout de code, c'est la
**surface publique d'un produit** — versionnée avec lui, alimentant son SDK publié, engageant sa
compatibilité. Si un paquet possède `GET /media`, une modification y change simultanément l'API
publique des deux produits, et un bump de paquet modifie en silence deux SDK. Le produit perd le
contrôle de son contrat. C'est aussi ce que dit la **direction** posée par
[ADR-0025](./ADR-0025-deux-produits-un-repo.md) : la flèche va du produit vers le paquet. Le produit
*consomme* la logique et les modèles ; il *décide* sa surface.

**Correction d'un chiffre avancé à tort** : le coût de duplication a été estimé à « 2 903 lignes de
routes ». C'est une comparaison biaisée — ces fichiers mélangent aujourd'hui déclaration Elysia et
logique, or le présent ADR les sépare précisément en `index.ts` et `service.ts`. La vraie alternative
n'est pas « tout partagé » contre « tout dupliqué », mais une **troisième voie** : `service.ts` et
`model.ts` dans le paquet, `index.ts` dans chaque produit. Seul le controller serait écrit deux fois,
et la part réelle reste à mesurer.

### L'injection de dépendance

`@repo/db` exporte un `db` concret lié à `process.env.DATABASE_URL` au chargement du module. Choix
délibéré, mais qui ne satisfait pas l'inversion de dépendance : une route qui fait `db.select()` ne
déclare pas sa dépendance, elle attrape une globale. Conséquences réelles — on ne peut pas tester les
routes d'un paquet sans un vrai Postgres, ni faire tourner les deux produits dans un même processus.
Déplacer des routes dans les paquets étendrait la portée de ce couplage, ce qui lie ce sujet au
précédent.

### Reliquats de la revue SOLID

- **`bypass` est un champ libre sur `Principal`** ([ADR-0037](./ADR-0037-principaux-surfaces.md)) :
  n'importe quel résolveur peut se déclarer propriétaire. Un principal n'est donc pas substituable en
  sécurité à un autre. À corriger.
- **L'écrasement de route est silencieux.** Aucun avertissement quand un produit masque une route.
  Pas de garde tant qu'aucune surcharge n'existe réellement — en construire une avant d'en avoir
  l'usage serait de l'abstraction par anticipation.
