CREATE TABLE "legal_entity" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"singleton" boolean DEFAULT true NOT NULL,
	"name" varchar(255),
	"legal_form" varchar(50),
	"siren" varchar(9),
	"siret" varchar(14),
	"tva_intra" varchar(20),
	"rcs_city" varchar(100),
	"share_capital" numeric(10, 2),
	"street" varchar(255),
	"street_2" varchar(255),
	"postal_code" varchar(10),
	"city" varchar(100),
	"country" uuid,
	CONSTRAINT "legal_entity_singleton_unique" UNIQUE("singleton"),
	CONSTRAINT "legal_entity_singleton" CHECK ("legal_entity"."singleton")
);
--> statement-breakpoint
CREATE TABLE "site" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"singleton" boolean DEFAULT true NOT NULL,
	"name" varchar(255) NOT NULL,
	"logo" uuid,
	"url" varchar(255),
	"description" varchar(500),
	"public_email" varchar(255),
	"public_phone" varchar(20),
	"publisher_name" varchar(255),
	"host_name" varchar(255),
	"host_address" varchar(500),
	"host_phone" varchar(20),
	CONSTRAINT "site_singleton_unique" UNIQUE("singleton"),
	CONSTRAINT "site_singleton" CHECK ("site"."singleton")
);
--> statement-breakpoint

-- Reprise des données AVANT la suppression (ADR-0040). Ajouté à la main : drizzle-kit produit du
-- DDL, pas de transfert — il a d'ailleurs demandé si `company` était RENOMMÉE en `site` ou en
-- `legal_entity`, preuve qu'il ne peut pas deviner qu'elle se décompose en deux.
--
-- `company` était un singleton de fait (une seule ligne, jamais contrainte) : LIMIT 1 suffit.
INSERT INTO "site" ("name", "logo", "public_email", "public_phone", "publisher_name", "host_name", "host_address", "host_phone")
SELECT "shop_name", "logo", "public_email", "public_phone", "publisher_name", "hosting_provider", "hosting_address", "hosting_phone"
FROM "company" LIMIT 1;--> statement-breakpoint

-- L'entité légale n'est reprise que si elle porte une raison sociale : une fiche vide n'a pas à
-- être fabriquée, l'absence de ligne EST le signal « pas d'entité légale ».
INSERT INTO "legal_entity" ("name", "legal_form", "siren", "siret", "tva_intra", "rcs_city", "share_capital", "street", "street_2", "postal_code", "city", "country")
SELECT "legal_name", "legal_form", "siren", "siret", "tva_intra", "rcs_city", "share_capital", "street", "street_2", "postal_code", "city", "country"
FROM "company" WHERE "legal_name" IS NOT NULL AND "legal_name" <> '' LIMIT 1;--> statement-breakpoint

-- La ressource RBAC `company` devient `identity` (le nom de la table ayant disparu, le laisser
-- serait une dérive silencieuse). Les permissions et les portées de clés d'API suivent.
UPDATE "permission" SET "resource" = 'identity' WHERE "resource" = 'company';--> statement-breakpoint
UPDATE "api_key" SET "scopes" = (
  SELECT jsonb_agg(replace(scope #>> '{}', ':company', ':identity'))
  FROM jsonb_array_elements("scopes") AS scope
)
WHERE "scopes"::text LIKE '%:company%';--> statement-breakpoint

DROP TABLE "company" CASCADE;--> statement-breakpoint
ALTER TABLE "legal_entity" ADD CONSTRAINT "legal_entity_country_country_id_fk" FOREIGN KEY ("country") REFERENCES "public"."country"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "site" ADD CONSTRAINT "site_logo_media_id_fk" FOREIGN KEY ("logo") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;