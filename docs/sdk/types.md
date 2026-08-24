# Types & surface

## Accéder aux types

Chaque schéma est exposé comme **alias plat importable** — c'est la façon recommandée :

```ts
import type { ProductDetail, Cart, Address } from '@axiome-apps/echoppe-client';

function render(product: ProductDetail) { /* … */ }
```

Ces alias sont **générés** depuis le contrat (aucune redéclaration à faire). Ils pointent
sous le capot vers les schémas indexés — accessibles aussi directement si besoin :

```ts
import type { components } from '@axiome-apps/echoppe-client';

type CartLowLevel = components['schemas']['Cart']; // strictement équivalent à `Cart`
```

Le SDK exporte par ailleurs trois espaces de noms bruts :

| Export | Contenu |
|--------|---------|
| `paths` | toutes les routes et leurs opérations |
| `operations` | les opérations nommées (paramètres, corps, réponses) |
| `components` | les schémas nommés, atteints par indexation |

> Analogie Zod : avec Zod on écrit `z.infer<typeof Schema>` (le schéma est une *valeur*).
> Ici les schémas sont générés en **types seuls** ; les alias plats évitent d'avoir à écrire
> `components['schemas']['X']` (et il n'y a pas de `typeof` à mettre).

## Modèles disponibles

Alias importables couvrant la surface boutique (générés — la liste suit automatiquement le
contrat) :

| Domaine | Alias |
|---------|-------|
| Catalogue | `ProductList`, `ProductDetail`, `ProductWithVariants` |
| Taxonomie | `Category`, `CategoryList`, `Collection`, `CollectionList` |
| Panier | `Cart`, `CartMerge` |
| Commande | `PaymentProviderList`, `CheckoutResult` |
| Compte client | `CustomerAuth`, `Address`, `AddressList` |
| Boutique | `TaxRateList` |

> Certaines réponses sont typées **en ligne sur leur route** plutôt que via un alias nommé
> (ex. `GET /company/` renvoie les informations légales, `Company | null`). Elles restent
> entièrement typées à l'appel — seul l'alias importable autonome n'existe pas.

Pour la **forme détaillée** de chaque modèle (champs, types, obligatoires), voir la
[Référence des modèles](/sdk/reference).

## Périmètre exposé

Le SDK ne décrit **que la surface storefront**. Le contrat complet de l'API (qui inclut le
back-office) est **filtré** à la génération : seules les routes boutique et les schémas
qu'elles référencent sont conservés. En conséquence :

- Les routes d'administration (CRUD produits, gestion des commandes, utilisateurs, rôles…)
  **ne sont pas** dans le client — elles restent protégées par le RBAC de l'API.
- Les champs sensibles ne fuitent pas : par exemple le **coût d'achat** (`costPrice`) d'un
  variant est masqué de la vue publique — le contrat boutique ne l'expose jamais.

Les grandes familles couvertes :

- **Catalogue** — produits, catégories, collections (lecture).
- **Panier** — consultation et mutation (par session).
- **Tunnel de commande** — moyens de paiement, checkout.
- **Compte client** — inscription, connexion, profil, adresses.
- **Divers boutique** — informations légales (`company`), taux de TVA, formulaire de contact.

::: info Feuille de route
Des modules sont en cours d'ajout à la surface (contenu éditorial, espace commandes du
client, calcul des frais de port et suivi de colis). Cette page sera complétée au fil de
leur publication.
:::
