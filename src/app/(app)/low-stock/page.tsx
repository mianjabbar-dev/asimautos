/**
 * /low-stock — products at or below minimum stock with rule-based
 * reorder suggestions and a one-click "Create Purchase" prefill link.
 */
import Link from "next/link";
import { and, asc, eq, gt, lte } from "drizzle-orm";
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

export default async function LowStockPage() {
  const session = await requireSession();
  const shopId = session.shopId;

  const rows = await db
    .select({
      id: products.id,
      name: products.name,
      sku: products.sku,
      partNumber: products.partNumber,
      currentStock: products.currentStock,
      minStock: products.minStock,
      reorderQty: products.reorderQty,
      purchasePrice: products.purchasePrice,
    })
    .from(products)
    .where(
      and(
        eq(products.shopId, shopId),
        eq(products.active, true),
        gt(products.currentStock, 0),
        lte(products.currentStock, products.minStock)
      )
    )
    .orderBy(asc(products.currentStock));

  const items = await Promise.all(
    rows.map(async (p) => {
      const avg = await avgMonthlySales(shopId, p.id);
      const s = suggestReorder(p.currentStock, p.minStock, p.reorderQty, avg);
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
        title="⚠️ Low Stock"
        subtitle="Products at or below their minimum stock level — restock before they run out."
      />

      {items.length === 0 ? (
        <EmptyState
          title="No low-stock products"
          message="Everything is above its minimum stock level. Nice work! 🎉"
          action={
            <LinkButton href="/inventory" variant="secondary" size="sm">
              View Inventory
            </LinkButton>
          }
        />
      ) : (
        <>
          <div className="mb-5 grid grid-cols-2 gap-3 sm:grid-cols-3">
            <Stat label="Low-stock items" value={String(items.length)} tone="warning" />
            <Stat
              label="Suggested units to buy"
              value={totalUnits.toLocaleString()}
              tone="warning"
            />
            <Stat
              label="Est. purchase cost"
              value={formatPKR(estCost)}
              sub="Suggested qty × purchase cost"
              tone="warning"
            />
          </div>

          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {items.map((p) => (
              <Card key={p.id}>
                <CardHeader
                  title={p.name}
                  subtitle={
                    [p.sku, p.partNumber].filter(Boolean).join(" · ") ||
                    "No SKU"
                  }
                  action={<Badge tone="warning">LOW</Badge>}
                />
                <div className="space-y-2 p-4 text-sm">
                  <p className="text-slate-600">
                    Current:{" "}
                    <b className="tabular-nums text-slate-900">{p.currentStock}</b>{" "}
                    · Minimum:{" "}
                    <b className="tabular-nums text-slate-900">{p.minStock}</b>
                  </p>
                  <p className="font-medium text-amber-800">
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
                      variant="primary"
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
