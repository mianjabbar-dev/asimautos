/**
 * ASIM AUTOS — Database schema (Drizzle ORM, PostgreSQL)
 *
 * Conventions:
 * - Every shop-scoped table carries shopId (multi-tenant). All queries MUST filter by shopId.
 * - Money is stored as INTEGER paisa (1 PKR = 100 paisa). Never float.
 * - Stock is ONLY changed through the transaction helpers in src/lib/tx.ts,
 *   which write a stock_movements row for every change.
 */

import {
  pgTable,
  pgEnum,
  text,
  uuid,
  integer,
  boolean,
  timestamp,
  jsonb,
  index,
  uniqueIndex,
  primaryKey,
} from "drizzle-orm/pg-core";

/* ------------------------------------------------------------------ */
/* Enums                                                               */
/* ------------------------------------------------------------------ */

export const userRoleEnum = pgEnum("user_role", ["OWNER", "STAFF"]);

export const paymentStatusEnum = pgEnum("payment_status", [
  "PAID",
  "PARTIAL",
  "PENDING",
]);

export const paymentMethodEnum = pgEnum("payment_method", [
  "CASH",
  "BANK",
  "CREDIT",
  "OTHER",
]);

export const movementTypeEnum = pgEnum("movement_type", [
  "INITIAL",
  "PURCHASE",
  "SALE",
  "CUSTOMER_RETURN",
  "SUPPLIER_RETURN",
  "DAMAGE",
  "LOST",
  "ADJUSTMENT",
]);

export const returnTypeEnum = pgEnum("return_type", ["CUSTOMER", "SUPPLIER"]);

export const notificationTypeEnum = pgEnum("notification_type", [
  "LOW_STOCK",
  "OUT_OF_STOCK",
  "SUPPLIER_PAYMENT",
  "INFO",
]);

/* ------------------------------------------------------------------ */
/* Shops (tenants)                                                     */
/* ------------------------------------------------------------------ */

export const shops = pgTable("shops", {
  id: text("id").primaryKey(), // e.g. "ASIM001"
  name: text("name").notNull(),
  city: text("city"),
  phone: text("phone"),
  address: text("address"),
  currency: text("currency").notNull().default("PKR"),
  invoicePrefix: text("invoice_prefix").notNull().default("INV"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

/* ------------------------------------------------------------------ */
/* Users & roles                                                       */
/* ------------------------------------------------------------------ */

export const users = pgTable(
  "users",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    shopId: text("shop_id")
      .notNull()
      .references(() => shops.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    email: text("email").notNull(),
    passwordHash: text("password_hash").notNull(),
    role: userRoleEnum("role").notNull().default("STAFF"),
    active: boolean("active").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [
    uniqueIndex("users_email_unique").on(t.email),
    index("users_shop_idx").on(t.shopId),
  ]
);

/* ------------------------------------------------------------------ */
/* Catalog: categories, brands, vehicles                               */
/* ------------------------------------------------------------------ */

export const categories = pgTable(
  "categories",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    shopId: text("shop_id")
      .notNull()
      .references(() => shops.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    description: text("description"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [
    uniqueIndex("categories_shop_name_unique").on(t.shopId, t.name),
    index("categories_shop_idx").on(t.shopId),
  ]
);

export const brands = pgTable(
  "brands",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    shopId: text("shop_id")
      .notNull()
      .references(() => shops.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    description: text("description"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [
    uniqueIndex("brands_shop_name_unique").on(t.shopId, t.name),
    index("brands_shop_idx").on(t.shopId),
  ]
);

export const vehicles = pgTable(
  "vehicles",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    shopId: text("shop_id")
      .notNull()
      .references(() => shops.id, { onDelete: "cascade" }),
    make: text("make").notNull(),
    model: text("model").notNull(),
    variant: text("variant"),
    yearFrom: integer("year_from"),
    yearTo: integer("year_to"),
    engine: text("engine"),
    fuelType: text("fuel_type"),
    notes: text("notes"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [
    index("vehicles_shop_idx").on(t.shopId),
    index("vehicles_make_model_idx").on(t.shopId, t.make, t.model),
  ]
);

/* ------------------------------------------------------------------ */
/* Products                                                            */
/* ------------------------------------------------------------------ */

export const products = pgTable(
  "products",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    shopId: text("shop_id")
      .notNull()
      .references(() => shops.id, { onDelete: "cascade" }),
    internalCode: text("internal_code"),
    name: text("name").notNull(),
    sku: text("sku"),
    partNumber: text("part_number"),
    oemNumber: text("oem_number"),
    barcode: text("barcode"),
    categoryId: uuid("category_id").references(() => categories.id, {
      onDelete: "set null",
    }),
    brandId: uuid("brand_id").references(() => brands.id, {
      onDelete: "set null",
    }),
    supplierId: uuid("supplier_id").references(() => suppliers.id, {
      onDelete: "set null",
    }),
    purchasePrice: integer("purchase_price").notNull().default(0), // paisa
    salePrice: integer("sale_price").notNull().default(0), // paisa
    currentStock: integer("current_stock").notNull().default(0),
    minStock: integer("min_stock").notNull().default(0),
    maxStock: integer("max_stock"),
    reorderQty: integer("reorder_qty").notNull().default(0),
    rack: text("rack"),
    shelf: text("shelf"),
    bin: text("bin"),
    imageUrl: text("image_url"),
    description: text("description"),
    active: boolean("active").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [
    uniqueIndex("products_shop_sku_unique").on(t.shopId, t.sku),
    uniqueIndex("products_shop_barcode_unique").on(t.shopId, t.barcode),
    index("products_shop_name_idx").on(t.shopId, t.name),
    index("products_part_number_idx").on(t.shopId, t.partNumber),
    index("products_oem_number_idx").on(t.shopId, t.oemNumber),
    index("products_shop_stock_idx").on(t.shopId, t.currentStock),
    index("products_shop_category_idx").on(t.shopId, t.categoryId),
    index("products_shop_brand_idx").on(t.shopId, t.brandId),
    index("products_shop_supplier_idx").on(t.shopId, t.supplierId),
  ]
);

export const productVehicles = pgTable(
  "product_vehicles",
  {
    productId: uuid("product_id")
      .notNull()
      .references(() => products.id, { onDelete: "cascade" }),
    vehicleId: uuid("vehicle_id")
      .notNull()
      .references(() => vehicles.id, { onDelete: "cascade" }),
    shopId: text("shop_id")
      .notNull()
      .references(() => shops.id, { onDelete: "cascade" }),
  },
  (t) => [
    primaryKey({ columns: [t.productId, t.vehicleId] }),
    index("product_vehicles_shop_idx").on(t.shopId),
    index("product_vehicles_vehicle_idx").on(t.vehicleId),
  ]
);

/* ------------------------------------------------------------------ */
/* Suppliers & customers                                               */
/* ------------------------------------------------------------------ */

export const suppliers = pgTable(
  "suppliers",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    shopId: text("shop_id")
      .notNull()
      .references(() => shops.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    contactPerson: text("contact_person"),
    phone: text("phone"),
    whatsapp: text("whatsapp"),
    email: text("email"),
    address: text("address"),
    city: text("city"),
    paymentTerms: text("payment_terms"),
    notes: text("notes"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [
    index("suppliers_shop_idx").on(t.shopId),
    index("suppliers_shop_name_idx").on(t.shopId, t.name),
  ]
);

export const customers = pgTable(
  "customers",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    shopId: text("shop_id")
      .notNull()
      .references(() => shops.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    phone: text("phone"),
    address: text("address"),
    vehicle: text("vehicle"),
    notes: text("notes"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [
    index("customers_shop_idx").on(t.shopId),
    index("customers_shop_name_idx").on(t.shopId, t.name),
    index("customers_shop_phone_idx").on(t.shopId, t.phone),
  ]
);

/* ------------------------------------------------------------------ */
/* Purchases                                                           */
/* ------------------------------------------------------------------ */

export const purchases = pgTable(
  "purchases",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    shopId: text("shop_id")
      .notNull()
      .references(() => shops.id, { onDelete: "cascade" }),
    supplierId: uuid("supplier_id").references(() => suppliers.id, {
      onDelete: "set null",
    }),
    invoiceNumber: text("invoice_number").notNull(),
    purchaseDate: timestamp("purchase_date", { withTimezone: true })
      .defaultNow()
      .notNull(),
    subtotal: integer("subtotal").notNull().default(0), // paisa
    discount: integer("discount").notNull().default(0), // paisa
    total: integer("total").notNull().default(0), // paisa
    paidAmount: integer("paid_amount").notNull().default(0), // paisa
    remaining: integer("remaining").notNull().default(0), // paisa
    paymentStatus: paymentStatusEnum("payment_status").notNull().default("PENDING"),
    notes: text("notes"),
    createdBy: uuid("created_by").references(() => users.id, {
      onDelete: "set null",
    }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [
    uniqueIndex("purchases_shop_invoice_unique").on(t.shopId, t.invoiceNumber),
    index("purchases_shop_idx").on(t.shopId),
    index("purchases_shop_supplier_idx").on(t.shopId, t.supplierId),
    index("purchases_shop_date_idx").on(t.shopId, t.purchaseDate),
  ]
);

export const purchaseItems = pgTable(
  "purchase_items",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    purchaseId: uuid("purchase_id")
      .notNull()
      .references(() => purchases.id, { onDelete: "cascade" }),
    productId: uuid("product_id")
      .notNull()
      .references(() => products.id, { onDelete: "restrict" }),
    quantity: integer("quantity").notNull(),
    purchasePrice: integer("purchase_price").notNull(), // paisa per unit (snapshot)
    discount: integer("discount").notNull().default(0), // paisa
    total: integer("total").notNull(), // paisa
  },
  (t) => [index("purchase_items_purchase_idx").on(t.purchaseId)]
);

/* ------------------------------------------------------------------ */
/* Sales                                                               */
/* ------------------------------------------------------------------ */

export const sales = pgTable(
  "sales",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    shopId: text("shop_id")
      .notNull()
      .references(() => shops.id, { onDelete: "cascade" }),
    invoiceNumber: text("invoice_number").notNull(),
    saleDate: timestamp("sale_date", { withTimezone: true }).defaultNow().notNull(),
    customerId: uuid("customer_id").references(() => customers.id, {
      onDelete: "set null",
    }),
    subtotal: integer("subtotal").notNull().default(0), // paisa
    discount: integer("discount").notNull().default(0), // paisa
    total: integer("total").notNull().default(0), // paisa
    paidAmount: integer("paid_amount").notNull().default(0), // paisa
    remaining: integer("remaining").notNull().default(0), // paisa
    paymentMethod: paymentMethodEnum("payment_method").notNull().default("CASH"),
    paymentStatus: paymentStatusEnum("payment_status").notNull().default("PAID"),
    notes: text("notes"),
    createdBy: uuid("created_by").references(() => users.id, {
      onDelete: "set null",
    }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [
    uniqueIndex("sales_shop_invoice_unique").on(t.shopId, t.invoiceNumber),
    index("sales_shop_idx").on(t.shopId),
    index("sales_shop_date_idx").on(t.shopId, t.saleDate),
    index("sales_shop_customer_idx").on(t.shopId, t.customerId),
  ]
);

export const saleItems = pgTable(
  "sale_items",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    saleId: uuid("sale_id")
      .notNull()
      .references(() => sales.id, { onDelete: "cascade" }),
    productId: uuid("product_id")
      .notNull()
      .references(() => products.id, { onDelete: "restrict" }),
    quantity: integer("quantity").notNull(),
    salePrice: integer("sale_price").notNull(), // paisa per unit (snapshot)
    purchaseCost: integer("purchase_cost").notNull().default(0), // paisa per unit at sale time (for gross profit)
    discount: integer("discount").notNull().default(0), // paisa
    total: integer("total").notNull(), // paisa
  },
  (t) => [index("sale_items_sale_idx").on(t.saleId)]
);

/* ------------------------------------------------------------------ */
/* Stock movements (immutable ledger)                                  */
/* ------------------------------------------------------------------ */

export const stockMovements = pgTable(
  "stock_movements",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    shopId: text("shop_id")
      .notNull()
      .references(() => shops.id, { onDelete: "cascade" }),
    productId: uuid("product_id")
      .notNull()
      .references(() => products.id, { onDelete: "cascade" }),
    previousQty: integer("previous_qty").notNull(),
    changeQty: integer("change_qty").notNull(),
    newQty: integer("new_qty").notNull(),
    type: movementTypeEnum("type").notNull(),
    referenceId: text("reference_id"),
    referenceType: text("reference_type"),
    userId: uuid("user_id").references(() => users.id, { onDelete: "set null" }),
    note: text("note"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [
    index("stock_movements_shop_product_idx").on(t.shopId, t.productId, t.createdAt),
    index("stock_movements_shop_type_idx").on(t.shopId, t.type),
    index("stock_movements_shop_date_idx").on(t.shopId, t.createdAt),
  ]
);

/* ------------------------------------------------------------------ */
/* Returns                                                             */
/* ------------------------------------------------------------------ */

export const returns = pgTable(
  "returns",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    shopId: text("shop_id")
      .notNull()
      .references(() => shops.id, { onDelete: "cascade" }),
    type: returnTypeEnum("type").notNull(),
    returnDate: timestamp("return_date", { withTimezone: true }).defaultNow().notNull(),
    customerId: uuid("customer_id").references(() => customers.id, {
      onDelete: "set null",
    }),
    supplierId: uuid("supplier_id").references(() => suppliers.id, {
      onDelete: "set null",
    }),
    saleId: uuid("sale_id").references(() => sales.id, { onDelete: "set null" }),
    purchaseId: uuid("purchase_id").references(() => purchases.id, {
      onDelete: "set null",
    }),
    subtotal: integer("subtotal").notNull().default(0), // paisa
    notes: text("notes"),
    createdBy: uuid("created_by").references(() => users.id, {
      onDelete: "set null",
    }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [
    index("returns_shop_idx").on(t.shopId),
    index("returns_shop_date_idx").on(t.shopId, t.returnDate),
    index("returns_shop_type_idx").on(t.shopId, t.type),
  ]
);

export const returnItems = pgTable(
  "return_items",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    returnId: uuid("return_id")
      .notNull()
      .references(() => returns.id, { onDelete: "cascade" }),
    productId: uuid("product_id")
      .notNull()
      .references(() => products.id, { onDelete: "restrict" }),
    quantity: integer("quantity").notNull(),
    unitPrice: integer("unit_price").notNull(), // paisa
  },
  (t) => [index("return_items_return_idx").on(t.returnId)]
);

/* ------------------------------------------------------------------ */
/* Notifications, audit logs, settings                                 */
/* ------------------------------------------------------------------ */

export const notifications = pgTable(
  "notifications",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    shopId: text("shop_id")
      .notNull()
      .references(() => shops.id, { onDelete: "cascade" }),
    type: notificationTypeEnum("type").notNull().default("INFO"),
    title: text("title").notNull(),
    message: text("message"),
    link: text("link"),
    isRead: boolean("is_read").notNull().default(false),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [
    index("notifications_shop_read_idx").on(t.shopId, t.isRead, t.createdAt),
  ]
);

export const auditLogs = pgTable(
  "audit_logs",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    shopId: text("shop_id")
      .notNull()
      .references(() => shops.id, { onDelete: "cascade" }),
    userId: uuid("user_id").references(() => users.id, { onDelete: "set null" }),
    action: text("action").notNull(),
    entity: text("entity").notNull(),
    entityId: text("entity_id"),
    oldValue: jsonb("old_value"),
    newValue: jsonb("new_value"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [
    index("audit_logs_shop_idx").on(t.shopId, t.createdAt),
    index("audit_logs_shop_entity_idx").on(t.shopId, t.entity),
  ]
);

export const settings = pgTable("settings", {
  shopId: text("shop_id")
    .primaryKey()
    .references(() => shops.id, { onDelete: "cascade" }),
  shopName: text("shop_name").notNull().default("Asim Autos"),
  phone: text("phone"),
  address: text("address"),
  city: text("city").notNull().default("Faisalabad"),
  currency: text("currency").notNull().default("PKR"),
  logoUrl: text("logo_url"),
  invoicePrefix: text("invoice_prefix").notNull().default("INV"),
  taxRateBps: integer("tax_rate_bps").notNull().default(0), // basis points
  defaultMinStock: integer("default_min_stock").notNull().default(5),
  defaultReorderQty: integer("default_reorder_qty").notNull().default(10),
  nextSaleInvoice: integer("next_sale_invoice").notNull().default(1),
  businessHours: text("business_hours"),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

/* ------------------------------------------------------------------ */
/* Type exports                                                        */
/* ------------------------------------------------------------------ */

export type Shop = typeof shops.$inferSelect;
export type User = typeof users.$inferSelect;
export type Category = typeof categories.$inferSelect;
export type Brand = typeof brands.$inferSelect;
export type Vehicle = typeof vehicles.$inferSelect;
export type Product = typeof products.$inferSelect;
export type Supplier = typeof suppliers.$inferSelect;
export type Customer = typeof customers.$inferSelect;
export type Purchase = typeof purchases.$inferSelect;
export type PurchaseItem = typeof purchaseItems.$inferSelect;
export type Sale = typeof sales.$inferSelect;
export type SaleItem = typeof saleItems.$inferSelect;
export type StockMovement = typeof stockMovements.$inferSelect;
export type Return = typeof returns.$inferSelect;
export type ReturnItem = typeof returnItems.$inferSelect;
export type Notification = typeof notifications.$inferSelect;
export type AuditLog = typeof auditLogs.$inferSelect;
export type Setting = typeof settings.$inferSelect;
