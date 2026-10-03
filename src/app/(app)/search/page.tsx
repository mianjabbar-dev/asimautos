/**
 * /search — target of the topbar search. Reads ?q=, runs globalSearch,
 * renders product cards grouped by category with price, stock badge,
 * location and a link to each product.
 */
import Link from "next/link";
import { requireSession } from "@/lib/auth";
import { globalSearch, type SearchResult } from "@/lib/search";
import { formatPKR } from "@/lib/money";
import {
  Badge,
  Card,
  EmptyState,
  PageHeader,
} from "@/components/ui";

export const dynamic = "force-dynamic";

function stockBadge(r: SearchResult) {
  if (r.currentStock <= 0) return <Badge tone="danger">OUT OF STOCK</Badge>;
  if (r.currentStock <= r.minStock) return <Badge tone="warning">LOW</Badge>;
  return <Badge tone="success">IN STOCK</Badge>;
}

function location(r: SearchResult): string {
  return [r.rack, r.shelf, r.bin].filter(Boolean).join(" · ") || "—";
}

export default async function SearchPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const session = await requireSession();
  const sp = await searchParams;
  const raw = sp.q;
  const q = (Array.isArray(raw) ? raw[0] : raw)?.trim() ?? "";

  const results = q ? await globalSearch(session.shopId, q, 50) : [];

  // Group by category, preserving result order.
  const groups: Array<{ name: string; items: SearchResult[] }> = [];
  for (const r of results) {
    const name = r.categoryName ?? "Uncategorized";
    let g = groups.find((x) => x.name === name);
    if (!g) {
      g = { name, items: [] };
      groups.push(g);
    }
    g.items.push(r);
  }

  return (
    <div>
      <PageHeader
        title={q ? `Search results for “${q}”` : "Search"}
        subtitle={
          q
            ? `${results.length} product${results.length === 1 ? "" : "s"} matched`
            : "Find any product in your inventory"
        }
      />

      {!q && (
        <EmptyState
          title="Search products"
          message="Type a product name, SKU, part number, OEM number, barcode, brand, category, vehicle or rack location in the search bar above and press Enter."
        />
      )}

      {q && results.length === 0 && (
        <EmptyState
          title="No products found"
          message={`Nothing matched “${q}”. Check the spelling or try a part number, barcode or vehicle name.`}
        />
      )}

      {groups.map((g) => (
        <section key={g.name} className="mb-8">
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-500">
            {g.name}{" "}
            <span className="text-slate-400">({g.items.length})</span>
          </h2>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {g.items.map((r) => (
              <Card key={r.id} className="p-4">
                <div className="flex items-start justify-between gap-2">
                  <Link
                    href={`/products/${r.id}`}
                    className="font-semibold text-slate-900 hover:text-blue-700 hover:underline"
                  >
                    {r.name}
                  </Link>
                  {stockBadge(r)}
                </div>
                <p className="mt-1 text-xs text-slate-500">
                  {[r.sku, r.partNumber].filter(Boolean).join(" · ") ||
                    "No SKU"}
                  {r.brandName ? ` · ${r.brandName}` : ""}
                </p>
                <div className="mt-3 flex items-end justify-between">
                  <p className="text-lg font-bold tabular-nums text-slate-900">
                    {formatPKR(r.salePrice)}
                  </p>
                  <p className="text-sm tabular-nums text-slate-600">
                    Stock: <b>{r.currentStock}</b>
                  </p>
                </div>
                <p className="mt-1 text-xs text-slate-500">
                  📍 {location(r)}
                </p>
                <Link
                  href={`/products/${r.id}`}
                  className="mt-3 inline-block text-sm font-medium text-blue-700 hover:underline"
                >
                  View product →
                </Link>
              </Card>
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}
