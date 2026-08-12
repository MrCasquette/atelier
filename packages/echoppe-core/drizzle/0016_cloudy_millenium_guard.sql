CREATE TABLE "user_password_token" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user" uuid NOT NULL,
	"token_hash" varchar(64) NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"used_at" timestamp with time zone,
	"date_created" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "user_password_token_token_hash_unique" UNIQUE("token_hash")
);
--> statement-breakpoint
ALTER TABLE "user_password_token" ADD CONSTRAINT "user_password_token_user_user_id_fk" FOREIGN KEY ("user") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "user_password_token_user_idx" ON "user_password_token" USING btree ("user");