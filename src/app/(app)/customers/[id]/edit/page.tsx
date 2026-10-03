/** /customers/[id]/edit — edit a customer. */
import { notFound } from "next/navigation";
import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { customers } from "@/db/schema";
import { requireSession } from "@/lib/auth";
import { PageHeader } from "@/components/ui";
import { CustomerForm } from "../../customer-form-client";

export default async function EditCustomerPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await requireSession();
  const { id } = await params;
  const [customer] = await db
    .select()
    .from(customers)
    .where(and(eq(customers.id, id), eq(customers.shopId, session.shopId)))
    .limit(1);
  if (!customer) notFound();

  return (
    <div>
      <PageHeader title={`Edit ${customer.name}`} subtitle="Update customer details" />
      <CustomerForm customer={customer} />
    </div>
  );
}
