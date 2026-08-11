CREATE UNIQUE INDEX "user_single_owner" ON "user" USING btree ("is_owner") WHERE "user"."is_owner";--> statement-breakpoint
-- ADR-0047 (amendement) : la propriété est un DRAPEAU, pas un rôle. Le rôle `owner` disparaît.
--
-- Ses permissions ne s'appliquaient jamais au vrai propriétaire — son autorité totale court-circuite
-- avant qu'on les lise — donc elles ne pouvaient prendre effet que sur quelqu'un qui n'en était pas
-- un. Un administrateur pouvait s'en servir pour atteindre les credentials qui lui sont réservés.
--
-- L'ordre compte : `user.role` est NOT NULL, on réassigne AVANT de supprimer.
UPDATE "user" SET "role" = (SELECT "id" FROM "role" WHERE "key" = 'admin')
  WHERE "role" IN (SELECT "id" FROM "role" WHERE "key" = 'owner')
    AND EXISTS (SELECT 1 FROM "role" WHERE "key" = 'admin');--> statement-breakpoint
DELETE FROM "permission" WHERE "role" IN (SELECT "id" FROM "role" WHERE "key" = 'owner');--> statement-breakpoint
-- La clause `NOT EXISTS` ne devrait jamais mordre : le seed crée toujours `admin`, donc la
-- réassignation ci-dessus a vidé le rôle. Si elle mord, c'est qu'aucun rôle `admin` n'existe sur
-- cette installation — on préfère alors laisser le rôle en place plutôt que faire échouer la
-- migration sur une contrainte de clé étrangère.
DELETE FROM "role" WHERE "key" = 'owner'
  AND NOT EXISTS (SELECT 1 FROM "user" WHERE "user"."role" = "role"."id");
