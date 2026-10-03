import { notFound } from "next/navigation";
import { eq, and } from "drizzle-orm";
import { db } from "@/db";
import { suppliers } from "@/db/schema";
import { requireSession } from "@/lib/auth";
import { updateSupplier } from "../../actions";
import { SupplierForm } from "../../supplier-form-client";
import { PageHeader, Alert } from "@/components/ui";

export const dynamic = "force-dynamic";

export default async function EditSupplierPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ error?: string }>;
}) {
  const { id } = await params;
  const session = await requireSession();
  const { error } = await searchParams;

  if (session.role !== "OWNER") {
    return (
      <div>
        <PageHeader title="Edit Supplier" />
        <Alert tone="warning">
          Only the shop owner can edit suppliers. Your STAFF account can view
          suppliers but not change them.
        </Alert>
      </div>
    );
  }

  const [supplier] = await db
    .select()
    .from(suppliers)
    .where(and(eq(suppliers.id, id), eq(suppliers.shopId, session.shopId)))
    .limit(1);

  if (!supplier) notFound();

  return (
    <div>
      <PageHeader
        title={`Edit — ${supplier.name}`}
        subtitle="Update this supplier's contact and payment details."
      />
      <SupplierForm
        action={updateSupplier.bind(null, id)}
        initial={supplier}
        error={error}
        submitLabel="Save Changes"
        title="Supplier details"
      />
    </div>
  );
}
