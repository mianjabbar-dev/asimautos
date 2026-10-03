"use client";

import { useActionState, useEffect, useState } from "react";
import {
  Button,
  Field,
  Input,
  Select,
  Textarea,
  FormMessage,
  Badge,
  Table,
  Th,
  Td,
} from "@/components/ui";
import { Modal, ConfirmSubmit } from "@/components/ui-client";
import type { ActionResult } from "@/lib/actions";
import {
  createVehicleAction,
  updateVehicleAction,
  deleteVehicleAction,
} from "./actions";

export type VehicleRowData = {
  id: string;
  make: string;
  model: string;
  variant: string | null;
  yearFrom: number | null;
  yearTo: number | null;
  engine: string | null;
  fuelType: string | null;
  notes: string | null;
  productCount: number;
};

function yearsLabel(v: {
  yearFrom: number | null;
  yearTo: number | null;
}): string {
  if (v.yearFrom && v.yearTo) return `${v.yearFrom}–${v.yearTo}`;
  if (v.yearFrom) return `${v.yearFrom}–`;
  if (v.yearTo) return `–${v.yearTo}`;
  return "—";
}

/* ------------------------------------------------------------------ */
/* Create / edit form (used inside a modal)                            */
/* ------------------------------------------------------------------ */

export function VehicleForm({
  mode,
  initial,
  onDone,
}: {
  mode: "new" | "edit";
  initial?: VehicleRowData;
  onDone: () => void;
}) {
  const action = mode === "new" ? createVehicleAction : updateVehicleAction;
  const [state, formAction, pending] = useActionState<
    ActionResult | undefined,
    FormData
  >(action, undefined);

  useEffect(() => {
    if (state?.ok) onDone();
  }, [state, onDone]);

  return (
    <form action={formAction} className="space-y-4">
      {state && !state.ok && (
        <FormMessage message={state.message} tone="error" />
      )}
      {initial && <input type="hidden" name="id" value={initial.id} />}
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Make *">
          <Input
            name="make"
            required
            maxLength={100}
            defaultValue={initial?.make ?? ""}
            placeholder="e.g. Toyota"
          />
        </Field>
        <Field label="Model *">
          <Input
            name="model"
            required
            maxLength={100}
            defaultValue={initial?.model ?? ""}
            placeholder="e.g. Corolla"
          />
        </Field>
        <Field label="Variant">
          <Input
            name="variant"
            maxLength={500}
            defaultValue={initial?.variant ?? ""}
            placeholder="e.g. GLi 1.3"
          />
        </Field>
        <Field label="Engine">
          <Input
            name="engine"
            maxLength={500}
            defaultValue={initial?.engine ?? ""}
            placeholder="e.g. 1300cc"
          />
        </Field>
        <Field label="Year from">
          <Input
            name="yearFrom"
            type="number"
            min={1950}
            max={2100}
            defaultValue={initial?.yearFrom ?? ""}
            placeholder="2010"
          />
        </Field>
        <Field label="Year to">
          <Input
            name="yearTo"
            type="number"
            min={1950}
            max={2100}
            defaultValue={initial?.yearTo ?? ""}
            placeholder="2016"
          />
        </Field>
        <Field label="Fuel type">
          <Select name="fuelType" defaultValue={initial?.fuelType ?? ""}>
            <option value="">— None —</option>
            {["Petrol", "Diesel", "CNG", "Hybrid", "Electric"].map((f) => (
              <option key={f} value={f}>
                {f}
              </option>
            ))}
          </Select>
        </Field>
      </div>
      <Field label="Notes">
        <Textarea
          name="notes"
          defaultValue={initial?.notes ?? ""}
          rows={2}
          placeholder="Optional notes"
        />
      </Field>
      <div className="flex justify-end gap-2">
        <Button type="button" variant="secondary" onClick={onDone}>
          Cancel
        </Button>
        <Button type="submit" disabled={pending}>
          {pending
            ? "Saving…"
            : mode === "new"
              ? "Add vehicle"
              : "Save changes"}
        </Button>
      </div>
    </form>
  );
}

/* ------------------------------------------------------------------ */
/* Table with add button + per-row edit/delete                         */
/* ------------------------------------------------------------------ */

export function VehicleManager({
  vehicles,
  canEdit,
}: {
  vehicles: VehicleRowData[];
  canEdit: boolean;
}) {
  const [modal, setModal] = useState<
    | { mode: "new" }
    | { mode: "edit"; vehicle: VehicleRowData }
    | null
  >(null);
  const [sessionKey, setSessionKey] = useState(0);
  const open = (m: NonNullable<typeof modal>) => {
    setSessionKey((k) => k + 1);
    setModal(m);
  };

  return (
    <>
      {canEdit && (
        <div className="mb-4">
          <Button size="sm" onClick={() => open({ mode: "new" })}>
            + Add Vehicle
          </Button>
        </div>
      )}
      <Table>
        <thead>
          <tr>
            <Th>Make</Th>
            <Th>Model</Th>
            <Th>Variant</Th>
            <Th>Years</Th>
            <Th>Engine</Th>
            <Th>Fuel</Th>
            <Th className="text-right">Products</Th>
            {canEdit && <Th>Actions</Th>}
          </tr>
        </thead>
        <tbody>
          {vehicles.map((v) => (
            <tr key={v.id} className="hover:bg-slate-50">
              <Td className="font-medium text-slate-900">{v.make}</Td>
              <Td>{v.model}</Td>
              <Td className="text-slate-500">{v.variant ?? "—"}</Td>
              <Td className="whitespace-nowrap text-slate-500">
                {yearsLabel(v)}
              </Td>
              <Td className="text-slate-500">{v.engine ?? "—"}</Td>
              <Td className="text-slate-500">{v.fuelType ?? "—"}</Td>
              <Td className="text-right">
                <Badge tone={v.productCount > 0 ? "info" : "default"}>
                  {v.productCount}
                </Badge>
              </Td>
              {canEdit && (
                <Td className="whitespace-nowrap">
                  <div className="flex items-center gap-2">
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() => open({ mode: "edit", vehicle: v })}
                    >
                      Edit
                    </Button>
                    <form action={deleteVehicleAction}>
                      <input type="hidden" name="id" value={v.id} />
                      <ConfirmSubmit
                        message={
                          v.productCount > 0
                            ? `Delete ${v.make} ${v.model}? It is linked to ${v.productCount} product${v.productCount === 1 ? "" : "s"} — those links will be removed too.`
                            : `Delete ${v.make} ${v.model}? This cannot be undone.`
                        }
                      >
                        Delete
                      </ConfirmSubmit>
                    </form>
                  </div>
                </Td>
              )}
            </tr>
          ))}
        </tbody>
      </Table>
      {canEdit && (
        <Modal
          open={modal !== null}
          onClose={() => setModal(null)}
          title={modal?.mode === "edit" ? "Edit vehicle" : "Add vehicle"}
        >
          {modal && (
            <VehicleForm
              key={sessionKey}
              mode={modal.mode}
              initial={
                modal.mode === "edit" ? modal.vehicle : undefined
              }
              onDone={() => setModal(null)}
            />
          )}
        </Modal>
      )}
    </>
  );
}
