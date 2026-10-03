"use client";

import { useActionState } from "react";
import { Alert, Button, Field, Input, Textarea } from "@/components/ui";
import { updateSettings } from "./actions";
import type { ActionResult } from "@/lib/actions";

export type SettingsFormValues = {
  shopName: string;
  phone: string;
  address: string;
  city: string;
  invoicePrefix: string;
  taxRateBps: number;
  defaultMinStock: number;
  defaultReorderQty: number;
  businessHours: string;
};

const initialState: ActionResult = { ok: false, message: "" };

export function SettingsForm({ initial }: { initial: SettingsFormValues }) {
  const [state, formAction, pending] = useActionState(
    updateSettings,
    initialState
  );

  return (
    <form action={formAction} className="space-y-4">
      {state.message && (
        <Alert tone={state.ok ? "success" : "danger"}>{state.message}</Alert>
      )}

      <Field label="Shop name *">
        <Input
          name="shopName"
          required
          maxLength={100}
          defaultValue={initial.shopName}
        />
      </Field>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Phone">
          <Input
            name="phone"
            defaultValue={initial.phone}
            placeholder="e.g. 0300 1234567"
            autoComplete="tel"
          />
        </Field>
        <Field label="City *">
          <Input name="city" required maxLength={100} defaultValue={initial.city} />
        </Field>
      </div>

      <Field label="Address">
        <Textarea
          name="address"
          defaultValue={initial.address}
          placeholder="Shop address"
          rows={2}
        />
      </Field>

      <Field
        label="Business hours"
        hint="Shown on invoices and receipts, e.g. Mon–Sat 9am–9pm"
      >
        <Input
          name="businessHours"
          defaultValue={initial.businessHours}
          placeholder="e.g. Mon–Sat 9:00 AM – 9:00 PM"
        />
      </Field>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field
          label="Invoice prefix *"
          hint="Used at the start of future sale invoice numbers only."
        >
          <Input
            name="invoicePrefix"
            required
            maxLength={10}
            defaultValue={initial.invoicePrefix}
          />
        </Field>
        <Field
          label="Tax rate (basis points) *"
          hint="e.g. 1600 = 16%. Applied to sales."
        >
          <Input
            name="taxRateBps"
            type="number"
            min={0}
            max={10000}
            step={1}
            required
            defaultValue={initial.taxRateBps}
          />
        </Field>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field
          label="Default min stock *"
          hint="Used as the low-stock threshold for new products."
        >
          <Input
            name="defaultMinStock"
            type="number"
            min={0}
            step={1}
            required
            defaultValue={initial.defaultMinStock}
          />
        </Field>
        <Field
          label="Default reorder quantity *"
          hint="Suggested restock quantity for new products."
        >
          <Input
            name="defaultReorderQty"
            type="number"
            min={0}
            step={1}
            required
            defaultValue={initial.defaultReorderQty}
          />
        </Field>
      </div>

      <div className="pt-1">
        <Button type="submit" disabled={pending}>
          {pending ? "Saving…" : "Save settings"}
        </Button>
      </div>
    </form>
  );
}
