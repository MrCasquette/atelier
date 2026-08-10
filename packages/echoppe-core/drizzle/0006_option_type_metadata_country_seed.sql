CREATE TYPE "public"."option_type" AS ENUM('string', 'color');--> statement-breakpoint
ALTER TABLE "option" ADD COLUMN "type" "option_type" DEFAULT 'string' NOT NULL;--> statement-breakpoint
ALTER TABLE "option_value" ADD COLUMN "metadata" jsonb;--> statement-breakpoint
-- Référentiel prod minimal : France comme pays de livraison par défaut. Idempotent
-- (ON CONFLICT sur le code ISO unique). Le seed démo (dev-only) couvre le reste.
INSERT INTO "country" ("name", "code", "is_shipping_enabled") VALUES ('France', 'FR', true) ON CONFLICT ("code") DO NOTHING;