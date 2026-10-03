/**
 * /reports/profit — gross profit per product over a date range.
 * GROSS PROFIT = sale price − purchase cost; excludes shop expenses.
 */
import { requireSession } from "@/lib/auth";
import { getProductProfit } from "@/lib/stats";
import { formatPKR } from "@/lib/money";
import {
  Alert,
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
import { parseReportRange } from "../_lib";

export const dynamic = "force-dynamic";

export default async function ProfitReportPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const session = await requireSession();
  const shopId = session.shopId;
  const range = parseReportRange(await searchParams);

  const rows = await getProductProfit(shopId, range.since, range.until);

  const tQty = rows.reduce((a, r) => a + Number(r.qty ?? 0), 0);
  const tRevenue = rows.reduce((a, r) => a + Number(r.revenue ?? 0), 0);
  const tCost = rows.reduce((a, r) => a + Number(r.cost ?? 0), 0);
  const tProfit = rows.reduce((a, r) => a + Number(r.profit ?? 0), 0);

  const columns: ExportColumn[] = [
    { key: "product", label: "Product" },
    { key: "qty", label: "Qty sold" },
    { key: "revenue", label: "Revenue (PKR)" },
    { key: "cost", label: "Purchase cost (PKR)" },
    { key: "profit", label: "Gross profit (PKR)" },
  ];
  const data = rows.map((r) => ({
    product: r.name,
    qty: String(Number(r.qty ?? 0)),
    revenue: formatPKR(Number(r.revenue ?? 0)),
    cost: formatPKR(Number(r.cost ?? 0)),
    profit: formatPKR(Number(r.profit ?? 0)),
  }));

  return (
    <div>
      <PageHeader
        title="Profit Report"
        subtitle={range.label}
        actions={
          <ExportButtons data={data} filename="profit-report" columns={columns} />
        }
      />

      <div className="mb-5">
        <DateFilter
          basePath="/reports/profit"
          preset={range.preset}
          from={range.from}
          to={range.to}
        />
      </div>

      <div className="mb-5">
        <Alert tone="info">
          <b>GROSS PROFIT</b> = sale price − purchase cost. Shop expenses
          (rent, salaries, utilities) are <b>not</b> included — this is not net
          profit.
        </Alert>
      </div>

      <div className="mb-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat label="Units sold" value={tQty.toLocaleString()} />
        <Stat label="Revenue" value={formatPKR(tRevenue)} />
        <Stat label="Purchase cost" value={formatPKR(tCost)} />
        <Stat
          label="Gross profit"
          value={formatPKR(tProfit)}
          tone={tProfit >= 0 ? "success" : "danger"}
        />
      </div>

      <Card>
        {rows.length === 0 ? (
          <div className="p-4">
            <EmptyState
              title="No sales in this period"
              message="Profit data appears once you record sales in the selected range."
            />
          </div>
        ) : (
          <Table>
            <thead>
              <tr>
                <Th>Product</Th>
                <Th className="text-right">Qty sold</Th>
                <Th className="text-right">Revenue</Th>
                <Th className="text-right">Purchase cost</Th>
                <Th className="text-right">Gross profit</Th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => {
                const profit = Number(r.profit ?? 0);
                return (
                  <tr key={r.productId}>
                    <Td className="font-medium">{r.name}</Td>
                    <Td className="text-right tabular-nums">
                      {Number(r.qty ?? 0)}
                    </Td>
                    <Td className="text-right tabular-nums">
                      {formatPKR(Number(r.revenue ?? 0))}
                    </Td>
                    <Td className="text-right tabular-nums">
                      {formatPKR(Number(r.cost ?? 0))}
                    </Td>
                    <Td
                      className={`text-right font-medium tabular-nums ${profit >= 0 ? "text-emerald-700" : "text-red-700"}`}
                    >
                      {formatPKR(profit)}
                    </Td>
                  </tr>
                );
              })}
            </tbody>
            <tfoot>
              <tr className="bg-slate-50 font-semibold">
                <Td>Totals</Td>
                <Td className="text-right tabular-nums">
                  {tQty.toLocaleString()}
                </Td>
                <Td className="text-right tabular-nums">{formatPKR(tRevenue)}</Td>
                <Td className="text-right tabular-nums">{formatPKR(tCost)}</Td>
                <Td
                  className={`text-right tabular-nums ${tProfit >= 0 ? "text-emerald-700" : "text-red-700"}`}
                >
                  {formatPKR(tProfit)}
                </Td>
              </tr>
            </tfoot>
          </Table>
        )}
      </Card>
    </div>
  );
}
