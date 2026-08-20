# Sauvegarde et restauration

Destiné à qui **exploite** une instance — pas au contributeur.

La vérité d'une instance en production, c'est **Postgres plus le volume d'uploads**. Les migrations
recréent le schéma, jamais les fichiers : sauvegarder l'un sans l'autre casse les références média.

## Ce qu'il faut sauvegarder

- **Base** : `pg_dump` planifié (ex. quotidien) hors du conteneur, rétention à définir — ex.
  `docker exec <db> pg_dump -U echoppe echoppe | gzip > backup-$(date +%F).sql.gz`. Restauration :
  `gunzip -c … | docker exec -i <db> psql -U echoppe echoppe`.
- **Uploads** : snapshot du volume monté sur la racine de données. Sauvegarder base **et** uploads
  dans le même geste — sinon les références média pointent dans le vide.
  → [ADR-0056](../adr/ADR-0056-racine-de-donnees.md).

## L'avertissement qui compte

⚠️ **Ne jamais éprouver une restauration sur une base de production** (`dpc-*`). Une restauration se
teste sur une base jetable, toujours.
