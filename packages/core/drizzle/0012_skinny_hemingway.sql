-- Surface : `store` était le nom Échoppe de la surface publique (ADR-0037). Renommer la VALEUR
-- plutôt que recréer le type — drizzle-kit propose un DROP TYPE / CREATE TYPE qui échouerait ici,
-- les lignes existantes portant encore 'store' au moment du transtypage.
ALTER TYPE "public"."role_scope" RENAME VALUE 'store' TO 'public';--> statement-breakpoint
ALTER TABLE "role" ADD COLUMN "key" varchar(50);--> statement-breakpoint
ALTER TABLE "role" ADD CONSTRAINT "role_key_unique" UNIQUE("key");--> statement-breakpoint
-- Reprise : les rôles système sont aujourd'hui repérés par leur nom affiché. On leur pose leur clé
-- immuable une fois, à partir de ce nom ; ensuite le code ne consulte plus que la clé.
UPDATE "role" SET "key" = 'owner' WHERE "is_system" AND "name" = 'Propriétaire';--> statement-breakpoint
UPDATE "role" SET "key" = 'admin' WHERE "is_system" AND "name" = 'Administrateur';--> statement-breakpoint
UPDATE "role" SET "key" = 'customer' WHERE "is_system" AND "name" = 'Client';--> statement-breakpoint
UPDATE "role" SET "key" = 'public' WHERE "is_system" AND "name" = 'Public';
