"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { eq, and, sql } from "drizzle-orm";
import { db } from "@/db";
import { categories, products } from "@/db/schema";
import { requireRole } from "@/lib/auth";
import { toResult, ok, fail, type ActionResult } from "@/lib/actions";
import { categorySchema } from "@/lib/validators";

function s(formData: FormData, name: string): string {
  const v = formData.get(name);
  return typeof v === "string" ? v : "";
}

function parseCategoryForm(formData: FormData) {
  return categorySchema.safeParse({
    name: s(formData, "name"),
    description: s(formData, "description"),
  });
}

export async function createCategoryAction(
  _prev: ActionResult | undefined,
  formData: FormData
): Promise<ActionResult> {
  try {
    const session = await requireRole("OWNER");
    const parsed = parseCategoryForm(formData);
    if (!parsed.success) return toResult(parsed.error);
    await db.insert(categories).values({
      shopId: session.shopId,
      name: parsed.data.name,
      description: parsed.data.description ?? null,
    });
    revalidatePath("/categories");
    return ok("Category created.");
  } catch (e) {
    return toResult(e);
  }
}

export async function updateCategoryAction(
  _prev: ActionResult | undefined,
  formData: FormData
): Promise<ActionResult> {
  try {
    const session = await requireRole("OWNER");
    const id = s(formData, "id");
    if (!id) return fail("Missing category id.");
    const parsed = parseCategoryForm(formData);
    if (!parsed.success) return toResult(parsed.error);
    const [updated] = await db
      .update(categories)
      .set({
        name: parsed.data.name,
        description: parsed.data.description ?? null,
        updatedAt: new Date(),
      })
      .where(
        and(eq(categories.id, id), eq(categories.shopId, session.shopId))
      )
      .returning({ id: categories.id });
    if (!updated) return fail("Category not found.");
    revalidatePath("/categories");
    return ok("Category updated.");
  } catch (e) {
    return toResult(e);
  }
}

export async function deleteCategoryAction(formData: FormData) {
  const id = s(formData, "id");
  try {
    const session = await requireRole("OWNER");
    if (!id) throw new Error("Missing category id.");
    const [existing] = await db
      .select({ id: categories.id, name: categories.name })
      .from(categories)
      .where(and(eq(categories.id, id), eq(categories.shopId, session.shopId)))
      .limit(1);
    if (!existing) throw new Error("Category not found.");
    // FK guard: deleting is only safe when no product uses this category.
    // (The FK itself is ON DELETE SET NULL, so we check explicitly to avoid
    // silently orphaning products.)
    const [{ v }] = await db
      .select({ v: sql<number>`count(*)` })
      .from(products)
      .where(
        and(
          eq(products.categoryId, id),
          eq(products.shopId, session.shopId)
        )
      );
    const inUse = Number(v ?? 0);
    if (inUse > 0) {
      throw new Error(
        `Cannot delete "${existing.name}": it is used by ${inUse} product${inUse === 1 ? "" : "s"}.`
      );
    }
    await db
      .delete(categories)
      .where(
        and(eq(categories.id, id), eq(categories.shopId, session.shopId))
      );
    revalidatePath("/categories");
  } catch (e) {
    const r = toResult(e);
    redirect(
      "/categories?error=" +
        encodeURIComponent(r.ok ? "Something went wrong." : r.message)
    );
  }
  redirect("/categories?message=" + encodeURIComponent("Category deleted."));
}
