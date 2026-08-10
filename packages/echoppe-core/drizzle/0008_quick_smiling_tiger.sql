CREATE TABLE "product_tag" (
	"product" uuid NOT NULL,
	"tag" uuid NOT NULL,
	CONSTRAINT "product_tag_product_tag_pk" PRIMARY KEY("product","tag")
);
--> statement-breakpoint
CREATE TABLE "tag" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" varchar(50) NOT NULL,
	"slug" varchar(50) NOT NULL,
	CONSTRAINT "tag_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
ALTER TABLE "product_tag" ADD CONSTRAINT "product_tag_product_product_id_fk" FOREIGN KEY ("product") REFERENCES "public"."product"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "product_tag" ADD CONSTRAINT "product_tag_tag_tag_id_fk" FOREIGN KEY ("tag") REFERENCES "public"."tag"("id") ON DELETE cascade ON UPDATE no action;