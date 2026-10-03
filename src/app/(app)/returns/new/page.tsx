/**
 * /returns/new — type toggle (?type=customer|supplier). Supplier returns are
 * OWNER only: the toggle is hidden for STAFF and the page refuses access.
 */
import { and, eq, desc } from "drizzle-orm";
import { db } from "@/db";
import {
  customers,
  suppliers,
  sales,
  purchases,
  products,
} from "@/db/schema";
import { requireSession } from "@/lib/auth";
import { PageHeader, LinkButton, Alert } from "@/components/ui";
import { ReturnsForm } from "./returns-client";

export default async function NewReturnPage({
  searchParams,
}: {
  searchParams: Promise<{ type?: string }>;
}) {
  const session = await requireSession();
  const { type } = await searchParams;
  const returnType = type === "supplier" ? "supplier" : "customer";
  const isOwner = session.role === "OWNER";

  if (returnType === "supplier" && !isOwner) {
    return (
      <div>
        <PageHeader title="New Return" />
        <Alert tone="danger">
          Supplier returns require OWNER permission. Your STAFF account cannot
          perform this action.
        </Alert>
      </div>
    );
  }

  const [customerList, supplierList, productList, recentSales, recentPurchases] =
    await Promise.all([
      db
        .select({ id: customers.id, name: customers.name })
        .from(customers)
        .where(eq(customers.shopId, session.shopId))
        .orderBy(customers.name)
        .limit(500),
      db
        .select({ id: suppliers.id, name: suppliers.name })
        .from(suppliers)
        .where(eq(suppliers.shopId, session.shopId))
        .orderBy(suppliers.name)
        .limit(500),
      db
        .select({
          id: products.id,
          name: products.name,
          sku: products.sku,
          salePrice: products.salePrice,
          purchasePrice: products.purchasePrice,
          currentStock: products.currentStock,
        })
        .from(products)
        .where(and(eq(products.shopId, session.shopId), eq(products.active, true)))
        .orderBy(products.name)
        .limit(2000),
      db
        .select({ id: sales.id, invoiceNumber: sales.invoiceNumber })
        .from(sales)
        .where(eq(sales.shopId, session.shopId))
        .orderBy(desc(sales.saleDate))
        .limit(50),
      db
        .select({ id: purchases.id, invoiceNumber: purchases.invoiceNumber })
        .from(purchases)
        .where(eq(purchases.shopId, session.shopId))
        .orderBy(desc(purchases.purchaseDate))
        .limit(50),
    ]);

  return (
    <div>
      <PageHeader
        title="New Return"
        actions={
          <div className="flex gap-2">
            <LinkButton
              href="/returns/new?type=customer"
              variant={returnType === "customer" ? "primary" : "secondary"}
            >
              Customer Return
            </LinkButton>
            {isOwner && (
              <LinkButton
                href="/returns/new?type=supplier"
                variant={returnType === "supplier" ? "primary" : "secondary"}
              >
                Supplier Return
              </LinkButton>
            )}
          </div>
        }
      />
      <ReturnsForm
        returnType={returnType}
        customers={customerList}
        suppliers={supplierList}
        recentSales={recentSales}
        recentPurchases={recentPurchases}
        products={productList}
      />
    </div>
  );
}
