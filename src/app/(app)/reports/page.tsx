/**
 * /reports — hub page with cards linking to each report.
 */
import Link from "next/link";
import { requireSession } from "@/lib/auth";
import { Card, PageHeader } from "@/components/ui";

export const dynamic = "force-dynamic";

const REPORTS = [
  {
    href: "/reports/sales",
    icon: "🧾",
    title: "Sales Report",
    desc: "Every invoice in a period with totals — paid, remaining and payment status. Filter by date presets or a custom range.",
  },
  {
    href: "/reports/purchases",
    icon: "🧮",
    title: "Purchases Report",
    desc: "Supplier invoices in a period with totals — what you bought, paid and still owe.",
  },
  {
    href: "/reports/inventory",
    icon: "📊",
    title: "Inventory Valuation",
    desc: "Current stock value (stock × purchase cost) with totals and breakdowns by category, brand and supplier.",
  },
  {
    href: "/reports/profit",
    icon: "💰",
    title: "Profit Report",
    desc: "Gross profit per product over a period — revenue minus purchase cost. Excludes shop expenses.",
  },
  {
    href: "/reports/stock-movements",
    icon: "🔄",
    title: "Stock Movements",
    desc: "The full stock ledger: every purchase, sale, return, adjustment, damage and loss with before/after quantities.",
  },
  {
    href: "/reports/top-products",
    icon: "🏆",
    title: "Top & Slow Products",
    desc: "Best sellers by quantity over an adjustable window, plus products sitting in stock with zero sales.",
  },
  {
    href: "/reports/customers",
    icon: "👥",
    title: "Customer Balances",
    desc: "Who owes you money: outstanding receivables per customer with totals.",
  },
  {
    href: "/reports/suppliers",
    icon: "🏭",
    title: "Supplier Balances",
    desc: "Who you owe: outstanding payables per supplier with totals.",
  },
  {
    href: "/reports/audit",
    icon: "🕵️",
    title: "Audit Log",
    desc: "Every recorded action in the system — who did what, when, and what changed.",
  },
];

export default async function ReportsHubPage() {
  await requireSession();

  return (
    <div>
      <PageHeader
        title="📈 Reports"
        subtitle="Live numbers straight from the database. Every report can be exported to CSV, Excel or PDF."
      />
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {REPORTS.map((r) => (
          <Link key={r.href} href={r.href} className="group">
            <Card className="h-full p-5 transition-shadow group-hover:shadow-md">
              <p className="text-3xl">{r.icon}</p>
              <h2 className="mt-3 text-base font-semibold text-slate-900 group-hover:text-blue-700 group-hover:underline">
                {r.title}
              </h2>
              <p className="mt-1.5 text-sm leading-relaxed text-slate-500">
                {r.desc}
              </p>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  );
}
