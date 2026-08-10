CREATE TABLE "store_settings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"singleton" boolean DEFAULT true NOT NULL,
	"document_prefix" varchar(10) DEFAULT 'REC' NOT NULL,
	"document_next_number" integer DEFAULT 1 NOT NULL,
	"invoice_prefix" varchar(10) DEFAULT 'FA' NOT NULL,
	"invoice_next_number" integer DEFAULT 1 NOT NULL,
	"tax_exempt" boolean DEFAULT false NOT NULL,
	CONSTRAINT "store_settings_singleton_unique" UNIQUE("singleton"),
	CONSTRAINT "store_settings_singleton" CHECK ("store_settings"."singleton")
);
--> statement-breakpoint
CREATE TABLE "shipping_country" (
	"country" uuid PRIMARY KEY NOT NULL
);
--> statement-breakpoint
ALTER TABLE "shipping_country" ADD CONSTRAINT "shipping_country_country_country_id_fk" FOREIGN KEY ("country") REFERENCES "public"."country"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint

-- Reprise des données AVANT suppression des colonnes (ADR-0034). Ajouté à la main : drizzle-kit
-- produit du DDL, pas de transfert — sans ces deux ordres, les préfixes de facturation, le
-- compteur de factures en cours et la liste des pays livrables seraient perdus.
INSERT INTO "store_settings" ("document_prefix", "document_next_number", "invoice_prefix", "invoice_next_number", "tax_exempt")
SELECT "document_prefix", "document_next_number", "invoice_prefix", "invoice_next_number", "tax_exempt"
FROM "company" LIMIT 1;--> statement-breakpoint
INSERT INTO "shipping_country" ("country")
SELECT "id" FROM "country" WHERE "is_shipping_enabled";--> statement-breakpoint

ALTER TABLE "company" DROP COLUMN "document_prefix";--> statement-breakpoint
ALTER TABLE "company" DROP COLUMN "document_next_number";--> statement-breakpoint
ALTER TABLE "company" DROP COLUMN "invoice_prefix";--> statement-breakpoint
ALTER TABLE "company" DROP COLUMN "invoice_next_number";--> statement-breakpoint
ALTER TABLE "company" DROP COLUMN "tax_exempt";--> statement-breakpoint
ALTER TABLE "country" DROP COLUMN "is_shipping_enabled";