CREATE TYPE "public"."personalization_field_type" AS ENUM('text', 'textarea');--> statement-breakpoint
CREATE TABLE "personalization_field" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"product" uuid NOT NULL,
	"label" varchar(100) NOT NULL,
	"type" "personalization_field_type" DEFAULT 'text' NOT NULL,
	"required" boolean DEFAULT false NOT NULL,
	"max_length" integer,
	"price_ht" numeric(10, 2) DEFAULT '0.00' NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
ALTER TABLE "cart_item" DROP CONSTRAINT "cart_item_cart_variant_unique";--> statement-breakpoint
ALTER TABLE "cart_item" ADD COLUMN "personalization" jsonb;--> statement-breakpoint
ALTER TABLE "product" ADD COLUMN "personalization_enabled" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "order_item" ADD COLUMN "personalization" jsonb;--> statement-breakpoint
ALTER TABLE "order_item" ADD COLUMN "addon_price_ht" numeric(10, 2) DEFAULT '0.00' NOT NULL;--> statement-breakpoint
ALTER TABLE "personalization_field" ADD CONSTRAINT "personalization_field_product_product_id_fk" FOREIGN KEY ("product") REFERENCES "public"."product"("id") ON DELETE cascade ON UPDATE no action;