"use server";

/**
 * Server actions for the Inventory module.
 * Stock adjustment is OWNER-only (enforced again inside adjustStock).
 */
import { revalidatePath } from "next/cache";
import { requireSession } from "@/lib/auth";
import { adjustStock } from "@/lib/tx";
import { stockAdjustSchema } from "@/lib/validators";
import {
  ok,
  toResult,
  type ActionResult,
} from "@/lib/actions";

export async function adjustStockAction(
  formData: FormData
): Promise<ActionResult> {
  try {
    const session = await requireSession();
    const parsed = stockAdjustSchema.parse({
      productId: formData.get("productId"),
      newQty: formData.get("newQty"),
      reason: formData.get("reason"),
      note: formData.get("note"),
    });
    await adjustStock(
      session,
      parsed.productId,
      parsed.newQty,
      parsed.reason,
      parsed.note
    );
    revalidatePath("/inventory");
    revalidatePath("/low-stock");
    revalidatePath("/out-of-stock");
    return ok(`Stock updated to ${parsed.newQty} units.`);
  } catch (e) {
    return toResult(e);
  }
}
