/**
 * /customers/[id] — customer profile: details, balance cards,
 * purchase history (each unpaid sale has its own pay form) and returns.
 */
import { notFound } from "next/navigation";
import Link from "next/link";
import { and, eq, desc, sql } from "drizzle-orm";
import { db } from "@/db";
import { customers, sales, returns } from "@/db/schema";
import { requireSession } from "@/lib/auth";
import { formatPKR } from "@/lib/money";
import {
  PageHeader,
  LinkButton,
  Card,
  CardHeader,
  Stat,
  Table,
  Th,
  Td,
  Badge,
  EmptyState,
  FormMessage,
} from "@/components/ui";
import { ConfirmSubmit } from "@/components/ui-client";
import { deleteCustomerAction } from "../actions";
import { PaySaleForm } from "@/app/(app)/sales/pay-form-client";

const STATUS_TONE: Record<string, "success" | "warning" | "danger"> = {
  PAID: "success",
  PARTIAL: "warning",
  PENDING: "danger",
};

export default async function CustomerProfilePage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ error?: string; message?: string }>;
}) {
  const session = await requireSession();
  const { id } = await params;
  const { error, message } = await searchParams;

  const [customer] = await db
    .select()
    .from(customers)
    .where(and(eq(customers.id, id), eq(customers.shopId, session.shopId)))
    .limit(1);
  if (!customer) notFound();

  const [agg] = await db
    .select({
      totalPurchased: sql<number>`coalesce(sum(${sales.total}),0)`,
      outstanding: sql<number>`coalesce(sum(${sales.remaining}),0)`,
      saleCount: sql<number>`count(${sales.id})`,
    })
    .from(sales)
    .where(and(eq(sales.customerId, id), eq(sales.shopId, session.shopId)));

  const customerSales = await db
    .select({
      id: sales.id,
      invoiceNumber: sales.invoiceNumber,
      saleDate: sales.saleDate,
      total: sales.total,
      paidAmount: sales.paidAmount,
      remaining: sales.remaining,
      paymentStatus: sales.paymentStatus,
      paymentMethod: sales.paymentMethod,
    })
    .from(sales)
    .where(and(eq(sales.customerId, id), eq(sales.shopId, session.shopId)))
    .orderBy(desc(sales.saleDate))
    .limit(50);

  const customerReturns = await db
    .select({
      id: returns.id,
      returnDate: returns.returnDate,
      subtotal: returns.subtotal,
      notes: returns.notes,
      invoiceNumber: sales.invoiceNumber,
    })
    .from(returns)
    .leftJoin(sales, eq(returns.saleId, sales.id))
    .where(and(eq(returns.customerId, id), eq(returns.shopId, session.shopId)))
    .orderBy(desc(returns.returnDate))
    .limit(50);

  return (
    <div>
      <PageHeader
        title={customer.name}
        subtitle="Customer profile"
        actions={
          <>
            <LinkButton href={`/customers/${customer.id}/edit`} variant="secondary">
              Edit
            </LinkButton>
            <form action={deleteCustomerAction}>
              <input type="hidden" name="id" value={customer.id} />
              <input type="hidden" name="from" value={`/customers/${customer.id}`} />
              <ConfirmSubmit message={`Delete customer "${customer.name}"? This cannot be undone.`}>
                Delete
              </ConfirmSubmit>
            </form>
            <LinkButton href="/customers" variant="ghost">
              Back
            </LinkButton>
          </>
        }
      />

      {(error || message) && (
        <div className="mb-4">
          <FormMessage message={error ?? message} tone={error ? "error" : "success"} />
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Stat
          label="Total Purchased"
          value={formatPKR(Number(agg?.totalPurchased ?? 0))}
        />
        <Stat
          label="Outstanding Balance"
          value={formatPKR(Number(agg?.outstanding ?? 0))}
          tone={Number(agg?.outstanding ?? 0) > 0 ? "danger" : "success"}
        />
        <Stat label="Total Sales" value={String(Number(agg?.saleCount ?? 0))} />
        <Stat label="Total Returns" value={String(customerReturns.length)} />
      </div>

      <Card className="mt-4">
        <CardHeader title="Details" />
        <dl className="grid gap-3 p-4 sm:grid-cols-2 sm:p-5">
          <div>
            <dt className="text-xs font-medium uppercase tracking-wide text-slate-500">
              Phone
            </dt>
            <dd className="mt-0.5 text-sm text-slate-900">{customer.phone ?? "—"}</dd>
          </div>
          <div>
            <dt className="text-xs font-medium uppercase tracking-wide text-slate-500">
              Vehicle
            </dt>
            <dd className="mt-0.5 text-sm text-slate-900">{customer.vehicle ?? "—"}</dd>
          </div>
          <div>
            <dt className="text-xs font-medium uppercase tracking-wide text-slate-500">
              Address
            </dt>
            <dd className="mt-0.5 text-sm text-slate-900">{customer.address ?? "—"}</dd>
          </div>
          <div>
            <dt className="text-xs font-medium uppercase tracking-wide text-slate-500">
              Notes
            </dt>
            <dd className="mt-0.5 text-sm text-slate-900">{customer.notes ?? "—"}</dd>
          </div>
        </dl>
      </Card>

      <Card className="mt-4">
        <CardHeader
          title="Purchase History"
          subtitle="Unpaid invoices can be settled with a payment below"
        />
        {customerSales.length === 0 ? (
          <div className="p-4">
            <EmptyState
              title="No purchases yet"
              message="This customer has no recorded sales."
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
                <Th className="text-right">Remaining</Th>
                <Th>Status</Th>
                <Th>Record Payment</Th>
              </tr>
            </thead>
            <tbody>
              {customerSales.map((s) => (
                <tr key={s.id} className="hover:bg-slate-50">
                  <Td>
                    <Link
                      href={`/sales/${s.id}`}
                      className="font-semibold text-blue-700 hover:underline"
                    >
                      {s.invoiceNumber}
                    </Link>
                  </Td>
                  <Td className="whitespace-nowrap">
                    {new Date(s.saleDate).toLocaleDateString("en-PK", {
                      day: "2-digit",
                      month: "short",
                      year: "numeric",
                    })}
                  </Td>
                  <Td className="text-right tabular-nums">{formatPKR(s.total)}</Td>
                  <Td className="text-right tabular-nums">{formatPKR(s.paidAmount)}</Td>
                  <Td
                    className={`text-right tabular-nums font-medium ${
                      s.remaining > 0 ? "text-red-700" : "text-slate-500"
                    }`}
                  >
                    {formatPKR(s.remaining)}
                  </Td>
                  <Td>
                    <Badge tone={STATUS_TONE[s.paymentStatus] ?? "default"}>
                      {s.paymentStatus}
                    </Badge>
                  </Td>
                  <Td>
                    {s.remaining > 0 ? (
                      <PaySaleForm saleId={s.id} remainingPaisa={s.remaining} compact />
                    ) : (
                      <span className="text-xs text-slate-400">Settled</span>
                    )}
                  </Td>
                </tr>
              ))}
            </tbody>
          </Table>
        )}
      </Card>

      <Card className="mt-4">
        <CardHeader title="Returns History" subtitle="Customer returns linked to this customer" />
        {customerReturns.length === 0 ? (
          <div className="p-4">
            <EmptyState
              title="No returns"
              message="No customer returns recorded for this customer."
            />
          </div>
        ) : (
          <Table>
            <thead>
              <tr>
                <Th>Date</Th>
                <Th>Linked Invoice</Th>
                <Th className="text-right">Subtotal</Th>
                <Th>Notes</Th>
              </tr>
            </thead>
            <tbody>
              {customerReturns.map((r) => (
                <tr key={r.id} className="hover:bg-slate-50">
                  <Td className="whitespace-nowrap">
                    {new Date(r.returnDate).toLocaleDateString("en-PK", {
                      day: "2-digit",
                      month: "short",
                      year: "numeric",
                    })}
                  </Td>
                  <Td>
                    {r.invoiceNumber ? (
                      <Link
                        href="/returns"
                        className="text-blue-700 hover:underline"
                      >
                        {r.invoiceNumber}
                      </Link>
                    ) : (
                      "—"
                    )}
                  </Td>
                  <Td className="text-right tabular-nums">{formatPKR(r.subtotal)}</Td>
                  <Td>{r.notes ?? "—"}</Td>
                </tr>
              ))}
            </tbody>
          </Table>
        )}
      </Card>
    </div>
  );
}
