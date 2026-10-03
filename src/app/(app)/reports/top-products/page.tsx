/**
 * /reports/top-products — best sellers (adjustable window, default 30d)
 * and slow movers (in stock, zero sales in the window).
 */
import Link from "next/link";
import { requireSession } from "@/lib/auth";
import { getTopSelling, getSlowMoving } from "@/lib/stats";
import { formatPKR } from "@/lib/money";
import {
  Card,
  CardHeader,
  EmptyState,
  LinkButton,
  PageHeader,
  Table,
  Td,
  Th,
} from "@/components/ui";
import { ExportButtons, type ExportColumn } from "../export-buttons-client";
import { first } from "../_lib";

export const dynamic = "force-dynamic";

const DAY_OPTIONS = [7, 30, 90];

export default async function TopProductsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const session = await requireSession();
  const shopId = session.shopId;
  const sp = await searchParams;
  const rawDays = parseInt(first(sp.days, "30"), 10);
  const days = DAY_OPTIONS.includes(rawDays) ? rawDays : 30;

  const [top, slow] = await Promise.all([
    getTopSelling(shopId, days, 10),
    getSlowMoving(shopId, days, 10),
  ]);

  const columns: ExportColumn[] = [
    { key: "product", label: "Product" },
    { key: "qty", label: "Qty sold" },
    { key: "revenue", label: "Revenue (PKR)" },
  ];
  const data = top.map((t) => ({
    product: t.name,
    qty: String(Number(t.qty ?? 0)),
    revenue: formatPKR(Number(t.revenue ?? 0)),
  }));

  const dayLink = (d: number) => `/reports/top-products?days=${d}`;

  return (
    <div>
      <PageHeader
        title="Top & Slow Products"
        subtitle={`Based on sales in the last ${days} days`}
        actions={
          <ExportButtons data={data} filename="top-products" columns={columns} />
        }
      />

      <div className="mb-5 flex items-center gap-2">
        <span className="text-sm text-slate-500">Window:</span>
        {DAY_OPTIONS.map((d) => (
          <LinkButton
            key={d}
            href={dayLink(d)}
            variant={days === d ? "primary" : "secondary"}
            size="sm"
          >
            {d} days
          </LinkButton>
        ))}
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader
            title="🏆 Top Sellers"
            subtitle={`Most units sold in the last ${days} days`}
          />
          {top.length === 0 ? (
            <div className="p-4">
              <EmptyState
                title="No sales data"
                message={`No sales were recorded in the last ${days} days.`}
              />
            </div>
          ) : (
            <Table>
              <thead>
                <tr>
                  <Th>#</Th>
                  <Th>Product</Th>
                  <Th className="text-right">Qty sold</Th>
                  <Th className="text-right">Revenue</Th>
                </tr>
              </thead>
              <tbody>
                {top.map((t, i) => (
                  <tr key={t.productId}>
                    <Td className="text-slate-400">{i + 1}</Td>
                    <Td className="font-medium">{t.name}</Td>
                    <Td className="text-right font-semibold tabular-nums">
                      {Number(t.qty ?? 0)}
                    </Td>
                    <Td className="text-right tabular-nums">
                      {formatPKR(Number(t.revenue ?? 0))}
                    </Td>
                  </tr>
                ))}
              </tbody>
            </Table>
          )}
        </Card>

        <Card>
          <CardHeader
            title="🐌 Slow Movers"
            subtitle={`In stock but zero sales in the last ${days} days`}
          />
          {slow.length === 0 ? (
            <div className="p-4">
              <EmptyState
                title="Nothing slow-moving"
                message={`Every stocked product sold in the last ${days} days.`}
              />
            </div>
          ) : (
            <Table>
              <thead>
                <tr>
                  <Th>Product</Th>
                  <Th>SKU</Th>
                  <Th className="text-right">In stock</Th>
                </tr>
              </thead>
              <tbody>
                {slow.map((t) => (
                  <tr key={t.id}>
                    <Td>
                      <Link
                        href={`/products/${t.id}`}
                        className="text-blue-700 hover:underline"
                      >
                        {t.name}
                      </Link>
                    </Td>
                    <Td className="text-slate-500">{t.sku ?? "—"}</Td>
                    <Td className="text-right tabular-nums">{t.currentStock}</Td>
                  </tr>
                ))}
              </tbody>
            </Table>
          )}
        </Card>
      </div>
    </div>
  );
}
