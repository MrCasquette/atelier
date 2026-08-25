# ADR-0067 — Un prérequis se déclare, et ce qui n'a pas de question se génère

Statut : accepté · 2026-08-25
Portée : socle

> Complète [ADR-0065](./ADR-0065-configuration-par-nature.md) (natures de configuration) et ajoute
> une ligne au tableau de ce que possède `dev <produit>` dans
> [ADR-0066](./ADR-0066-ce-qui-execute-nomme-son-produit.md).

## Contexte

ADR-0066 promet qu'« un dépôt fraîchement cloné atteint un produit qui tourne, migré et peuplé, en
une commande de deux mots ». Mesuré le 2026-08-25, sur un poste privé de `.env.echoppe.local` :
c'est faux, et de la pire des façons.

`bun run dev echoppe` monte la pile, applique les migrations, joue le seed — puis l'API refuse de
démarrer :

```
[Env] Démarrage refusé — configuration invalide :
  ✗ ENCRYPTION_KEY : clé de chiffrement des secrets — 32 octets en base64
```

…et **la commande continue de tourner**. Le dashboard et la vitrine, eux, n'ont pas besoin de cette
clé : ils démarrent, servent, et parlent à une API qui n'existe pas. Le message a défilé. Le
contributeur a une base migrée, peuplée, deux serveurs vivants et rien qui marche.

Trois défauts distincts, que le même geste corrige :

1. **L'ordre.** On découvre le prérequis après avoir tout monté, au lieu d'avant de rien faire.
2. **Le silence.** Une surface qui meurt n'arrête pas les autres, donc l'échec n'est pas visible.
3. **La cérémonie.** Ce qui manque est une valeur **aléatoire**. On demande à un humain de coller
   trente-deux octets tirés au hasard, sans qu'il ait le moindre avis sur le résultat.

### Ce qui a été écarté, et pourquoi

Un **assistant type `create-atelier`**, sur le modèle de `create-echoppe` / `create-prisme`, a été
envisagé. Il ne tient pas, pour deux raisons.

**Un assistant pose des questions ; ici il n'y en a aucune.** Passons en revue ce qu'il demanderait :
`DATABASE_URL` a un défaut versionné qui marche, `ADMIN_URL` aussi, le produit est déjà un argument
de la commande, et `ENCRYPTION_KEY` est un tirage aléatoire. Ce serait un assistant à zéro prompt —
c'est-à-dire `dev` qui fait son travail.

**Et il répondrait à un problème que le contributeur n'a pas.** `create-echoppe` existe parce que le
consommateur **n'a pas de dépôt** : il faut lui en fabriquer un. Le contributeur a déjà le sien, avec
son historique, ses branches et son remote — le lui refabriquer par npm les lui coûterait. Le prix,
lui, serait réel : un quatrième artefact publié, sa couverture de release, son *trusted publisher*,
son template à tenir synchrone. Pour une ligne d'`openssl`.

Un assistant redeviendra juste le jour où un **choix** existera — mode d'identité, stockage média,
Redis, tous sujets ouverts. Une question, alors, aura un sens.

### Il n'existe aucune configuration commune au dépôt

Vérifié en écrivant cet ADR : `echoppe-api` exige `DATABASE_URL` et `ENCRYPTION_KEY`, `prisme-api`
exige `DATABASE_URL` seul.

`ENCRYPTION_KEY` n'appartient donc pas au dépôt mais à **Échoppe** : elle chiffre des credentials de
prestataires — paiement, transport, SMTP — que Prisme ne détient pas. Et le jour où Prisme aura un
secret à chiffrer, il lui faudra **sa** clé : deux produits, deux bases, deux jeux de données
chiffrées. Partager la clé les coupleraient par le seul endroit où ça ne se verrait pas, alors que
la frontière entre les deux est un invariant gardé.

La catégorie « commun au dépôt » est donc **vide**. Tout prérequis appartient à un produit — ce qui
tombe bien, puisque le produit est déjà nommé par la commande.

## Décision

### Un prérequis se déclare dans le fichier versionné du produit

`.env.<produit>` porte déjà les défauts qui marchent. Il porte désormais aussi ce qui **n'a pas** de
défaut : une variable **déclarée vide** est un prérequis que la machine doit remplir.

```ini
# @genere base64:32
ENCRYPTION_KEY=
```

Le marqueur `# @genere <recette>` dit que cette valeur **n'admet qu'un tirage arbitraire**. Une
variable déclarée vide **sans** marqueur exige un choix humain.

D'où la règle, qui tient en une ligne :

> **Ce qui n'admet qu'une valeur arbitraire se génère. Ce qui exige un choix se refuse et se nomme.**

La recette nomme un **genre** (`base64:32`), pas une commande shell. Un fichier versionné qui
porterait une ligne de commande à exécuter serait un chemin d'exécution de code pour un gain nul :
il n'existe qu'un genre aujourd'hui, et le lanceur sait le produire lui-même.

### Le lanceur garantit les prérequis avant de bouger

`dev <produit>` et `db <produit> <verbe>` — les deux verbes qui exécutent le code du produit contre
sa base — vérifient les prérequis **en premier**, avant la pile, avant les migrations, avant le seed.

| Cas | Geste |
|---|---|
| déclaré vide, marqueur présent, absent du `.local` | **généré**, écrit dans `.env.<produit>.local`, annoncé |
| déclaré vide, pas de marqueur, absent du `.local` | **refus**, en nommant la variable |
| déjà renseigné dans le `.local` | rien |

L'écriture ne touche **jamais** le fichier versionné. Le `.local` est créé s'il manque, en `0600`,
et le lanceur dit ce qu'il a écrit — une clé qui apparaît en silence serait pire que pas de clé.

`infra` en est exempt : il passe la main à Compose, qui n'exécute aucun code du produit.
`integration` aussi : il provisionne son propre environnement, jetable, de bout en bout.

### Une surface qui meurt arrête les autres

`dev` lance N surfaces en parallèle. Si l'une sort en erreur, les autres s'arrêtent et la commande
sort en erreur. Sans quoi l'échec reste invisible derrière deux serveurs qui tournent — c'est
exactement ce qui a permis au défaut ci-dessus de passer inaperçu.

### Le garde-fou d'`env.ts` ne bouge pas

Il reste ce qu'il est : un refus net au boot, qui nomme ce qui manque. Il protège **l'exploitant**,
chez qui `scripts/run.ts` n'existe pas — le stage final du `Dockerfile` ne copie ni manifeste ni
lanceur. Générer une clé côté contributeur ne l'affaiblit donc en rien : les deux mécanismes ne se
rencontrent jamais, et c'est la frontière qu'ADR-0066 avait déjà posée.

## Conséquences

- **Une clé générée est une clé de développement**, et le dépôt ne le cachera pas. Si elle est
  remplacée plus tard, les credentials de prestataires saisis dans le dashboard deviennent
  illisibles. En développement le seed reconstruit tout, ce qui rend l'incident sans gravité — mais
  la phrase reste due, dans `docs/guide/configuration.md`.
- **Le `.local` cesse d'être un préalable et devient une conséquence.** Il n'est plus quelque chose
  qu'on doit savoir créer : il apparaît au premier lancement, avec dedans exactement ce que le
  produit exigeait.
- **`.env.prisme` reste court, et c'est un fait, pas un manque.** Le remplir pour ressembler à
  Échoppe mentirait sur ce que Prisme exige. Une ligne s'y ajoutera quand une capacité l'exigera.
- **Le lanceur découvre les prérequis, il ne les connaît pas.** Un secret nouveau se déclare dans le
  `.env.<produit>` de son produit et fonctionne sans qu'on touche à `scripts/run.ts`. Un genre de
  recette nouveau, lui, s'y ajoute — et c'est le seul cas.
- Les deux produits **tournent en parallèle sans conflit** (mesuré : `:8101` et `:8201` sains
  ensemble, dashboard `:3110` à 200). Deux terminaux, un par produit. Aucun verbe `dev all` n'est
  ajouté : six flux de journaux entrelacés seraient illisibles et `Ctrl-C` deviendrait ambigu.
- Le `.env` racine a disparu avec ADR-0066 et rien ne le disait à l'endroit où on le cherche. Une
  phrase rejoint `docs/guide/configuration.md` et le README.
