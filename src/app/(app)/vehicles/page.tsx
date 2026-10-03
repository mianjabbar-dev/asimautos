import { eq, and, or, ilike, asc, sql } from "drizzle-orm";
import { db } from "@/db";
import { vehicles, productVehicles } from "@/db/schema";
import { requireSession } from "@/lib/auth";
import {
  PageHeader,
  Card,
  CardHeader,
  Input,
  Field,
  Button,
  LinkButton,
  EmptyState,
  FormMessage,
} from "@/components/ui";
import { VehicleManager, type VehicleRowData } from "./vehicle-client";

export const dynamic = "force-dynamic";

type SearchParams = {
  q?: string;
  message?: string;
  error?: string;
};

/** Escape % _ and \ for ILIKE patterns. */
function like(s: string): string {
  return `%${s.replace(/[\\%_]/g, (m) => `\\${m}`)}%`;
}

export default async function VehiclesPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const session = await requireSession();
  const shopId = session.shopId;
  const isOwner = session.role === "OWNER";
  const sp = await searchParams;
  const q = (sp.q ?? "").trim();

  const conditions = [eq(vehicles.shopId, shopId)];
  if (q) {
    const pattern = like(q);
    conditions.push(
      or(ilike(vehicles.make, pattern), ilike(vehicles.model, pattern))!
    );
  }

  const rows = await db
    .select({
      id: vehicles.id,
      make: vehicles.make,
      model: vehicles.model,
      variant: vehicles.variant,
      yearFrom: vehicles.yearFrom,
      yearTo: vehicles.yearTo,
      engine: vehicles.engine,
      fuelType: vehicles.fuelType,
      notes: vehicles.notes,
      productCount: sql<number>`count(${productVehicles.productId})`,
    })
    .from(vehicles)
    .leftJoin(
      productVehicles,
      and(
        eq(productVehicles.vehicleId, vehicles.id),
        eq(productVehicles.shopId, shopId)
      )
    )
    .where(and(...conditions))
    .groupBy(
      vehicles.id,
      vehicles.make,
      vehicles.model,
      vehicles.variant,
      vehicles.yearFrom,
      vehicles.yearTo,
      vehicles.engine,
      vehicles.fuelType,
      vehicles.notes
    )
    .orderBy(asc(vehicles.make), asc(vehicles.model));

  const data: VehicleRowData[] = rows.map((r) => ({
    id: r.id,
    make: r.make,
    model: r.model,
    variant: r.variant,
    yearFrom: r.yearFrom,
    yearTo: r.yearTo,
    engine: r.engine,
    fuelType: r.fuelType,
    notes: r.notes,
    productCount: Number(r.productCount ?? 0),
  }));

  return (
    <div>
      <PageHeader
        title="Vehicles"
        subtitle="Link products to the vehicles they fit — powers the compatibility checklist on products."
      />

      {(sp.message || sp.error) && (
        <div className="mb-4">
          <FormMessage
            message={sp.message ?? sp.error}
            tone={sp.error ? "error" : "success"}
          />
        </div>
      )}

      {/* Search */}
      <Card className="mb-4 p-4">
        <form method="get" action="/vehicles">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
            <div className="flex-1">
              <Field label="Search make or model">
                <Input
                  name="q"
                  defaultValue={q}
                  placeholder="e.g. Toyota, Corolla…"
                />
              </Field>
            </div>
            <div className="flex gap-2">
              <Button type="submit" size="sm">
                Search
              </Button>
              {q && (
                <LinkButton href="/vehicles" variant="secondary" size="sm">
                  Clear
                </LinkButton>
              )}
            </div>
          </div>
        </form>
      </Card>

      {data.length === 0 ? (
        <EmptyState
          title={q ? "No vehicles match" : "No vehicles yet"}
          message={
            q
              ? "Try a different search or clear it."
              : "Add the vehicles your customers drive so products can be matched to them."
          }
        />
      ) : (
        <Card>
          <CardHeader
            title={`${data.length} vehicle${data.length === 1 ? "" : "s"}`}
            subtitle="Product count = products marked compatible with this vehicle"
          />
          <VehicleManager vehicles={data} canEdit={isOwner} />
        </Card>
      )}
    </div>
  );
}
