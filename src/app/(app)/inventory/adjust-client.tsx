"use client";

/**
 * Per-row "Adjust" button for the inventory table (OWNER only).
 * Opens a modal with new quantity + reason + note, submits adjustStockAction.
 */
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Modal } from "@/components/ui-client";
import { Button, Field, Input, Select } from "@/components/ui";
import { adjustStockAction } from "./actions";
import type { ActionResult } from "@/lib/actions";

export function AdjustStockButton({
  productId,
  name,
  currentStock,
}: {
  productId: string;
  name: string;
  currentStock: number;
}) {
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const router = useRouter();

  return (
    <>
      <Button
        size="sm"
        variant="secondary"
        onClick={() => {
          setError(null);
          setOpen(true);
        }}
      >
        Adjust
      </Button>
      <Modal open={open} onClose={() => setOpen(false)} title="Adjust stock">
        <p className="mb-4 text-sm text-slate-600">
          <span className="font-semibold text-slate-900">{name}</span>
          <br />
          Current stock:{" "}
          <b className="tabular-nums text-slate-900">{currentStock}</b> units
        </p>
        <form
          className="space-y-4"
          action={async (fd) => {
            setPending(true);
            setError(null);
            const r: ActionResult = await adjustStockAction(fd);
            setPending(false);
            if (r.ok) {
              setOpen(false);
              router.refresh();
            } else {
              setError(r.message);
            }
          }}
        >
          <input type="hidden" name="productId" value={productId} />
          <Field label="New quantity">
            <Input
              name="newQty"
              type="number"
              min={0}
              step={1}
              defaultValue={currentStock}
              required
            />
          </Field>
          <Field label="Reason">
            <Select name="reason" defaultValue="ADJUSTMENT" required>
              <option value="ADJUSTMENT">Adjustment</option>
              <option value="DAMAGE">Damage</option>
              <option value="LOST">Lost</option>
            </Select>
          </Field>
          <Field
            label="Note (optional)"
            hint="Written into the stock ledger for this change."
          >
            <Input
              name="note"
              placeholder="e.g. found 2 extra units during recount"
              maxLength={500}
            />
          </Field>
          {error && (
            <p className="text-sm font-medium text-red-600">{error}</p>
          )}
          <div className="flex justify-end gap-2">
            <Button
              type="button"
              variant="secondary"
              onClick={() => setOpen(false)}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={pending}>
              {pending ? "Saving…" : "Save adjustment"}
            </Button>
          </div>
        </form>
      </Modal>
    </>
  );
}
