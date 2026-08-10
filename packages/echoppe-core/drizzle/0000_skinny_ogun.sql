CREATE TYPE "public"."address_type" AS ENUM('billing', 'shipping');--> statement-breakpoint
CREATE TYPE "public"."cart_status" AS ENUM('active', 'converted', 'abandoned');--> statement-breakpoint
CREATE TYPE "public"."communication_provider" AS ENUM('resend', 'brevo', 'smtp');--> statement-breakpoint
CREATE TYPE "public"."document_type" AS ENUM('receipt', 'credit_note');--> statement-breakpoint
CREATE TYPE "public"."invoice_status" AS ENUM('pending', 'issued', 'cancelled');--> statement-breakpoint
CREATE TYPE "public"."invoice_type" AS ENUM('invoice', 'credit_note');--> statement-breakpoint
CREATE TYPE "public"."order_status" AS ENUM('pending', 'confirmed', 'processing', 'shipped', 'delivered', 'cancelled', 'refunded');--> statement-breakpoint
CREATE TYPE "public"."payment_provider" AS ENUM('stripe', 'paypal', 'bank_transfer', 'check');--> statement-breakpoint
CREATE TYPE "public"."payment_status" AS ENUM('pending', 'completed', 'failed', 'refunded');--> statement-breakpoint
CREATE TYPE "public"."product_status" AS ENUM('draft', 'published', 'archived');--> statement-breakpoint
CREATE TYPE "public"."role_scope" AS ENUM('admin', 'store');--> statement-breakpoint
CREATE TYPE "public"."shipment_status" AS ENUM('pending', 'label_created', 'shipped', 'in_transit', 'delivered', 'returned');--> statement-breakpoint
CREATE TYPE "public"."shipping_provider_type" AS ENUM('colissimo', 'mondialrelay', 'sendcloud');--> statement-breakpoint
CREATE TYPE "public"."stock_move_type" AS ENUM('sale', 'return', 'restock', 'adjustment', 'reservation');--> statement-breakpoint
CREATE TABLE "audit_log" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user" uuid,
	"action" varchar(100) NOT NULL,
	"entity_type" varchar(50),
	"entity_id" uuid,
	"data" jsonb,
	"ip_address" varchar(45),
	"date_created" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "company" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"shop_name" varchar(255) NOT NULL,
	"logo" uuid,
	"public_email" varchar(255) NOT NULL,
	"public_phone" varchar(20),
	"legal_name" varchar(255) NOT NULL,
	"legal_form" varchar(50),
	"siren" varchar(9),
	"siret" varchar(14),
	"tva_intra" varchar(20),
	"rcs_city" varchar(100),
	"share_capital" numeric(10, 2),
	"street" varchar(255) NOT NULL,
	"street_2" varchar(255),
	"postal_code" varchar(10) NOT NULL,
	"city" varchar(100) NOT NULL,
	"country" uuid NOT NULL,
	"document_prefix" varchar(10) DEFAULT 'REC' NOT NULL,
	"document_next_number" integer DEFAULT 1 NOT NULL,
	"invoice_prefix" varchar(10) DEFAULT 'FA' NOT NULL,
	"invoice_next_number" integer DEFAULT 1 NOT NULL,
	"tax_exempt" boolean DEFAULT false NOT NULL,
	"publisher_name" varchar(255),
	"hosting_provider" varchar(255),
	"hosting_address" varchar(500),
	"hosting_phone" varchar(20)
);
--> statement-breakpoint
CREATE TABLE "session" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"token" varchar(64) NOT NULL,
	"user" uuid NOT NULL,
	"ip_address" varchar(45),
	"user_agent" text,
	"expires_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "session_token_unique" UNIQUE("token")
);
--> statement-breakpoint
CREATE TABLE "user" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email" varchar(255) NOT NULL,
	"password_hash" varchar(255) NOT NULL,
	"first_name" varchar(100) NOT NULL,
	"last_name" varchar(100) NOT NULL,
	"role" uuid NOT NULL,
	"is_owner" boolean DEFAULT false NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"date_created" timestamp with time zone DEFAULT now() NOT NULL,
	"last_login" timestamp with time zone,
	CONSTRAINT "user_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE "permission" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"role" uuid NOT NULL,
	"resource" varchar(50) NOT NULL,
	"can_create" boolean DEFAULT false NOT NULL,
	"can_read" boolean DEFAULT false NOT NULL,
	"can_update" boolean DEFAULT false NOT NULL,
	"can_delete" boolean DEFAULT false NOT NULL,
	"self_only" boolean DEFAULT false NOT NULL,
	"locked" boolean DEFAULT false NOT NULL,
	CONSTRAINT "permission_role_resource_unique" UNIQUE("role","resource")
);
--> statement-breakpoint
CREATE TABLE "role" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" varchar(50) NOT NULL,
	"description" text,
	"scope" "role_scope" DEFAULT 'admin' NOT NULL,
	"is_system" boolean DEFAULT false NOT NULL,
	"date_created" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "cart" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"customer" uuid,
	"session_id" varchar(100),
	"status" "cart_status" DEFAULT 'active' NOT NULL,
	"date_created" timestamp with time zone DEFAULT now() NOT NULL,
	"date_updated" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "cart_item" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"cart" uuid NOT NULL,
	"variant" uuid NOT NULL,
	"quantity" integer NOT NULL,
	"date_added" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "cart_item_cart_variant_unique" UNIQUE("cart","variant")
);
--> statement-breakpoint
CREATE TABLE "category" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"parent" uuid,
	"name" varchar(100) NOT NULL,
	"slug" varchar(100) NOT NULL,
	"description" text,
	"image" uuid,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"is_visible" boolean DEFAULT true NOT NULL,
	CONSTRAINT "category_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "collection" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" varchar(100) NOT NULL,
	"slug" varchar(100) NOT NULL,
	"description" text,
	"image" uuid,
	"is_visible" boolean DEFAULT true NOT NULL,
	"date_created" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "collection_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "option" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" varchar(50) NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "option_value" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"option" uuid NOT NULL,
	"value" varchar(100) NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "product" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"category" uuid NOT NULL,
	"tax_rate" uuid NOT NULL,
	"name" varchar(255) NOT NULL,
	"slug" varchar(255) NOT NULL,
	"description" text,
	"status" "product_status" DEFAULT 'draft' NOT NULL,
	"date_created" timestamp with time zone DEFAULT now() NOT NULL,
	"date_updated" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "product_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "product_collection" (
	"product" uuid NOT NULL,
	"collection" uuid NOT NULL,
	CONSTRAINT "product_collection_product_collection_pk" PRIMARY KEY("product","collection")
);
--> statement-breakpoint
CREATE TABLE "product_media" (
	"product" uuid NOT NULL,
	"media" uuid NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"is_featured" boolean DEFAULT false NOT NULL,
	"featured_for_variant" uuid,
	CONSTRAINT "product_media_product_media_pk" PRIMARY KEY("product","media")
);
--> statement-breakpoint
CREATE TABLE "product_option" (
	"product" uuid NOT NULL,
	"option" uuid NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	CONSTRAINT "product_option_product_option_pk" PRIMARY KEY("product","option")
);
--> statement-breakpoint
CREATE TABLE "variant" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"product" uuid NOT NULL,
	"sku" varchar(50),
	"barcode" varchar(50),
	"price_ht" numeric(10, 2) NOT NULL,
	"compare_at_price_ht" numeric(10, 2),
	"cost_price" numeric(10, 2),
	"weight" numeric(10, 3),
	"length" numeric(10, 2),
	"width" numeric(10, 2),
	"height" numeric(10, 2),
	"is_default" boolean DEFAULT false NOT NULL,
	"status" "product_status" DEFAULT 'draft' NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"quantity" integer DEFAULT 0 NOT NULL,
	"low_stock_threshold" integer DEFAULT 5,
	CONSTRAINT "variant_sku_unique" UNIQUE("sku")
);
--> statement-breakpoint
CREATE TABLE "variant_option_value" (
	"variant" uuid NOT NULL,
	"option_value" uuid NOT NULL,
	CONSTRAINT "variant_option_value_variant_option_value_pk" PRIMARY KEY("variant","option_value")
);
--> statement-breakpoint
CREATE TABLE "communication_log" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"provider" "communication_provider" NOT NULL,
	"channel" varchar(20) DEFAULT 'email' NOT NULL,
	"template" varchar(50) NOT NULL,
	"recipient" varchar(255) NOT NULL,
	"subject" varchar(255),
	"status" varchar(20) NOT NULL,
	"provider_message_id" varchar(255),
	"error" text,
	"metadata" jsonb,
	"date_created" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "communication_provider_config" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"provider" "communication_provider" NOT NULL,
	"is_enabled" boolean DEFAULT false NOT NULL,
	"credentials" text,
	"from_email" varchar(255),
	"from_name" varchar(255),
	"reply_to" varchar(255),
	"date_created" timestamp with time zone DEFAULT now() NOT NULL,
	"date_updated" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "communication_provider_config_provider_unique" UNIQUE("provider")
);
--> statement-breakpoint
CREATE TABLE "address" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"customer" uuid NOT NULL,
	"type" "address_type" NOT NULL,
	"label" varchar(50),
	"first_name" varchar(100) NOT NULL,
	"last_name" varchar(100) NOT NULL,
	"company" varchar(100),
	"street" varchar(255) NOT NULL,
	"street_2" varchar(255),
	"postal_code" varchar(10) NOT NULL,
	"city" varchar(100) NOT NULL,
	"country" uuid NOT NULL,
	"phone" varchar(20),
	"is_default" boolean DEFAULT false NOT NULL
);
--> statement-breakpoint
CREATE TABLE "customer" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email" varchar(255) NOT NULL,
	"password_hash" varchar(255) NOT NULL,
	"first_name" varchar(100) NOT NULL,
	"last_name" varchar(100) NOT NULL,
	"phone" varchar(20),
	"avatar" uuid,
	"email_verified" boolean DEFAULT false NOT NULL,
	"marketing_optin" boolean DEFAULT false NOT NULL,
	"date_created" timestamp with time zone DEFAULT now() NOT NULL,
	"date_updated" timestamp with time zone DEFAULT now() NOT NULL,
	"last_login" timestamp with time zone,
	CONSTRAINT "customer_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE "customer_session" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"token" varchar(64) NOT NULL,
	"customer" uuid NOT NULL,
	"ip_address" varchar(45),
	"user_agent" text,
	"expires_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "customer_session_token_unique" UNIQUE("token")
);
--> statement-breakpoint
CREATE TABLE "wishlist_item" (
	"customer" uuid NOT NULL,
	"variant" uuid NOT NULL,
	"date_added" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "wishlist_item_customer_variant_pk" PRIMARY KEY("customer","variant")
);
--> statement-breakpoint
CREATE TABLE "invoice" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"order" uuid NOT NULL,
	"type" "invoice_type" NOT NULL,
	"number" varchar(20) NOT NULL,
	"status" "invoice_status" DEFAULT 'pending' NOT NULL,
	"pdf" uuid,
	"seller_snapshot" jsonb NOT NULL,
	"buyer_snapshot" jsonb NOT NULL,
	"total_ht" numeric(10, 2) NOT NULL,
	"total_tax" numeric(10, 2) NOT NULL,
	"total_ttc" numeric(10, 2) NOT NULL,
	"tax_exempt_mention" varchar(255),
	"date_issued" timestamp with time zone DEFAULT now() NOT NULL,
	"date_due" timestamp with time zone,
	"date_created" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "order_document" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"order" uuid NOT NULL,
	"type" "document_type" NOT NULL,
	"number" varchar(20) NOT NULL,
	"pdf" uuid,
	"date_created" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "back_in_stock_request" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"variant" uuid NOT NULL,
	"customer" uuid NOT NULL,
	"date_created" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "back_in_stock_request_variant_customer_unique" UNIQUE("variant","customer")
);
--> statement-breakpoint
CREATE TABLE "review" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"product" uuid NOT NULL,
	"customer" uuid NOT NULL,
	"rating" integer NOT NULL,
	"title" varchar(255),
	"content" text,
	"date_created" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "review_product_customer_unique" UNIQUE("product","customer")
);
--> statement-breakpoint
CREATE TABLE "folder" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"parent" uuid,
	"name" varchar(100) NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "media" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"folder" uuid,
	"filename_disk" varchar(255) NOT NULL,
	"filename_original" varchar(255) NOT NULL,
	"title" varchar(255),
	"description" text,
	"alt" varchar(255),
	"mime_type" varchar(100) NOT NULL,
	"size" integer NOT NULL,
	"width" integer,
	"height" integer,
	"date_created" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "order" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"order_number" varchar(20) NOT NULL,
	"customer" uuid NOT NULL,
	"status" "order_status" DEFAULT 'pending' NOT NULL,
	"shipping_address" jsonb NOT NULL,
	"billing_address" jsonb NOT NULL,
	"subtotal_ht" numeric(10, 2) NOT NULL,
	"shipping_ht" numeric(10, 2) DEFAULT '0' NOT NULL,
	"discount_ht" numeric(10, 2) DEFAULT '0' NOT NULL,
	"total_ht" numeric(10, 2) NOT NULL,
	"total_tax" numeric(10, 2) NOT NULL,
	"total_ttc" numeric(10, 2) NOT NULL,
	"customer_note" text,
	"internal_note" text,
	"date_created" timestamp with time zone DEFAULT now() NOT NULL,
	"date_updated" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "order_order_number_unique" UNIQUE("order_number")
);
--> statement-breakpoint
CREATE TABLE "order_item" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"order" uuid NOT NULL,
	"variant" uuid,
	"label" varchar(255) NOT NULL,
	"quantity" integer NOT NULL,
	"unit_price_ht" numeric(10, 2) NOT NULL,
	"tax_rate" numeric(5, 2) NOT NULL,
	"total_ht" numeric(10, 2) NOT NULL,
	"total_ttc" numeric(10, 2) NOT NULL
);
--> statement-breakpoint
CREATE TABLE "payment" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"order" uuid NOT NULL,
	"provider" "payment_provider" NOT NULL,
	"status" "payment_status" DEFAULT 'pending' NOT NULL,
	"amount" numeric(10, 2) NOT NULL,
	"provider_transaction_id" varchar(255),
	"date_created" timestamp with time zone DEFAULT now() NOT NULL,
	"date_updated" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "payment_order_unique" UNIQUE("order")
);
--> statement-breakpoint
CREATE TABLE "payment_event" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"payment" uuid NOT NULL,
	"type" varchar(50) NOT NULL,
	"data" jsonb,
	"date_created" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "payment_provider_config" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"provider" "payment_provider" NOT NULL,
	"is_enabled" boolean DEFAULT false NOT NULL,
	"credentials" text,
	"date_created" timestamp with time zone DEFAULT now() NOT NULL,
	"date_updated" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "payment_provider_config_provider_unique" UNIQUE("provider")
);
--> statement-breakpoint
CREATE TABLE "country" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" varchar(100) NOT NULL,
	"code" char(2) NOT NULL,
	"is_shipping_enabled" boolean DEFAULT true NOT NULL,
	CONSTRAINT "country_code_unique" UNIQUE("code")
);
--> statement-breakpoint
CREATE TABLE "tax_rate" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" varchar(50) NOT NULL,
	"rate" numeric(5, 2) NOT NULL,
	"is_default" boolean DEFAULT false NOT NULL,
	"mention" varchar(255),
	CONSTRAINT "tax_rate_name_unique" UNIQUE("name")
);
--> statement-breakpoint
CREATE TABLE "shipment" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"order" uuid NOT NULL,
	"provider" uuid NOT NULL,
	"status" "shipment_status" DEFAULT 'pending' NOT NULL,
	"tracking_number" varchar(100),
	"tracking_url" varchar(500),
	"weight" numeric(10, 3),
	"shipped_at" timestamp with time zone,
	"delivered_at" timestamp with time zone,
	"date_created" timestamp with time zone DEFAULT now() NOT NULL,
	"date_updated" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "shipment_order_unique" UNIQUE("order")
);
--> statement-breakpoint
CREATE TABLE "shipping_provider" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" varchar(50) NOT NULL,
	"type" varchar(50) NOT NULL,
	"is_enabled" boolean DEFAULT true NOT NULL
);
--> statement-breakpoint
CREATE TABLE "shipping_provider_config" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"provider" "shipping_provider_type" NOT NULL,
	"is_enabled" boolean DEFAULT false NOT NULL,
	"credentials" text,
	"date_created" timestamp with time zone DEFAULT now() NOT NULL,
	"date_updated" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "shipping_provider_config_provider_unique" UNIQUE("provider")
);
--> statement-breakpoint
CREATE TABLE "stock_move" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"variant" uuid,
	"label" varchar(255) NOT NULL,
	"quantity" integer NOT NULL,
	"type" "stock_move_type" NOT NULL,
	"reference" uuid,
	"note" text,
	"date_created" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "audit_log" ADD CONSTRAINT "audit_log_user_user_id_fk" FOREIGN KEY ("user") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "company" ADD CONSTRAINT "company_logo_media_id_fk" FOREIGN KEY ("logo") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "company" ADD CONSTRAINT "company_country_country_id_fk" FOREIGN KEY ("country") REFERENCES "public"."country"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "session" ADD CONSTRAINT "session_user_user_id_fk" FOREIGN KEY ("user") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user" ADD CONSTRAINT "user_role_role_id_fk" FOREIGN KEY ("role") REFERENCES "public"."role"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "permission" ADD CONSTRAINT "permission_role_role_id_fk" FOREIGN KEY ("role") REFERENCES "public"."role"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cart" ADD CONSTRAINT "cart_customer_customer_id_fk" FOREIGN KEY ("customer") REFERENCES "public"."customer"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cart_item" ADD CONSTRAINT "cart_item_cart_cart_id_fk" FOREIGN KEY ("cart") REFERENCES "public"."cart"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cart_item" ADD CONSTRAINT "cart_item_variant_variant_id_fk" FOREIGN KEY ("variant") REFERENCES "public"."variant"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "category" ADD CONSTRAINT "category_parent_category_id_fk" FOREIGN KEY ("parent") REFERENCES "public"."category"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "category" ADD CONSTRAINT "category_image_media_id_fk" FOREIGN KEY ("image") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "collection" ADD CONSTRAINT "collection_image_media_id_fk" FOREIGN KEY ("image") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "option_value" ADD CONSTRAINT "option_value_option_option_id_fk" FOREIGN KEY ("option") REFERENCES "public"."option"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "product" ADD CONSTRAINT "product_category_category_id_fk" FOREIGN KEY ("category") REFERENCES "public"."category"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "product" ADD CONSTRAINT "product_tax_rate_tax_rate_id_fk" FOREIGN KEY ("tax_rate") REFERENCES "public"."tax_rate"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "product_collection" ADD CONSTRAINT "product_collection_product_product_id_fk" FOREIGN KEY ("product") REFERENCES "public"."product"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "product_collection" ADD CONSTRAINT "product_collection_collection_collection_id_fk" FOREIGN KEY ("collection") REFERENCES "public"."collection"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "product_media" ADD CONSTRAINT "product_media_product_product_id_fk" FOREIGN KEY ("product") REFERENCES "public"."product"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "product_media" ADD CONSTRAINT "product_media_media_media_id_fk" FOREIGN KEY ("media") REFERENCES "public"."media"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "product_media" ADD CONSTRAINT "product_media_featured_for_variant_variant_id_fk" FOREIGN KEY ("featured_for_variant") REFERENCES "public"."variant"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "product_option" ADD CONSTRAINT "product_option_product_product_id_fk" FOREIGN KEY ("product") REFERENCES "public"."product"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "product_option" ADD CONSTRAINT "product_option_option_option_id_fk" FOREIGN KEY ("option") REFERENCES "public"."option"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "variant" ADD CONSTRAINT "variant_product_product_id_fk" FOREIGN KEY ("product") REFERENCES "public"."product"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "variant_option_value" ADD CONSTRAINT "variant_option_value_variant_variant_id_fk" FOREIGN KEY ("variant") REFERENCES "public"."variant"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "variant_option_value" ADD CONSTRAINT "variant_option_value_option_value_option_value_id_fk" FOREIGN KEY ("option_value") REFERENCES "public"."option_value"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "address" ADD CONSTRAINT "address_customer_customer_id_fk" FOREIGN KEY ("customer") REFERENCES "public"."customer"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "address" ADD CONSTRAINT "address_country_country_id_fk" FOREIGN KEY ("country") REFERENCES "public"."country"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "customer" ADD CONSTRAINT "customer_avatar_media_id_fk" FOREIGN KEY ("avatar") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "customer_session" ADD CONSTRAINT "customer_session_customer_customer_id_fk" FOREIGN KEY ("customer") REFERENCES "public"."customer"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "wishlist_item" ADD CONSTRAINT "wishlist_item_customer_customer_id_fk" FOREIGN KEY ("customer") REFERENCES "public"."customer"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "wishlist_item" ADD CONSTRAINT "wishlist_item_variant_variant_id_fk" FOREIGN KEY ("variant") REFERENCES "public"."variant"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invoice" ADD CONSTRAINT "invoice_order_order_id_fk" FOREIGN KEY ("order") REFERENCES "public"."order"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invoice" ADD CONSTRAINT "invoice_pdf_media_id_fk" FOREIGN KEY ("pdf") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "order_document" ADD CONSTRAINT "order_document_order_order_id_fk" FOREIGN KEY ("order") REFERENCES "public"."order"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "order_document" ADD CONSTRAINT "order_document_pdf_media_id_fk" FOREIGN KEY ("pdf") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "back_in_stock_request" ADD CONSTRAINT "back_in_stock_request_variant_variant_id_fk" FOREIGN KEY ("variant") REFERENCES "public"."variant"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "back_in_stock_request" ADD CONSTRAINT "back_in_stock_request_customer_customer_id_fk" FOREIGN KEY ("customer") REFERENCES "public"."customer"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "review" ADD CONSTRAINT "review_product_product_id_fk" FOREIGN KEY ("product") REFERENCES "public"."product"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "review" ADD CONSTRAINT "review_customer_customer_id_fk" FOREIGN KEY ("customer") REFERENCES "public"."customer"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "folder" ADD CONSTRAINT "folder_parent_folder_id_fk" FOREIGN KEY ("parent") REFERENCES "public"."folder"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "media" ADD CONSTRAINT "media_folder_folder_id_fk" FOREIGN KEY ("folder") REFERENCES "public"."folder"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "order" ADD CONSTRAINT "order_customer_customer_id_fk" FOREIGN KEY ("customer") REFERENCES "public"."customer"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "order_item" ADD CONSTRAINT "order_item_order_order_id_fk" FOREIGN KEY ("order") REFERENCES "public"."order"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "order_item" ADD CONSTRAINT "order_item_variant_variant_id_fk" FOREIGN KEY ("variant") REFERENCES "public"."variant"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payment" ADD CONSTRAINT "payment_order_order_id_fk" FOREIGN KEY ("order") REFERENCES "public"."order"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payment_event" ADD CONSTRAINT "payment_event_payment_payment_id_fk" FOREIGN KEY ("payment") REFERENCES "public"."payment"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "shipment" ADD CONSTRAINT "shipment_order_order_id_fk" FOREIGN KEY ("order") REFERENCES "public"."order"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "shipment" ADD CONSTRAINT "shipment_provider_shipping_provider_id_fk" FOREIGN KEY ("provider") REFERENCES "public"."shipping_provider"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stock_move" ADD CONSTRAINT "stock_move_variant_variant_id_fk" FOREIGN KEY ("variant") REFERENCES "public"."variant"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "session_user_idx" ON "session" USING btree ("user");--> statement-breakpoint
CREATE INDEX "session_token_idx" ON "session" USING btree ("token");--> statement-breakpoint
CREATE UNIQUE INDEX "option_name_unique_ci" ON "option" USING btree (lower("name"));--> statement-breakpoint
CREATE UNIQUE INDEX "option_value_unique_ci" ON "option_value" USING btree ("option",lower("value"));--> statement-breakpoint
CREATE UNIQUE INDEX "product_media_featured_unique" ON "product_media" USING btree ("product") WHERE "product_media"."is_featured" = true;--> statement-breakpoint
CREATE UNIQUE INDEX "product_media_variant_unique" ON "product_media" USING btree ("featured_for_variant") WHERE "product_media"."featured_for_variant" IS NOT NULL;--> statement-breakpoint
CREATE INDEX "customer_session_customer_idx" ON "customer_session" USING btree ("customer");--> statement-breakpoint
CREATE INDEX "customer_session_token_idx" ON "customer_session" USING btree ("token");