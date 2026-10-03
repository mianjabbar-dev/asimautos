import Link from "next/link";
import type { ReactNode } from "react";
import { eq, and, desc } from "drizzle-orm";
import { db } from "@/db";
import {
  products,
  categories,
  brands,
  suppliers,
  vehicles,
  productVehicles,
  stockMovements,
  users,
} from "@/db/schema";
import { requireSession } from "@/lib/auth";
import { formatPKR } from "@/lib/money";
import {
  PageHeader,
  LinkButton,
  Card,
  CardHeader,
  Table,
  Th,
  Td,
  Badge,
  EmptyState,
  FormMessage,
  Alert,
} from "@/components/ui";
import { ConfirmSubmit } from "@/components/ui-client";
import { deleteProductAction } from "../actions";

export const dynamic = "force-dynamic";

type SearchParams = { message?: string };

function DetailRow({
  label,
  value,
}: {
  label: string;
  value: ReactNode;
}) {
  return (
    <div className="grid grid-cols-3 gap-2 border-b border-slate-100 py-2.5 last:border-0 sm:grid-cols-4">
      <dt className="text-sm font-medium text-slate-500">{label}</dt>
      <dd className="col-span-2 text-sm text-slate-900 sm:col-span-3">{value}</dd>
    </div>
  );
}

export default async function ProductDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<SearchParams>;
}) {
  const session = await requireSession();
  const shopId = session.shopId;
  const isOwner = session.role === "OWNER";
  const { id } = await params;
  const sp = await searchParams;

  const [product] = await db
    .select({
      id: products.id,
      name: products.name,
      sku: products.sku,
      partNumber: products.partNumber,
      oemNumber: products.oemNumber,
      barcode: products.barcode,
      purchasePrice: products.purchasePrice,
      salePrice: products.salePrice,
      currentStock: products.currentStock,
      minStock: products.minStock,
      maxStock: products.maxStock,
      reorderQty: products.reorderQty,
      rack: products.rack,
      shelf: products.shelf,
      bin: products.bin,
      imageUrl: products.imageUrl,
      description: products.description,
      active: products.active,
      createdAt: products.createdAt,
      updatedAt: products.updatedAt,
      categoryName: categories.name,
      brandName: brands.name,
      supplierName: suppliers.name,
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
    .leftJoin(
      suppliers,
      and(eq(suppliers.id, products.supplierId), eq(suppliers.shopId, shopId))
    )
    .where(and(eq(products.id, id), eq(products.shopId, shopId)))
    .limit(1);

  if (!product) {
    return (
      <div>
        <PageHeader title="Product not found" />
        <EmptyState
          title="Product not found"
          message="This product does not exist or belongs to another shop."
          action={
            <LinkButton href="/products" variant="secondary" size="sm">
              Back to products
            </LinkButton>
          }
        />
      </div>
    );
  }

  const [compatible, movements] = await Promise.all([
    db
      .select({
        id: vehicles.id,
        make: vehicles.make,
        model: vehicles.model,
        variant: vehicles.variant,
        yearFrom: vehicles.yearFrom,
        yearTo: vehicles.yearTo,
      })
      .from(productVehicles)
      .innerJoin(vehicles, eq(vehicles.id, productVehicles.vehicleId))
      .where(
        and(
          eq(productVehicles.productId, product.id),
          eq(productVehicles.shopId, shopId)
        )
      )
      .orderBy(vehicles.make, vehicles.model),
    db
      .select({
        id: stockMovements.id,
        type: stockMovements.type,
        previousQty: stockMovements.previousQty,
        changeQty: stockMovements.changeQty,
        newQty: stockMovements.newQty,
        note: stockMovements.note,
        createdAt: stockMovements.createdAt,
        userName: users.name,
      })
      .from(stockMovements)
      .leftJoin(users, eq(users.id, stockMovements.userId))
      .where(
        and(
          eq(stockMovements.productId, product.id),
          eq(stockMovements.shopId, shopId)
        )
      )
      .orderBy(desc(stockMovements.createdAt))
      .limit(10),
  ]);

  const locationLong =
    [product.rack && `Rack ${product.rack}`, product.shelf && `Shelf ${product.shelf}`, product.bin && `Bin ${product.bin}`]
      .filter(Boolean)
      .join(" → ") || "—";

  return (
    <div>
      <PageHeader
        title={product.name}
        subtitle="Product details"
        actions={
          <>
            <LinkButton href="/products" variant="secondary" size="sm">
              ← Back
            </LinkButton>
            {isOwner && (
              <>
                <LinkButton href={`/products/${product.id}/edit`} variant="secondary" size="sm">
                  Edit
                </LinkButton>
                <form action={deleteProductAction}>
                  <input type="hidden" name="id" value={product.id} />
                  <ConfirmSubmit message={`Delete "${product.name}"? This cannot be undone.`}>
                    Delete
                  </ConfirmSubmit>
                </form>
              </>
            )}
          </>
        }
      />

      {sp.message && (
        <div className="mb-4">
          <FormMessage message={sp.message} tone="success" />
        </div>
      )}

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="space-y-4 lg:col-span-2">
          {/* Overview */}
          <Card className="p-4 sm:p-5">
            <div className="mb-3 flex flex-wrap items-center gap-2">
              {product.currentStock <= 0 ? (
                <Badge tone="danger">OUT OF STOCK</Badge>
              ) : product.currentStock <= product.minStock ? (
                <Badge tone="warning">LOW STOCK</Badge>
              ) : (
                <Badge tone="success">IN STOCK</Badge>
              )}
              {product.active ? (
                <Badge tone="info">Active</Badge>
              ) : (
                <Badge tone="default">Inactive</Badge>
              )}
              {product.brandName && <Badge tone="default">{product.brandName}</Badge>}
              {product.categoryName && <Badge tone="default">{product.categoryName}</Badge>}
            </div>
            <dl>
              <DetailRow label="SKU" value={product.sku ?? "—"} />
              <DetailRow label="Part number" value={product.partNumber ?? "—"} />
              <DetailRow label="OEM number" value={product.oemNumber ?? "—"} />
              <DetailRow label="Barcode" value={product.barcode ?? "—"} />
              <DetailRow label="Category" value={product.categoryName ?? "—"} />
              <DetailRow label="Brand" value={product.brandName ?? "—"} />
              <DetailRow label="Preferred supplier" value={product.supplierName ?? "—"} />
              <DetailRow
                label="Location"
                value={<span className="font-medium">{locationLong}</span>}
              />
              <DetailRow
                label="Description"
                value={product.description ?? "—"}
              />
              {product.imageUrl && (
                <DetailRow
                  label="Image"
                  value={
                    <a
                      href={product.imageUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="text-blue-700 hover:underline"
                    >
                      View image
                    </a>
                  }
                />
              )}
            </dl>
          </Card>

          {/* Vehicle compatibility */}
          <Card>
            <CardHeader
              title="Vehicle compatibility"
              subtitle={`${compatible.length} vehicle${compatible.length === 1 ? "" : "s"}`}
            />
            {compatible.length === 0 ? (
              <div className="p-4">
                <EmptyState
                  title="No compatible vehicles"
                  message="This part is not linked to any vehicle yet."
                />
              </div>
            ) : (
              <ul className="divide-y divide-slate-100 px-4">
                {compatible.map((v) => (
                  <li key={v.id} className="py-2.5 text-sm text-slate-800">
                    <span className="font-medium">{v.make}</span> {v.model}
                    {v.variant && <span className="text-slate-500"> {v.variant}</span>}
                    {(v.yearFrom || v.yearTo) && (
                      <span className="text-slate-500">
                        {" "}
                        ({v.yearFrom ?? "?"}–{v.yearTo ?? "?"})
                      </span>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </Card>

          {/* Recent stock movements */}
          <Card>
            <CardHeader
              title="Recent stock movements"
              subtitle="Last 10 changes for this product"
            />
            {movements.length === 0 ? (
              <div className="p-4">
                <EmptyState
                  title="No movements yet"
                  message="Stock changes from purchases, sales and adjustments will be logged here."
                />
              </div>
            ) : (
              <Table>
                <thead>
                  <tr>
                    <Th>Date</Th>
                    <Th>Type</Th>
                    <Th className="text-right">Change</Th>
                    <Th className="text-right">New Qty</Th>
                    <Th>Note</Th>
                  </tr>
                </thead>
                <tbody>
                  {movements.map((m) => (
                    <tr key={m.id}>
                      <Td className="whitespace-nowrap text-xs text-slate-500">
                        {m.createdAt
                          ? new Date(m.createdAt).toLocaleString("en-PK", {
                              dateStyle: "medium",
                              timeStyle: "short",
                            })
                          : "—"}
                      </Td>
                      <Td>
                        <Badge tone="default">
                          {m.type.replaceAll("_", " ")}
                        </Badge>
                      </Td>
                      <Td
                        className={`text-right font-semibold tabular-nums ${
                          m.changeQty >= 0 ? "text-emerald-700" : "text-red-700"
                        }`}
                      >
                        {m.changeQty >= 0 ? "+" : ""}
                        {m.changeQty}
                      </Td>
                      <Td className="text-right tabular-nums font-medium">
                        {m.newQty}
                      </Td>
                      <Td className="text-xs text-slate-500">
                        {[m.note, m.userName ? `by ${m.userName}` : null]
                          .filter(Boolean)
                          .join(" ") || "—"}
                      </Td>
                    </tr>
                  ))}
                </tbody>
              </Table>
            )}
          </Card>
        </div>

        {/* Pricing & stock summary */}
        <div className="space-y-4">
          <Card className="p-4 sm:p-5">
            <h2 className="mb-3 text-base font-semibold text-slate-900">
              Pricing & stock
            </h2>
            <dl className="space-y-2.5 text-sm">
              <div className="flex justify-between">
                <dt className="text-slate-500">Sale price</dt>
                <dd className="font-semibold tabular-nums text-slate-900">
                  {formatPKR(product.salePrice)}
                </dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-slate-500">Purchase price</dt>
                <dd className="tabular-nums text-slate-900">
                  {formatPKR(product.purchasePrice)}
                </dd>
              </div>
              <div className="flex justify-between border-t border-slate-100 pt-2.5">
                <dt className="text-slate-500">Current stock</dt>
                <dd className="font-bold tabular-nums text-slate-900">
                  {product.currentStock}
                </dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-slate-500">Min stock</dt>
                <dd className="tabular-nums text-slate-900">{product.minStock}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-slate-500">Max stock</dt>
                <dd className="tabular-nums text-slate-900">
                  {product.maxStock ?? "—"}
                </dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-slate-500">Reorder qty</dt>
                <dd className="tabular-nums text-slate-900">{product.reorderQty}</dd>
              </div>
            </dl>
          </Card>
          {product.currentStock <= product.minStock && (
            <Alert tone={product.currentStock <= 0 ? "danger" : "warning"}>
              {product.currentStock <= 0
                ? "This product is out of stock."
                : `Low stock: only ${product.currentStock} left (minimum ${product.minStock}).`}
            </Alert>
          )}
          <Card className="p-4 sm:p-5">
            <h2 className="mb-2 text-base font-semibold text-slate-900">
              Record info
            </h2>
            <dl className="space-y-2 text-sm text-slate-600">
              <div className="flex justify-between gap-2">
                <dt>Created</dt>
                <dd className="text-right">
                  {product.createdAt
                    ? new Date(product.createdAt).toLocaleDateString("en-PK", { dateStyle: "medium" })
                    : "—"}
                </dd>
              </div>
              <div className="flex justify-between gap-2">
                <dt>Updated</dt>
                <dd className="text-right">
                  {product.updatedAt
                    ? new Date(product.updatedAt).toLocaleDateString("en-PK", { dateStyle: "medium" })
                    : "—"}
                </dd>
              </div>
            </dl>
          </Card>
        </div>
      </div>

      <p className="mt-4 text-xs text-slate-400">
        <Link href="/products" className="text-blue-700 hover:underline">
          ← All products
        </Link>
      </p>
    </div>
  );
}
