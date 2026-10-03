/**
 * /out-of-stock — products with zero units on hand, with reorder
 * suggestions and a prominent "Create Purchase" prefill link per product.
 */
import Link from "next/link";
import { and, asc, eq } from "drizzle-orm";
import { db } from "@/db";
import { products } from "@/db/schema";
import { requireSession } from "@/lib/auth";
import { avgMonthlySales, suggestReorder } from "@/lib/tx";
import { formatPKR } from "@/lib/money";
import {
  Badge,
  Card,
  CardHeader,
  EmptyState,
  LinkButton,
  PageHeader,
  Stat,
} from "@/components/ui";

export const dynamic = "force-dynamic";

export default async function OutOfStockPage() {
  const session = await requireSession();
  const shopId = session.shopId;

  const rows = await db
    .select({
      id: products.id,
      name: products.name,
      sku: products.sku,
      partNumber: products.partNumber,
      minStock: products.minStock,
      reorderQty: products.reorderQty,
      purchasePrice: products.purchasePrice,
    })
    .from(products)
    .where(
      and(
        eq(products.shopId, shopId),
        eq(products.active, true),
        eq(products.currentStock, 0)
      )
    )
    .orderBy(asc(products.name));

  const items = await Promise.all(
    rows.map(async (p) => {
      const avg = await avgMonthlySales(shopId, p.id);
      const s = suggestReorder(0, p.minStock, p.reorderQty, avg);
      return { ...p, suggested: s.recommendedQty, reasons: s.reasons };
    })
  );

  const totalUnits = items.reduce((a, p) => a + p.suggested, 0);
  const estCost = items.reduce(
    (a, p) => a + p.suggested * p.purchasePrice,
    0
  );

  return (
    <div>
      <PageHeader
        title="⛔ Out of Stock"
        subtitle="Products with zero units on hand — these cannot be sold until restocked."
      />

      {items.length === 0 ? (
        <EmptyState
          title="Nothing is out of stock 🎉"
          message="Every product has at least one unit on hand. Keep it that way!"
          action={
            <LinkButton href="/inventory" variant="secondary" size="sm">
              View Inventory
            </LinkButton>
          }
        />
      ) : (
        <>
          <div className="mb-5 grid grid-cols-2 gap-3 sm:grid-cols-3">
            <Stat label="Out-of-stock items" value={String(items.length)} tone="danger" />
            <Stat
              label="Suggested units to buy"
              value={totalUnits.toLocaleString()}
              tone="danger"
            />
            <Stat
              label="Est. purchase cost"
              value={formatPKR(estCost)}
              sub="Suggested qty × purchase cost"
              tone="danger"
            />
          </div>

          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {items.map((p) => (
              <Card key={p.id} className="border-red-200">
                <CardHeader
                  title={p.name}
                  subtitle={
                    [p.sku, p.partNumber].filter(Boolean).join(" · ") ||
                    "No SKU"
                  }
                  action={<Badge tone="danger">OUT</Badge>}
                />
                <div className="space-y-2 p-4 text-sm">
                  <p className="text-slate-600">
                    Current: <b className="tabular-nums text-red-700">0</b> ·
                    Minimum:{" "}
                    <b className="tabular-nums text-slate-900">{p.minStock}</b>
                  </p>
                  <p className="font-medium text-red-800">
                    Suggested purchase: {p.suggested} units
                  </p>
                  <ul className="list-disc space-y-0.5 pl-5 text-xs text-slate-500">
                    {p.reasons.map((r, i) => (
                      <li key={i}>{r}</li>
                    ))}
                  </ul>
                  <div className="flex gap-2 pt-2">
                    <LinkButton
                      href={`/purchases/new?product=${p.id}&qty=${p.suggested}`}
                      variant="danger"
                      size="sm"
                    >
                      + Create Purchase
                    </LinkButton>
                    <LinkButton
                      href={`/inventory?product=${p.id}`}
                      variant="ghost"
                      size="sm"
                    >
                      View in inventory
                    </LinkButton>
                  </div>
                  <p className="text-xs text-slate-400">
                    <Link
                      href={`/products/${p.id}`}
                      className="text-blue-700 hover:underline"
                    >
                      Product details →
                    </Link>
                  </p>
                </div>
              </Card>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
