/**
 * Global product search — partial matching across name, SKU, part number,
 * OEM number, barcode, brand, category, vehicle, rack and supplier.
 */
import { and, eq, ilike, or, sql } from "drizzle-orm";
import { db } from "@/db";
import {
  products,
  categories,
  brands,
  suppliers,
  vehicles,
  productVehicles,
} from "@/db/schema";

export type SearchResult = {
  id: string;
  name: string;
  sku: string | null;
  partNumber: string | null;
  barcode: string | null;
  salePrice: number;
  currentStock: number;
  minStock: number;
  rack: string | null;
  shelf: string | null;
  bin: string | null;
  categoryName: string | null;
  brandName: string | null;
};

export async function globalSearch(
  shopId: string,
  query: string,
  limit = 25
): Promise<SearchResult[]> {
  const q = query.trim();
  if (!q) return [];
  const like = `%${q}%`;

  // Products matching directly, or via vehicle compatibility.
  const vehicleMatchIds = db
    .select({ productId: productVehicles.productId })
    .from(productVehicles)
    .innerJoin(vehicles, eq(productVehicles.vehicleId, vehicles.id))
    .where(
      and(
        eq(productVehicles.shopId, shopId),
        or(
          ilike(vehicles.make, like),
          ilike(vehicles.model, like),
          ilike(vehicles.variant, like)
        )
      )
    );

  const rows = await db
    .select({
      id: products.id,
      name: products.name,
      sku: products.sku,
      partNumber: products.partNumber,
      barcode: products.barcode,
      salePrice: products.salePrice,
      currentStock: products.currentStock,
      minStock: products.minStock,
      rack: products.rack,
      shelf: products.shelf,
      bin: products.bin,
      categoryName: categories.name,
      brandName: brands.name,
    })
    .from(products)
    .leftJoin(categories, eq(products.categoryId, categories.id))
    .leftJoin(brands, eq(products.brandId, brands.id))
    .leftJoin(suppliers, eq(products.supplierId, suppliers.id))
    .where(
      and(
        eq(products.shopId, shopId),
        eq(products.active, true),
        or(
          ilike(products.name, like),
          ilike(products.sku, like),
          ilike(products.partNumber, like),
          ilike(products.oemNumber, like),
          ilike(products.barcode, like),
          ilike(brands.name, like),
          ilike(categories.name, like),
          ilike(products.rack, like),
          ilike(suppliers.name, like),
          sql`${products.id} IN (${vehicleMatchIds})`
        )
      )
    )
    .orderBy(products.name)
    .limit(limit);

  return rows;
}
