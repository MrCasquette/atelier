CREATE TABLE "entity_definition" (
	"name" varchar(48) PRIMARY KEY NOT NULL,
	"label" varchar(200),
	"icon" varchar(100),
	"singleton" boolean DEFAULT false NOT NULL,
	"fields" jsonb NOT NULL,
	"date_created" timestamp with time zone DEFAULT now() NOT NULL,
	"date_updated" timestamp with time zone DEFAULT now() NOT NULL
);
