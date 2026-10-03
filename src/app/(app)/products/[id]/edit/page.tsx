import { redirect } from "next/navigation";
import { asc, eq, and } from "drizzle-orm";
import { db } from "@/db";
import {
  products,
  categories,
  brands,
  suppliers,
  vehicles,
  productVehicles,
} from "@/db/schema";
import { requireRole, ForbiddenError } from "@/lib/auth";
import type { ActionResult } from "@/lib/actions";
import { PageHeader, EmptyState, LinkButton } from "@/components/ui";
import { updateProductAction } from "../../actions";
import {
  ProductForm,
  type ProductDefaults,
} from "../../product-form-client";

export default async function EditProductPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  let shopId: string;
  try {
    const session = await requireRole("OWNER");
    shopId = session.shopId;
  } catch (e) {
    const message =
      e instanceof ForbiddenError
        ? e.message
        : "Only the owner can edit products.";
    redirect("/products?error=" + encodeURIComponent(message));
  }
  const { id } = await params;

  const [product] = await db
    .select()
    .from(products)
    .where(and(eq(products.id, id), eq(products.shopId, shopId)))
    .limit(1);

  if (!product) {
    return (
      <div>
        <PageHeader title="Edit product" />
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

  const [
    categoryOptions,
    brandOptions,
    supplierOptions,
    vehicleOptions,
    linkedVehicles,
  ] = await Promise.all([
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
      .select({ vehicleId: productVehicles.vehicleId })
      .from(productVehicles)
      .where(
        and(
          eq(productVehicles.productId, product.id),
          eq(productVehicles.shopId, shopId)
        )
      ),
  ]);

  const defaults: ProductDefaults = {    name: product.name,
    sku: product.sku ?? "",
    partNumber: product.partNumber ?? "",
    oemNumber: product.oemNumber ?? "",
    barcode: product.barcode ?? "",
    categoryId: product.categoryId ?? "",
    brandId: product.brandId ?? "",
    supplierId: product.supplierId ?? "",
    purchasePrice: product.purchasePrice,
    salePrice: product.salePrice,
    currentStock: product.currentStock,
    minStock: product.minStock,
    maxStock: product.maxStock,
    reorderQty: product.reorderQty,
    rack: product.rack ?? "",
    shelf: product.shelf ?? "",
    bin: product.bin ?? "",
    imageUrl: product.imageUrl ?? "",
    description: product.description ?? "",
    active: product.active,
    vehicleIds: linkedVehicles.map((v) => v.vehicleId),
  };

  /** Binds the product id into the form data before delegating. */
  async function boundUpdate(
    prev: ActionResult | undefined,
    formData: FormData
  ) {
    "use server";
    formData.set("id", id);
    return updateProductAction(prev, formData);
  }

  return (
    <div>
      <PageHeader
        title="Edit product"
        subtitle={product.name}
      />
      <ProductForm
        mode="edit"
        action={boundUpdate}
        defaults={defaults}
        categories={categoryOptions}
        brands={brandOptions}
        suppliers={supplierOptions}
        vehicles={vehicleOptions}
      />
    </div>
  );
}
