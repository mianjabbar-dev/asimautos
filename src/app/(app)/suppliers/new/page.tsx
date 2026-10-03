import { requireSession } from "@/lib/auth";
import { createSupplier } from "../actions";
import { SupplierForm } from "../supplier-form-client";
import { PageHeader, Alert } from "@/components/ui";

export const dynamic = "force-dynamic";

export default async function NewSupplierPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const session = await requireSession();
  const { error } = await searchParams;

  if (session.role !== "OWNER") {
    return (
      <div>
        <PageHeader title="New Supplier" />
        <Alert tone="warning">
          Only the shop owner can add suppliers. Your STAFF account can view
          suppliers but not create them.
        </Alert>
      </div>
    );
  }

  return (
    <div>
      <PageHeader
        title="New Supplier"
        subtitle="Add a parts supplier or wholesaler you buy stock from."
      />
      <SupplierForm
        action={createSupplier}
        error={error}
        submitLabel="Save Supplier"
        title="Supplier details"
        subtitle="Only the name is required — fill in the rest when you have it."
      />
    </div>
  );
}
