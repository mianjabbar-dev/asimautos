import { eq, and, asc, sql } from "drizzle-orm";
import { db } from "@/db";
import { categories, products } from "@/db/schema";
import { requireSession } from "@/lib/auth";
import {
  PageHeader,
  Card,
  CardHeader,
  EmptyState,
  FormMessage,
} from "@/components/ui";
import {
  CategoryCreateForm,
  CategoryTable,
  type CategoryRowData,
} from "./category-client";

export const dynamic = "force-dynamic";

export default async function CategoriesPage({
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
      id: categories.id,
      name: categories.name,
      description: categories.description,
      productCount: sql<number>`count(${products.id})`,
    })
    .from(categories)
    .leftJoin(
      products,
      and(
        eq(products.categoryId, categories.id),
        eq(products.shopId, shopId)
      )
    )
    .where(eq(categories.shopId, shopId))
    .groupBy(categories.id, categories.name, categories.description)
    .orderBy(asc(categories.name));

  const data: CategoryRowData[] = rows.map((r) => ({
    id: r.id,
    name: r.name,
    description: r.description,
    productCount: Number(r.productCount ?? 0),
  }));

  return (
    <div>
      <PageHeader
        title="Categories"
        subtitle="Group products by part type (e.g. Brake System, Engine, Electrical)."
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
            title="Add category"
            subtitle="Names must be unique within your shop."
          />
          <div className="p-4 sm:p-5">
            <CategoryCreateForm />
          </div>
        </Card>
      )}

      {data.length === 0 ? (
        <EmptyState
          title="No categories yet"
          message="Categories help you filter and organize products. Add the first one above."
        />
      ) : (
        <Card>
          <CategoryTable categories={data} canEdit={isOwner} />
        </Card>
      )}
    </div>
  );
}
