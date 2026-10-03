"use server";

/**
 * Server actions for SALES / POS.
 *
 * - searchProductsAction: fast product lookup for the POS screen
 *   (matches name, SKU, part number, OEM, barcode, brand, category).
 * - createSaleAction: completes a POS sale via the tx engine
 *   (blocks oversell with a clear InsufficientStockError message).
 * - paySaleAction: records a payment against a sale.
 *
 * STAFF and OWNER may use all of these (enforced by requireSession + tx).
 */

import { revalidatePath } from "next/cache";
import { requireSession } from "@/lib/auth";
import {
  createSale,
  paySale,
} from "@/lib/tx";
import { saleSchema } from "@/lib/validators";
import { parsePaisaInput } from "@/lib/money";
import { toResult, ok, type ActionResult } from "@/lib/actions";
import { globalSearch } from "@/lib/search";

export type PosProduct = {
  id: string;
  name: string;
  sku: string | null;
  salePrice: number; // paisa
  currentStock: number;
};

/** Product search for the POS screen. Returns a light payload for speed. */
export async function searchProductsAction(q: string): Promise<PosProduct[]> {
  const session = await requireSession();
  const rows = await globalSearch(session.shopId, q, 12);
  return rows.map((r) => ({
    id: r.id,
    name: r.name,
    sku: r.sku,
    salePrice: r.salePrice,
    currentStock: r.currentStock,
  }));
}

export type CreateSaleInput = {
  customerId?: string;
  items: Array<{
    productId: string;
    quantity: number;
    /** unit sale price in PKR (not paisa) — converted server-side */
    salePrice?: number;
  }>;
  /** bill-level discount in PKR */
  discount?: number;
  /** paid amount in PKR */
  paidAmount?: number;
  paymentMethod?: "CASH" | "BANK" | "CREDIT" | "OTHER";
  notes?: string;
};

/** Complete a POS sale. Returns ok with the new sale id; the client redirects. */
export async function createSaleAction(input: CreateSaleInput): Promise<ActionResult> {
  try {
    const actor = await requireSession();
    const parsed = saleSchema.parse({
      customerId: input.customerId || undefined,
      items: input.items,
      discount: input.discount ?? 0,
      paidAmount: input.paidAmount,
      paymentMethod: input.paymentMethod ?? "CASH",
      notes: input.notes,
    });
    const sale = await createSale(actor, {
      customerId: parsed.customerId || undefined,
      items: parsed.items.map((it) => ({
        productId: it.productId,
        quantity: it.quantity,
        salePrice:
          it.salePrice === undefined ? undefined : parsePaisaInput(it.salePrice),
        discount: it.discount === undefined ? undefined : parsePaisaInput(it.discount),
      })),
      discount: parsePaisaInput(parsed.discount),
      paidAmount:
        parsed.paidAmount === undefined
          ? undefined
          : parsePaisaInput(parsed.paidAmount),
      paymentMethod: parsed.paymentMethod,
      notes: parsed.notes,
    });
    revalidatePath("/sales");
    return ok("Sale completed.", sale.id);
  } catch (e) {
    // InsufficientStockError carries the "Only X units available" message
    // and is surfaced prominently by the POS client.
    return toResult(e);
  }
}

/** Record a payment against a sale (form-data action for useActionState). */
export async function paySaleAction(
  _prev: ActionResult | null,
  formData: FormData
): Promise<ActionResult> {
  try {
    const actor = await requireSession();
    const saleId = String(formData.get("saleId") ?? "");
    const amount = parsePaisaInput(String(formData.get("amount") ?? ""));
    if (!saleId) return toResult(new Error("Missing sale id."));
    await paySale(actor, saleId, amount);
    revalidatePath("/sales");
    revalidatePath(`/sales/${saleId}`);
    revalidatePath("/customers");
    return ok("Payment recorded.");
  } catch (e) {
    return toResult(e);
  }
}
