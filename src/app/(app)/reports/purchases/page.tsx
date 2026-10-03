/**
 * /reports/purchases — supplier purchase invoices in a date range
 * with totals + exports.
 */
import { and, desc, eq, gte, lt } from "drizzle-orm";
import { db } from "@/db";
import { purchases, suppliers } from "@/db/schema";
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

export default async function PurchasesReportPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const session = await requireSession();
  const shopId = session.shopId;
  const range = parseReportRange(await searchParams);

  const rows = await db
    .select({
      id: purchases.id,
      invoiceNumber: purchases.invoiceNumber,
      purchaseDate: purchases.purchaseDate,
      supplierName: suppliers.name,
      total: purchases.total,
      paidAmount: purchases.paidAmount,
      remaining: purchases.remaining,
      paymentStatus: purchases.paymentStatus,
    })
    .from(purchases)
    .leftJoin(suppliers, eq(purchases.supplierId, suppliers.id))
    .where(
      and(
        eq(purchases.shopId, shopId),
        gte(purchases.purchaseDate, range.since),
        lt(purchases.purchaseDate, range.until)
      )
    )
    .orderBy(desc(purchases.purchaseDate));

  const tTotal = rows.reduce((a, r) => a + r.total, 0);
  const tPaid = rows.reduce((a, r) => a + r.paidAmount, 0);
  const tDue = rows.reduce((a, r) => a + r.remaining, 0);

  const columns: ExportColumn[] = [
    { key: "invoice", label: "Invoice" },
    { key: "date", label: "Date" },
    { key: "supplier", label: "Supplier" },
    { key: "total", label: "Total (PKR)" },
    { key: "paid", label: "Paid (PKR)" },
    { key: "remaining", label: "Remaining (PKR)" },
    { key: "status", label: "Status" },
  ];
  const data = rows.map((r) => ({
    invoice: r.invoiceNumber,
    date: fmtDateTime(r.purchaseDate),
    supplier: r.supplierName ?? "—",
    total: formatPKR(r.total),
    paid: formatPKR(r.paidAmount),
    remaining: formatPKR(r.remaining),
    status: r.paymentStatus,
  }));

  return (
    <div>
      <PageHeader
        title="Purchases Report"
        subtitle={range.label}
        actions={
          <ExportButtons data={data} filename="purchases-report" columns={columns} />
        }
      />

      <div className="mb-5">
        <DateFilter
          basePath="/reports/purchases"
          preset={range.preset}
          from={range.from}
          to={range.to}
        />
      </div>

      <div className="mb-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat label="Invoices" value={String(rows.length)} />
        <Stat label="Total purchases" value={formatPKR(tTotal)} />
        <Stat label="Paid" value={formatPKR(tPaid)} tone="success" />
        <Stat label="Still owed" value={formatPKR(tDue)} tone={tDue > 0 ? "warning" : "default"} />
      </div>

      <Card>
        {rows.length === 0 ? (
          <div className="p-4">
            <EmptyState
              title="No purchases in this period"
              message="Try a different date range, or record a purchase invoice."
            />
          </div>
        ) : (
          <Table>
            <thead>
              <tr>
                <Th>Invoice</Th>
                <Th>Date</Th>
                <Th>Supplier</Th>
                <Th className="text-right">Total</Th>
                <Th className="text-right">Paid</Th>
                <Th className="text-right">Due</Th>
                <Th>Status</Th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id}>
                  <Td className="font-medium">{r.invoiceNumber}</Td>
                  <Td className="whitespace-nowrap">{fmtDateTime(r.purchaseDate)}</Td>
                  <Td>{r.supplierName ?? "—"}</Td>
                  <Td className="text-right tabular-nums">{formatPKR(r.total)}</Td>
                  <Td className="text-right tabular-nums">{formatPKR(r.paidAmount)}</Td>
                  <Td className="text-right tabular-nums">{formatPKR(r.remaining)}</Td>
                  <Td>
                    {r.paymentStatus === "PAID" ? (
                      <Badge tone="success">Paid</Badge>
                    ) : r.paymentStatus === "PARTIAL" ? (
                      <Badge tone="warning">Partial</Badge>
                    ) : (
                      <Badge tone="danger">Pending</Badge>
                    )}
                  </Td>
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
              </tr>
            </tfoot>
          </Table>
        )}
      </Card>
    </div>
  );
}
