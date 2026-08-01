# ADR-0024 — Portée des ADR : un compteur unique, un champ de portée

Statut : accepté · 2026-08-01
Portée : socle

## Contexte

Les 23 premiers ADR ont été rédigés pour Échoppe seul. L'arrivée de **Prisme** (CMS) dans le même
repo rend leur portée ambiguë. Le classement des 23 existants donne **14 décisions de socle** —
valables pour les deux produits, simplement rédigées depuis le point de vue Échoppe — et **9
décisions propres à l'e-commerce**. Ce n'est pas un défaut à réparer : c'est le contexte historique.

## Options envisagées

- **Trois répertoires** (`adr/socle`, `adr/echoppe`, `adr/prisme`) — impose soit une renumérotation,
  soit trois compteurs qui divergent.
- **Trois compteurs séparés** — `ADR-0005` devient ambigu sans préfixe de produit.
- **Un compteur unique + un champ de portée** dans l'en-tête.

## Décision

**Un compteur unique**, jamais renuméroté : le numéro d'un ADR est une identité, citée dans le code,
les commits et les autres ADR.

Un champ **`Portée :`** sous la ligne `Statut :`. Sa valeur dit **où vit le code concerné**, ce qui
est plus actionnable qu'un simple « vaut pour les deux » :

| Valeur | Signification |
|---|---|
| `socle` | les raisons d'être du monorepo — distribution, runtime, migrations, versioning, conventions transverses |
| `<package>` | une brique partagée : `auth`, `content`, `assets`, `communication`, `adapters`, `client`, `shared` |
| `échoppe` | propre au framework e-commerce |
| `prisme` | propre au CMS |

Une portée **multiple** est admise quand une décision traverse réellement plusieurs briques
(`content, échoppe, prisme`) — à ne pas banaliser.

L'index du [README](./README.md) est découpé par portée.

### Pourquoi le grain du package

Un premier classement en trois valeurs (`socle` / `échoppe` / `prisme`) a donné 14 ADR en `socle` —
un fourre-tout mêlant trois natures : les décisions du monorepo, des briques de domaine partagées, et
des conventions transverses. Le grain du package sépare les deux premières.

Les noms de packages sont ceux **visés** par [ADR-0033](./ADR-0033-organisation-monorepo.md), pas
ceux qui existent : l'extraction n'a pas commencé. C'est assumé — les ADR expriment ainsi
l'architecture cible plutôt que l'état courant.

**`prisme` compte peu d'ADR, et c'est un signal, pas un manque** : Prisme est essentiellement un
assemblage de briques partagées (content + auth + assets + un core mince). Si cette portée se
remplit, c'est que le CMS diverge du socle.

## Conséquences

- Le champ est obligatoire sur tout nouvel ADR. Les 23 existants sont classés rétroactivement.
- **Certains ADR `socle` devront être relus à l'occasion de Prisme** — [ADR-0008](./ADR-0008-auth-sessions.md)
  (auth) et [ADR-0013](./ADR-0013-modele-rbac.md) (RBAC) en tête, tous deux mis de côté pour une
  discussion dédiée. Un ADR socle qui ne survit pas au deuxième produit n'était pas socle : il sera
  alors scindé ou amendé, pas supprimé.
- Un ADR peut changer de portée. C'est un amendement daté, comme tout le reste.
