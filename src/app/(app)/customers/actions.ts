"use server";

/**
 * Server actions for CUSTOMERS. STAFF and OWNER may manage customers.
 * Delete is guarded: a customer with sales or return history cannot be
 * deleted (their rows would otherwise lose the link).
 */

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { eq, and, sql } from "drizzle-orm";
import { db } from "@/db";
import { customers, sales, returns } from "@/db/schema";
import { requireSession } from "@/lib/auth";
import { customerSchema } from "@/lib/validators";
import { toResult, type ActionResult } from "@/lib/actions";

function parseCustomer(formData: FormData) {
  return customerSchema.parse({
    name: formData.get("name"),
    phone: formData.get("phone"),
    address: formData.get("address"),
    vehicle: formData.get("vehicle"),
    notes: formData.get("notes"),
  });
}

export async function createCustomerAction(
  _prev: ActionResult | null,
  formData: FormData
): Promise<ActionResult> {
  try {
    const session = await requireSession();
    const data = parseCustomer(formData);
    const [c] = await db
      .insert(customers)
      .values({ shopId: session.shopId, ...data })
      .returning({ id: customers.id });
    revalidatePath("/customers");
    redirect(`/customers/${c.id}`);
  } catch (e) {
    return toResult(e);
  }
}

export async function updateCustomerAction(
  _prev: ActionResult | null,
  formData: FormData
): Promise<ActionResult> {
  try {
    const session = await requireSession();
    const id = String(formData.get("id") ?? "");
    if (!id) return toResult(new Error("Missing customer id."));
    const data = parseCustomer(formData);
    const updated = await db
      .update(customers)
      .set({ ...data, updatedAt: new Date() })
      .where(and(eq(customers.id, id), eq(customers.shopId, session.shopId)))
      .returning({ id: customers.id });
    if (!updated[0]) return toResult(new Error("Customer not found."));
    revalidatePath("/customers");
    revalidatePath(`/customers/${id}`);
    redirect(`/customers/${id}`);
  } catch (e) {
    return toResult(e);
  }
}

export async function deleteCustomerAction(formData: FormData): Promise<void> {
  const id = String(formData.get("id") ?? "");
  const from = String(formData.get("from") ?? "/customers");
  try {
    const session = await requireSession();
    if (!id) throw new Error("Missing customer id.");

    const [saleCount] = await db
      .select({ v: sql<number>`count(*)` })
      .from(sales)
      .where(and(eq(sales.customerId, id), eq(sales.shopId, session.shopId)));
    const [returnCount] = await db
      .select({ v: sql<number>`count(*)` })
      .from(returns)
      .where(and(eq(returns.customerId, id), eq(returns.shopId, session.shopId)));

    if (Number(saleCount?.v ?? 0) > 0 || Number(returnCount?.v ?? 0) > 0) {
      throw new Error("Cannot delete: this customer has sales or return history.");
    }

    await db
      .delete(customers)
      .where(and(eq(customers.id, id), eq(customers.shopId, session.shopId)));
    revalidatePath("/customers");
  } catch (e) {
    const r = toResult(e);
    redirect(from + "?error=" + encodeURIComponent(r.message ?? "Something went wrong."));
  }
  redirect("/customers?message=" + encodeURIComponent("Customer deleted."));
}
