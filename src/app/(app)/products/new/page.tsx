import { redirect } from "next/navigation";
import { asc, eq } from "drizzle-orm";
import { db } from "@/db";
import {
  categories,
  brands,
  suppliers,
  vehicles,
  settings,
} from "@/db/schema";
import { requireRole, ForbiddenError } from "@/lib/auth";
import { PageHeader } from "@/components/ui";
import { createProductAction } from "../actions";
import {
  ProductForm,
  type ProductDefaults,
} from "../product-form-client";

export default async function NewProductPage() {
  let shopId: string;
  try {
    const session = await requireRole("OWNER");
    shopId = session.shopId;
  } catch (e) {
    const message =
      e instanceof ForbiddenError
        ? e.message
        : "Only the owner can add products.";
    redirect("/products?error=" + encodeURIComponent(message));
  }

  const [categoryOptions, brandOptions, supplierOptions, vehicleOptions, shopSettings] =
    await Promise.all([
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
      db
        .select({ id: suppliers.id, name: suppliers.name })
        .from(suppliers)
        .where(eq(suppliers.shopId, shopId))
        .orderBy(asc(suppliers.name)),
      db
        .select({
          id: vehicles.id,
          make: vehicles.make,
          model: vehicles.model,
          variant: vehicles.variant,
          yearFrom: vehicles.yearFrom,
          yearTo: vehicles.yearTo,
        })
        .from(vehicles)
        .where(eq(vehicles.shopId, shopId))
        .orderBy(asc(vehicles.make), asc(vehicles.model)),
      db
        .select()
        .from(settings)
        .where(eq(settings.shopId, shopId))
        .limit(1)
        .then((rows) => rows[0]),
    ]);

  const defaults: ProductDefaults = {
    name: "",
    sku: "",
    partNumber: "",
    oemNumber: "",
    barcode: "",
    categoryId: "",
    brandId: "",
    supplierId: "",
    purchasePrice: 0,
    salePrice: 0,
    currentStock: 0,
    minStock: shopSettings?.defaultMinStock ?? 5,
    maxStock: null,
    reorderQty: shopSettings?.defaultReorderQty ?? 10,
    rack: "",
    shelf: "",
    bin: "",
    imageUrl: "",
    description: "",
    active: true,
    vehicleIds: [],
  };

  return (
    <div>
      <PageHeader
        title="Add Product"
        subtitle="Enter the part details, pricing, stock and shelf location."
      />
      <ProductForm
        mode="new"
        action={createProductAction}
        defaults={defaults}
        categories={categoryOptions}
        brands={brandOptions}
        suppliers={supplierOptions}
        vehicles={vehicleOptions}
      />
    </div>
  );
}
