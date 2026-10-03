/**
 * /inventory — full stock table with filters, sorting, pagination,
 * status badges, inventory valuation, and OWNER-only stock adjustment.
 * Supports ?product=<id> to highlight a row (used by notification links).
 */
import Link from "next/link";
import {
  and,
  asc,
  desc,
  eq,
  gt,
  ilike,
  lte,
  or,
  sql,
  type SQL,
} from "drizzle-orm";
import { db } from "@/db";
import { products, categories } from "@/db/schema";
import { requireSession } from "@/lib/auth";
import { formatPKR } from "@/lib/money";
import {
  Badge,
  Button,
  Card,
  EmptyState,
  Field,
  Input,
  LinkButton,
  PageHeader,
  Pagination,
  Select,
  Table,
  Td,
  Th,
} from "@/components/ui";
import { AdjustStockButton } from "./adjust-client";

export const dynamic = "force-dynamic";

const PAGE_SIZE = 25;

type SP = Record<string, string | string[] | undefined>;
const param = (sp: SP, k: string, fallback = ""): string => {
  const v = sp[k];
  return Array.isArray(v) ? (v[0] ?? fallback) : (v ?? fallback);
};

function statusBadge(stock: number, min: number) {
  if (stock <= 0) return <Badge tone="danger">OUT</Badge>;
  if (stock <= min) return <Badge tone="warning">LOW</Badge>;
  return <Badge tone="success">OK</Badge>;
}

export default async function InventoryPage({
  searchParams,
}: {
  searchParams: Promise<SP>;
}) {
  const session = await requireSession();
  const shopId = session.shopId;
  const isOwner = session.role === "OWNER";
  const sp = await searchParams;

  const page = Math.max(1, parseInt(param(sp, "page"), 10) || 1);
  const q = param(sp, "q").trim();
  const status = ["all", "low", "out", "ok"].includes(param(sp, "status"))
    ? param(sp, "status")
    : "all";
  const categoryId = param(sp, "category");
  const sort = ["name", "stock", "value"].includes(param(sp, "sort"))
    ? param(sp, "sort")
    : "name";
  const highlightId = param(sp, "product");

  const like = `%${q}%`;
  const conds: SQL[] = [
    eq(products.shopId, shopId),
    eq(products.active, true),
  ];
  if (q) {
    conds.push(
      or(
        ilike(products.name, like),
        ilike(products.sku, like),
        ilike(products.partNumber, like),
        ilike(products.barcode, like)
      )!
    );
  }
  if (categoryId) conds.push(eq(products.categoryId, categoryId));
  if (status === "out") conds.push(eq(products.currentStock, 0));
  else if (status === "low")
    conds.push(
      and(gt(products.currentStock, 0), lte(products.currentStock, products.minStock))!
    );
  else if (status === "ok")
    conds.push(sql`${products.currentStock} > ${products.minStock}`);
  const where = and(...conds)!;

  const order =
    sort === "stock"
      ? asc(products.currentStock)
      : sort === "value"
        ? desc(sql`${products.currentStock} * ${products.purchasePrice}`)
        : asc(products.name);

  const [cats, countRows, rows] = await Promise.all([
    db
      .select({ id: categories.id, name: categories.name })
      .from(categories)
      .where(eq(categories.shopId, shopId))
      .orderBy(asc(categories.name)),
    db
      .select({ v: sql<number>`count(*)` })
      .from(products)
      .where(where),
    db
      .select({
        id: products.id,
        name: products.name,
        sku: products.sku,
        partNumber: products.partNumber,
        categoryName: categories.name,
        currentStock: products.currentStock,
        minStock: products.minStock,
        purchasePrice: products.purchasePrice,
        rack: products.rack,
        shelf: products.shelf,
        bin: products.bin,
      })
      .from(products)
      .leftJoin(categories, eq(products.categoryId, categories.id))
      .where(where)
      .orderBy(order)
      .limit(PAGE_SIZE)
      .offset((page - 1) * PAGE_SIZE),
  ]);

  const total = Number(countRows[0]?.v ?? 0);
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  // Preserve filters in pagination links.
  const qs = new URLSearchParams();
  for (const [k, v] of Object.entries(sp)) {
    if (k === "page") continue;
    const val = Array.isArray(v) ? v[0] : v;
    if (val) qs.set(k, val);
  }
  const query = qs.toString();

  const hasFilters =
    q !== "" || status !== "all" || categoryId !== "" || sort !== "name";

  return (
    <div>
      <PageHeader
        title="Inventory"
        subtitle={`${total.toLocaleString()} product${total === 1 ? "" : "s"} in stock ledger`}
      />

      {/* Filters */}
      <form
        method="get"
        action="/inventory"
        className="mb-4 flex flex-wrap items-end gap-2"
      >
        <Field label="Search">
          <Input
            name="q"
            defaultValue={q}
            placeholder="Name, SKU, part no, barcode…"
            className="w-56"
          />
        </Field>
        <Field label="Status">
          <Select name="status" defaultValue={status}>
            <option value="all">All</option>
            <option value="low">Low stock</option>
            <option value="out">Out of stock</option>
            <option value="ok">OK</option>
          </Select>
        </Field>
        <Field label="Category">
          <Select name="category" defaultValue={categoryId}>
            <option value="">All categories</option>
            {cats.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Sort by">
          <Select name="sort" defaultValue={sort}>
            <option value="name">Name (A–Z)</option>
            <option value="stock">Stock (lowest first)</option>
            <option value="value">Value (highest first)</option>
          </Select>
        </Field>
        <Button type="submit">Apply</Button>
        {hasFilters && (
          <LinkButton href="/inventory" variant="ghost">
            Clear
          </LinkButton>
        )}
      </form>

      <Card>
        {rows.length === 0 ? (
          <div className="p-4">
            <EmptyState
              title="No products found"
              message="Try widening your filters, or add products from the Products page."
              action={
                <LinkButton href="/products/new" variant="secondary" size="sm">
                  + Add Product
                </LinkButton>
              }
            />
          </div>
        ) : (
          <>
            <Table>
              <thead>
                <tr>
                  <Th>Product</Th>
                  <Th>SKU</Th>
                  <Th>Category</Th>
                  <Th className="text-right">Stock</Th>
                  <Th className="text-right">Min</Th>
                  <Th>Status</Th>
                  <Th className="text-right">Value</Th>
                  <Th>Location</Th>
                  {isOwner && <Th>Actions</Th>}
                </tr>
              </thead>
              <tbody>
                {rows.map((p) => {
                  const highlighted = highlightId === p.id;
                  const value = p.currentStock * p.purchasePrice;
                  const loc =
                    [p.rack, p.shelf, p.bin].filter(Boolean).join(" · ") || "—";
                  return (
                    <tr
                      key={p.id}
                      className={highlighted ? "bg-blue-50" : undefined}
                    >
                      <Td>
                        <Link
                          href={`/products/${p.id}`}
                          className="font-medium text-blue-700 hover:underline"
                        >
                          {p.name}
                        </Link>
                        {p.partNumber && (
                          <span className="block text-xs text-slate-500">
                            {p.partNumber}
                          </span>
                        )}
                      </Td>
                      <Td className="text-slate-500">{p.sku ?? "—"}</Td>
                      <Td>{p.categoryName ?? "—"}</Td>
                      <Td className="text-right font-semibold tabular-nums">
                        {p.currentStock}
                      </Td>
                      <Td className="text-right tabular-nums text-slate-500">
                        {p.minStock}
                      </Td>
                      <Td>{statusBadge(p.currentStock, p.minStock)}</Td>
                      <Td className="text-right tabular-nums">
                        {formatPKR(value)}
                      </Td>
                      <Td className="text-slate-500">{loc}</Td>
                      {isOwner && (
                        <Td>
                          <AdjustStockButton
                            productId={p.id}
                            name={p.name}
                            currentStock={p.currentStock}
                          />
                        </Td>
                      )}
                    </tr>
                  );
                })}
              </tbody>
            </Table>
            <Pagination
              page={page}
              totalPages={totalPages}
              basePath="/inventory"
              query={query}
            />
          </>
        )}
      </Card>
      {!isOwner && (
        <p className="mt-3 text-xs text-slate-500">
          Stock adjustments require an OWNER account — your STAFF account can
          view inventory but not change it.
        </p>
      )}
    </div>
  );
}
