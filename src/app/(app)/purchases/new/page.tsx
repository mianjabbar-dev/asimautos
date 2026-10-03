import { eq, and } from "drizzle-orm";
import { db } from "@/db";
import { suppliers, products } from "@/db/schema";
import { requireSession } from "@/lib/auth";
import { createPurchaseAction } from "../actions";
import { PurchaseForm, type PrefillLine } from "./purchase-form-client";
import { PageHeader, Alert, EmptyState, LinkButton } from "@/components/ui";

export const dynamic = "force-dynamic";

export default async function NewPurchasePage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; product?: string; qty?: string }>;
}) {
  const session = await requireSession();
  const { error, product: productId, qty } = await searchParams;

  if (session.role !== "OWNER") {
    return (
      <div>
        <PageHeader title="New Purchase" />
        <Alert tone="warning">
          Only the shop owner can record purchases. Your STAFF account can view
          purchases but not create them.
        </Alert>
      </div>
    );
  }

  const supplierList = await db
    .select({ id: suppliers.id, name: suppliers.name })
    .from(suppliers)
    .where(eq(suppliers.shopId, session.shopId))
    .orderBy(suppliers.name);

  let prefill: PrefillLine = null;
  if (productId) {
    const [p] = await db
      .select({ id: products.id, name: products.name, purchasePrice: products.purchasePrice })
      .from(products)
      .where(and(eq(products.id, productId), eq(products.shopId, session.shopId)))
      .limit(1);
    if (p) {
      const qtyNum = Math.max(1, parseInt(qty ?? "1", 10) || 1);
      prefill = {
        productId: p.id,
        productName: p.name,
        purchasePrice: p.purchasePrice,
        qty: qtyNum,
      };
    }
  }

  const today = new Date().toISOString().slice(0, 10);

  if (supplierList.length === 0) {
    return (
      <div>
        <PageHeader title="New Purchase" subtitle="Record stock bought from a supplier." />
        <EmptyState
          title="Add a supplier first"
          message="A purchase needs a supplier. Create one before recording this invoice."
          action={<LinkButton href="/suppliers/new">+ New Supplier</LinkButton>}
        />
      </div>
    );
  }

  return (
    <div>
      <PageHeader
        title="New Purchase"
        subtitle="Recording a purchase adds stock automatically and tracks what you owe the supplier."
      />
      <PurchaseForm
        suppliers={supplierList}
        createAction={createPurchaseAction}
        prefill={prefill}
        error={error}
        today={today}
      />
    </div>
  );
}
