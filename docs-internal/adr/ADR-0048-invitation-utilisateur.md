# ADR-0048 — Inviter un utilisateur : le créateur ne connaît jamais le mot de passe

Statut : accepté · 2026-08-12
Portée : auth

Complète [ADR-0047](./ADR-0047-autorite-principal.md) — l'autorité y était bornée, l'**identité**
restait empruntable.

## Contexte

`POST /users` fait poser le mot de passe **par le créateur**, et `PATCH /users/:id` lui permet de
réécrire celui de n'importe quel compte ordinaire. Celui qui crée un compte peut donc s'y connecter.

Ça vide une garantie qu'ADR-0047 croyait avoir posée. #50 a réservé au propriétaire le fait de
toucher à un utilisateur du premier rang ; #51 a été **révoquée** parce qu'un administrateur peut
légitimement en admettre un autre — un pair est un pair. Les deux décisions tiennent. Mais elles ne
décrivent que ce qu'on a le droit de **modifier**, jamais ce qu'on a le droit de **devenir**.

Le levier n'est pas le rang conféré. C'est le mot de passe posé : il vaut pour tout compte créé ou
modifié par un administrateur, quel que soit son rôle. La garde de #50 est une politique ; elle
n'est pas une frontière tant que celui qui administre peut agir par procuration.

### Pourquoi ça n'avait pas été fait

Parce qu'un flux d'invitation suppose un envoi de courriel opérationnel. Directus tranche dans
l'autre sens pour exactement cette raison : sans mailing configuré, une invitation bloque
l'installation dès le second compte. L'argument est réel et on ne le balaie pas.

## Décision

### 1. Le créateur ne choisit pas de mot de passe. Jamais.

`POST /users` perd `password`. Le compte naît **sans secret utilisable** : la colonne porte une
empreinte impossible, qu'aucune vérification ne peut satisfaire. Il ne devient utilisable qu'au
moment où son titulaire pose lui-même son mot de passe.

`PATCH /users/:id` perd `password` également. Un administrateur ne réécrit plus le secret de
personne.

### 2. Un seul mécanisme, deux usages

Inviter et débloquer sont **le même acte** : prouver qu'on tient l'adresse, puis poser un mot de
passe. Un seul jeton, une seule table, une seule route de consommation.

`user_password_token` — jumelle de `password_reset_token` côté client. On stocke le **hash** SHA-256
du jeton, jamais le jeton ; TTL court, usage unique.

| Route | Acte |
|---|---|
| `POST /users` | crée le compte et émet le premier jeton |
| `POST /users/:id/reset` | réémet un jeton pour un compte existant |
| `POST /auth/accept-invitation` | consomme le jeton et pose le mot de passe (**publique**) |

La route de consommation est publique par nature : celui qui clique n'a pas de session. Elle
n'entre pas dans la surface storefront, qui est une liste explicite.

### 3. Sans fournisseur d'envoi, le lien est rendu une fois — le flux ne change pas

C'est la réponse à l'objection de Directus, sans adopter son arbitrage. Il n'y a **qu'un** flux :
une invitation est toujours émise. Seule la **remise** change.

- fournisseur configuré → le lien part par courriel, personne d'autre ne le voit ;
- aucun fournisseur → `POST /users` rend `invitation: { url, expiresAt }` **dans sa réponse**, une
  fois, au créateur, à charge pour lui de le transmettre.

Le créateur peut alors se servir du lien lui-même. C'est assumé, et c'est **strictement meilleur que
l'état actuel** : un mot de passe posé est invisible pour la victime, un jeton consommé ne l'est
pas — l'invité découvre que son lien ne marche plus. Le mensonge devient détectable, et il est
journalisé (`user.invite`, `user.invite_link_shown`).

### 4. Ce qu'on n'a pas fait

- **Pas de compte pré-activé.** Un compte sans mot de passe utilisable n'est pas un compte
  désactivé : `isActive` garde son sens, qui est une décision d'administration, pas un état
  transitoire.
- **Pas de renvoi automatique.** Un jeton expiré se réémet par `POST /users/:id/reset`, à la main.
  Un renvoi automatique transformerait l'adresse en oracle.

## Conséquences

Un administrateur ne peut plus agir par procuration, sauf à passer par le repli sans fournisseur —
où son acte laisse une trace que la victime voit.

La garde de #50 redevient ce qu'elle prétendait être : une frontière.

Le support garde sa voie — un utilisateur bloqué se débloque par `POST /users/:id/reset`, sans que
personne n'apprenne son secret.

Une installation nue reste utilisable dès le premier jour, sans mailing.
