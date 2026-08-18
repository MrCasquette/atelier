# ADR-0057 — Le premier compte naît d'une commande, jamais d'une variable

Statut : accepté · 2026-08-18
Portée : auth

> Applique au premier compte le principe posé par
> [ADR-0048](./ADR-0048-invitation-utilisateur.md), dont il était jusqu'ici la seule exception.
> N'engage rien du choix reporté par [ADR-0051](./ADR-0051-garde-credentials.md).

## Contexte

ADR-0048 pose qu'un compte administrateur naît **sans secret utilisable** : son titulaire pose le
sien, et le créateur ne le connaît jamais. Le compte le plus puissant du système échappait à cette
règle. `initAdmin()` lit `ADMIN_EMAIL` et `ADMIN_PASSWORD` dans l'environnement, les hache au
démarrage et pose `isOwner: true` ; `compose.yaml` les remplissait par défaut avec
`admin@echoppe.dev` / `admin123`, et le `.env` livré au consommateur proposait `change-me`, qui
démarre parfaitement si personne ne l'édite.

Le secret du propriétaire vivait donc en clair dans un fichier, et sa valeur par défaut était
publique.

**Ce n'est pas le débat sur le mode d'identité.** ADR-0051 reporte le choix entre garde locale,
fournisseur OIDC et service hébergé jusqu'aux deux usages réels. L'amorçage lui est antérieur et
indifférent : même une installation entièrement adossée à un fournisseur externe a besoin d'un
premier compte local pour aller le configurer. La question se tranche donc seule, et maintenant.

## Options envisagées

- **Un lien de pose de mot de passe au premier démarrage** — homogène avec ADR-0048, mais circulaire
  dès qu'il passe par courriel : les credentials du fournisseur d'envoi vivent chiffrés en base
  (ADR-0011) et se saisissent dans le dashboard, qui exige d'être connecté. Imprimé dans les
  journaux, le lien échappe à la circularité mais reste un secret dans un flux de journalisation,
  pour un gain nul face à une commande.
- **`create-echoppe` demande e-mail et mot de passe au scaffold** — le bon moment côté parcours,
  le mauvais côté technique : la CLI tourne sur Node avec `@clack/prompts` pour seule dépendance et
  s'exécute **avant** que la base existe, `docker compose up -d` faisant partie des étapes qu'elle
  imprime. Il faudrait lui donner un pilote PostgreSQL et faire d'un outil de scaffold un client de
  base de données.
- **Une commande d'amorçage interactive, exécutée dans le conteneur après le démarrage.**

## Décision

### Le propriétaire se crée par `admin:create`, en interactif

```bash
docker compose exec -it api ./api admin:create
```

Frère de `api-key:create`, même nature : une commande serveur d'amorçage, à accès direct à la base,
qui suppose déjà l'autorité de l'exploitant puisqu'elle suppose l'accès au conteneur. Elle demande
e-mail et mot de passe, hache en Argon2id, insère, et n'affiche jamais le secret.

**Interactif seul.** Pas de `--password`, pas de lecture sur stdin : un mode non interactif est
exactement le chemin par lequel un mot de passe reviendrait dans un fichier, un historique de shell
ou une définition de tâche. Le jour où un provisionnement automatisé aura un usage réel, il fera
l'objet de sa propre décision.

La commande refuse de s'exécuter si un utilisateur existe déjà : elle amorce, elle n'administre pas.
Les comptes suivants passent par l'invitation d'ADR-0048.

### `ADMIN_EMAIL` et `ADMIN_PASSWORD` disparaissent

Avec elles, `initAdmin()` et son appel au démarrage. Rien en CI, dans les tests ni dans le gate
d'intégration n'en dépendait ; le seed de développement crée son propre compte, en dur et assumé.

Le `.env` du dépôt, celui du template et les deux `compose.yaml` perdent ces clés. Il ne reste aucun
secret de compte dans un fichier de configuration.

### L'absence de propriétaire est bruyante, pas silencieuse

Au démarrage, si la table des utilisateurs est vide, l'API imprime la commande exacte à exécuter. Le
coût de la décision — une commande de plus après le `up` — se rembourse là : un démarrage sans
compte se voit, au lieu d'aboutir à un formulaire de connexion qu'aucun identifiant n'ouvre.

### Le premier compte est le propriétaire, et le reste jusqu'à ce qu'il transmette

C'est déjà le modèle, et il est outillé : `user_single_owner` garantit en base qu'il n'y a qu'un
propriétaire à la fois, et la transmission est implémentée, atomique et irréversible
([ADR-0047](./ADR-0047-autorite-principal.md) §6). En V1 le premier compte est celui du
développeur ; à la livraison, il cède la propriété et redevient un Administrateur ordinaire, sans
pouvoir la reprendre.

Ce que cette ADR ne tranche pas : ce qu'il advient du sortant. Il reste `admin`, donc très capable,
et c'est au nouveau propriétaire de le désactiver s'il le veut. Automatiser ce geste serait une
politique, pas une frontière — à rouvrir quand le premier compte pourra être celui d'un
non-technicien.

## Conséquences

- `docs/guide/configuration.md` perd deux variables et gagne l'étape d'amorçage.
- Le `.env` généré par `create-echoppe` et la note des « prochaines étapes » citent `admin:create`
  entre le `up` et l'accès à `/-/admin`.
- Un exploitant qui met à jour une installation existante n'est pas concerné : son compte est déjà
  en base, et `initAdmin()` ne faisait rien dès le second démarrage.
- **L'image ne porte qu'un binaire compilé** — ni sources, ni `package.json`, ni `node_modules`.
  `bun run <script>` n'y a jamais existé, et la commande `docker compose exec api bun run
  api-key:create` que le `.env` généré documentait était donc inexécutable depuis toujours,
  silencieusement. Les commandes d'exploitation deviennent des **sous-commandes du binaire** :
  `./api admin:create`, `./api api-key:create`. `index.ts` les aiguille avant tout démarrage de
  serveur, en retirant l'argument d'`argv` pour que chaque script voie la même ligne de commande
  qu'en local.
- Une sous-commande n'applique **pas** les migrations : c'est le serveur qui les possède, et il a
  démarré avant qu'on exécute quoi que ce soit dans son conteneur.
- Les trois défauts de la surface d'authentification recensés par ADR-0051 restent ouverts et
  indépendants : l'oracle d'énumération (temps de réponse, et `account-disabled` renvoyé avant
  vérification du mot de passe), le jeton de session conservé en clair là où le jeton de pose de mot
  de passe est haché, et l'adhérence du rate limiting à Redis. Aucun ne dépend de cette décision ni
  du mode d'identité.
