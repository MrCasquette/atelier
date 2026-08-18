# ADR-0053 — Un commentaire garde le passé seulement s'il est encore agissant

Statut : accepté · 2026-08-18
Portée : socle

> Précise la SSOT personnelle (`00-philosophy.md` : « doc minimale — commentaires sur le *pourquoi* »),
> qui ne dit pas ce qu'il advient d'un pourquoi devenu du passé. Ne la contredit pas : hiérarchie
> [ADR-0041](./ADR-0041-hierarchie-autorites.md).

## Contexte

Le dépôt commente abondamment le *pourquoi*, et c'est sa force : la plupart de ces commentaires
expliquent une contrainte que le code seul ne montre pas. Mais une part d'entre eux raconte une
**transition** — ce qui existait avant, ce qui a été remplacé, ce qui n'existe plus.

Un balayage en donne une trentaine d'occurrences, dont la majorité sont des faux positifs : « avant
le `listen` », « avant l'`ALTER` », « avant la mise en ligne » sont des antériorités **logiques**,
pas des souvenirs. Restent une dizaine de commentaires réellement narratifs.

Le coût n'est pas l'encombrement. C'est qu'ils vieillissent sans prévenir : une phrase au présent
qui décrit un état révolu devient un mensonge que le lecteur suivant prend pour argent comptant.

## Options envisagées

- **Tout garder** — l'historique est une richesse ; mais git et les ADR le portent déjà, avec les
  dates, les raisons complètes et le diff.
- **Interdire toute mention du passé** — supprimerait des garde-fous irremplaçables, dont la valeur
  tient précisément à ce qu'ils rappellent un incident.
- **Un critère qui départage.**

## Décision

**Le test** : *si je supprime cette phrase, quelqu'un peut-il refaire l'erreur ?*

- **Oui → garde-fou, il reste.** Le piège est ouvert, et le commentaire vit à l'endroit exact où la
  faute se commettrait — ce qu'aucun ADR ne peut faire. Exemple : le `PAS de --minify` du
  `Dockerfile` (Elysia analyse le source des handlers ; la minification renomme les paramètres
  déstructurés → 500 sur toute route protégée, invisible en dev, fatal en binaire). Autre exemple :
  `tests/permission-delegation.test.ts`, dont le commentaire dit ce que le test empêche de revenir —
  le retirer ferait perdre la raison d'être du test.
- **Non → récit, il part.** Git porte la chronologie, l'ADR porte les raisons, et le lecteur
  d'aujourd'hui n'a besoin ni de l'une ni des autres pour comprendre le code qu'il a sous les yeux.

Le commentaire d'un garde-fou énonce donc **la règle et sa conséquence**, pas la transition qui l'a
produite. « Ne fais pas X, sinon Y » se périme mal ; « on faisait X, maintenant Z » se périme au
premier changement suivant.

## Conséquences

- Ce critère ne s'automatise pas : la même phrase est un garde-fou ou un récit selon que le piège
  est encore atteignable. Il se tient en revue, pas en CI.
- Un commentaire narratif supprimé n'est jamais perdu : il reste dans l'historique du fichier.
- Un ADR reste le bon endroit pour la transition elle-même — pourquoi on a changé, et ce qu'on a
  écarté.
- Corollaire d'écriture : préférer le présent. Un commentaire rédigé au présent sur l'état actuel
  ne peut pas devenir un faux souvenir ; il devient faux tout court, ce qui se voit.
