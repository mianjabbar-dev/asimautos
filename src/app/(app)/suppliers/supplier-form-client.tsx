"use client";

import { Input, Field, Textarea, Button, FormMessage, Card, CardHeader } from "@/components/ui";
import type { Supplier } from "@/db/schema";

type SupplierFormProps = {
  action: (formData: FormData) => Promise<void>;
  initial?: Partial<Supplier>;
  error?: string;
  submitLabel: string;
  title: string;
  subtitle?: string;
};

export function SupplierForm({ action, initial, error, submitLabel, title, subtitle }: SupplierFormProps) {
  return (
    <Card className="max-w-3xl">
      <CardHeader title={title} subtitle={subtitle} />
      <form action={action} className="space-y-4 p-4 sm:p-5">
        {error && <FormMessage message={error} tone="error" />}
        <Field label="Supplier name *">
          <Input name="name" required maxLength={200} defaultValue={initial?.name ?? ""} placeholder="e.g. Lahore Auto Parts" />
        </Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Contact person">
            <Input name="contactPerson" maxLength={500} defaultValue={initial?.contactPerson ?? ""} placeholder="e.g. Muhammad Asim" />
          </Field>
          <Field label="Phone">
            <Input name="phone" maxLength={500} defaultValue={initial?.phone ?? ""} placeholder="0300-0000000" inputMode="tel" />
          </Field>
          <Field label="WhatsApp">
            <Input name="whatsapp" maxLength={500} defaultValue={initial?.whatsapp ?? ""} placeholder="0300-0000000" inputMode="tel" />
          </Field>
          <Field label="Email">
            <Input name="email" type="email" maxLength={500} defaultValue={initial?.email ?? ""} placeholder="supplier@example.com" />
          </Field>
          <Field label="City">
            <Input name="city" maxLength={500} defaultValue={initial?.city ?? ""} placeholder="e.g. Faisalabad" />
          </Field>
          <Field label="Payment terms">
            <Input name="paymentTerms" maxLength={500} defaultValue={initial?.paymentTerms ?? ""} placeholder="e.g. 30 days credit" />
          </Field>
        </div>
        <Field label="Address">
          <Textarea name="address" defaultValue={initial?.address ?? ""} placeholder="Shop address" />
        </Field>
        <Field label="Notes">
          <Textarea name="notes" defaultValue={initial?.notes ?? ""} placeholder="Any extra notes about this supplier" />
        </Field>
        <div className="flex gap-2 pt-1">
          <Button type="submit">{submitLabel}</Button>
        </div>
      </form>
    </Card>
  );
}
