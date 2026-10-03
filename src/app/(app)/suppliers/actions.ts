"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { eq, and } from "drizzle-orm";
import { db } from "@/db";
import { suppliers } from "@/db/schema";
import { requireRole } from "@/lib/auth";
import { supplierSchema } from "@/lib/validators";
import { toResult } from "@/lib/actions";

function failRedirect(base: string, message: string): never {
  redirect(`${base}?error=${encodeURIComponent(message)}`);
}

/** toResult's message is optional on the ok-branch — narrow it for redirects. */
function errMsg(e: unknown): string {
  const r = toResult(e);
  return r.ok ? "Something went wrong. Please try again." : r.message;
}

function formToSupplierInput(formData: FormData) {
  return {
    name: formData.get("name"),
    contactPerson: formData.get("contactPerson"),
    phone: formData.get("phone"),
    whatsapp: formData.get("whatsapp"),
    email: formData.get("email"),
    address: formData.get("address"),
    city: formData.get("city"),
    paymentTerms: formData.get("paymentTerms"),
    notes: formData.get("notes"),
  };
}

/** Create a new supplier (OWNER only). */
export async function createSupplier(formData: FormData) {
  const session = await requireRole("OWNER");
  const parsed = supplierSchema.safeParse(formToSupplierInput(formData));
  if (!parsed.success) {
    const first = parsed.error.issues[0];
    failRedirect(
      "/suppliers/new",
      first ? `${first.path.join(".")}: ${first.message}` : "Invalid input."
    );
  }
  try {
    const [s] = await db
      .insert(suppliers)
      .values({ shopId: session.shopId, ...parsed.data })
      .returning({ id: suppliers.id });
    if (!s) failRedirect("/suppliers/new", "Could not create supplier.");
    revalidatePath("/suppliers");
    redirect(`/suppliers/${s.id}`);
  } catch (e) {
    failRedirect("/suppliers/new", errMsg(e));
  }
}

/** Update a supplier (OWNER only). */
export async function updateSupplier(id: string, formData: FormData) {
  const session = await requireRole("OWNER");
  const parsed = supplierSchema.safeParse(formToSupplierInput(formData));
  if (!parsed.success) {
    const first = parsed.error.issues[0];
    failRedirect(
      `/suppliers/${id}/edit`,
      first ? `${first.path.join(".")}: ${first.message}` : "Invalid input."
    );
  }
  try {
    await db
      .update(suppliers)
      .set({ ...parsed.data, updatedAt: new Date() })
      .where(and(eq(suppliers.id, id), eq(suppliers.shopId, session.shopId)));
    revalidatePath("/suppliers");
    revalidatePath(`/suppliers/${id}`);
    redirect(`/suppliers/${id}`);
  } catch (e) {
    failRedirect(`/suppliers/${id}/edit`, errMsg(e));
  }
}

/** Delete a supplier (OWNER only). FK usage is mapped to a friendly message. */
export async function deleteSupplier(formData: FormData) {
  const session = await requireRole("OWNER");
  const id = String(formData.get("id") ?? "");
  try {
    await db
      .delete(suppliers)
      .where(and(eq(suppliers.id, id), eq(suppliers.shopId, session.shopId)));
    revalidatePath("/suppliers");
    redirect("/suppliers");
  } catch (e) {
    failRedirect("/suppliers", errMsg(e));
  }
}
