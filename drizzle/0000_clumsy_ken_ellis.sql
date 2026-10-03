CREATE TYPE "public"."movement_type" AS ENUM('INITIAL', 'PURCHASE', 'SALE', 'CUSTOMER_RETURN', 'SUPPLIER_RETURN', 'DAMAGE', 'LOST', 'ADJUSTMENT');--> statement-breakpoint
CREATE TYPE "public"."notification_type" AS ENUM('LOW_STOCK', 'OUT_OF_STOCK', 'SUPPLIER_PAYMENT', 'INFO');--> statement-breakpoint
CREATE TYPE "public"."payment_method" AS ENUM('CASH', 'BANK', 'CREDIT', 'OTHER');--> statement-breakpoint
CREATE TYPE "public"."payment_status" AS ENUM('PAID', 'PARTIAL', 'PENDING');--> statement-breakpoint
CREATE TYPE "public"."return_type" AS ENUM('CUSTOMER', 'SUPPLIER');--> statement-breakpoint
CREATE TYPE "public"."user_role" AS ENUM('OWNER', 'STAFF');--> statement-breakpoint
CREATE TABLE "audit_logs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"shop_id" text NOT NULL,
	"user_id" uuid,
	"action" text NOT NULL,
	"entity" text NOT NULL,
	"entity_id" text,
	"old_value" jsonb,
	"new_value" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "brands" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"shop_id" text NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "categories" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"shop_id" text NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "customers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"shop_id" text NOT NULL,
	"name" text NOT NULL,
	"phone" text,
	"address" text,
	"vehicle" text,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "notifications" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"shop_id" text NOT NULL,
	"type" "notification_type" DEFAULT 'INFO' NOT NULL,
	"title" text NOT NULL,
	"message" text,
	"link" text,
	"is_read" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "product_vehicles" (
	"product_id" uuid NOT NULL,
	"vehicle_id" uuid NOT NULL,
	"shop_id" text NOT NULL,
	CONSTRAINT "product_vehicles_product_id_vehicle_id_pk" PRIMARY KEY("product_id","vehicle_id")
);
--> statement-breakpoint
CREATE TABLE "products" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"shop_id" text NOT NULL,
	"internal_code" text,
	"name" text NOT NULL,
	"sku" text,
	"part_number" text,
	"oem_number" text,
	"barcode" text,
	"category_id" uuid,
	"brand_id" uuid,
	"supplier_id" uuid,
	"purchase_price" integer DEFAULT 0 NOT NULL,
	"sale_price" integer DEFAULT 0 NOT NULL,
	"current_stock" integer DEFAULT 0 NOT NULL,
	"min_stock" integer DEFAULT 0 NOT NULL,
	"max_stock" integer,
	"reorder_qty" integer DEFAULT 0 NOT NULL,
	"rack" text,
	"shelf" text,
	"bin" text,
	"image_url" text,
	"description" text,
	"active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "purchase_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"purchase_id" uuid NOT NULL,
	"product_id" uuid NOT NULL,
	"quantity" integer NOT NULL,
	"purchase_price" integer NOT NULL,
	"discount" integer DEFAULT 0 NOT NULL,
	"total" integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE "purchases" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"shop_id" text NOT NULL,
	"supplier_id" uuid,
	"invoice_number" text NOT NULL,
	"purchase_date" timestamp with time zone DEFAULT now() NOT NULL,
	"subtotal" integer DEFAULT 0 NOT NULL,
	"discount" integer DEFAULT 0 NOT NULL,
	"total" integer DEFAULT 0 NOT NULL,
	"paid_amount" integer DEFAULT 0 NOT NULL,
	"remaining" integer DEFAULT 0 NOT NULL,
	"payment_status" "payment_status" DEFAULT 'PENDING' NOT NULL,
	"notes" text,
	"created_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "return_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"return_id" uuid NOT NULL,
	"product_id" uuid NOT NULL,
	"quantity" integer NOT NULL,
	"unit_price" integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE "returns" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"shop_id" text NOT NULL,
	"type" "return_type" NOT NULL,
	"return_date" timestamp with time zone DEFAULT now() NOT NULL,
	"customer_id" uuid,
	"supplier_id" uuid,
	"sale_id" uuid,
	"purchase_id" uuid,
	"subtotal" integer DEFAULT 0 NOT NULL,
	"notes" text,
	"created_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sale_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"sale_id" uuid NOT NULL,
	"product_id" uuid NOT NULL,
	"quantity" integer NOT NULL,
	"sale_price" integer NOT NULL,
	"purchase_cost" integer DEFAULT 0 NOT NULL,
	"discount" integer DEFAULT 0 NOT NULL,
	"total" integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sales" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"shop_id" text NOT NULL,
	"invoice_number" text NOT NULL,
	"sale_date" timestamp with time zone DEFAULT now() NOT NULL,
	"customer_id" uuid,
	"subtotal" integer DEFAULT 0 NOT NULL,
	"discount" integer DEFAULT 0 NOT NULL,
	"total" integer DEFAULT 0 NOT NULL,
	"paid_amount" integer DEFAULT 0 NOT NULL,
	"remaining" integer DEFAULT 0 NOT NULL,
	"payment_method" "payment_method" DEFAULT 'CASH' NOT NULL,
	"payment_status" "payment_status" DEFAULT 'PAID' NOT NULL,
	"notes" text,
	"created_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "settings" (
	"shop_id" text PRIMARY KEY NOT NULL,
	"shop_name" text DEFAULT 'Asim Autos' NOT NULL,
	"phone" text,
	"address" text,
	"city" text DEFAULT 'Faisalabad' NOT NULL,
	"currency" text DEFAULT 'PKR' NOT NULL,
	"logo_url" text,
	"invoice_prefix" text DEFAULT 'INV' NOT NULL,
	"tax_rate_bps" integer DEFAULT 0 NOT NULL,
	"default_min_stock" integer DEFAULT 5 NOT NULL,
	"default_reorder_qty" integer DEFAULT 10 NOT NULL,
	"next_sale_invoice" integer DEFAULT 1 NOT NULL,
	"business_hours" text,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "shops" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"city" text,
	"phone" text,
	"address" text,
	"currency" text DEFAULT 'PKR' NOT NULL,
	"invoice_prefix" text DEFAULT 'INV' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "stock_movements" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"shop_id" text NOT NULL,
	"product_id" uuid NOT NULL,
	"previous_qty" integer NOT NULL,
	"change_qty" integer NOT NULL,
	"new_qty" integer NOT NULL,
	"type" "movement_type" NOT NULL,
	"reference_id" text,
	"reference_type" text,
	"user_id" uuid,
	"note" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "suppliers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"shop_id" text NOT NULL,
	"name" text NOT NULL,
	"contact_person" text,
	"phone" text,
	"whatsapp" text,
	"email" text,
	"address" text,
	"city" text,
	"payment_terms" text,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"shop_id" text NOT NULL,
	"name" text NOT NULL,
	"email" text NOT NULL,
	"password_hash" text NOT NULL,
	"role" "user_role" DEFAULT 'STAFF' NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "vehicles" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"shop_id" text NOT NULL,
	"make" text NOT NULL,
	"model" text NOT NULL,
	"variant" text,
	"year_from" integer,
	"year_to" integer,
	"engine" text,
	"fuel_type" text,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_shop_id_shops_id_fk" FOREIGN KEY ("shop_id") REFERENCES "public"."shops"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "brands" ADD CONSTRAINT "brands_shop_id_shops_id_fk" FOREIGN KEY ("shop_id") REFERENCES "public"."shops"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "categories" ADD CONSTRAINT "categories_shop_id_shops_id_fk" FOREIGN KEY ("shop_id") REFERENCES "public"."shops"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "customers" ADD CONSTRAINT "customers_shop_id_shops_id_fk" FOREIGN KEY ("shop_id") REFERENCES "public"."shops"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_shop_id_shops_id_fk" FOREIGN KEY ("shop_id") REFERENCES "public"."shops"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "product_vehicles" ADD CONSTRAINT "product_vehicles_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "product_vehicles" ADD CONSTRAINT "product_vehicles_vehicle_id_vehicles_id_fk" FOREIGN KEY ("vehicle_id") REFERENCES "public"."vehicles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "product_vehicles" ADD CONSTRAINT "product_vehicles_shop_id_shops_id_fk" FOREIGN KEY ("shop_id") REFERENCES "public"."shops"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "products" ADD CONSTRAINT "products_shop_id_shops_id_fk" FOREIGN KEY ("shop_id") REFERENCES "public"."shops"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "products" ADD CONSTRAINT "products_category_id_categories_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."categories"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "products" ADD CONSTRAINT "products_brand_id_brands_id_fk" FOREIGN KEY ("brand_id") REFERENCES "public"."brands"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "products" ADD CONSTRAINT "products_supplier_id_suppliers_id_fk" FOREIGN KEY ("supplier_id") REFERENCES "public"."suppliers"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "purchase_items" ADD CONSTRAINT "purchase_items_purchase_id_purchases_id_fk" FOREIGN KEY ("purchase_id") REFERENCES "public"."purchases"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "purchase_items" ADD CONSTRAINT "purchase_items_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "purchases" ADD CONSTRAINT "purchases_shop_id_shops_id_fk" FOREIGN KEY ("shop_id") REFERENCES "public"."shops"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "purchases" ADD CONSTRAINT "purchases_supplier_id_suppliers_id_fk" FOREIGN KEY ("supplier_id") REFERENCES "public"."suppliers"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "purchases" ADD CONSTRAINT "purchases_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "return_items" ADD CONSTRAINT "return_items_return_id_returns_id_fk" FOREIGN KEY ("return_id") REFERENCES "public"."returns"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "return_items" ADD CONSTRAINT "return_items_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "returns" ADD CONSTRAINT "returns_shop_id_shops_id_fk" FOREIGN KEY ("shop_id") REFERENCES "public"."shops"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "returns" ADD CONSTRAINT "returns_customer_id_customers_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "returns" ADD CONSTRAINT "returns_supplier_id_suppliers_id_fk" FOREIGN KEY ("supplier_id") REFERENCES "public"."suppliers"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "returns" ADD CONSTRAINT "returns_sale_id_sales_id_fk" FOREIGN KEY ("sale_id") REFERENCES "public"."sales"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "returns" ADD CONSTRAINT "returns_purchase_id_purchases_id_fk" FOREIGN KEY ("purchase_id") REFERENCES "public"."purchases"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "returns" ADD CONSTRAINT "returns_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sale_items" ADD CONSTRAINT "sale_items_sale_id_sales_id_fk" FOREIGN KEY ("sale_id") REFERENCES "public"."sales"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sale_items" ADD CONSTRAINT "sale_items_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sales" ADD CONSTRAINT "sales_shop_id_shops_id_fk" FOREIGN KEY ("shop_id") REFERENCES "public"."shops"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sales" ADD CONSTRAINT "sales_customer_id_customers_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sales" ADD CONSTRAINT "sales_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "settings" ADD CONSTRAINT "settings_shop_id_shops_id_fk" FOREIGN KEY ("shop_id") REFERENCES "public"."shops"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stock_movements" ADD CONSTRAINT "stock_movements_shop_id_shops_id_fk" FOREIGN KEY ("shop_id") REFERENCES "public"."shops"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stock_movements" ADD CONSTRAINT "stock_movements_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stock_movements" ADD CONSTRAINT "stock_movements_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "suppliers" ADD CONSTRAINT "suppliers_shop_id_shops_id_fk" FOREIGN KEY ("shop_id") REFERENCES "public"."shops"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "users" ADD CONSTRAINT "users_shop_id_shops_id_fk" FOREIGN KEY ("shop_id") REFERENCES "public"."shops"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vehicles" ADD CONSTRAINT "vehicles_shop_id_shops_id_fk" FOREIGN KEY ("shop_id") REFERENCES "public"."shops"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "audit_logs_shop_idx" ON "audit_logs" USING btree ("shop_id","created_at");--> statement-breakpoint
CREATE INDEX "audit_logs_shop_entity_idx" ON "audit_logs" USING btree ("shop_id","entity");--> statement-breakpoint
CREATE UNIQUE INDEX "brands_shop_name_unique" ON "brands" USING btree ("shop_id","name");--> statement-breakpoint
CREATE INDEX "brands_shop_idx" ON "brands" USING btree ("shop_id");--> statement-breakpoint
CREATE UNIQUE INDEX "categories_shop_name_unique" ON "categories" USING btree ("shop_id","name");--> statement-breakpoint
CREATE INDEX "categories_shop_idx" ON "categories" USING btree ("shop_id");--> statement-breakpoint
CREATE INDEX "customers_shop_idx" ON "customers" USING btree ("shop_id");--> statement-breakpoint
CREATE INDEX "customers_shop_name_idx" ON "customers" USING btree ("shop_id","name");--> statement-breakpoint
CREATE INDEX "customers_shop_phone_idx" ON "customers" USING btree ("shop_id","phone");--> statement-breakpoint
CREATE INDEX "notifications_shop_read_idx" ON "notifications" USING btree ("shop_id","is_read","created_at");--> statement-breakpoint
CREATE INDEX "product_vehicles_shop_idx" ON "product_vehicles" USING btree ("shop_id");--> statement-breakpoint
CREATE INDEX "product_vehicles_vehicle_idx" ON "product_vehicles" USING btree ("vehicle_id");--> statement-breakpoint
CREATE UNIQUE INDEX "products_shop_sku_unique" ON "products" USING btree ("shop_id","sku");--> statement-breakpoint
CREATE UNIQUE INDEX "products_shop_barcode_unique" ON "products" USING btree ("shop_id","barcode");--> statement-breakpoint
CREATE INDEX "products_shop_name_idx" ON "products" USING btree ("shop_id","name");--> statement-breakpoint
CREATE INDEX "products_part_number_idx" ON "products" USING btree ("shop_id","part_number");--> statement-breakpoint
CREATE INDEX "products_oem_number_idx" ON "products" USING btree ("shop_id","oem_number");--> statement-breakpoint
CREATE INDEX "products_shop_stock_idx" ON "products" USING btree ("shop_id","current_stock");--> statement-breakpoint
CREATE INDEX "products_shop_category_idx" ON "products" USING btree ("shop_id","category_id");--> statement-breakpoint
CREATE INDEX "products_shop_brand_idx" ON "products" USING btree ("shop_id","brand_id");--> statement-breakpoint
CREATE INDEX "products_shop_supplier_idx" ON "products" USING btree ("shop_id","supplier_id");--> statement-breakpoint
CREATE INDEX "purchase_items_purchase_idx" ON "purchase_items" USING btree ("purchase_id");--> statement-breakpoint
CREATE UNIQUE INDEX "purchases_shop_invoice_unique" ON "purchases" USING btree ("shop_id","invoice_number");--> statement-breakpoint
CREATE INDEX "purchases_shop_idx" ON "purchases" USING btree ("shop_id");--> statement-breakpoint
CREATE INDEX "purchases_shop_supplier_idx" ON "purchases" USING btree ("shop_id","supplier_id");--> statement-breakpoint
CREATE INDEX "purchases_shop_date_idx" ON "purchases" USING btree ("shop_id","purchase_date");--> statement-breakpoint
CREATE INDEX "return_items_return_idx" ON "return_items" USING btree ("return_id");--> statement-breakpoint
CREATE INDEX "returns_shop_idx" ON "returns" USING btree ("shop_id");--> statement-breakpoint
CREATE INDEX "returns_shop_date_idx" ON "returns" USING btree ("shop_id","return_date");--> statement-breakpoint
CREATE INDEX "returns_shop_type_idx" ON "returns" USING btree ("shop_id","type");--> statement-breakpoint
CREATE INDEX "sale_items_sale_idx" ON "sale_items" USING btree ("sale_id");--> statement-breakpoint
CREATE UNIQUE INDEX "sales_shop_invoice_unique" ON "sales" USING btree ("shop_id","invoice_number");--> statement-breakpoint
CREATE INDEX "sales_shop_idx" ON "sales" USING btree ("shop_id");--> statement-breakpoint
CREATE INDEX "sales_shop_date_idx" ON "sales" USING btree ("shop_id","sale_date");--> statement-breakpoint
CREATE INDEX "sales_shop_customer_idx" ON "sales" USING btree ("shop_id","customer_id");--> statement-breakpoint
CREATE INDEX "stock_movements_shop_product_idx" ON "stock_movements" USING btree ("shop_id","product_id","created_at");--> statement-breakpoint
CREATE INDEX "stock_movements_shop_type_idx" ON "stock_movements" USING btree ("shop_id","type");--> statement-breakpoint
CREATE INDEX "stock_movements_shop_date_idx" ON "stock_movements" USING btree ("shop_id","created_at");--> statement-breakpoint
CREATE INDEX "suppliers_shop_idx" ON "suppliers" USING btree ("shop_id");--> statement-breakpoint
CREATE INDEX "suppliers_shop_name_idx" ON "suppliers" USING btree ("shop_id","name");--> statement-breakpoint
CREATE UNIQUE INDEX "users_email_unique" ON "users" USING btree ("email");--> statement-breakpoint
CREATE INDEX "users_shop_idx" ON "users" USING btree ("shop_id");--> statement-breakpoint
CREATE INDEX "vehicles_shop_idx" ON "vehicles" USING btree ("shop_id");--> statement-breakpoint
CREATE INDEX "vehicles_make_model_idx" ON "vehicles" USING btree ("shop_id","make","model");