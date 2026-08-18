---
'create-echoppe': minor
---

Le compte propriétaire ne se configure plus dans `.env` : `ADMIN_EMAIL` et `ADMIN_PASSWORD`
disparaissent du `.env` généré et du `compose.yaml` livré. Le compte se crée après le démarrage,
par `docker compose exec -it api ./api admin:create`, qui demande e-mail et mot de passe au
terminal — aucun mot de passe n'est donc écrit dans un fichier.

Au passage, les commandes d'exploitation citées par le projet généré étaient inexécutables :
l'image ne contient qu'un binaire compilé, sans `package.json`, donc `bun run api-key:create` n'y
existait pas. Elles passent désormais par le binaire lui-même (`./api api-key:create …`).
