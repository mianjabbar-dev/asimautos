/** /customers/new — add a customer. */
import { requireSession } from "@/lib/auth";
import { PageHeader } from "@/components/ui";
import { CustomerForm } from "../customer-form-client";

export default async function NewCustomerPage() {
  await requireSession();
  return (
    <div>
      <PageHeader title="New Customer" subtitle="Add a customer record" />
      <CustomerForm />
    </div>
  );
}
