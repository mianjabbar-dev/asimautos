import Link from "next/link";
import { notFound } from "next/navigation";
import { eq, and } from "drizzle-orm";
import { db } from "@/db";
import { purchases, purchaseItems, products, suppliers } from "@/db/schema";
import { requireSession } from "@/lib/auth";
import { formatPKR } from "@/lib/money";
import { recordPaymentAction } from "../actions";
import {
  PageHeader,
  Card,
  CardHeader,
  Stat,
  Badge,
  Table,
  Th,
  Td,
  Field,
  Input,
  Button,
  FormMessage,
} from "@/components/ui";

export const dynamic = "force-dynamic";

function StatusBadge({ status }: { status: "PAID" | "PARTIAL" | "PENDING" }) {
  const tone =
    status === "PAID" ? "success" : status === "PARTIAL" ? "warning" : "danger";
  return <Badge tone={tone}>{status}</Badge>;
}

function fmtDate(d: Date) {
  return d.toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

export default async function PurchaseDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ error?: string }>;
}) {
  const { id } = await params;
  const session = await requireSession();
  const { error } = await searchParams;
  const isOwner = session.role === "OWNER";

  const [purchase] = await db
    .select({
      id: purchases.id,
      invoiceNumber: purchases.invoiceNumber,
      purchaseDate: purchases.purchaseDate,
      supplierId: purchases.supplierId,
      supplierName: suppliers.name,
      subtotal: purchases.subtotal,
      discount: purchases.discount,
      total: purchases.total,
      paidAmount: purchases.paidAmount,
      remaining: purchases.remaining,
      paymentStatus: purchases.paymentStatus,
      notes: purchases.notes,
    })
    .from(purchases)
    .leftJoin(suppliers, eq(purchases.supplierId, suppliers.id))
    .where(and(eq(purchases.id, id), eq(purchases.shopId, session.shopId)))
    .limit(1);

  if (!purchase) notFound();

  const items = await db
    .select({
      id: purchaseItems.id,
      productName: products.name,
      quantity: purchaseItems.quantity,
      purchasePrice: purchaseItems.purchasePrice,
      discount: purchaseItems.discount,
      total: purchaseItems.total,
    })
    .from(purchaseItems)
    .innerJoin(products, eq(purchaseItems.productId, products.id))
    .where(eq(purchaseItems.purchaseId, id))
    .orderBy(products.name);

  return (
    <div>
      <PageHeader
        title={`Invoice ${purchase.invoiceNumber}`}
        subtitle={`Purchased ${fmtDate(purchase.purchaseDate)}`}
        actions={<StatusBadge status={purchase.paymentStatus} />}
      />

      {error && (
        <div className="mb-4">
          <FormMessage message={error} tone="error" />
        </div>
      )}

      <div className="grid gap-3 sm:grid-cols-4">
        <Stat label="Invoice total" value={formatPKR(purchase.total)} />
        <Stat label="Paid" value={formatPKR(purchase.paidAmount)} tone="success" />
        <Stat
          label="Remaining"
          value={formatPKR(purchase.remaining)}
          tone={purchase.remaining > 0 ? "danger" : "default"}
        />
        <Card className="p-4">
          <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
            Supplier
          </p>
          <p className="mt-1 font-semibold text-slate-900">
            {purchase.supplierId ? (
              <Link
                href={`/suppliers/${purchase.supplierId}`}
                className="text-blue-700 hover:underline"
              >
                {purchase.supplierName ?? "—"}
              </Link>
            ) : (
              "—"
            )}
          </p>
          {purchase.notes && (
            <p className="mt-2 text-xs text-slate-500">{purchase.notes}</p>
          )}
        </Card>
      </div>

      <Card className="mt-6">
        <CardHeader
          title="Items"
          subtitle={`${items.length} line item${items.length === 1 ? "" : "s"} — stock was added on save`}
        />
        <Table>
          <thead>
            <tr>
              <Th>Product</Th>
              <Th className="text-right">Qty</Th>
              <Th className="text-right">Unit price</Th>
              <Th className="text-right">Discount</Th>
              <Th className="text-right">Total</Th>
            </tr>
          </thead>
          <tbody>
            {items.map((it) => (
              <tr key={it.id} className="hover:bg-slate-50">
                <Td className="font-medium">{it.productName}</Td>
                <Td className="text-right tabular-nums">{it.quantity}</Td>
                <Td className="text-right tabular-nums">
                  {formatPKR(it.purchasePrice)}
                </Td>
                <Td className="text-right tabular-nums">{formatPKR(it.discount)}</Td>
                <Td className="text-right font-medium tabular-nums">
                  {formatPKR(it.total)}
                </Td>
              </tr>
            ))}
          </tbody>
        </Table>
      </Card>

      {isOwner && purchase.remaining > 0 && (
        <Card className="mt-6 max-w-xl">
          <CardHeader
            title="Record payment"
            subtitle={`You still owe ${formatPKR(purchase.remaining)} on this invoice.`}
          />
          <form action={recordPaymentAction} className="flex flex-col gap-3 p-4 sm:flex-row sm:items-end sm:p-5">
            <input type="hidden" name="purchaseId" value={purchase.id} />
            <div className="flex-1">
              <Field label="Amount (PKR)">
                <Input
                  name="amount"
                  required
                  inputMode="decimal"
                  placeholder="e.g. 5000"
                />
              </Field>
            </div>
            <Button type="submit">Record Payment</Button>
          </form>
        </Card>
      )}
    </div>
  );
}
