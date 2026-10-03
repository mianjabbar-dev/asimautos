/**
 * /returns — list of all returns (customer + supplier) with type badges,
 * linked invoices and subtotals.
 */
import { eq, desc, sql } from "drizzle-orm";
import Link from "next/link";
import { db } from "@/db";
import { returns, customers, suppliers, sales, purchases } from "@/db/schema";
import { requireSession } from "@/lib/auth";
import { formatPKR } from "@/lib/money";
import {
  PageHeader,
  LinkButton,
  Card,
  Table,
  Th,
  Td,
  Badge,
  EmptyState,
  Pagination,
} from "@/components/ui";

const PAGE_SIZE = 20;

const TYPE_META: Record<string, { label: string; tone: "info" | "warning" }> = {
  CUSTOMER: { label: "Customer", tone: "info" },
  SUPPLIER: { label: "Supplier", tone: "warning" },
};

export default async function ReturnsPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string }>;
}) {
  const session = await requireSession();
  const { page: pageParam } = await searchParams;
  const page = Math.max(1, parseInt(pageParam ?? "1", 10) || 1);
  const where = eq(returns.shopId, session.shopId);

  const [rows, countRows] = await Promise.all([
    db
      .select({
        id: returns.id,
        type: returns.type,
        returnDate: returns.returnDate,
        subtotal: returns.subtotal,
        notes: returns.notes,
        customerName: customers.name,
        supplierName: suppliers.name,
        saleInvoice: sales.invoiceNumber,
        purchaseInvoice: purchases.invoiceNumber,
      })
      .from(returns)
      .leftJoin(customers, eq(returns.customerId, customers.id))
      .leftJoin(suppliers, eq(returns.supplierId, suppliers.id))
      .leftJoin(sales, eq(returns.saleId, sales.id))
      .leftJoin(purchases, eq(returns.purchaseId, purchases.id))
      .where(where)
      .orderBy(desc(returns.returnDate))
      .limit(PAGE_SIZE)
      .offset((page - 1) * PAGE_SIZE),
    db
      .select({ v: sql<number>`count(*)` })
      .from(returns)
      .where(where),
  ]);

  const total = Number(countRows[0]?.v ?? 0);
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const isOwner = session.role === "OWNER";

  return (
    <div>
      <PageHeader
        title="Returns"
        subtitle="Customer and supplier returns"
        actions={
          <div className="flex gap-2">
            <LinkButton href="/returns/new?type=customer">＋ Customer Return</LinkButton>
            {isOwner && (
              <LinkButton href="/returns/new?type=supplier" variant="secondary">
                ＋ Supplier Return
              </LinkButton>
            )}
          </div>
        }
      />

      {rows.length === 0 ? (
        <EmptyState
          title="No returns recorded"
          message="Record a customer return when goods come back, or a supplier return when goods go back to a supplier."
          action={<LinkButton href="/returns/new">New Return</LinkButton>}
        />
      ) : (
        <Card>
          <Table>
            <thead>
              <tr>
                <Th>Date</Th>
                <Th>Type</Th>
                <Th>Party</Th>
                <Th>Linked Invoice</Th>
                <Th className="text-right">Subtotal</Th>
                <Th>Notes</Th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => {
                const meta = TYPE_META[r.type] ?? { label: r.type, tone: "info" as const };
                const party =
                  r.type === "CUSTOMER" ? r.customerName : r.supplierName;
                const invoice =
                  r.type === "CUSTOMER" ? r.saleInvoice : r.purchaseInvoice;
                return (
                  <tr key={r.id} className="hover:bg-slate-50">
                    <Td className="whitespace-nowrap">
                      {new Date(r.returnDate).toLocaleDateString("en-PK", {
                        day: "2-digit",
                        month: "short",
                        year: "numeric",
                      })}
                    </Td>
                    <Td>
                      <Badge tone={meta.tone}>{meta.label}</Badge>
                    </Td>
                    <Td>{party ?? "—"}</Td>
                    <Td>
                      {invoice ? (
                        <Link
                          href={
                            r.type === "CUSTOMER" ? "/sales" : "/purchases"
                          }
                          className="font-medium text-blue-700 hover:underline"
                        >
                          {invoice}
                        </Link>
                      ) : (
                        "—"
                      )}
                    </Td>
                    <Td className="text-right tabular-nums font-medium">
                      {formatPKR(r.subtotal)}
                    </Td>
                    <Td className="max-w-48 truncate">{r.notes ?? "—"}</Td>
                  </tr>
                );
              })}
            </tbody>
          </Table>
          <Pagination page={page} totalPages={totalPages} basePath="/returns" />
        </Card>
      )}
    </div>
  );
}
