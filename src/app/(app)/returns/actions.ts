"use server";

/**
 * Server actions for RETURNS.
 * - Customer returns: STAFF and OWNER.
 * - Supplier returns: OWNER only (enforced here and inside tx).
 */

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requireSession, requireRole } from "@/lib/auth";
import { createCustomerReturn, createSupplierReturn } from "@/lib/tx";
import { customerReturnSchema, supplierReturnSchema } from "@/lib/validators";
import { parsePaisaInput } from "@/lib/money";
import { toResult, type ActionResult } from "@/lib/actions";

/** Line items arrive from the client form as JSON in a hidden field. */
function parseItemsJson(raw: FormDataEntryValue | null): unknown[] {
  if (typeof raw !== "string" || !raw.trim()) return [];
  const parsed: unknown = JSON.parse(raw);
  return Array.isArray(parsed) ? parsed : [];
}

function toPaisaItems(items: Array<{ productId: string; quantity: number; unitPrice: string | number }>) {
  return items.map((it) => ({
    productId: it.productId,
    quantity: it.quantity,
    unitPrice: parsePaisaInput(it.unitPrice),
  }));
}

export async function createCustomerReturnAction(
  _prev: ActionResult | null,
  formData: FormData
): Promise<ActionResult> {
  try {
    const actor = await requireSession();
    const parsed = customerReturnSchema.parse({
      saleId: formData.get("saleId") || undefined,
      customerId: formData.get("customerId") || undefined,
      items: parseItemsJson(formData.get("itemsJson")),
      notes: formData.get("notes"),
    });
    await createCustomerReturn(actor, {
      saleId: parsed.saleId,
      customerId: parsed.customerId,
      items: toPaisaItems(
        parsed.items as Array<{ productId: string; quantity: number; unitPrice: string | number }>
      ),
      notes: parsed.notes,
    });
    revalidatePath("/returns");
    redirect("/returns");
  } catch (e) {
    return toResult(e);
  }
}

export async function createSupplierReturnAction(
  _prev: ActionResult | null,
  formData: FormData
): Promise<ActionResult> {
  try {
    const actor = await requireRole("OWNER");
    const parsed = supplierReturnSchema.parse({
      purchaseId: formData.get("purchaseId") || undefined,
      supplierId: formData.get("supplierId"),
      items: parseItemsJson(formData.get("itemsJson")),
      notes: formData.get("notes"),
    });
    await createSupplierReturn(actor, {
      purchaseId: parsed.purchaseId,
      supplierId: parsed.supplierId,
      items: toPaisaItems(
        parsed.items as Array<{ productId: string; quantity: number; unitPrice: string | number }>
      ),
      notes: parsed.notes,
    });
    revalidatePath("/returns");
    redirect("/returns");
  } catch (e) {
    return toResult(e);
  }
}
