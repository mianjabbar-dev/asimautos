"use client";

/**
 * Small pay form (useActionState) for recording a payment against a sale.
 * Reused on the invoice page and the customer profile.
 */
import { useActionState } from "react";
import { paySaleAction } from "./actions";
import { Button, Input, Field, Alert } from "@/components/ui";
import { formatPKR } from "@/lib/money";

export function PaySaleForm({
  saleId,
  remainingPaisa,
  compact = false,
}: {
  saleId: string;
  remainingPaisa: number;
  compact?: boolean;
}) {
  const [state, formAction, pending] = useActionState(paySaleAction, null);

  if (remainingPaisa <= 0) return null;

  return (
    <form
      action={formAction}
      className={compact ? "flex items-end gap-2" : "space-y-3"}
    >
      <input type="hidden" name="saleId" value={saleId} />
      <div className={compact ? "w-36" : ""}>
        <Field
          label={compact ? "Amount" : `Amount (PKR) — due ${formatPKR(remainingPaisa)}`}
        >
          <Input
            name="amount"
            type="number"
            min={0.01}
            step="0.01"
            required
            className={compact ? "h-8 text-sm" : undefined}
            defaultValue={(remainingPaisa / 100).toFixed(2)}
          />
        </Field>
      </div>
      <Button type="submit" size={compact ? "sm" : "md"} disabled={pending}>
        {pending ? "Saving…" : "Record Payment"}
      </Button>
      {!compact && state && (
        <Alert tone={state.ok ? "success" : "danger"}>
          {state.ok ? state.message : state.message}
        </Alert>
      )}
    </form>
  );
}
