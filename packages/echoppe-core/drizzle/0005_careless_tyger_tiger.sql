CREATE TABLE "menu" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"handle" varchar(100) NOT NULL,
	"label" varchar(200) NOT NULL,
	"items" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"date_created" timestamp with time zone DEFAULT now() NOT NULL,
	"date_updated" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "menu_handle_unique" UNIQUE("handle")
);
