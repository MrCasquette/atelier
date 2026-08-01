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

Un champ **`Portée :`** sous la ligne `Statut :`, avec trois valeurs :

| Valeur | Signification |
|---|---|
| `socle` | vaut pour les deux produits |
| `échoppe` | propre au framework e-commerce |
| `prisme` | propre au CMS |

L'index du [README](./README.md) est découpé en trois tables par portée.

## Conséquences

- Le champ est obligatoire sur tout nouvel ADR. Les 23 existants sont classés rétroactivement.
- **Certains ADR `socle` devront être relus à l'occasion de Prisme** — [ADR-0008](./ADR-0008-auth-sessions.md)
  (auth) et [ADR-0013](./ADR-0013-modele-rbac.md) (RBAC) en tête, tous deux mis de côté pour une
  discussion dédiée. Un ADR socle qui ne survit pas au deuxième produit n'était pas socle : il sera
  alors scindé ou amendé, pas supprimé.
- Un ADR peut changer de portée. C'est un amendement daté, comme tout le reste.
