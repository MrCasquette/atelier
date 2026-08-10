CREATE TABLE "content_definition" (
	"name" varchar(150) PRIMARY KEY NOT NULL,
	"role" varchar(20) NOT NULL,
	"label" varchar(200),
	"icon" varchar(100),
	"fields" jsonb NOT NULL,
	"date_updated" timestamp with time zone DEFAULT now() NOT NULL
);
