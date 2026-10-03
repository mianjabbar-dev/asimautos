import Link from "next/link";
import { requireSession } from "@/lib/auth";
import {
  getDashboardStats,
  getActionRequired,
  getRecentSales,
  getRecentPurchases,
  getTopSelling,
  getSlowMoving,
  getRecentMovements,
  getRecentNotifications,
} from "@/lib/stats";
import { formatPKR, formatPKRCompact } from "@/lib/money";
import {
  Stat,
  Card,
  CardHeader,
  Badge,
  EmptyState,
  Table,
  Th,
  Td,
  LinkButton,
  PageHeader,
  Alert,
} from "@/components/ui";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const session = await requireSession();
  const shopId = session.shopId;

  const [
    stats,
    action,
    recentSales,
    recentPurchases,
    topSelling,
    slowMoving,
    movements,
    notifs,
  ] = await Promise.all([
    getDashboardStats(shopId),
    getActionRequired(shopId),
    getRecentSales(shopId),
    getRecentPurchases(shopId),
    getTopSelling(shopId),
    getSlowMoving(shopId),
    getRecentMovements(shopId),
    getRecentNotifications(shopId),
  ]);

  const cards = [
    { label: "Total Products", value: String(stats.totalProducts) },
    { label: "Total Stock Units", value: stats.totalStockUnits.toLocaleString() },
    { label: "Inventory Value", value: formatPKRCompact(stats.inventoryValue), sub: formatPKR(stats.inventoryValue) },
    { label: "Low Stock Products", value: String(stats.lowStockCount), tone: "warning" as const },
    { label: "Out of Stock Products", value: String(stats.outOfStockCount), tone: "danger" as const },
    { label: "Today's Sales", value: formatPKRCompact(stats.todaySales), sub: formatPKR(stats.todaySales) },
    { label: "Today's Purchases", value: formatPKRCompact(stats.todayPurchases), sub: formatPKR(stats.todayPurchases) },
    { label: "Today's Gross Profit", value: formatPKRCompact(stats.todayGrossProfit), sub: formatPKR(stats.todayGrossProfit), tone: "success" as const },
    { label: "Monthly Sales", value: formatPKRCompact(stats.monthlySales), sub: formatPKR(stats.monthlySales) },
    { label: "Monthly Gross Profit", value: formatPKRCompact(stats.monthlyGrossProfit), sub: formatPKR(stats.monthlyGrossProfit), tone: "success" as const },
    { label: "Customer Receivables", value: formatPKRCompact(stats.customerReceivables), sub: formatPKR(stats.customerReceivables) },
    { label: "Supplier Payables", value: formatPKRCompact(stats.supplierPayables), sub: formatPKR(stats.supplierPayables) },
  ];

  return (
    <div>
      <PageHeader
        title="Dashboard"
        subtitle="Live overview of your shop — all numbers come straight from the database."
        actions={
          <>
            <LinkButton href="/sales/new" variant="primary" size="sm">+ New Sale</LinkButton>
            <LinkButton href="/purchases/new" variant="secondary" size="sm">+ New Purchase</LinkButton>
            <LinkButton href="/products/new" variant="secondary" size="sm">+ Add Product</LinkButton>
          </>
        }
      />

      {/* Stat cards */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-4">
        {cards.map((c) => (
          <Stat key={c.label} label={c.label} value={c.value} sub={c.sub} tone={c.tone} />
        ))}
      </div>

      {/* Action required */}
      <div className="mt-6">
        <Card>
          <CardHeader
            title="⚠ Action Required"
            subtitle="Products that need your attention right now"
            action={
              <div className="flex gap-2">
                <LinkButton href="/low-stock" variant="secondary" size="sm">View Low Stock</LinkButton>
                <LinkButton href="/out-of-stock" variant="secondary" size="sm">View Out of Stock</LinkButton>
              </div>
            }
          />
          <div className="grid gap-0 md:grid-cols-2">
            <div className="border-b border-slate-100 p-4 md:border-b-0 md:border-r">
              <h3 className="mb-3 text-sm font-semibold uppercase tracking-wide text-amber-700">
                Low Stock ({action.lowStock.length})
              </h3>
              {action.lowStock.length === 0 ? (
                <p className="text-sm text-slate-500">No low-stock products. 🎉</p>
              ) : (
                <ul className="space-y-3">
                  {action.lowStock.slice(0, 5).map((p) => (
                    <li key={p.id} className="rounded-lg bg-amber-50 p-3 text-sm">
                      <div className="flex items-center justify-between gap-2">
                        <Link href={`/products/${p.id}`} className="font-semibold text-slate-900 hover:underline">
                          {p.name}
                        </Link>
                        <Badge tone="warning">LOW</Badge>
                      </div>
                      <p className="mt-1 text-slate-600">
                        Current: <b>{p.currentStock}</b> · Minimum: <b>{p.minStock}</b>
                      </p>
                      <p className="mt-0.5 font-medium text-amber-800">
                        Suggested purchase: {p.suggested} units
                      </p>
                    </li>
                  ))}
                </ul>
              )}
            </div>
            <div className="p-4">
              <h3 className="mb-3 text-sm font-semibold uppercase tracking-wide text-red-700">
                Out of Stock ({action.outOfStock.length})
              </h3>
              {action.outOfStock.length === 0 ? (
                <p className="text-sm text-slate-500">Nothing is out of stock. 🎉</p>
              ) : (
                <ul className="space-y-2">
                  {action.outOfStock.slice(0, 5).map((p) => (
                    <li key={p.id} className="flex items-center justify-between gap-2 rounded-lg bg-red-50 p-3 text-sm">
                      <Link href={`/products/${p.id}`} className="font-semibold text-slate-900 hover:underline">
                        {p.name}
                      </Link>
                      <Badge tone="danger">OUT</Badge>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </Card>
      </div>

      {/* Two-column: recent activity */}
      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader title="Recent Sales" action={<LinkButton href="/sales" variant="ghost" size="sm">View all</LinkButton>} />
          {recentSales.length === 0 ? (
            <div className="p-4"><EmptyState title="No sales yet" message="Sales you create in POS will appear here." /></div>
          ) : (
            <Table>
              <thead><tr><Th>Invoice</Th><Th>Total</Th><Th>Paid</Th><Th>Status</Th></tr></thead>
              <tbody>
                {recentSales.map((s) => (
                  <tr key={s.id}>
                    <Td><Link href={`/sales/${s.id}`} className="font-medium text-blue-700 hover:underline">{s.invoiceNumber}</Link></Td>
                    <Td className="tabular-nums">{formatPKR(s.total)}</Td>
                    <Td className="tabular-nums">{formatPKR(s.paidAmount)}</Td>
                    <Td>{s.remaining === 0 ? <Badge tone="success">Paid</Badge> : <Badge tone="warning">{formatPKR(s.remaining)} due</Badge>}</Td>
                  </tr>
                ))}
              </tbody>
            </Table>
          )}
        </Card>
        <Card>
          <CardHeader title="Recent Purchases" action={<LinkButton href="/purchases" variant="ghost" size="sm">View all</LinkButton>} />
          {recentPurchases.length === 0 ? (
            <div className="p-4"><EmptyState title="No purchases yet" message="Purchase invoices will appear here." /></div>
          ) : (
            <Table>
              <thead><tr><Th>Invoice</Th><Th>Total</Th><Th>Paid</Th><Th>Status</Th></tr></thead>
              <tbody>
                {recentPurchases.map((p) => (
                  <tr key={p.id}>
                    <Td><Link href={`/purchases/${p.id}`} className="font-medium text-blue-700 hover:underline">{p.invoiceNumber}</Link></Td>
                    <Td className="tabular-nums">{formatPKR(p.total)}</Td>
                    <Td className="tabular-nums">{formatPKR(p.paidAmount)}</Td>
                    <Td>
                      {p.paymentStatus === "PAID" ? <Badge tone="success">Paid</Badge>
                        : p.paymentStatus === "PARTIAL" ? <Badge tone="warning">Partial</Badge>
                        : <Badge tone="danger">Pending</Badge>}
                    </Td>
                  </tr>
                ))}
              </tbody>
            </Table>
          )}
        </Card>
      </div>

      {/* Top sellers / slow movers */}
      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader title="Top Selling Products" subtitle="Last 30 days by quantity sold" />
          {topSelling.length === 0 ? (
            <div className="p-4"><EmptyState title="No sales data" message="Top sellers will appear once you record sales." /></div>
          ) : (
            <Table>
              <thead><tr><Th>Product</Th><Th className="text-right">Qty Sold</Th><Th className="text-right">Revenue</Th></tr></thead>
              <tbody>
                {topSelling.map((t) => (
                  <tr key={t.productId}>
                    <Td>{t.name}</Td>
                    <Td className="text-right tabular-nums font-medium">{Number(t.qty)}</Td>
                    <Td className="text-right tabular-nums">{formatPKR(Number(t.revenue))}</Td>
                  </tr>
                ))}
              </tbody>
            </Table>
          )}
        </Card>
        <Card>
          <CardHeader title="Slow Moving Products" subtitle="In stock but 0 sales in the last 30 days" />
          {slowMoving.length === 0 ? (
            <div className="p-4"><EmptyState title="Nothing slow-moving" message="Every stocked product sold in the last 30 days." /></div>
          ) : (
            <Table>
              <thead><tr><Th>Product</Th><Th>SKU</Th><Th className="text-right">In Stock</Th></tr></thead>
              <tbody>
                {slowMoving.map((t) => (
                  <tr key={t.id}>
                    <Td><Link href={`/products/${t.id}`} className="text-blue-700 hover:underline">{t.name}</Link></Td>
                    <Td className="text-slate-500">{t.sku ?? "—"}</Td>
                    <Td className="text-right tabular-nums">{t.currentStock}</Td>
                  </tr>
                ))}
              </tbody>
            </Table>
          )}
        </Card>
      </div>

      {/* Stock changes + notifications */}
      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader title="Recent Stock Changes" action={<LinkButton href="/inventory" variant="ghost" size="sm">Inventory</LinkButton>} />
          {movements.length === 0 ? (
            <div className="p-4"><EmptyState title="No movements yet" message="Purchases, sales and adjustments will be logged here." /></div>
          ) : (
            <ul className="divide-y divide-slate-100 px-4">
              {movements.map((m) => (
                <li key={m.id} className="flex items-center justify-between gap-3 py-2.5 text-sm">
                  <div>
                    <p className="font-medium text-slate-800">{m.productName}</p>
                    <p className="text-xs text-slate-500">{m.type.replaceAll("_", " ")} · {m.createdAt ? new Date(m.createdAt).toLocaleString() : ""}</p>
                  </div>
                  <span className={`font-mono text-sm font-semibold tabular-nums ${m.changeQty >= 0 ? "text-emerald-700" : "text-red-700"}`}>
                    {m.changeQty >= 0 ? "+" : ""}{m.changeQty} → {m.newQty}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Card>
        <Card>
          <CardHeader title="Notifications" action={<LinkButton href="/notifications" variant="ghost" size="sm">View all</LinkButton>} />
          {notifs.length === 0 ? (
            <div className="p-4"><EmptyState title="All clear" message="Stock alerts and payment reminders will appear here." /></div>
          ) : (
            <ul className="divide-y divide-slate-100 px-4">
              {notifs.map((n) => (
                <li key={n.id} className="py-2.5 text-sm">
                  <div className="flex items-center gap-2">
                    {!n.isRead && <span className="h-2 w-2 rounded-full bg-blue-600" />}
                    <p className="font-medium text-slate-800">{n.title}</p>
                  </div>
                  {n.message && <p className="mt-0.5 text-xs text-slate-500">{n.message}</p>}
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>

      <div className="mt-6">
        <Alert tone="info">
          <b>Gross profit</b> shown here is sale price minus purchase cost. Shop
          expenses (rent, salaries, utilities) are not included, so this is not net profit.
        </Alert>
      </div>
    </div>
  );
}
