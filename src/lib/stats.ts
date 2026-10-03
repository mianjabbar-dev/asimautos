/**
 * Dashboard statistics — every number is computed live from the database.
 * No hard-coded values anywhere.
 */

import { eq, and, sql, desc, lte, gt, isNull, or } from "drizzle-orm";
import { db } from "@/db";
import {
  products,
  categories,
  brands,
  suppliers,
  sales,
  saleItems,
  purchases,
  stockMovements,
  notifications,
} from "@/db/schema";
import { avgMonthlySales, suggestReorder } from "./tx";

const DAY = 24 * 60 * 60 * 1000;

function startOfToday(): Date {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}

function startOfMonth(): Date {
  const d = new Date();
  d.setDate(1);
  d.setHours(0, 0, 0, 0);
  return d;
}

async function sumTotal(
  shopId: string,
  table: typeof sales | typeof purchases,
  dateCol: typeof sales.saleDate | typeof purchases.purchaseDate,
  since: Date
): Promise<number> {
  const rows = await db
    .select({ v: sql<number>`coalesce(sum(${table.total}),0)` })
    .from(table)
    .where(and(eq(table.shopId, shopId), sql`${dateCol} >= ${since}`));
  return Number(rows[0]?.v ?? 0);
}

async function grossProfitSince(shopId: string, since: Date): Promise<number> {
  const rows = await db
    .select({
      v: sql<number>`coalesce(sum((${saleItems.salePrice} - ${saleItems.purchaseCost}) * ${saleItems.quantity} - ${saleItems.discount}),0)`,
    })
    .from(saleItems)
    .innerJoin(sales, eq(saleItems.saleId, sales.id))
    .where(and(eq(sales.shopId, shopId), sql`${sales.saleDate} >= ${since}`));
  return Number(rows[0]?.v ?? 0);
}

export type DashboardStats = Awaited<ReturnType<typeof getDashboardStats>>;

export async function getDashboardStats(shopId: string) {
  const today = startOfToday();
  const month = startOfMonth();

  const [
    productCount,
    stockAgg,
    lowStock,
    outOfStock,
    todaySales,
    todayPurchases,
    todayProfit,
    monthlySales,
    monthlyProfit,
    receivables,
    payables,
    unreadNotifications,
  ] = await Promise.all([
    db
      .select({ v: sql<number>`count(*)` })
      .from(products)
      .where(and(eq(products.shopId, shopId), eq(products.active, true))),
    db
      .select({
        units: sql<number>`coalesce(sum(${products.currentStock}),0)`,
        value: sql<number>`coalesce(sum(${products.currentStock} * ${products.purchasePrice}),0)`,
      })
      .from(products)
      .where(and(eq(products.shopId, shopId), eq(products.active, true))),
    db
      .select({ v: sql<number>`count(*)` })
      .from(products)
      .where(
        and(
          eq(products.shopId, shopId),
          eq(products.active, true),
          gt(products.currentStock, 0),
          sql`${products.currentStock} <= ${products.minStock}`
        )
      ),
    db
      .select({ v: sql<number>`count(*)` })
      .from(products)
      .where(
        and(
          eq(products.shopId, shopId),
          eq(products.active, true),
          eq(products.currentStock, 0)
        )
      ),
    sumTotal(shopId, sales, sales.saleDate, today),
    sumTotal(shopId, purchases, purchases.purchaseDate, today),
    grossProfitSince(shopId, today),
    sumTotal(shopId, sales, sales.saleDate, month),
    grossProfitSince(shopId, month),
    db
      .select({ v: sql<number>`coalesce(sum(${sales.remaining}),0)` })
      .from(sales)
      .where(eq(sales.shopId, shopId)),
    db
      .select({ v: sql<number>`coalesce(sum(${purchases.remaining}),0)` })
      .from(purchases)
      .where(eq(purchases.shopId, shopId)),
    db
      .select({ v: sql<number>`count(*)` })
      .from(notifications)
      .where(and(eq(notifications.shopId, shopId), eq(notifications.isRead, false))),
  ]);

  return {
    totalProducts: Number(productCount[0]?.v ?? 0),
    totalStockUnits: Number(stockAgg[0]?.units ?? 0),
    inventoryValue: Number(stockAgg[0]?.value ?? 0),
    lowStockCount: Number(lowStock[0]?.v ?? 0),
    outOfStockCount: Number(outOfStock[0]?.v ?? 0),
    todaySales,
    todayPurchases,
    todayGrossProfit: todayProfit,
    monthlySales,
    monthlyGrossProfit: monthlyProfit,
    customerReceivables: Number(receivables[0]?.v ?? 0),
    supplierPayables: Number(payables[0]?.v ?? 0),
    unreadNotifications: Number(unreadNotifications[0]?.v ?? 0),
  };
}

export async function getActionRequired(shopId: string) {
  const low = await db
    .select({
      id: products.id,
      name: products.name,
      sku: products.sku,
      partNumber: products.partNumber,
      currentStock: products.currentStock,
      minStock: products.minStock,
      reorderQty: products.reorderQty,
    })
    .from(products)
    .where(
      and(
        eq(products.shopId, shopId),
        eq(products.active, true),
        gt(products.currentStock, 0),
        sql`${products.currentStock} <= ${products.minStock}`
      )
    )
    .orderBy(products.currentStock)
    .limit(10);

  const out = await db
    .select({
      id: products.id,
      name: products.name,
      sku: products.sku,
      partNumber: products.partNumber,
      reorderQty: products.reorderQty,
    })
    .from(products)
    .where(
      and(
        eq(products.shopId, shopId),
        eq(products.active, true),
        eq(products.currentStock, 0)
      )
    )
    .orderBy(products.name)
    .limit(10);

  // Attach rule-based reorder suggestions.
  const lowWithSuggestion = await Promise.all(
    low.map(async (p) => {
      const avg = await avgMonthlySales(shopId, p.id);
      const s = suggestReorder(p.currentStock, p.minStock, p.reorderQty, avg);
      return { ...p, suggested: s.recommendedQty, reasons: s.reasons };
    })
  );

  return { lowStock: lowWithSuggestion, outOfStock: out };
}

export async function getRecentSales(shopId: string, limit = 5) {
  return db
    .select({
      id: sales.id,
      invoiceNumber: sales.invoiceNumber,
      total: sales.total,
      paidAmount: sales.paidAmount,
      remaining: sales.remaining,
      paymentMethod: sales.paymentMethod,
      saleDate: sales.saleDate,
    })
    .from(sales)
    .where(eq(sales.shopId, shopId))
    .orderBy(desc(sales.saleDate))
    .limit(limit);
}

export async function getRecentPurchases(shopId: string, limit = 5) {
  return db
    .select({
      id: purchases.id,
      invoiceNumber: purchases.invoiceNumber,
      total: purchases.total,
      paidAmount: purchases.paidAmount,
      remaining: purchases.remaining,
      paymentStatus: purchases.paymentStatus,
      purchaseDate: purchases.purchaseDate,
    })
    .from(purchases)
    .where(eq(purchases.shopId, shopId))
    .orderBy(desc(purchases.purchaseDate))
    .limit(limit);
}

export async function getTopSelling(shopId: string, days = 30, limit = 5) {
  const since = new Date(Date.now() - days * DAY);
  return db
    .select({
      productId: saleItems.productId,
      name: products.name,
      qty: sql<number>`sum(${saleItems.quantity})`,
      revenue: sql<number>`sum(${saleItems.total})`,
    })
    .from(saleItems)
    .innerJoin(sales, eq(saleItems.saleId, sales.id))
    .innerJoin(products, eq(saleItems.productId, products.id))
    .where(and(eq(sales.shopId, shopId), sql`${sales.saleDate} >= ${since}`))
    .groupBy(saleItems.productId, products.name)
    .orderBy(desc(sql`sum(${saleItems.quantity})`))
    .limit(limit);
}

export async function getSlowMoving(shopId: string, days = 30, limit = 5) {
  const since = new Date(Date.now() - days * DAY);
  const sold = db
    .select({ productId: saleItems.productId })
    .from(saleItems)
    .innerJoin(sales, eq(saleItems.saleId, sales.id))
    .where(and(eq(sales.shopId, shopId), sql`${sales.saleDate} >= ${since}`))
    .groupBy(saleItems.productId);
  return db
    .select({
      id: products.id,
      name: products.name,
      sku: products.sku,
      currentStock: products.currentStock,
    })
    .from(products)
    .where(
      and(
        eq(products.shopId, shopId),
        eq(products.active, true),
        gt(products.currentStock, 0),
        sql`${products.id} NOT IN (${sold})`
      )
    )
    .orderBy(desc(products.currentStock))
    .limit(limit);
}

export async function getRecentMovements(shopId: string, limit = 10) {
  return db
    .select({
      id: stockMovements.id,
      productName: products.name,
      previousQty: stockMovements.previousQty,
      changeQty: stockMovements.changeQty,
      newQty: stockMovements.newQty,
      type: stockMovements.type,
      note: stockMovements.note,
      createdAt: stockMovements.createdAt,
    })
    .from(stockMovements)
    .innerJoin(products, eq(stockMovements.productId, products.id))
    .where(eq(stockMovements.shopId, shopId))
    .orderBy(desc(stockMovements.createdAt))
    .limit(limit);
}

export async function getRecentNotifications(shopId: string, limit = 5) {
  return db
    .select()
    .from(notifications)
    .where(eq(notifications.shopId, shopId))
    .orderBy(desc(notifications.createdAt))
    .limit(limit);
}

/** Inventory valuation grouped by category / brand / supplier. */
export async function getValuationBy(shopId: string, by: "category" | "brand" | "supplier") {
  const join =
    by === "category"
      ? { table: categories, col: categories.name, fk: products.categoryId, ref: categories.id }
      : by === "brand"
        ? { table: brands, col: brands.name, fk: products.brandId, ref: brands.id }
        : { table: suppliers, col: suppliers.name, fk: products.supplierId, ref: suppliers.id };

  const rows = await db
    .select({
      name: join.col,
      units: sql<number>`coalesce(sum(${products.currentStock}),0)`,
      value: sql<number>`coalesce(sum(${products.currentStock} * ${products.purchasePrice}),0)`,
    })
    .from(products)
    .leftJoin(join.table, eq(join.fk, join.ref))
    .where(and(eq(products.shopId, shopId), eq(products.active, true)))
    .groupBy(join.col)
    .orderBy(desc(sql`coalesce(sum(${products.currentStock} * ${products.purchasePrice}),0)`));
  return rows.map((r) => ({
    name: r.name ?? "Unassigned",
    units: Number(r.units ?? 0),
    value: Number(r.value ?? 0),
  }));
}

/** Customer outstanding balances (receivables) per customer. */
export async function getCustomerBalances(shopId: string) {
  const { customers } = await import("@/db/schema");
  return db
    .select({
      id: customers.id,
      name: customers.name,
      phone: customers.phone,
      outstanding: sql<number>`coalesce(sum(${sales.remaining}),0)`,
      totalPurchased: sql<number>`coalesce(sum(${sales.total}),0)`,
    })
    .from(customers)
    .leftJoin(sales, and(eq(sales.customerId, customers.id), eq(sales.shopId, shopId)))
    .where(eq(customers.shopId, shopId))
    .groupBy(customers.id, customers.name, customers.phone)
    .orderBy(desc(sql`coalesce(sum(${sales.remaining}),0)`));
}

/** Supplier outstanding balances (payables) per supplier. */
export async function getSupplierBalances(shopId: string) {
  const { suppliers } = await import("@/db/schema");
  return db
    .select({
      id: suppliers.id,
      name: suppliers.name,
      phone: suppliers.phone,
      outstanding: sql<number>`coalesce(sum(${purchases.remaining}),0)`,
      totalPurchased: sql<number>`coalesce(sum(${purchases.total}),0)`,
    })
    .from(suppliers)
    .leftJoin(
      purchases,
      and(eq(purchases.supplierId, suppliers.id), eq(purchases.shopId, shopId))
    )
    .where(eq(suppliers.shopId, shopId))
    .groupBy(suppliers.id, suppliers.name, suppliers.phone)
    .orderBy(desc(sql`coalesce(sum(${purchases.remaining}),0)`));
}

/** Profit report grouped per product over a date range. */
export async function getProductProfit(
  shopId: string,
  since: Date,
  until: Date
) {
  return db
    .select({
      productId: saleItems.productId,
      name: products.name,
      qty: sql<number>`sum(${saleItems.quantity})`,
      revenue: sql<number>`sum(${saleItems.total})`,
      cost: sql<number>`sum(${saleItems.purchaseCost} * ${saleItems.quantity})`,
      profit: sql<number>`sum((${saleItems.salePrice} - ${saleItems.purchaseCost}) * ${saleItems.quantity} - ${saleItems.discount})`,
    })
    .from(saleItems)
    .innerJoin(sales, eq(saleItems.saleId, sales.id))
    .innerJoin(products, eq(saleItems.productId, products.id))
    .where(
      and(
        eq(sales.shopId, shopId),
        sql`${sales.saleDate} >= ${since}`,
        sql`${sales.saleDate} < ${until}`
      )
    )
    .groupBy(saleItems.productId, products.name)
    .orderBy(desc(sql`sum((${saleItems.salePrice} - ${saleItems.purchaseCost}) * ${saleItems.quantity})`));
}
