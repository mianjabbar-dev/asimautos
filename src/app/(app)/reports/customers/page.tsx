/**
 * /reports/customers — outstanding customer balances (receivables).
 */
import { requireSession } from "@/lib/auth";
import { getCustomerBalances } from "@/lib/stats";
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
import { ExportButtons, type ExportColumn } from "../export-buttons-client";

export const dynamic = "force-dynamic";

export default async function CustomerBalancesPage() {
  const session = await requireSession();
  const rows = await getCustomerBalances(session.shopId);

  const shown = rows.filter(
    (r) => Number(r.outstanding ?? 0) > 0 || Number(r.totalPurchased ?? 0) > 0
  );
  const tOutstanding = shown.reduce(
    (a, r) => a + Number(r.outstanding ?? 0),
    0
  );
  const tPurchased = shown.reduce(
    (a, r) => a + Number(r.totalPurchased ?? 0),
    0
  );

  const columns: ExportColumn[] = [
    { key: "customer", label: "Customer" },
    { key: "phone", label: "Phone" },
    { key: "totalPurchased", label: "Total purchased (PKR)" },
    { key: "outstanding", label: "Outstanding (PKR)" },
  ];
  const data = shown.map((r) => ({
    customer: r.name,
    phone: r.phone ?? "",
    totalPurchased: formatPKR(Number(r.totalPurchased ?? 0)),
    outstanding: formatPKR(Number(r.outstanding ?? 0)),
  }));

  return (
    <div>
      <PageHeader
        title="Customer Balances"
        subtitle="Who owes you money — receivables per customer"
        actions={
          <ExportButtons data={data} filename="customer-balances" columns={columns} />
        }
      />

      <div className="mb-5 grid grid-cols-2 gap-3 sm:grid-cols-3">
        <Stat label="Customers with history" value={String(shown.length)} />
        <Stat label="Total purchased" value={formatPKR(tPurchased)} />
        <Stat
          label="Total outstanding"
          value={formatPKR(tOutstanding)}
          tone={tOutstanding > 0 ? "warning" : "success"}
        />
      </div>

      <Card>
        {shown.length === 0 ? (
          <div className="p-4">
            <EmptyState
              title="No customer balances"
              message="Customers with sales history or outstanding dues will appear here."
            />
          </div>
        ) : (
          <Table>
            <thead>
              <tr>
                <Th>Customer</Th>
                <Th>Phone</Th>
                <Th className="text-right">Total purchased</Th>
                <Th className="text-right">Outstanding</Th>
                <Th>Status</Th>
              </tr>
            </thead>
            <tbody>
              {shown.map((r) => {
                const due = Number(r.outstanding ?? 0);
                return (
                  <tr key={r.id}>
                    <Td className="font-medium">{r.name}</Td>
                    <Td className="text-slate-500">{r.phone ?? "—"}</Td>
                    <Td className="text-right tabular-nums">
                      {formatPKR(Number(r.totalPurchased ?? 0))}
                    </Td>
                    <Td className="text-right font-medium tabular-nums">
                      {formatPKR(due)}
                    </Td>
                    <Td>
                      {due === 0 ? (
                        <Badge tone="success">Clear</Badge>
                      ) : (
                        <Badge tone="warning">Due</Badge>
                      )}
                    </Td>
                  </tr>
                );
              })}
            </tbody>
            <tfoot>
              <tr className="bg-slate-50 font-semibold">
                <Td>Totals</Td>
                <Td>{""}</Td>
                <Td className="text-right tabular-nums">{formatPKR(tPurchased)}</Td>
                <Td className="text-right tabular-nums">
                  {formatPKR(tOutstanding)}
                </Td>
                <Td>{""}</Td>
              </tr>
            </tfoot>
          </Table>
        )}
      </Card>
    </div>
  );
}
