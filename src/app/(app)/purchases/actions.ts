"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { eq, and, ilike, or } from "drizzle-orm";
import { db } from "@/db";
import { products } from "@/db/schema";
import { requireSession, requireRole } from "@/lib/auth";
import { purchaseSchema } from "@/lib/validators";
import { parsePaisaInput } from "@/lib/money";
import { createPurchase, payPurchase, BusinessError } from "@/lib/tx";
import { toResult } from "@/lib/actions";

function failRedirect(base: string, message: string): never {
  redirect(`${base}?error=${encodeURIComponent(message)}`);
}

/** toResult's message is optional on the ok-branch — narrow it for redirects. */
function errMsg(e: unknown): string {
  const r = toResult(e);
  return r.ok ? "Something went wrong. Please try again." : r.message;
}

/** Create a purchase with line items, updating stock (OWNER only). */
export async function createPurchaseAction(formData: FormData) {
  const session = await requireRole("OWNER");

  let rawItems: unknown;
  try {
    rawItems = JSON.parse(String(formData.get("items") ?? "[]"));
  } catch {
    failRedirect("/purchases/new", "Could not read the line items. Try again.");
  }

  const parsed = purchaseSchema.safeParse({
    supplierId: formData.get("supplierId"),
    invoiceNumber: formData.get("invoiceNumber"),
    purchaseDate: formData.get("purchaseDate") || undefined,
    items: rawItems,
    paidAmount: formData.get("paidAmount") || 0,
    notes: formData.get("notes"),
  });
  if (!parsed.success) {
    const first = parsed.error.issues[0];
    failRedirect(
      "/purchases/new",
      first ? `${first.path.join(".")}: ${first.message}` : "Invalid input."
    );
  }

  try {
    const purchase = await createPurchase(
      { id: session.id, shopId: session.shopId, role: session.role },
      {
        supplierId: parsed.data.supplierId,
        invoiceNumber: parsed.data.invoiceNumber,
        purchaseDate: parsed.data.purchaseDate
          ? new Date(`${parsed.data.purchaseDate}T00:00:00`)
          : undefined,
        items: parsed.data.items.map((it) => ({
          productId: it.productId,
          quantity: it.quantity,
          purchasePrice: parsePaisaInput(it.purchasePrice),
          discount: parsePaisaInput(it.discount ?? 0),
        })),
        paidAmount: parsePaisaInput(parsed.data.paidAmount ?? 0),
        notes: parsed.data.notes,
      }
    );
    revalidatePath("/purchases");
    if (!purchase) throw new BusinessError("Could not create purchase.");
    redirect(`/purchases/${purchase.id}`);
  } catch (e) {
    failRedirect("/purchases/new", errMsg(e));
  }
}

/** Record a payment against a purchase (OWNER only). */
export async function recordPaymentAction(formData: FormData) {
  const session = await requireRole("OWNER");
  const purchaseId = String(formData.get("purchaseId") ?? "");
  const back = `/purchases/${purchaseId}`;
  let amount: number;
  try {
    amount = parsePaisaInput(String(formData.get("amount") ?? ""));
  } catch {
    failRedirect(back, "Enter a valid payment amount.");
  }
  try {
    await payPurchase(
      { id: session.id, shopId: session.shopId, role: session.role },
      purchaseId,
      amount
    );
    revalidatePath(back);
    revalidatePath("/purchases");
    revalidatePath("/suppliers");
    redirect(back);
  } catch (e) {
    failRedirect(back, errMsg(e));
  }
}

/** Product search for purchase line items. Returns id, name and last purchase price. */
export async function searchProductsAction(
  query: string
): Promise<Array<{ id: string; name: string; purchasePrice: number }>> {
  const session = await requireSession();
  const q = query.trim();
  if (!q) return [];
  const like = `%${q}%`;
  return db
    .select({ id: products.id, name: products.name, purchasePrice: products.purchasePrice })
    .from(products)
    .where(
      and(
        eq(products.shopId, session.shopId),
        eq(products.active, true),
        or(
          ilike(products.name, like),
          ilike(products.sku, like),
          ilike(products.partNumber, like),
          ilike(products.oemNumber, like),
          ilike(products.barcode, like)
        )
      )
    )
    .orderBy(products.name)
    .limit(10);
}
