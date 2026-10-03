import { eq, and, asc, sql } from "drizzle-orm";
import { db } from "@/db";
import { brands, products } from "@/db/schema";
import { requireSession } from "@/lib/auth";
import {
  PageHeader,
  Card,
  CardHeader,
  EmptyState,
  FormMessage,
} from "@/components/ui";
import {
  BrandCreateForm,
  BrandTable,
  type BrandRowData,
} from "./brand-client";

export const dynamic = "force-dynamic";

export default async function BrandsPage({
  searchParams,
}: {
  searchParams: Promise<{ message?: string; error?: string }>;
}) {
  const session = await requireSession();
  const shopId = session.shopId;
  const isOwner = session.role === "OWNER";
  const sp = await searchParams;

  const rows = await db
    .select({
      id: brands.id,
      name: brands.name,
      description: brands.description,
      productCount: sql<number>`count(${products.id})`,
    })
    .from(brands)
    .leftJoin(
      products,
      and(eq(products.brandId, brands.id), eq(products.shopId, shopId))
    )
    .where(eq(brands.shopId, shopId))
    .groupBy(brands.id, brands.name, brands.description)
    .orderBy(asc(brands.name));

  const data: BrandRowData[] = rows.map((r) => ({
    id: r.id,
    name: r.name,
    description: r.description,
    productCount: Number(r.productCount ?? 0),
  }));

  return (
    <div>
      <PageHeader
        title="Brands"
        subtitle="Track which manufacturer or quality tier each part belongs to."
      />

      {(sp.message || sp.error) && (
        <div className="mb-4">
          <FormMessage
            message={sp.message ?? sp.error}
            tone={sp.error ? "error" : "success"}
          />
        </div>
      )}

      {isOwner && (
        <Card className="mb-4">
          <CardHeader
            title="Add brand"
            subtitle="Names must be unique within your shop."
          />
          <div className="p-4 sm:p-5">
            <BrandCreateForm />
          </div>
        </Card>
      )}

      {data.length === 0 ? (
        <EmptyState
          title="No brands yet"
          message="Add brands like Genuine, OEM or local manufacturers to organize your catalog."
        />
      ) : (
        <Card>
          <BrandTable brands={data} canEdit={isOwner} />
        </Card>
      )}
    </div>
  );
}
