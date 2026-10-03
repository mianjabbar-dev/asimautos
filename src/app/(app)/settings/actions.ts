"use server";

import { revalidatePath } from "next/cache";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { auditLogs, settings } from "@/db/schema";
import { requireRole } from "@/lib/auth";
import { ok, toResult, type ActionResult } from "@/lib/actions";
import { settingsSchema } from "@/lib/validators";

/** Update shop settings (used with useActionState). Creates the row if missing. */
export async function updateSettings(
  _prevState: ActionResult,
  formData: FormData
): Promise<ActionResult> {
  try {
    const session = await requireRole("OWNER");
    const parsed = settingsSchema.parse({
      shopName: formData.get("shopName"),
      phone: formData.get("phone"),
      address: formData.get("address"),
      city: formData.get("city"),
      invoicePrefix: formData.get("invoicePrefix"),
      taxRateBps: formData.get("taxRateBps"),
      defaultMinStock: formData.get("defaultMinStock"),
      defaultReorderQty: formData.get("defaultReorderQty"),
      businessHours: formData.get("businessHours"),
    });

    const values = {
      shopName: parsed.shopName,
      phone: parsed.phone ?? null,
      address: parsed.address ?? null,
      city: parsed.city,
      invoicePrefix: parsed.invoicePrefix,
      taxRateBps: parsed.taxRateBps,
      defaultMinStock: parsed.defaultMinStock,
      defaultReorderQty: parsed.defaultReorderQty,
      businessHours: parsed.businessHours ?? null,
    };

    const [existing] = await db
      .select()
      .from(settings)
      .where(eq(settings.shopId, session.shopId))
      .limit(1);

    if (existing) {
      const oldValue = {
        shopName: existing.shopName,
        phone: existing.phone,
        address: existing.address,
        city: existing.city,
        invoicePrefix: existing.invoicePrefix,
        taxRateBps: existing.taxRateBps,
        defaultMinStock: existing.defaultMinStock,
        defaultReorderQty: existing.defaultReorderQty,
        businessHours: existing.businessHours,
      };
      await db
        .update(settings)
        .set({ ...values, updatedAt: new Date() })
        .where(eq(settings.shopId, session.shopId));
      await db.insert(auditLogs).values({
        shopId: session.shopId,
        userId: session.id,
        action: "SETTINGS_UPDATED",
        entity: "settings",
        entityId: session.shopId,
        oldValue,
        newValue: values,
      });
    } else {
      await db.insert(settings).values({ shopId: session.shopId, ...values });
      await db.insert(auditLogs).values({
        shopId: session.shopId,
        userId: session.id,
        action: "SETTINGS_UPDATED",
        entity: "settings",
        entityId: session.shopId,
        oldValue: null,
        newValue: values,
      });
    }

    revalidatePath("/settings");
    return ok("Settings saved.");
  } catch (e) {
    return toResult(e);
  }
}
