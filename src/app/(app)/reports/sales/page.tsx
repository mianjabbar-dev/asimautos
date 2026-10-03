/**
 * /reports/sales — sales invoices in a date range with totals + exports.
 */
import Link from "next/link";
import { and, desc, eq, gte, lt } from "drizzle-orm";
import { db } from "@/db";
import { sales, customers } from "@/db/schema";
import { requireSession } from "@/lib/auth";
import { formatPKR } from "@/lib/money";
import {
  Badge,
  Card,
  EmptyState,
  PageHeader,
  Stat,
  Table,
  Td,
  Th,
} from "@/components/ui";
import { DateFilter } from "../date-filters";
import { ExportButtons, type ExportColumn } from "../export-buttons-client";
import { fmtDateTime, parseReportRange } from "../_lib";

export const dynamic = "force-dynamic";

export default async function SalesReportPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const session = await requireSession();
  const shopId = session.shopId;
  const range = parseReportRange(await searchParams);

  const rows = await db
    .select({
      id: sales.id,
      invoiceNumber: sales.invoiceNumber,
      saleDate: sales.saleDate,
      customerName: customers.name,
      total: sales.total,
      paidAmount: sales.paidAmount,
      remaining: sales.remaining,
      paymentStatus: sales.paymentStatus,
      paymentMethod: sales.paymentMethod,
    })
    .from(sales)
    .leftJoin(customers, eq(sales.customerId, customers.id))
    .where(
      and(
        eq(sales.shopId, shopId),
        gte(sales.saleDate, range.since),
        lt(sales.saleDate, range.until)
      )
    )
    .orderBy(desc(sales.saleDate));

  const tTotal = rows.reduce((a, r) => a + r.total, 0);
  const tPaid = rows.reduce((a, r) => a + r.paidAmount, 0);
  const tDue = rows.reduce((a, r) => a + r.remaining, 0);

  const columns: ExportColumn[] = [
    { key: "invoice", label: "Invoice" },
    { key: "date", label: "Date" },
    { key: "customer", label: "Customer" },
    { key: "total", label: "Total (PKR)" },
    { key: "paid", label: "Paid (PKR)" },
    { key: "remaining", label: "Remaining (PKR)" },
    { key: "status", label: "Status" },
    { key: "method", label: "Method" },
  ];
  const data = rows.map((r) => ({
    invoice: r.invoiceNumber,
    date: fmtDateTime(r.saleDate),
    customer: r.customerName ?? "Walk-in",
    total: formatPKR(r.total),
    paid: formatPKR(r.paidAmount),
    remaining: formatPKR(r.remaining),
    status: r.paymentStatus,
    method: r.paymentMethod,
  }));

  return (
    <div>
      <PageHeader
        title="Sales Report"
        subtitle={range.label}
        actions={
          <ExportButtons data={data} filename="sales-report" columns={columns} />
        }
      />

      <div className="mb-5">
        <DateFilter
          basePath="/reports/sales"
          preset={range.preset}
          from={range.from}
          to={range.to}
        />
      </div>

      <div className="mb-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat label="Invoices" value={String(rows.length)} />
        <Stat label="Total sales" value={formatPKR(tTotal)} />
        <Stat label="Collected" value={formatPKR(tPaid)} tone="success" />
        <Stat label="Outstanding" value={formatPKR(tDue)} tone={tDue > 0 ? "warning" : "default"} />
      </div>

      <Card>
        {rows.length === 0 ? (
          <div className="p-4">
            <EmptyState
              title="No sales in this period"
              message="Try a different date range, or record a sale from the POS."
            />
          </div>
        ) : (
          <Table>
            <thead>
              <tr>
                <Th>Invoice</Th>
                <Th>Date</Th>
                <Th>Customer</Th>
                <Th className="text-right">Total</Th>
                <Th className="text-right">Paid</Th>
                <Th className="text-right">Due</Th>
                <Th>Status</Th>
                <Th>Method</Th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id}>
                  <Td>
                    <Link
                      href={`/sales/${r.id}`}
                      className="font-medium text-blue-700 hover:underline"
                    >
                      {r.invoiceNumber}
                    </Link>
                  </Td>
                  <Td className="whitespace-nowrap">{fmtDateTime(r.saleDate)}</Td>
                  <Td>{r.customerName ?? "Walk-in"}</Td>
                  <Td className="text-right tabular-nums">{formatPKR(r.total)}</Td>
                  <Td className="text-right tabular-nums">{formatPKR(r.paidAmount)}</Td>
                  <Td className="text-right tabular-nums">{formatPKR(r.remaining)}</Td>
                  <Td>
                    {r.remaining === 0 ? (
                      <Badge tone="success">Paid</Badge>
                    ) : (
                      <Badge tone="warning">{r.paymentStatus}</Badge>
                    )}
                  </Td>
                  <Td>{r.paymentMethod}</Td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="bg-slate-50 font-semibold">
                <Td>Totals</Td>
                <Td>{""}</Td>
                <Td>{""}</Td>
                <Td className="text-right tabular-nums">{formatPKR(tTotal)}</Td>
                <Td className="text-right tabular-nums">{formatPKR(tPaid)}</Td>
                <Td className="text-right tabular-nums">{formatPKR(tDue)}</Td>
                <Td>{""}</Td>
                <Td>{""}</Td>
              </tr>
            </tfoot>
          </Table>
        )}
      </Card>
    </div>
  );
}
