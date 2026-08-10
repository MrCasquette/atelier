CREATE TABLE "product_related" (
	"product" uuid NOT NULL,
	"related_product" uuid NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	CONSTRAINT "product_related_product_related_product_pk" PRIMARY KEY("product","related_product")
);
--> statement-breakpoint
ALTER TABLE "product_related" ADD CONSTRAINT "product_related_product_product_id_fk" FOREIGN KEY ("product") REFERENCES "public"."product"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "product_related" ADD CONSTRAINT "product_related_related_product_product_id_fk" FOREIGN KEY ("related_product") REFERENCES "public"."product"("id") ON DELETE cascade ON UPDATE no action;