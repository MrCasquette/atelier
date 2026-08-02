# ADR-0037 — Principaux, surfaces et sessions : un registre plutôt qu'une union fermée

Statut : accepté · 2026-08-02
Portée : auth

> Amende [ADR-0008](./ADR-0008-auth-sessions.md), dont le mécanisme — sessions Postgres, cookie
> HTTP-only, pas de JWT — est **inchangé**. Seule change la façon dont les principaux sont déclarés.

## Contexte

`rbac.ts` définit `RbacAuthContext` comme une **union fermée de quatre principaux** : admin, client,
clé d'API, public (l. 29-51). Prisme n'aura jamais de clients — il traînerait une branche morte.

Deux piles d'authentification coexistent, et les mesures montrent qu'elles sont **structurellement
identiques** :

```
session          { id, token, user     → FK user,     ipAddress, userAgent, expiresAt, createdAt }
customer_session { id, token, customer → FK customer, ipAddress, userAgent, expiresAt, createdAt }
```

Mêmes colonnes, mêmes index. Seule la cible de la clé étrangère change. Et `rbac.ts` ne consulte le
principal `customer` qu'à trois endroits (l. 30, 223, 277).

**Trois axes étaient confondus** sous « rôle » et « scope » :

| Axe | Répond à | Valeurs |
|---|---|---|
| **Principal** | comment tu es authentifié | session admin, session client, clé d'API, anonyme |
| **Rôle** | ce que tu as le droit de faire | Owner, Admin, Editor, Client, Public |
| **Surface** | dans quelle application le rôle a un sens | `admin`, `public` |

La surface publique contient **deux** principaux — le client authentifié et l'anonyme. Surface et
principal ne sont donc pas la même chose.

## Options envisagées

- **Une seule table de session à sujet polymorphe** — `session { token, subject_type, subject_id }`.
- **Duplication par produit** — Prisme recopie la pile admin.
- **Un registre de principaux.**

## Décision

### Un registre de principaux

Le package `auth` définit le **contrat** d'un principal — un type, un identifiant de sujet, une carte
de permissions, la façon d'identifier le « soi ». Chaque produit **enregistre** les siens : quel
cookie lire, quelle table de sujet interroger, quel rôle en dériver.

Prisme enregistre `admin`, `apikey`, `public`. Échoppe enregistre les mêmes plus `customer`. Aucun
des deux ne traîne les branches de l'autre.

C'est le même motif que les cibles référençables ([ADR-0032](./ADR-0032-cibles-referencables.md)) :
**un registre à la place d'une union fermée**. Deux fois la même leçon dans la même base de code.

### Une table de session par sujet

Le sujet polymorphe est **écarté** : un `subject_id` qui référence conditionnellement deux tables
**ne peut pas porter de clé étrangère**. On perdrait la cascade à la suppression d'un compte, et
l'intégrité serait à tenir applicativement — exactement ce que
[ADR-0027](./ADR-0027-entites-tables-reelles.md) refuse par ailleurs. Or les sessions sont
précisément ce qui doit disparaître proprement quand un compte est supprimé.

Chaque produit garde donc **sa** table de session, avec sa vraie clé étrangère. Ce qui est partagé,
c'est le **mécanisme** — génération et vérification du jeton, expiration, pose du cookie, résolution
des permissions — exposé en fonctions, pas en union figée.

### La surface remplace le « scope »

`roleScopeEnum = ['admin', 'store']` devient **`['admin', 'public']`**.

`store` n'était pas un concept commerce : c'était **le nom Échoppe de la surface publique**. Prisme a
exactement la même — un visiteur non connecté lit les pages et les entités publiées. Le mot du
commerce disparaît de la base, et la valeur générique vaut pour les deux produits sans modification.

| Rôle | Surface | Principal |
|---|---|---|
| Owner, Admin, Editor | `admin` | session admin |
| Client | `public` | session client *(Échoppe seul)* |
| Public | `public` | aucun — anonyme |

**Public n'est pas un cas particulier** : c'est le rôle de la surface publique en l'absence de
principal authentifié, commun aux deux produits.

## Conséquences

- `rbac.ts:277` identifie aujourd'hui le « soi » du filtrage `selfOnly` par un `if` sur le type de
  principal. Ça devient une **propriété du principal enregistré** — « voici comment on identifie le
  sujet » — au lieu d'une branche par type.
- `roleScopeEnum` sort de `enums.ts` : la valeur est validée contre le registre, pas contre un
  `pgEnum`. Petit gain sur le découpage d'`enums.ts`.
- Trois mots désignaient la même chose — le scope `store`, le principal `customer`, le rôle système
  `Client`. Le registre impose d'en garder **un** : `customer`, celui du code.
- Le mécanisme d'ADR-0008 est intact : sessions Postgres, cookie HTTP-only, pas de JWT, jeton opaque
  indexé.
