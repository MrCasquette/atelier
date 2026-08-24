# Sujets à discussion

Ce que le dépôt sait devoir trancher un jour, et qui n'est **ni une tâche actionnable, ni une
décision prise**. Une ligne de backlog dit quoi faire ; un ADR dit ce qu'on a décidé ; ici on garde
la question ouverte, avec ce qui l'a fait naître.

**Un sujet ne reste pas.** Il sort par une des trois portes : il devient une tâche dans un backlog
de périmètre, il devient un ADR, ou il meurt parce que la réalité l'a réglé. Cette liste est
mauvaise le jour où elle s'allonge sans que rien n'en sorte.

## D'où viennent ces sujets

D'un chantier qui bute sur une question qu'il ne peut pas trancher seul, et — pour la plupart — des
audits, qui sont des **constats à date**. Un audit prouve qu'on s'est inquiété d'un sujet, et
quand ; il ne dit pas l'état courant, qui se redécouvre. C'est pourquoi chaque entrée porte deux
dates : celle du constat d'origine, et celle de la dernière redécouverte — et que ce qui est écrit
sous « aujourd'hui » l'emporte sur ce que l'audit affirmait.

Chaque sujet venu d'un audit a été **revérifié sur le code le 2026-08-22**. Plusieurs constats d'audit ne figurent pas ici
parce que la redécouverte les a trouvés réglés : le `onError` global manquant (`error-handler.ts`
existe), le mot `store` dans `roleScopeEnum` (passé à `['admin', 'public']`), le sac global
`enums.ts` (dissous), les templates e-mail couplés au commerce (`storefront-emails.ts` les
enregistre depuis Échoppe, et un test verrouille que le socle ne les connaît pas).

## Identité et noms

### La visibilité du dépôt bloque trois choses à la fois

*Ouvert : 2026-08-24, en héritage du sujet du nom — tranché par
[ADR-0063](../adr/ADR-0063-appartenance-des-paquets.md) le même jour.*

Le dépôt est privé, et trois chantiers butent dessus sans qu'aucun ne le possède :

- **les métadonnées npm** — ADR-0062 §6 rend `repository` obligatoire sur tout paquet publié, mais il
  pointerait aujourd'hui vers un 404. Trois paquets publics sous licence CeCILL dont le code n'est pas
  consultable : c'est légal, les sources voyageant dans le tarball, mais contradictoire avec ce que la
  licence annonce ;
- **le redéploiement de la documentation sur Pages** ;
- **la langue du système documentaire**, plus bas dans cette liste, qui est une décision de
  positionnement — publication ouverte ou non.

À trancher : le dépôt s'ouvre, il reste privé, ou il se scinde en une partie publiée et une partie
privée. Les trois chantiers se débloquent d'un seul geste, et aucun ne se débloque seul.

## Socle et contrats

### Une primitive de champ récursive casserait l'inférence de route

*Constat : 2026-08-16 (audit Elysia, contrainte C15) · redécouvert : 2026-08-22.*

La grammaire de `@repo/fields` est écrite deux fois — un `t.Object` TypeBox et un membre de l'union
TypeScript — parce qu'un `Static<>` récursif casse l'inférence des routes Elysia. Le verrou existe
(`model.test.ts` exige une ligne par `kind`), et le coût par primitive **plate** est de trois
éléments dans deux fichiers : négligeable.

Le risque n'est pas le nombre, c'est la **forme**. Le jour où une primitive devient récursive, le
coût n'est plus borné — c'est exactement le bug d'origine, un `t.Array` dans un `t.Recursive`
traversé par `Static<>`.

À trancher : une garde qui exige une revue à l'ajout d'une primitive récursive, ou rien et on
accepte de le redécouvrir. Le sujet appartient à `@repo/fields`, pas à Elysia.

### Le verdict « rester sur Elysia » n'est jamais devenu un ADR

*Constat : 2026-08-16 (audit Elysia) · conservé tel quel.*

L'arbitrage a été instruit sérieusement — dix-huit contraintes, requalifiées en six réellement
imputables à Elysia, chiffrées contre Hono et Fastify — et la conclusion était **rester**, les deux
migrations supprimant deux contraintes récurrentes au prix d'une réécriture complète et de coûts
d'outillage neufs.

Ce verdict n'est figé nulle part. Il est **daté**, et il se rouvrira de lui-même si le sujet revient
— l'enquête complète reste dans l'historique git, au commit qui a supprimé
`docs-internal/audits/audit-elysia.md`. On le note ici pour ne pas la refaire de zéro.

## Sécurité

### L'owner court-circuite toute vérification

*Constat : 2026-07-14 (audit sécurité) · redécouvert : 2026-08-22.*

`isOwner` court-circuite le RBAC entier. C'est **voulu** et ce n'est pas un défaut : c'est ce qui
rend le propriétaire non verrouillable hors de sa propre boutique. La conséquence l'est moins — le
compte owner devient une cible dont la compromission n'a aucun garde-fou en profondeur.

À trancher : MFA sur les comptes owner et admin, rotation, ou rien tant qu'Échoppe n'est pas
hébergé. Le sujet touche la garde des credentials
([ADR-0051](../adr/ADR-0051-garde-credentials.md)) et attend le même second usage réel.

### Le CSRF ne tient qu'à `sameSite=strict`

*Constat : 2026-07-14 (audit sécurité) · redécouvert : 2026-08-22.*

Il n'y a pas de jeton anti-CSRF : la protection vient entièrement du cookie `sameSite=strict`,
complété par un CORS à origines explicites. C'est solide, et c'est **un seul rempart**.

Deux choses le feraient tomber sans que rien ne le signale : une route sensible servie en `GET` qui
mute, ou un assouplissement en `sameSite=lax` — qu'un besoin d'intégration tierce peut rendre
tentant. Aucun test ne tomberait dans les deux cas.

À trancher : l'accepter en l'écrivant comme un invariant gardé, ou introduire un jeton. Le premier
est cohérent avec la façon dont ce dépôt tient ses frontières — par la forme plutôt que par la
discipline — mais suppose une garde qui n'existe pas.

### Une clé d'API écrit en base à chaque appel

*Constat : 2026-07-14 (audit sécurité) · redécouvert : 2026-08-22.*

`lastUsedAt` est mis à jour à chaque authentification par clé. Négligeable au volume machine
actuel ; c'est une amplification d'écriture qui suit le trafic, sur une table par ailleurs sensible.

À trancher le jour où une intégration tape en boucle : écriture différée, throttle, ou renoncer à la
précision de la date. Pas avant — ce serait optimiser sans mesure.

## Prisme

### `RESOURCES` mêle le commerce au RBAC générique

*Constat : 2026-08-01 (périmètre Prisme) · redécouvert : 2026-08-22.*

L'audit comptait quatorze entrées de commerce sur vingt-quatre. **Aujourd'hui : onze sur
vingt-six** — `PRODUCT`, `CATEGORY`, `COLLECTION`, `VARIANT`, `ORDER`, `CART`, `WISHLIST`,
`INVOICE`, `STOCK`, `SHIPPING_*`, `PAYMENT_*` — dans ce qui devrait être un vocabulaire d'autorisation
agnostique. La proportion a baissé, la nature du problème non.

Le sujet est **coincé derrière l'auth** : [ADR-0008](../adr/ADR-0008-auth-sessions.md) et
[ADR-0013](../adr/ADR-0013-modele-rbac.md) portent tous deux la mention « à relire pour Prisme », et
la garde des credentials ([ADR-0051](../adr/ADR-0051-garde-credentials.md)) conditionne son choix à
deux usages réels. Il ne s'instruit donc pas avant le vertical slice — il s'instruit **pendant**.

### Le média n'a pas de port de stockage

*Constat : 2026-08-01 (périmètre Prisme) · redécouvert : 2026-08-22.*

Le module média était réputé « zéro dépendance sortante », donc la brique la plus favorable à
l'extraction. Son seul défaut interne tient toujours : `UPLOAD_DIR` et `node:fs/promises` sont
appelés directement (`modules/media/{storage,service}.ts`), sans port. Le disque local est câblé en
dur.

Conséquence : ni S3, ni volume distant, ni stockage propre à un second produit sans toucher au
module. Le sujet croise deux tâches déjà ouvertes — la whitelist d'upload du backlog Échoppe, et le
déplacement de la brique média vers un paquet partagé.

À trancher : introduire le port maintenant, ou attendre le second consommateur — la règle du dépôt
dit d'attendre, et il n'y en a qu'un.

## Documentation

### La langue du système documentaire

*Constat : 2026-08-16 (audit de couverture documentaire) · conservé tel quel.*

Environ 6 300 lignes de commentaire en français citent une cinquantaine d'ADR français et un lexique
français. L'audit s'est explicitement abstenu de trancher, et sa formulation reste la bonne : la
question n'est pas « les commentaires en anglais », c'est **« le système documentaire passe-t-il en
anglais »**. C'est une décision de positionnement — publication ouverte ou non — pas de style.

Le point dur : **un parc à moitié traduit serait pire que l'un ou l'autre des deux états.**

Le sujet est lié à la visibilité du dépôt, déjà ouverte dans le [backlog socle](./shared.md)
§ Distribution npm : les paquets publiés n'ont pas de `repository` parce qu'il pointerait vers un
dépôt privé. Les deux se tranchent probablement ensemble.
