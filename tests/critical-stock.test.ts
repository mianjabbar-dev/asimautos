/**
 * CRITICAL STOCK TESTS for ASIM AUTOS.
 * Run against a REAL PostgreSQL database via the app's own transaction
 * functions (src/lib/tx.ts) — the same code the UI uses.
 *
 * Usage:  DATABASE_URL=... npx vitest run tests/critical-stock.test.ts
 *
 * The suite uses a dedicated TEST001 shop so it never touches real data,
 * and cleans up after itself.
 */
import "dotenv/config";
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { eq, and, sql } from "drizzle-orm";
import { db } from "@/db";
import * as s from "@/db/schema";
import {
  createPurchase,
  createSale,
  createCustomerReturn,
  createSupplierReturn,
  adjustStock,
  paySale,
  payPurchase,
  InsufficientStockError,
  BusinessError,
} from "@/lib/tx";
import { ForbiddenError } from "@/lib/auth";
import { globalSearch } from "@/lib/search";

const SHOP = "TEST001";
const SHOP2 = "TEST002";

const owner = { id: "00000000-0000-0000-0000-000000000001", shopId: SHOP, role: "OWNER" as const };
const staff = { id: "00000000-0000-0000-0000-000000000002", shopId: SHOP, role: "STAFF" as const };

let productId = "";
let supplierId = "";
let customerId = "";

async function stockOf(id: string): Promise<number> {
  const [p] = await db.select().from(s.products).where(eq(s.products.id, id));
  return p.currentStock;
}

async function movementsFor(productId: string) {
  return db
    .select()
    .from(s.stockMovements)
    .where(and(eq(s.stockMovements.shopId, SHOP), eq(s.stockMovements.productId, productId)));
}

async function wipeShop(shopId: string) {
  // FK-safe order, strictly scoped to the given shop — never touches other shops.
  // Line items (purchase_items/sale_items/return_items) cascade from their parents.
  await db.delete(s.returns).where(eq(s.returns.shopId, shopId));
  await db.delete(s.stockMovements).where(eq(s.stockMovements.shopId, shopId));
  await db.delete(s.sales).where(eq(s.sales.shopId, shopId));
  await db.delete(s.purchases).where(eq(s.purchases.shopId, shopId));
  await db.delete(s.productVehicles).where(eq(s.productVehicles.shopId, shopId));
  await db.delete(s.products).where(eq(s.products.shopId, shopId));
  await db.delete(s.vehicles).where(eq(s.vehicles.shopId, shopId));
  await db.delete(s.categories).where(eq(s.categories.shopId, shopId));
  await db.delete(s.brands).where(eq(s.brands.shopId, shopId));
  await db.delete(s.suppliers).where(eq(s.suppliers.shopId, shopId));
  await db.delete(s.customers).where(eq(s.customers.shopId, shopId));
  await db.delete(s.notifications).where(eq(s.notifications.shopId, shopId));
  await db.delete(s.auditLogs).where(eq(s.auditLogs.shopId, shopId));
  await db.delete(s.users).where(eq(s.users.shopId, shopId));
  await db.delete(s.settings).where(eq(s.settings.shopId, shopId));
  await db.delete(s.shops).where(eq(s.shops.id, shopId));
}

beforeAll(async () => {
  // Clean slate for the test shops only
  for (const shopId of [SHOP, SHOP2]) await wipeShop(shopId);

  for (const [id, name] of [[SHOP, "Test Shop"], [SHOP2, "Other Shop"]] as const) {
    await db.insert(s.shops).values({ id, name, currency: "PKR" });
    await db.insert(s.settings).values({ shopId: id, shopName: name, invoicePrefix: "TST" });
  }

  // Real users so stock_movements.user_id FK is satisfied
  await db.insert(s.users).values([
    { id: owner.id, shopId: SHOP, name: "Test Owner", email: "test-owner@example.com", passwordHash: "x", role: "OWNER" },
    { id: staff.id, shopId: SHOP, name: "Test Staff", email: "test-staff@example.com", passwordHash: "x", role: "STAFF" },
  ]);

  const [sup] = await db
    .insert(s.suppliers)
    .values({ shopId: SHOP, name: "Test Supplier" })
    .returning();
  supplierId = sup.id;
  const [cust] = await db
    .insert(s.customers)
    .values({ shopId: SHOP, name: "Test Customer" })
    .returning();
  customerId = cust.id;

  const [prod] = await db
    .insert(s.products)
    .values({
      shopId: SHOP,
      name: "Test Air Filter",
      sku: "TEST-AF-001",
      partNumber: "TAF-001",
      oemNumber: "TEST-OEM-1",
      barcode: "999000000001",
      purchasePrice: 120000, // PKR 1200
      salePrice: 160000, // PKR 1600
      currentStock: 0,
      minStock: 5,
      reorderQty: 10,
      rack: "B", shelf: "04", bin: "12",
    })
    .returning();
  productId = prod.id;

  // Vehicle compatibility for search test 11
  const [veh] = await db
    .insert(s.vehicles)
    .values({ shopId: SHOP, make: "Toyota", model: "Corolla", yearFrom: 2014, yearTo: 2018 })
    .returning();
  await db.insert(s.productVehicles).values({ productId, vehicleId: veh.id, shopId: SHOP });

  // Opening stock of 10 via INITIAL adjustment
  await adjustStock(owner, productId, 10, "INITIAL", "test opening");
});

afterAll(async () => {
  for (const shopId of [SHOP, SHOP2]) await wipeShop(shopId);
});

describe("CRITICAL STOCK TESTS", () => {
  it("TEST 1: sell 2 from stock 10 -> stock 8", async () => {
    expect(await stockOf(productId)).toBe(10);
    await createSale(owner, { items: [{ productId, quantity: 2 }] });
    expect(await stockOf(productId)).toBe(8);
  });

  it("TEST 2: purchase 20 -> stock 28", async () => {
    await createPurchase(owner, {
      supplierId,
      invoiceNumber: "TEST-PUR-1",
      items: [{ productId, quantity: 20, purchasePrice: 120000, discount: 0 }],
      paidAmount: 20 * 120000,
    });
    expect(await stockOf(productId)).toBe(28);
  });

  it("TEST 3: min stock 30 with stock 28 -> classified LOW STOCK", async () => {
    await db.update(s.products).set({ minStock: 30 }).where(eq(s.products.id, productId));
    const [p] = await db.select().from(s.products).where(eq(s.products.id, productId));
    const isLow = p.currentStock > 0 && p.currentStock <= p.minStock;
    expect(isLow).toBe(true);
  });

  it("TEST 4: sell remaining 28 -> OUT OF STOCK (0)", async () => {
    await createSale(owner, { items: [{ productId, quantity: 28 }] });
    const [p] = await db.select().from(s.products).where(eq(s.products.id, productId));
    expect(p.currentStock).toBe(0);
  });

  it("TEST 5: oversell blocked with clear message", async () => {
    await expect(createSale(owner, { items: [{ productId, quantity: 5 }] })).rejects.toThrow(
      InsufficientStockError
    );
    try {
      await createSale(owner, { items: [{ productId, quantity: 5 }] });
    } catch (e) {
      expect((e as Error).message).toMatch(/Insufficient stock\. Only 0 unit\(s\) .* are available/);
    }
    expect(await stockOf(productId)).toBe(0); // unchanged
  });

  it("TEST 6: customer return increases stock", async () => {
    await createCustomerReturn(owner, {
      customerId,
      items: [{ productId, quantity: 3, unitPrice: 160000 }],
    });
    expect(await stockOf(productId)).toBe(3);
  });

  it("TEST 7: supplier return decreases stock", async () => {
    await createSupplierReturn(owner, {
      supplierId,
      items: [{ productId, quantity: 2, unitPrice: 120000 }],
    });
    expect(await stockOf(productId)).toBe(1);
  });

  it("TEST 8: manual adjustment writes movement + audit log", async () => {
    const before = await movementsFor(productId);
    await adjustStock(owner, productId, 15, "ADJUSTMENT", "test adjust");
    expect(await stockOf(productId)).toBe(15);
    const after = await movementsFor(productId);
    expect(after.length).toBe(before.length + 1);
    const last = after[after.length - 1];
    expect(last.type).toBe("ADJUSTMENT");
    expect(last.previousQty).toBe(1);
    expect(last.newQty).toBe(15);
    const audits = await db
      .select()
      .from(s.auditLogs)
      .where(and(eq(s.auditLogs.shopId, SHOP), eq(s.auditLogs.action, "STOCK_ADJUSTED")));
    expect(audits.length).toBeGreaterThan(0);
  });

  it("TEST 9: staff attempting admin-only operation is denied server-side", async () => {
    await expect(
      createPurchase(staff, {
        supplierId,
        invoiceNumber: "TEST-PUR-STAFF",
        items: [{ productId, quantity: 1, purchasePrice: 120000, discount: 0 }],
      })
    ).rejects.toThrow(ForbiddenError);
    await expect(adjustStock(staff, productId, 99, "ADJUSTMENT")).rejects.toThrow(ForbiddenError);
    await expect(
      createSupplierReturn(staff, {
        supplierId,
        items: [{ productId, quantity: 1, unitPrice: 120000 }],
      })
    ).rejects.toThrow(ForbiddenError);
    // staff CAN still sell (allowed operation)
    await createSale(staff, { items: [{ productId, quantity: 1 }] });
    expect(await stockOf(productId)).toBe(14);
  });

  it("TEST 10: search by part number returns the product", async () => {
    const res = await globalSearch(SHOP, "TAF-001");
    expect(res.some((r) => r.id === productId)).toBe(true);
  });

  it("TEST 11: search by vehicle returns compatible products", async () => {
    const res = await globalSearch(SHOP, "Corolla");
    expect(res.some((r) => r.id === productId)).toBe(true);
  });

  it("TEST 12: purchase updates supplier balance and inventory", async () => {
    const before = await stockOf(productId);
    const pur = await createPurchase(owner, {
      supplierId,
      invoiceNumber: "TEST-PUR-2",
      items: [{ productId, quantity: 10, purchasePrice: 120000, discount: 0 }],
      paidAmount: 0, // unpaid -> full remaining
    });
    expect(pur.remaining).toBe(10 * 120000);
    expect(await stockOf(productId)).toBe(before + 10);
    const bal = await db
      .select({ v: sql<number>`coalesce(sum(${s.purchases.remaining}),0)` })
      .from(s.purchases)
      .where(and(eq(s.purchases.shopId, SHOP), eq(s.purchases.supplierId, supplierId)));
    expect(Number(bal[0]?.v ?? 0)).toBeGreaterThan(0);
    // paying reduces the balance
    await payPurchase(owner, pur.id, 5 * 120000);
    const [updated] = await db.select().from(s.purchases).where(eq(s.purchases.id, pur.id));
    expect(updated.remaining).toBe(5 * 120000);
    expect(updated.paymentStatus).toBe("PARTIAL");
  });

  it("TEST 13: credit sale updates customer outstanding", async () => {
    const sale = await createSale(owner, {
      customerId,
      items: [{ productId, quantity: 2 }],
      paymentMethod: "CREDIT",
    });
    expect(sale.remaining).toBe(2 * 160000);
    expect(sale.paymentStatus).toBe("PENDING");
  });

  it("TEST 14: payment against customer balance decreases outstanding", async () => {
    const sales = await db
      .select()
      .from(s.sales)
      .where(and(eq(s.sales.shopId, SHOP), eq(s.sales.customerId, customerId)));
    const target = sales.find((x) => x.remaining > 0)!;
    expect(target).toBeDefined();
    const before = target.remaining;
    await paySale(owner, target.id, 160000);
    const [after] = await db.select().from(s.sales).where(eq(s.sales.id, target.id));
    expect(after.remaining).toBe(before - 160000);
  });

  it("TEST 15: tenant isolation — SHOP2 data invisible to SHOP", async () => {
    const [other] = await db
      .insert(s.products)
      .values({
        shopId: SHOP2,
        name: "Other Shop Filter",
        sku: "OTHER-001",
        purchasePrice: 100,
        salePrice: 200,
        currentStock: 50,
      })
      .returning();
    // globalSearch scoped to SHOP must not return SHOP2's product
    const res = await globalSearch(SHOP, "Other Shop Filter");
    expect(res.some((r) => r.id === other.id)).toBe(false);
    // tx functions reject cross-shop product ids
    await expect(
      createSale(owner, { items: [{ productId: other.id, quantity: 1 }] })
    ).rejects.toThrow(BusinessError);
    await expect(adjustStock(owner, other.id, 5, "ADJUSTMENT")).rejects.toThrow(BusinessError);
  });
});
