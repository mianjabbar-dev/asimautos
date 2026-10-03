"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { eq, and, inArray } from "drizzle-orm";
import { db } from "@/db";
import {
  products,
  categories,
  brands,
  suppliers,
  vehicles,
  productVehicles,
  stockMovements,
} from "@/db/schema";
import { requireRole } from "@/lib/auth";
import { toResult, fail, type ActionResult } from "@/lib/actions";
import { productSchema } from "@/lib/validators";
import { parsePaisaInput } from "@/lib/money";

/** Read a form field as a string ("" when missing). */
function s(formData: FormData, name: string): string {
  const v = formData.get(name);
  return typeof v === "string" ? v : "";
}

function parseProductForm(formData: FormData) {
  return productSchema.safeParse({
    name: s(formData, "name"),
    sku: s(formData, "sku"),
    partNumber: s(formData, "partNumber"),
    oemNumber: s(formData, "oemNumber"),
    barcode: s(formData, "barcode"),
    categoryId: s(formData, "categoryId"),
    brandId: s(formData, "brandId"),
    supplierId: s(formData, "supplierId"),
    purchasePrice: s(formData, "purchasePrice"),
    salePrice: s(formData, "salePrice"),
    currentStock: s(formData, "currentStock"),
    minStock: s(formData, "minStock"),
    maxStock: s(formData, "maxStock") === "" ? undefined : s(formData, "maxStock"),
    reorderQty: s(formData, "reorderQty"),
    rack: s(formData, "rack"),
    shelf: s(formData, "shelf"),
    bin: s(formData, "bin"),
    imageUrl: s(formData, "imageUrl"),
    description: s(formData, "description"),
    active: formData.get("active"),
    vehicleIds: formData
      .getAll("vehicleIds")
      .filter((v): v is string => typeof v === "string"),
  });
}

/** Verify an FK reference id exists inside the caller's shop. */
async function assertInShop(
  shopId: string,
  table: typeof categories | typeof brands | typeof suppliers,
  id: string | undefined,
  label: string
) {
  if (!id) return;
  const [row] = await db
    .select({ id: table.id })
    .from(table)
    .where(and(eq(table.id, id), eq(table.shopId, shopId)))
    .limit(1);
  if (!row) throw new Error(`Selected ${label} does not exist.`);
}

/** Keep only vehicle ids that belong to the caller's shop. */
async function validVehicleIds(
  shopId: string,
  ids: string[]
): Promise<string[]> {
  if (ids.length === 0) return [];
  const rows = await db
    .select({ id: vehicles.id })
    .from(vehicles)
    .where(and(eq(vehicles.shopId, shopId), inArray(vehicles.id, ids)));
  return rows.map((r) => r.id);
}

/* ------------------------------------------------------------------ */
/* Create (OWNER only) — used with useActionState, redirects on success */
/* ------------------------------------------------------------------ */

export async function createProductAction(
  _prev: ActionResult | undefined,
  formData: FormData
): Promise<ActionResult> {
  let id = "";
  try {
    const session = await requireRole("OWNER");
    const parsed = parseProductForm(formData);
    if (!parsed.success) return toResult(parsed.error);
    const d = parsed.data;

    if (s(formData, "purchasePrice").trim() === "")
      return fail("Purchase price is required.");
    if (s(formData, "salePrice").trim() === "")
      return fail("Sale price is required.");

    await assertInShop(session.shopId, categories, d.categoryId, "category");
    await assertInShop(session.shopId, brands, d.brandId, "brand");
    await assertInShop(session.shopId, suppliers, d.supplierId, "supplier");
    const vehicleIds = await validVehicleIds(session.shopId, d.vehicleIds);

    const purchasePrice = parsePaisaInput(d.purchasePrice);
    const salePrice = parsePaisaInput(d.salePrice);
    const initialStock = d.currentStock;

    const [created] = await db.transaction(async (tx) => {
      const [p] = await tx
        .insert(products)
        .values({
          shopId: session.shopId,
          name: d.name,
          sku: d.sku ?? null,
          partNumber: d.partNumber ?? null,
          oemNumber: d.oemNumber ?? null,
          barcode: d.barcode ?? null,
          categoryId: d.categoryId ?? null,
          brandId: d.brandId ?? null,
          supplierId: d.supplierId ?? null,
          purchasePrice,
          salePrice,
          currentStock: initialStock,
          minStock: d.minStock,
          maxStock: d.maxStock ?? null,
          reorderQty: d.reorderQty,
          rack: d.rack ?? null,
          shelf: d.shelf ?? null,
          bin: d.bin ?? null,
          imageUrl: d.imageUrl ?? null,
          description: d.description ?? null,
          active: d.active,
        })
        .returning({ id: products.id });

      if (initialStock > 0) {
        await tx.insert(stockMovements).values({
          shopId: session.shopId,
          productId: p.id,
          previousQty: 0,
          changeQty: initialStock,
          newQty: initialStock,
          type: "INITIAL",
          userId: session.id,
          note: "Initial stock on product creation",
        });
      }
      if (vehicleIds.length > 0) {
        await tx.insert(productVehicles).values(
          vehicleIds.map((vehicleId) => ({
            productId: p.id,
            vehicleId,
            shopId: session.shopId,
          }))
        );
      }
      return [p];
    });

    id = created.id;
    revalidatePath("/products");
  } catch (e) {
    return toResult(e);
  }
  redirect(
    `/products/${id}?message=` + encodeURIComponent("Product created.")
  );
}

/* ------------------------------------------------------------------ */
/* Update (OWNER only) — used with useActionState, redirects on success */
/* ------------------------------------------------------------------ */

export async function updateProductAction(
  _prev: ActionResult | undefined,
  formData: FormData
): Promise<ActionResult> {
  let id = "";
  try {
    const session = await requireRole("OWNER");
    id = s(formData, "id");
    if (!id) return fail("Missing product id.");
    const parsed = parseProductForm(formData);
    if (!parsed.success) return toResult(parsed.error);
    const d = parsed.data;

    const [existing] = await db
      .select({ id: products.id })
      .from(products)
      .where(and(eq(products.id, id), eq(products.shopId, session.shopId)))
      .limit(1);
    if (!existing) return fail("Product not found.");

    await assertInShop(session.shopId, categories, d.categoryId, "category");
    await assertInShop(session.shopId, brands, d.brandId, "brand");
    await assertInShop(session.shopId, suppliers, d.supplierId, "supplier");
    const vehicleIds = await validVehicleIds(session.shopId, d.vehicleIds);

    await db.transaction(async (tx) => {
      await tx
        .update(products)
        .set({
          name: d.name,
          sku: d.sku ?? null,
          partNumber: d.partNumber ?? null,
          oemNumber: d.oemNumber ?? null,
          barcode: d.barcode ?? null,
          categoryId: d.categoryId ?? null,
          brandId: d.brandId ?? null,
          supplierId: d.supplierId ?? null,
          purchasePrice: parsePaisaInput(d.purchasePrice),
          salePrice: parsePaisaInput(d.salePrice),
          // NOTE: currentStock is intentionally NOT updated here — stock only
          // changes through purchases, sales and adjustments.
          minStock: d.minStock,
          maxStock: d.maxStock ?? null,
          reorderQty: d.reorderQty,
          rack: d.rack ?? null,
          shelf: d.shelf ?? null,
          bin: d.bin ?? null,
          imageUrl: d.imageUrl ?? null,
          description: d.description ?? null,
          active: d.active,
          updatedAt: new Date(),
        })
        .where(
          and(eq(products.id, id), eq(products.shopId, session.shopId))
        );
      await tx
        .delete(productVehicles)
        .where(
          and(
            eq(productVehicles.productId, id),
            eq(productVehicles.shopId, session.shopId)
          )
        );
      if (vehicleIds.length > 0) {
        await tx.insert(productVehicles).values(
          vehicleIds.map((vehicleId) => ({
            productId: id,
            vehicleId,
            shopId: session.shopId,
          }))
        );
      }
    });

    revalidatePath("/products");
    revalidatePath(`/products/${id}`);
  } catch (e) {
    return toResult(e);
  }
  redirect(
    `/products/${id}?message=` + encodeURIComponent("Product updated.")
  );
}

/* ------------------------------------------------------------------ */
/* Delete (OWNER only) — plain form action, redirects                  */
/* ------------------------------------------------------------------ */

export async function deleteProductAction(formData: FormData) {
  const id = s(formData, "id");
  try {
    const session = await requireRole("OWNER");
    if (!id) throw new Error("Missing product id.");
    const [existing] = await db
      .select({ id: products.id })
      .from(products)
      .where(and(eq(products.id, id), eq(products.shopId, session.shopId)))
      .limit(1);
    if (!existing) throw new Error("Product not found.");
    await db
      .delete(products)
      .where(and(eq(products.id, id), eq(products.shopId, session.shopId)));
    revalidatePath("/products");
  } catch (e) {
    const r = toResult(e);
    redirect(
      "/products?error=" +
        encodeURIComponent(r.ok ? "Something went wrong." : r.message)
    );
  }
  redirect("/products?message=" + encodeURIComponent("Product deleted."));
}
