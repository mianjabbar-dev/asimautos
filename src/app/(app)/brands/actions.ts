"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { eq, and, sql } from "drizzle-orm";
import { db } from "@/db";
import { brands, products } from "@/db/schema";
import { requireRole } from "@/lib/auth";
import { toResult, ok, fail, type ActionResult } from "@/lib/actions";
import { brandSchema } from "@/lib/validators";

function s(formData: FormData, name: string): string {
  const v = formData.get(name);
  return typeof v === "string" ? v : "";
}

function parseBrandForm(formData: FormData) {
  return brandSchema.safeParse({
    name: s(formData, "name"),
    description: s(formData, "description"),
  });
}

export async function createBrandAction(
  _prev: ActionResult | undefined,
  formData: FormData
): Promise<ActionResult> {
  try {
    const session = await requireRole("OWNER");
    const parsed = parseBrandForm(formData);
    if (!parsed.success) return toResult(parsed.error);
    await db.insert(brands).values({
      shopId: session.shopId,
      name: parsed.data.name,
      description: parsed.data.description ?? null,
    });
    revalidatePath("/brands");
    return ok("Brand created.");
  } catch (e) {
    return toResult(e);
  }
}

export async function updateBrandAction(
  _prev: ActionResult | undefined,
  formData: FormData
): Promise<ActionResult> {
  try {
    const session = await requireRole("OWNER");
    const id = s(formData, "id");
    if (!id) return fail("Missing brand id.");
    const parsed = parseBrandForm(formData);
    if (!parsed.success) return toResult(parsed.error);
    const [updated] = await db
      .update(brands)
      .set({
        name: parsed.data.name,
        description: parsed.data.description ?? null,
        updatedAt: new Date(),
      })
      .where(and(eq(brands.id, id), eq(brands.shopId, session.shopId)))
      .returning({ id: brands.id });
    if (!updated) return fail("Brand not found.");
    revalidatePath("/brands");
    return ok("Brand updated.");
  } catch (e) {
    return toResult(e);
  }
}

export async function deleteBrandAction(formData: FormData) {
  const id = s(formData, "id");
  try {
    const session = await requireRole("OWNER");
    if (!id) throw new Error("Missing brand id.");
    const [existing] = await db
      .select({ id: brands.id, name: brands.name })
      .from(brands)
      .where(and(eq(brands.id, id), eq(brands.shopId, session.shopId)))
      .limit(1);
    if (!existing) throw new Error("Brand not found.");
    // FK guard: block while products reference this brand (FK is SET NULL,
    // so check explicitly to avoid silently orphaning products).
    const [{ v }] = await db
      .select({ v: sql<number>`count(*)` })
      .from(products)
      .where(
        and(eq(products.brandId, id), eq(products.shopId, session.shopId))
      );
    const inUse = Number(v ?? 0);
    if (inUse > 0) {
      throw new Error(
        `Cannot delete "${existing.name}": it is used by ${inUse} product${inUse === 1 ? "" : "s"}.`
      );
    }
    await db
      .delete(brands)
      .where(and(eq(brands.id, id), eq(brands.shopId, session.shopId)));
    revalidatePath("/brands");
  } catch (e) {
    const r = toResult(e);
    redirect(
      "/brands?error=" +
        encodeURIComponent(r.ok ? "Something went wrong." : r.message)
    );
  }
  redirect("/brands?message=" + encodeURIComponent("Brand deleted."));
}
