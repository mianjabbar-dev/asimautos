/**
 * Transaction engine for ASIM AUTOS.
 *
 * SINGLE SOURCE OF TRUTH for every stock change. All stock mutations MUST go
 * through these functions. Each one:
 *  - runs inside a DB transaction with row-level locking (FOR UPDATE),
 *  - enforces shop_id tenant isolation on every read/write,
 *  - enforces role-based authorization server-side (actor.role),
 *  - never lets stock go negative (oversell is blocked with a clear message),
 *  - writes a stock_movements ledger row for every change,
 *  - writes an audit_logs row for the business action,
 *  - refreshes low/out-of-stock notifications.
 *
 * Money is integer paisa everywhere.
 */

import { eq, and, sql } from "drizzle-orm";
import { db } from "@/db";
import {
  products,
  purchases,
  purchaseItems,
  sales,
  saleItems,
  stockMovements,
  returns,
  returnItems,
  notifications,
  auditLogs,
  settings,
  type Product,
} from "@/db/schema";
import type { SessionUser } from "./auth";
import { ForbiddenError } from "./auth";

type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];

export class InsufficientStockError extends Error {
  productName: string;
  available: number;
  requested: number;
  constructor(productName: string, available: number, requested: number) {
    super(
      `Insufficient stock. Only ${available} unit(s) of "${productName}" are available.`
    );
    this.name = "InsufficientStockError";
    this.productName = productName;
    this.available = available;
    this.requested = requested;
  }
}

export class BusinessError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "BusinessError";
  }
}

type Actor = Pick<SessionUser, "id" | "shopId" | "role">;

function assertOwner(actor: Actor) {
  if (actor.role !== "OWNER") {
    throw new ForbiddenError(
      "This action requires OWNER permission. Your STAFF account cannot perform it."
    );
  }
}

/* ------------------------------------------------------------------ */
/* Helpers                                                             */
/* ------------------------------------------------------------------ */

async function audit(
  tx: Tx,
  entry: {
    shopId: string;
    userId: string | null;
    action: string;
    entity: string;
    entityId?: string;
    oldValue?: unknown;
    newValue?: unknown;
  }
) {
  await tx.insert(auditLogs).values({
    shopId: entry.shopId,
    userId: entry.userId,
    action: entry.action,
    entity: entry.entity,
    entityId: entry.entityId,
    oldValue: entry.oldValue as never,
    newValue: entry.newValue as never,
  });
}

async function getProductForUpdate(
  tx: Tx,
  shopId: string,
  productId: string
): Promise<Product> {
  const rows = await tx
    .select()
    .from(products)
    .where(and(eq(products.id, productId), eq(products.shopId, shopId)))
    .for("update");
  const p = rows[0];
  if (!p) throw new BusinessError("Product not found.");
  if (!p.active) throw new BusinessError(`Product "${p.name}" is inactive.`);
  return p;
}

/**
 * Apply a signed stock change to one product inside the caller's transaction.
 * Throws InsufficientStockError if the result would be negative.
 */
async function applyStockChange(
  tx: Tx,
  opts: {
    shopId: string;
    productId: string;
    changeQty: number; // signed
    type: (typeof stockMovements.$inferInsert)["type"];
    referenceId?: string;
    referenceType?: string;
    userId: string | null;
    note?: string;
  }
): Promise<Product> {
  const p = await getProductForUpdate(tx, opts.shopId, opts.productId);
  const newQty = p.currentStock + opts.changeQty;
  if (newQty < 0) {
    throw new InsufficientStockError(p.name, p.currentStock, -opts.changeQty);
  }
  await tx
    .update(products)
    .set({ currentStock: newQty, updatedAt: new Date() })
    .where(eq(products.id, p.id));
  await tx.insert(stockMovements).values({
    shopId: opts.shopId,
    productId: p.id,
    previousQty: p.currentStock,
    changeQty: opts.changeQty,
    newQty,
    type: opts.type,
    referenceId: opts.referenceId,
    referenceType: opts.referenceType,
    userId: opts.userId,
    note: opts.note,
  });
  await refreshStockNotifications(tx, opts.shopId, p.id, p.name, newQty, p.minStock);
  return { ...p, currentStock: newQty };
}

/**
 * Create/update low-stock & out-of-stock notifications for a product.
 * Avoids spamming: only one unread notification per (product, type) at a time.
 */
async function refreshStockNotifications(
  tx: Tx,
  shopId: string,
  productId: string,
  productName: string,
  currentStock: number,
  minStock: number
) {
  const existing = await tx
    .select({ id: notifications.id, type: notifications.type })
    .from(notifications)
    .where(
      and(
        eq(notifications.shopId, shopId),
        eq(notifications.isRead, false),
        eq(notifications.link, `/inventory?product=${productId}`)
      )
    );
  const has = (t: string) => existing.some((n) => n.type === t);

  if (currentStock === 0 && !has("OUT_OF_STOCK")) {
    await tx.insert(notifications).values({
      shopId,
      type: "OUT_OF_STOCK",
      title: "Out of stock",
      message: `"${productName}" is completely out of stock. Create a purchase to restock.`,
      link: `/inventory?product=${productId}`,
    });
  } else if (
    currentStock > 0 &&
    currentStock <= minStock &&
    !has("LOW_STOCK") &&
    !has("OUT_OF_STOCK")
  ) {
    await tx.insert(notifications).values({
      shopId,
      type: "LOW_STOCK",
      title: "Low stock",
      message: `"${productName}" reached minimum stock (${currentStock} left, minimum ${minStock}).`,
      link: `/inventory?product=${productId}`,
    });
  }
}

function paymentStatusFor(total: number, paid: number) {
  if (paid <= 0) return "PENDING" as const;
  if (paid >= total) return "PAID" as const;
  return "PARTIAL" as const;
}

/* ------------------------------------------------------------------ */
/* Purchases (OWNER only — involves purchase prices & stock intake)     */
/* ------------------------------------------------------------------ */

export type PurchaseItemInput = {
  productId: string;
  quantity: number;
  purchasePrice: number; // paisa per unit
  discount?: number; // paisa
};

export async function createPurchase(
  actor: Actor,
  input: {
    supplierId: string | null;
    invoiceNumber: string;
    purchaseDate?: Date;
    items: PurchaseItemInput[];
    paidAmount?: number;
    notes?: string;
  }
) {
  assertOwner(actor);
  if (!input.items.length) throw new BusinessError("Add at least one product.");
  for (const it of input.items) {
    if (!Number.isInteger(it.quantity) || it.quantity <= 0)
      throw new BusinessError("Purchase quantities must be positive whole numbers.");
    if (it.purchasePrice < 0)
      throw new BusinessError("Purchase price cannot be negative.");
  }

  return db.transaction(async (tx) => {
    const shopId = actor.shopId;
    let subtotal = 0;
    const prepared: Array<PurchaseItemInput & { total: number }> = [];
    for (const it of input.items) {
      const discount = it.discount ?? 0;
      const total = it.quantity * it.purchasePrice - discount;
      if (total < 0) throw new BusinessError("Item total cannot be negative.");
      subtotal += total;
      prepared.push({ ...it, discount, total });
    }
    const paid = input.paidAmount ?? 0;
    if (paid < 0 || paid > subtotal)
      throw new BusinessError("Paid amount must be between 0 and the invoice total.");

    const [purchase] = await tx
      .insert(purchases)
      .values({
        shopId,
        supplierId: input.supplierId,
        invoiceNumber: input.invoiceNumber.trim(),
        purchaseDate: input.purchaseDate ?? new Date(),
        subtotal,
        discount: 0,
        total: subtotal,
        paidAmount: paid,
        remaining: subtotal - paid,
        paymentStatus: paymentStatusFor(subtotal, paid),
        notes: input.notes,
        createdBy: actor.id,
      })
      .returning();

    for (const it of prepared) {
      await tx.insert(purchaseItems).values({
        purchaseId: purchase.id,
        productId: it.productId,
        quantity: it.quantity,
        purchasePrice: it.purchasePrice,
        discount: it.discount,
        total: it.total,
      });
      await applyStockChange(tx, {
        shopId,
        productId: it.productId,
        changeQty: it.quantity,
        type: "PURCHASE",
        referenceId: purchase.id,
        referenceType: "purchase",
        userId: actor.id,
        note: `Purchase ${purchase.invoiceNumber}`,
      });
    }

    await audit(tx, {
      shopId,
      userId: actor.id,
      action: "PURCHASE_CREATED",
      entity: "purchase",
      entityId: purchase.id,
      newValue: { invoiceNumber: purchase.invoiceNumber, total: subtotal, paid },
    });
    return purchase;
  });
}

/** Record a payment against an existing purchase (OWNER only). */
export async function payPurchase(
  actor: Actor,
  purchaseId: string,
  amount: number // paisa
) {
  assertOwner(actor);
  if (amount <= 0) throw new BusinessError("Payment amount must be positive.");
  return db.transaction(async (tx) => {
    const rows = await tx
      .select()
      .from(purchases)
      .where(and(eq(purchases.id, purchaseId), eq(purchases.shopId, actor.shopId)))
      .for("update");
    const p = rows[0];
    if (!p) throw new BusinessError("Purchase not found.");
    const paid = p.paidAmount + amount;
    if (paid > p.total)
      throw new BusinessError(
        `Payment exceeds the remaining balance of ${p.remaining} paisa.`
      );
    const [updated] = await tx
      .update(purchases)
      .set({
        paidAmount: paid,
        remaining: p.total - paid,
        paymentStatus: paymentStatusFor(p.total, paid),
        updatedAt: new Date(),
      })
      .where(eq(purchases.id, p.id))
      .returning();
    await audit(tx, {
      shopId: actor.shopId,
      userId: actor.id,
      action: "PURCHASE_PAYMENT",
      entity: "purchase",
      entityId: p.id,
      oldValue: { paidAmount: p.paidAmount },
      newValue: { paidAmount: paid },
    });
    return updated;
  });
}

/* ------------------------------------------------------------------ */
/* Sales / POS (STAFF and OWNER)                                       */
/* ------------------------------------------------------------------ */

export type SaleItemInput = {
  productId: string;
  quantity: number;
  salePrice?: number; // paisa per unit; defaults to product's sale price
  discount?: number; // paisa
};

export async function createSale(
  actor: Actor,
  input: {
    customerId?: string | null;
    items: SaleItemInput[];
    discount?: number; // paisa, bill-level
    paidAmount?: number;
    paymentMethod?: "CASH" | "BANK" | "CREDIT" | "OTHER";
    notes?: string;
    saleDate?: Date;
  }
) {
  if (!input.items.length) throw new BusinessError("Add at least one product.");
  for (const it of input.items) {
    if (!Number.isInteger(it.quantity) || it.quantity <= 0)
      throw new BusinessError("Sale quantities must be positive whole numbers.");
  }

  return db.transaction(async (tx) => {
    const shopId = actor.shopId;

    // Next invoice number (per shop, incremented atomically in this tx).
    const [shopSettings] = await tx
      .select()
      .from(settings)
      .where(eq(settings.shopId, shopId))
      .for("update");
    if (!shopSettings) throw new BusinessError("Shop settings not found.");
    const seq = shopSettings.nextSaleInvoice;
    const invoiceNumber = `${shopSettings.invoicePrefix}-${String(seq).padStart(6, "0")}`;
    await tx
      .update(settings)
      .set({ nextSaleInvoice: seq + 1 })
      .where(eq(settings.shopId, shopId));

    let subtotal = 0;
    const prepared: Array<{
      productId: string;
      quantity: number;
      salePrice: number;
      purchaseCost: number;
      discount: number;
      total: number;
    }> = [];

    for (const it of input.items) {
      const p = await getProductForUpdate(tx, shopId, it.productId);
      if (p.currentStock < it.quantity) {
        throw new InsufficientStockError(p.name, p.currentStock, it.quantity);
      }
      const salePrice = it.salePrice ?? p.salePrice;
      if (salePrice < 0) throw new BusinessError("Sale price cannot be negative.");
      const discount = it.discount ?? 0;
      const total = it.quantity * salePrice - discount;
      if (total < 0) throw new BusinessError("Item total cannot be negative.");
      subtotal += total;
      prepared.push({
        productId: p.id,
        quantity: it.quantity,
        salePrice,
        purchaseCost: p.purchasePrice, // snapshot for gross profit
        discount,
        total,
      });
    }

    const billDiscount = input.discount ?? 0;
    const total = subtotal - billDiscount;
    if (total < 0) throw new BusinessError("Bill total cannot be negative.");
    const paymentMethod = input.paymentMethod ?? "CASH";
    // CREDIT sales default to unpaid; others default to fully paid.
    const paid =
      input.paidAmount ?? (paymentMethod === "CREDIT" ? 0 : total);
    if (paid < 0 || paid > total)
      throw new BusinessError("Paid amount must be between 0 and the bill total.");

    const [sale] = await tx
      .insert(sales)
      .values({
        shopId,
        invoiceNumber,
        saleDate: input.saleDate ?? new Date(),
        customerId: input.customerId ?? null,
        subtotal,
        discount: billDiscount,
        total,
        paidAmount: paid,
        remaining: total - paid,
        paymentMethod,
        paymentStatus: paymentStatusFor(total, paid),
        notes: input.notes,
        createdBy: actor.id,
      })
      .returning();

    for (const it of prepared) {
      await tx.insert(saleItems).values({
        saleId: sale.id,
        productId: it.productId,
        quantity: it.quantity,
        salePrice: it.salePrice,
        purchaseCost: it.purchaseCost,
        discount: it.discount,
        total: it.total,
      });
      await applyStockChange(tx, {
        shopId,
        productId: it.productId,
        changeQty: -it.quantity,
        type: "SALE",
        referenceId: sale.id,
        referenceType: "sale",
        userId: actor.id,
        note: `Sale ${sale.invoiceNumber}`,
      });
    }

    await audit(tx, {
      shopId,
      userId: actor.id,
      action: "SALE_CREATED",
      entity: "sale",
      entityId: sale.id,
      newValue: { invoiceNumber: sale.invoiceNumber, total, paid },
    });
    return sale;
  });
}

/** Record a payment against a sale / customer balance (STAFF and OWNER). */
export async function paySale(actor: Actor, saleId: string, amount: number) {
  if (amount <= 0) throw new BusinessError("Payment amount must be positive.");
  return db.transaction(async (tx) => {
    const rows = await tx
      .select()
      .from(sales)
      .where(and(eq(sales.id, saleId), eq(sales.shopId, actor.shopId)))
      .for("update");
    const s = rows[0];
    if (!s) throw new BusinessError("Sale not found.");
    const paid = s.paidAmount + amount;
    if (paid > s.total)
      throw new BusinessError("Payment exceeds the remaining balance.");
    const [updated] = await tx
      .update(sales)
      .set({
        paidAmount: paid,
        remaining: s.total - paid,
        paymentStatus: paymentStatusFor(s.total, paid),
        updatedAt: new Date(),
      })
      .where(eq(sales.id, s.id))
      .returning();
    await audit(tx, {
      shopId: actor.shopId,
      userId: actor.id,
      action: "SALE_PAYMENT",
      entity: "sale",
      entityId: s.id,
      oldValue: { paidAmount: s.paidAmount },
      newValue: { paidAmount: paid },
    });
    return updated;
  });
}

/* ------------------------------------------------------------------ */
/* Returns                                                             */
/* ------------------------------------------------------------------ */

export type ReturnItemInput = {
  productId: string;
  quantity: number;
  unitPrice: number; // paisa
};

/**
 * Customer return: stock goes UP. Staff may process customer returns.
 * If linked to a sale, reduces that sale's remaining balance (never below 0).
 */
export async function createCustomerReturn(
  actor: Actor,
  input: {
    saleId?: string | null;
    customerId?: string | null;
    items: ReturnItemInput[];
    notes?: string;
  }
) {
  if (!input.items.length) throw new BusinessError("Add at least one product.");
  return db.transaction(async (tx) => {
    const shopId = actor.shopId;
    let subtotal = 0;
    for (const it of input.items) {
      if (!Number.isInteger(it.quantity) || it.quantity <= 0)
        throw new BusinessError("Return quantities must be positive whole numbers.");
      subtotal += it.quantity * it.unitPrice;
    }
    const [ret] = await tx
      .insert(returns)
      .values({
        shopId,
        type: "CUSTOMER",
        customerId: input.customerId ?? null,
        saleId: input.saleId ?? null,
        subtotal,
        notes: input.notes,
        createdBy: actor.id,
      })
      .returning();
    for (const it of input.items) {
      await tx.insert(returnItems).values({
        returnId: ret.id,
        productId: it.productId,
        quantity: it.quantity,
        unitPrice: it.unitPrice,
      });
      await applyStockChange(tx, {
        shopId,
        productId: it.productId,
        changeQty: it.quantity,
        type: "CUSTOMER_RETURN",
        referenceId: ret.id,
        referenceType: "return",
        userId: actor.id,
        note: "Customer return",
      });
    }
    if (input.saleId) {
      const rows = await tx
        .select()
        .from(sales)
        .where(and(eq(sales.id, input.saleId), eq(sales.shopId, shopId)))
        .for("update");
      const s = rows[0];
      if (s && s.remaining > 0) {
        const reduce = Math.min(s.remaining, subtotal);
        await tx
          .update(sales)
          .set({
            remaining: s.remaining - reduce,
            paymentStatus: paymentStatusFor(s.total, s.paidAmount),
            updatedAt: new Date(),
          })
          .where(eq(sales.id, s.id));
      }
    }
    await audit(tx, {
      shopId,
      userId: actor.id,
      action: "CUSTOMER_RETURN_CREATED",
      entity: "return",
      entityId: ret.id,
      newValue: { subtotal },
    });
    return ret;
  });
}

/** Supplier return: stock goes DOWN (OWNER only). */
export async function createSupplierReturn(
  actor: Actor,
  input: {
    purchaseId?: string | null;
    supplierId: string;
    items: ReturnItemInput[];
    notes?: string;
  }
) {
  assertOwner(actor);
  if (!input.items.length) throw new BusinessError("Add at least one product.");
  return db.transaction(async (tx) => {
    const shopId = actor.shopId;
    let subtotal = 0;
    for (const it of input.items) {
      if (!Number.isInteger(it.quantity) || it.quantity <= 0)
        throw new BusinessError("Return quantities must be positive whole numbers.");
      subtotal += it.quantity * it.unitPrice;
    }
    const [ret] = await tx
      .insert(returns)
      .values({
        shopId,
        type: "SUPPLIER",
        supplierId: input.supplierId,
        purchaseId: input.purchaseId ?? null,
        subtotal,
        notes: input.notes,
        createdBy: actor.id,
      })
      .returning();
    for (const it of input.items) {
      await tx.insert(returnItems).values({
        returnId: ret.id,
        productId: it.productId,
        quantity: it.quantity,
        unitPrice: it.unitPrice,
      });
      await applyStockChange(tx, {
        shopId,
        productId: it.productId,
        changeQty: -it.quantity,
        type: "SUPPLIER_RETURN",
        referenceId: ret.id,
        referenceType: "return",
        userId: actor.id,
        note: "Supplier return",
      });
    }
    await audit(tx, {
      shopId,
      userId: actor.id,
      action: "SUPPLIER_RETURN_CREATED",
      entity: "return",
      entityId: ret.id,
      newValue: { subtotal },
    });
    return ret;
  });
}

/* ------------------------------------------------------------------ */
/* Manual stock adjustment (OWNER only)                                 */
/* ------------------------------------------------------------------ */

export async function adjustStock(
  actor: Actor,
  productId: string,
  newQty: number,
  reason: "DAMAGE" | "LOST" | "ADJUSTMENT" | "INITIAL",
  note?: string
) {
  assertOwner(actor);
  if (!Number.isInteger(newQty) || newQty < 0)
    throw new BusinessError("New stock quantity must be a whole number >= 0.");
  return db.transaction(async (tx) => {
    const p = await getProductForUpdate(tx, actor.shopId, productId);
    const change = newQty - p.currentStock;
    if (change === 0) return p;
    const updated = await applyStockChange(tx, {
      shopId: actor.shopId,
      productId: p.id,
      changeQty: change,
      type: reason,
      userId: actor.id,
      note: note ?? `Manual adjustment to ${newQty}`,
    });
    await audit(tx, {
      shopId: actor.shopId,
      userId: actor.id,
      action: "STOCK_ADJUSTED",
      entity: "product",
      entityId: p.id,
      oldValue: { stock: p.currentStock },
      newValue: { stock: newQty, reason },
    });
    return updated;
  });
}

/* ------------------------------------------------------------------ */
/* Reorder suggestion (rule-based, explainable — NOT ML)               */
/* ------------------------------------------------------------------ */

export type ReorderSuggestion = {
  recommendedQty: number;
  reasons: string[];
};

/**
 * Rule-based reorder recommendation:
 *  1. Start from the product's reorderQty (owner's rule of thumb).
 *  2. Ensure we cover (minStock - currentStock) shortfall.
 *  3. Add one month of average sales if recent sales data exists.
 * Returns the recommended quantity plus human-readable reasons.
 */
export function suggestReorder(
  currentStock: number,
  minStock: number,
  reorderQty: number,
  avgMonthlySales: number
): ReorderSuggestion {
  const reasons: string[] = [];
  let qty = Math.max(0, reorderQty);
  if (reorderQty > 0) reasons.push(`Base reorder quantity: ${reorderQty}`);

  const shortfall = Math.max(0, minStock - currentStock);
  if (shortfall > 0) {
    reasons.push(`Shortfall vs minimum stock: ${shortfall}`);
    qty = Math.max(qty, shortfall);
  }
  const monthly = Math.max(0, Math.round(avgMonthlySales));
  if (monthly > 0) {
    reasons.push(`Average monthly sales: ${monthly}`);
    qty = Math.max(qty, shortfall + monthly);
  }
  if (qty === 0) reasons.push("No reorder needed right now.");
  return { recommendedQty: qty, reasons };
}

/** Average monthly units sold for a product over the last N days (default 90). */
export async function avgMonthlySales(
  shopId: string,
  productId: string,
  days = 90
): Promise<number> {
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
  const rows = await db
    .select({ qty: sql<number>`coalesce(sum(${saleItems.quantity}),0)` })
    .from(saleItems)
    .innerJoin(sales, eq(saleItems.saleId, sales.id))
    .where(
      and(
        eq(sales.shopId, shopId),
        eq(saleItems.productId, productId),
        sql`${sales.saleDate} >= ${since}`
      )
    );
  const total = Number(rows[0]?.qty ?? 0);
  return (total / days) * 30;
}
