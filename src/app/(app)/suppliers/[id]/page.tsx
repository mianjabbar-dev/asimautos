import Link from "next/link";
import { notFound } from "next/navigation";
import { eq, and, desc } from "drizzle-orm";
import { db } from "@/db";
import { suppliers, purchases, purchaseItems, products } from "@/db/schema";
import { requireSession } from "@/lib/auth";
import { getSupplierBalances } from "@/lib/stats";
import { formatPKR } from "@/lib/money";
import { deleteSupplier } from "../actions";
import {
  PageHeader,
  LinkButton,
  Card,
  CardHeader,
  Stat,
  Badge,
  Table,
  Th,
  Td,
  EmptyState,
  FormMessage,
} from "@/components/ui";
import { ConfirmSubmit } from "@/components/ui-client";

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

export default async function SupplierProfilePage({
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

  const [supplier] = await db
    .select()
    .from(suppliers)
    .where(and(eq(suppliers.id, id), eq(suppliers.shopId, session.shopId)))
    .limit(1);
  if (!supplier) notFound();

  const [balances, history, suppliedRows] = await Promise.all([
    getSupplierBalances(session.shopId),
    db
      .select({
        id: purchases.id,
        invoiceNumber: purchases.invoiceNumber,
        purchaseDate: purchases.purchaseDate,
        total: purchases.total,
        paidAmount: purchases.paidAmount,
        remaining: purchases.remaining,
        paymentStatus: purchases.paymentStatus,
      })
      .from(purchases)
      .where(
        and(eq(purchases.shopId, session.shopId), eq(purchases.supplierId, id))
      )
      .orderBy(desc(purchases.purchaseDate))
      .limit(50),
    db
      .select({
        productId: products.id,
        name: products.name,
        sku: products.sku,
        purchasePrice: purchaseItems.purchasePrice,
        purchaseDate: purchases.purchaseDate,
      })
      .from(purchaseItems)
      .innerJoin(purchases, eq(purchaseItems.purchaseId, purchases.id))
      .innerJoin(products, eq(purchaseItems.productId, products.id))
      .where(
        and(eq(purchases.shopId, session.shopId), eq(purchases.supplierId, id))
      )
      .orderBy(desc(purchases.purchaseDate)),
  ]);

  const balance = balances.find((b) => b.id === id);
  const totalPurchased = Number(balance?.totalPurchased ?? 0);
  const outstanding = Number(balance?.outstanding ?? 0);
  const totalPaid = totalPurchased - outstanding;

  // Distinct products, keeping the most recent purchase (rows are date-desc).
  const seen = new Set<string>();
  const supplied = suppliedRows.filter((r) => {
    if (seen.has(r.productId)) return false;
    seen.add(r.productId);
    return true;
  });

  const contactRows: Array<[string, string | null]> = [
    ["Contact person", supplier.contactPerson],
    ["Phone", supplier.phone],
    ["WhatsApp", supplier.whatsapp],
    ["Email", supplier.email],
    ["City", supplier.city],
    ["Address", supplier.address],
    ["Payment terms", supplier.paymentTerms],
    ["Notes", supplier.notes],
  ];

  return (
    <div>
      <PageHeader
        title={supplier.name}
        subtitle="Supplier profile"
        actions={
          isOwner ? (
            <>
              <LinkButton href={`/suppliers/${id}/edit`} variant="secondary" size="sm">
                Edit
              </LinkButton>
              <form action={deleteSupplier}>
                <input type="hidden" name="id" value={id} />
                <ConfirmSubmit message={`Delete supplier "${supplier.name}"? This cannot be undone.`}>
                  Delete
                </ConfirmSubmit>
              </form>
            </>
          ) : undefined
        }
      />

      {error && (
        <div className="mb-4">
          <FormMessage message={error} tone="error" />
        </div>
      )}

      <div className="grid gap-3 sm:grid-cols-3">
        <Stat label="Total Purchases" value={formatPKR(totalPurchased)} />
        <Stat label="Total Paid" value={formatPKR(totalPaid)} tone="success" />
        <Stat
          label="Outstanding Balance"
          value={formatPKR(outstanding)}
          tone={outstanding > 0 ? "danger" : "default"}
          sub={outstanding > 0 ? "Amount you still owe" : "All clear"}
        />
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-1">
          <CardHeader title="Contact details" />
          <dl className="space-y-2.5 p-4 text-sm sm:p-5">
            {contactRows.map(([label, value]) => (
              <div key={label} className="flex justify-between gap-4">
                <dt className="shrink-0 text-slate-500">{label}</dt>
                <dd className="text-right font-medium text-slate-800">
                  {value || "—"}
                </dd>
              </div>
            ))}
          </dl>
        </Card>

        <div className="space-y-6 lg:col-span-2">
          <Card>
            <CardHeader
              title="Purchase history"
              subtitle="Latest invoices from this supplier"
              action={
                isOwner ? (
                  <LinkButton href="/purchases/new" variant="secondary" size="sm">
                    + New Purchase
                  </LinkButton>
                ) : undefined
              }
            />
            {history.length === 0 ? (
              <div className="p-4">
                <EmptyState
                  title="No purchases yet"
                  message={`No purchase invoices recorded from ${supplier.name}.`}
                />
              </div>
            ) : (
              <Table>
                <thead>
                  <tr>
                    <Th>Invoice</Th>
                    <Th>Date</Th>
                    <Th className="text-right">Total</Th>
                    <Th className="text-right">Paid</Th>
                    <Th>Status</Th>
                  </tr>
                </thead>
                <tbody>
                  {history.map((p) => (
                    <tr key={p.id} className="hover:bg-slate-50">
                      <Td>
                        <Link
                          href={`/purchases/${p.id}`}
                          className="font-medium text-blue-700 hover:underline"
                        >
                          {p.invoiceNumber}
                        </Link>
                      </Td>
                      <Td className="whitespace-nowrap">{fmtDate(p.purchaseDate)}</Td>
                      <Td className="text-right tabular-nums">{formatPKR(p.total)}</Td>
                      <Td className="text-right tabular-nums">{formatPKR(p.paidAmount)}</Td>
                      <Td>
                        <StatusBadge status={p.paymentStatus} />
                      </Td>
                    </tr>
                  ))}
                </tbody>
              </Table>
            )}
          </Card>

          <Card>
            <CardHeader
              title="Products supplied"
              subtitle="Distinct products bought from this supplier, with the last purchase price"
            />
            {supplied.length === 0 ? (
              <div className="p-4">
                <EmptyState
                  title="No products yet"
                  message="Products will appear here once you record purchases from this supplier."
                />
              </div>
            ) : (
              <Table>
                <thead>
                  <tr>
                    <Th>Product</Th>
                    <Th>SKU</Th>
                    <Th className="text-right">Last price</Th>
                    <Th>Last bought</Th>
                  </tr>
                </thead>
                <tbody>
                  {supplied.map((r) => (
                    <tr key={r.productId} className="hover:bg-slate-50">
                      <Td className="font-medium">{r.name}</Td>
                      <Td className="text-slate-500">{r.sku ?? "—"}</Td>
                      <Td className="text-right tabular-nums">
                        {formatPKR(r.purchasePrice)}
                      </Td>
                      <Td className="whitespace-nowrap">{fmtDate(r.purchaseDate)}</Td>
                    </tr>
                  ))}
                </tbody>
              </Table>
            )}
          </Card>
        </div>
      </div>
    </div>
  );
}
