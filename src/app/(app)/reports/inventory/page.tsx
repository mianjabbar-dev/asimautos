/**
 * /reports/inventory — current stock valuation (stock × purchase cost),
 * totals, and valuation grouped by category / brand / supplier.
 */
import { and, desc, eq, sql } from "drizzle-orm";
import { db } from "@/db";
import { products, categories, brands, suppliers } from "@/db/schema";
import { requireSession } from "@/lib/auth";
import { getValuationBy } from "@/lib/stats";
import { formatPKR } from "@/lib/money";
import {
  Card,
  CardHeader,
  EmptyState,
  PageHeader,
  Stat,
  Table,
  Td,
  Th,
} from "@/components/ui";
import { ExportButtons, type ExportColumn } from "../export-buttons-client";

export const dynamic = "force-dynamic";

export default async function InventoryReportPage() {
  const session = await requireSession();
  const shopId = session.shopId;

  const [rows, byCategory, byBrand, bySupplier] = await Promise.all([
    db
      .select({
        id: products.id,
        name: products.name,
        sku: products.sku,
        categoryName: categories.name,
        brandName: brands.name,
        supplierName: suppliers.name,
        currentStock: products.currentStock,
        purchasePrice: products.purchasePrice,
        rack: products.rack,
        shelf: products.shelf,
        bin: products.bin,
      })
      .from(products)
      .leftJoin(categories, eq(products.categoryId, categories.id))
      .leftJoin(brands, eq(products.brandId, brands.id))
      .leftJoin(suppliers, eq(products.supplierId, suppliers.id))
      .where(and(eq(products.shopId, shopId), eq(products.active, true)))
      .orderBy(desc(sql`${products.currentStock} * ${products.purchasePrice}`)),
    getValuationBy(shopId, "category"),
    getValuationBy(shopId, "brand"),
    getValuationBy(shopId, "supplier"),
  ]);

  const totalUnits = rows.reduce((a, r) => a + r.currentStock, 0);
  const totalValue = rows.reduce(
    (a, r) => a + r.currentStock * r.purchasePrice,
    0
  );

  const columns: ExportColumn[] = [
    { key: "product", label: "Product" },
    { key: "sku", label: "SKU" },
    { key: "category", label: "Category" },
    { key: "brand", label: "Brand" },
    { key: "supplier", label: "Supplier" },
    { key: "stock", label: "Stock" },
    { key: "purchaseCost", label: "Purchase cost (PKR)" },
    { key: "value", label: "Value (PKR)" },
    { key: "location", label: "Location" },
  ];
  const data = rows.map((r) => ({
    product: r.name,
    sku: r.sku ?? "",
    category: r.categoryName ?? "",
    brand: r.brandName ?? "",
    supplier: r.supplierName ?? "",
    stock: String(r.currentStock),
    purchaseCost: formatPKR(r.purchasePrice),
    value: formatPKR(r.currentStock * r.purchasePrice),
    location: [r.rack, r.shelf, r.bin].filter(Boolean).join(" · "),
  }));

  const groups: Array<{ title: string; rows: typeof byCategory }> = [
    { title: "By Category", rows: byCategory },
    { title: "By Brand", rows: byBrand },
    { title: "By Supplier", rows: bySupplier },
  ];

  return (
    <div>
      <PageHeader
        title="Inventory Valuation"
        subtitle="Current stock value = units on hand × purchase cost"
        actions={
          <ExportButtons data={data} filename="inventory-report" columns={columns} />
        }
      />

      <div className="mb-5 grid grid-cols-2 gap-3 sm:grid-cols-3">
        <Stat label="Products" value={String(rows.length)} />
        <Stat label="Total units" value={totalUnits.toLocaleString()} />
        <Stat label="Total inventory value" value={formatPKR(totalValue)} />
      </div>

      <Card>
        <CardHeader title="Stock valuation" subtitle="Sorted by highest value first" />
        {rows.length === 0 ? (
          <div className="p-4">
            <EmptyState
              title="No products"
              message="Add products to see your inventory valuation here."
            />
          </div>
        ) : (
          <Table>
            <thead>
              <tr>
                <Th>Product</Th>
                <Th>SKU</Th>
                <Th className="text-right">Stock</Th>
                <Th className="text-right">Purchase cost</Th>
                <Th className="text-right">Value</Th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id}>
                  <Td className="font-medium">{r.name}</Td>
                  <Td className="text-slate-500">{r.sku ?? "—"}</Td>
                  <Td className="text-right tabular-nums">{r.currentStock}</Td>
                  <Td className="text-right tabular-nums">
                    {formatPKR(r.purchasePrice)}
                  </Td>
                  <Td className="text-right font-medium tabular-nums">
                    {formatPKR(r.currentStock * r.purchasePrice)}
                  </Td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="bg-slate-50 font-semibold">
                <Td>Totals</Td>
                <Td>{""}</Td>
                <Td className="text-right tabular-nums">
                  {totalUnits.toLocaleString()}
                </Td>
                <Td>{""}</Td>
                <Td className="text-right tabular-nums">{formatPKR(totalValue)}</Td>
              </tr>
            </tfoot>
          </Table>
        )}
      </Card>

      <div className="mt-6 grid gap-6 lg:grid-cols-3">
        {groups.map((g) => (
          <Card key={g.title}>
            <CardHeader title={g.title} />
            {g.rows.length === 0 ? (
              <div className="p-4">
                <EmptyState title="No data" message="Nothing to break down yet." />
              </div>
            ) : (
              <Table>
                <thead>
                  <tr>
                    <Th>Name</Th>
                    <Th className="text-right">Units</Th>
                    <Th className="text-right">Value</Th>
                  </tr>
                </thead>
                <tbody>
                  {g.rows.map((r) => (
                    <tr key={r.name}>
                      <Td>{r.name}</Td>
                      <Td className="text-right tabular-nums">
                        {r.units.toLocaleString()}
                      </Td>
                      <Td className="text-right tabular-nums">
                        {formatPKR(r.value)}
                      </Td>
                    </tr>
                  ))}
                </tbody>
              </Table>
            )}
          </Card>
        ))}
      </div>
    </div>
  );
}
