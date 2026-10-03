"use client";

/**
 * Shared customer form (new + edit) using useActionState.
 */
import { useActionState } from "react";
import Link from "next/link";
import {
  Button,
  Input,
  Textarea,
  Field,
  Alert,
  Card,
} from "@/components/ui";
import {
  createCustomerAction,
  updateCustomerAction,
} from "./actions";
import type { ActionResult } from "@/lib/actions";
import type { Customer } from "@/db/schema";

export function CustomerForm({
  customer,
}: {
  customer?: Pick<Customer, "id" | "name" | "phone" | "address" | "vehicle" | "notes">;
}) {
  const action = customer ? updateCustomerAction : createCustomerAction;
  const [state, formAction, pending] = useActionState<ActionResult | null, FormData>(
    action,
    null
  );

  return (
    <Card className="max-w-2xl p-4 sm:p-6">
      <form action={formAction} className="space-y-4">
        {customer && <input type="hidden" name="id" value={customer.id} />}
        {state && !state.ok && <Alert tone="danger">{state.message}</Alert>}

        <Field label="Name *">
          <Input
            name="name"
            required
            maxLength={200}
            defaultValue={customer?.name ?? ""}
            placeholder="Customer name"
          />
        </Field>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Phone">
            <Input
              name="phone"
              type="tel"
              defaultValue={customer?.phone ?? ""}
              placeholder="03xx xxxxxxx"
            />
          </Field>
          <Field label="Vehicle">
            <Input
              name="vehicle"
              defaultValue={customer?.vehicle ?? ""}
              placeholder="e.g. Honda City 2019"
            />
          </Field>
        </div>

        <Field label="Address">
          <Input
            name="address"
            defaultValue={customer?.address ?? ""}
            placeholder="Address"
          />
        </Field>

        <Field label="Notes">
          <Textarea
            name="notes"
            defaultValue={customer?.notes ?? ""}
            placeholder="Any notes about this customer…"
          />
        </Field>

        <div className="flex gap-2">
          <Button type="submit" disabled={pending}>
            {pending
              ? "Saving…"
              : customer
                ? "Save Changes"
                : "Add Customer"}
          </Button>
          <Link
            href={customer ? `/customers/${customer.id}` : "/customers"}
            className="inline-flex h-10 items-center justify-center gap-2 rounded-lg border border-slate-300 bg-white px-4 text-sm font-medium text-slate-800 hover:bg-slate-50"
          >
            Cancel
          </Link>
        </div>
      </form>
    </Card>
  );
}
