CREATE TYPE "public"."content_status" AS ENUM('draft', 'published');--> statement-breakpoint
CREATE TABLE "page" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"slug" varchar(150) NOT NULL,
	"title" varchar(200) NOT NULL,
	"seo_title" varchar(200),
	"seo_description" text,
	"status" "content_status" DEFAULT 'draft' NOT NULL,
	"date_created" timestamp with time zone DEFAULT now() NOT NULL,
	"date_updated" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "page_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "section" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"page" uuid NOT NULL,
	"name" varchar(150),
	"type" varchar(50) NOT NULL,
	"data" jsonb NOT NULL,
	"sort" integer DEFAULT 0 NOT NULL,
	"date_created" timestamp with time zone DEFAULT now() NOT NULL,
	"date_updated" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "section" ADD CONSTRAINT "section_page_page_id_fk" FOREIGN KEY ("page") REFERENCES "public"."page"("id") ON DELETE cascade ON UPDATE no action;