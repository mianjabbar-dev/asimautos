import Link from "next/link";
import { eq, and, or, ilike, gt, lte, asc, desc, sql } from "drizzle-orm";
import { db } from "@/db";
import { products, categories, brands } from "@/db/schema";
import { requireSession } from "@/lib/auth";
import { formatPKR } from "@/lib/money";
import {
  PageHeader,
  LinkButton,
  Button,
  Input,
  Select,
  Field,
  Card,
  Table,
  Th,
  Td,
  Badge,
  EmptyState,
  Pagination,
  FormMessage,
} from "@/components/ui";

export const dynamic = "force-dynamic";

const PAGE_SIZE = 20;

type SearchParams = {
  q?: string;
  category?: string;
  brand?: string;
  status?: string;
  sort?: string;
  page?: string;
  message?: string;
  error?: string;
};

/** Escape % _ and \ for ILIKE patterns. */
function like(s: string): string {
  return `%${s.replace(/[\\%_]/g, (m) => `\\${m}`)}%`;
}

export default async function ProductsPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const session = await requireSession();
  const shopId = session.shopId;
  const isOwner = session.role === "OWNER";

  const p = await searchParams;
  const q = (p.q ?? "").trim();
  const categoryId = (p.category ?? "").trim();
  const brandId = (p.brand ?? "").trim();
  const status = (p.status ?? "all").trim();
  const sort = (p.sort ?? "name").trim();
  const page = Math.max(1, parseInt(p.page ?? "1", 10) || 1);

  const [categoryOptions, brandOptions] = await Promise.all([
    db
      .select({ id: categories.id, name: categories.name })
      .from(categories)
      .where(eq(categories.shopId, shopId))
      .orderBy(asc(categories.name)),
    db
      .select({ id: brands.id, name: brands.name })
      .from(brands)
      .where(eq(brands.shopId, shopId))
      .orderBy(asc(brands.name)),
  ]);

  const conditions = [eq(products.shopId, shopId)];
  if (q) {
    const pattern = like(q);
    conditions.push(
      or(
        ilike(products.name, pattern),
        ilike(products.sku, pattern),
        ilike(products.partNumber, pattern),
        ilike(products.oemNumber, pattern),
        ilike(products.barcode, pattern)
      )!
    );
  }
  if (categoryId) conditions.push(eq(products.categoryId, categoryId));
  if (brandId) conditions.push(eq(products.brandId, brandId));
  if (status === "out") conditions.push(eq(products.currentStock, 0));
  else if (status === "low")
    conditions.push(
      and(gt(products.currentStock, 0), lte(products.currentStock, products.minStock))!
    );

  const orderBy =
    sort === "stock"
      ? asc(products.currentStock)
      : sort === "price"
        ? desc(products.salePrice)
        : asc(products.name);

  const where = and(...conditions);

  const [{ v: totalRaw }] = await db
    .select({ v: sql<number>`count(*)` })
    .from(products)
    .where(where);
  const total = Number(totalRaw ?? 0);
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);

  const rows = await db
    .select({
      id: products.id,
      name: products.name,
      sku: products.sku,
      partNumber: products.partNumber,
      salePrice: products.salePrice,
      currentStock: products.currentStock,
      minStock: products.minStock,
      rack: products.rack,
      shelf: products.shelf,
      bin: products.bin,
      active: products.active,
      categoryName: categories.name,
      brandName: brands.name,
    })
    .from(products)
    .leftJoin(
      categories,
      and(eq(categories.id, products.categoryId), eq(categories.shopId, shopId))
    )
    .leftJoin(
      brands,
      and(eq(brands.id, products.brandId), eq(brands.shopId, shopId))
    )
    .where(where)
    .orderBy(orderBy)
    .limit(PAGE_SIZE)
    .offset((safePage - 1) * PAGE_SIZE);

  // Preserve filters in pagination links.
  const qp = new URLSearchParams();
  if (q) qp.set("q", q);
  if (categoryId) qp.set("category", categoryId);
  if (brandId) qp.set("brand", brandId);
  if (status !== "all") qp.set("status", status);
  if (sort !== "name") qp.set("sort", sort);
  const queryStr = qp.toString();

  return (
    <div>
      <PageHeader
        title="Products"
        subtitle={`${total.toLocaleString()} product${total === 1 ? "" : "s"} in your catalog`}
        actions={
          isOwner ? (
            <LinkButton href="/products/new" size="sm">
              + Add Product
            </LinkButton>
          ) : undefined
        }
      />

      {(p.message || p.error) && (
        <div className="mb-4">
          <FormMessage
            message={p.message ?? p.error}
            tone={p.error ? "error" : "success"}
          />
        </div>
      )}

      {/* Filters */}
      <Card className="mb-4 p-4">
        <form method="get" action="/products">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-6">
            <div className="sm:col-span-2 lg:col-span-2">
              <Field label="Search">
                <Input
                  name="q"
                  defaultValue={q}
                  placeholder="Name, SKU, part #, OEM, barcode…"
                />
              </Field>
            </div>
            <Field label="Category">
              <Select name="category" defaultValue={categoryId}>
                <option value="">All categories</option>
                {categoryOptions.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Brand">
              <Select name="brand" defaultValue={brandId}>
                <option value="">All brands</option>
                {brandOptions.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.name}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Stock status">
              <Select name="status" defaultValue={status}>
                <option value="all">All</option>
                <option value="low">Low stock</option>
                <option value="out">Out of stock</option>
              </Select>
            </Field>
            <Field label="Sort by">
              <Select name="sort" defaultValue={sort}>
                <option value="name">Name (A–Z)</option>
                <option value="stock">Stock (low first)</option>
                <option value="price">Price (high first)</option>
              </Select>
            </Field>
          </div>
          <div className="mt-3 flex gap-2">
            <Button type="submit" size="sm">
              Apply
            </Button>
            <LinkButton href="/products" variant="secondary" size="sm">
              Clear
            </LinkButton>
          </div>
        </form>
      </Card>

      {rows.length === 0 ? (
        <EmptyState
          title={q || categoryId || brandId || status !== "all" ? "No products match" : "No products yet"}
          message={
            q || categoryId || brandId || status !== "all"
              ? "Try a different search or clear the filters."
              : "Add your first product to start tracking inventory."
          }
          action={
            isOwner ? (
              <LinkButton href="/products/new" size="sm">
                + Add Product
              </LinkButton>
            ) : undefined
          }
        />
      ) : (
        <Card>
          <Table>
            <thead>
              <tr>
                <Th>Product</Th>
                <Th>Brand</Th>
                <Th>Category</Th>
                <Th className="text-right">Sale Price</Th>
                <Th className="text-right">Stock</Th>
                <Th>Location</Th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => {
                const location = [r.rack, r.shelf, r.bin]
                  .filter(Boolean)
                  .join(" → ");
                return (
                  <tr key={r.id} className="hover:bg-slate-50">
                    <Td>
                      <Link
                        href={`/products/${r.id}`}
                        className="font-medium text-blue-700 hover:underline"
                      >
                        {r.name}
                      </Link>
                      {!r.active && (
                        <Badge tone="default" className="ml-2">
                          Inactive
                        </Badge>
                      )}
                      <div className="mt-0.5 text-xs text-slate-500">
                        {[r.sku, r.partNumber].filter(Boolean).join(" · ") || "—"}
                      </div>
                    </Td>
                    <Td>{r.brandName ?? "—"}</Td>
                    <Td>{r.categoryName ?? "—"}</Td>
                    <Td className="text-right tabular-nums">
                      {formatPKR(r.salePrice)}
                    </Td>
                    <Td className="text-right">
                      <span className="tabular-nums font-medium">
                        {r.currentStock}
                      </span>{" "}
                      {r.currentStock <= 0 ? (
                        <Badge tone="danger">OUT</Badge>
                      ) : r.currentStock <= r.minStock ? (
                        <Badge tone="warning">LOW</Badge>
                      ) : (
                        <Badge tone="success">OK</Badge>
                      )}
                    </Td>
                    <Td className="text-slate-500">{location || "—"}</Td>
                  </tr>
                );
              })}
            </tbody>
          </Table>
          <Pagination
            page={safePage}
            totalPages={totalPages}
            basePath="/products"
            query={queryStr}
          />
        </Card>
      )}
    </div>
  );
}
