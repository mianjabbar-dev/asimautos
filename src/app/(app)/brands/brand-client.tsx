"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import {
  Button,
  Field,
  Input,
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
  createBrandAction,
  updateBrandAction,
  deleteBrandAction,
} from "./actions";

export type BrandRowData = {
  id: string;
  name: string;
  description: string | null;
  productCount: number;
};

/* ------------------------------------------------------------------ */
/* Inline create card                                                  */
/* ------------------------------------------------------------------ */

export function BrandCreateForm() {
  const [state, formAction, pending] = useActionState<
    ActionResult | undefined,
    FormData
  >(createBrandAction, undefined);
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (state?.ok) formRef.current?.reset();
  }, [state]);

  return (
    <form ref={formRef} action={formAction} className="space-y-3">
      {state && (
        <FormMessage
          message={state.message}
          tone={state.ok ? "success" : "error"}
        />
      )}
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Brand name *">
          <Input name="name" required maxLength={100} placeholder="e.g. Genuine Honda" />
        </Field>
        <Field label="Description">
          <Input name="description" maxLength={500} placeholder="Optional" />
        </Field>
      </div>
      <Button type="submit" size="sm" disabled={pending}>
        {pending ? "Adding…" : "+ Add Brand"}
      </Button>
    </form>
  );
}

/* ------------------------------------------------------------------ */
/* Table (rows + one shared edit modal, rendered outside the table)    */
/* ------------------------------------------------------------------ */

export function BrandTable({
  brands,
  canEdit,
}: {
  brands: BrandRowData[];
  canEdit: boolean;
}) {
  const [editing, setEditing] = useState<BrandRowData | null>(null);
  const [sessionKey, setSessionKey] = useState(0);
  const openEdit = (brand: BrandRowData) => {
    setSessionKey((k) => k + 1);
    setEditing(brand);
  };

  return (
    <>
      <Table>
        <thead>
          <tr>
            <Th>Name</Th>
            <Th>Products</Th>
            <Th>Description</Th>
            {canEdit && <Th>Actions</Th>}
          </tr>
        </thead>
        <tbody>
          {brands.map((brand) => (
            <tr key={brand.id} className="hover:bg-slate-50">
              <Td className="font-medium text-slate-900">{brand.name}</Td>
              <Td>
                <Badge tone={brand.productCount > 0 ? "info" : "default"}>
                  {brand.productCount} product
                  {brand.productCount === 1 ? "" : "s"}
                </Badge>
              </Td>
              <Td className="max-w-60 truncate text-slate-500">
                {brand.description ?? "—"}
              </Td>
              {canEdit && (
                <Td className="whitespace-nowrap">
                  <div className="flex items-center gap-2">
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() => openEdit(brand)}
                    >
                      Edit
                    </Button>
                    <form action={deleteBrandAction}>
                      <input type="hidden" name="id" value={brand.id} />
                      <ConfirmSubmit
                        message={
                          brand.productCount > 0
                            ? `Delete "${brand.name}"? It is used by ${brand.productCount} product${brand.productCount === 1 ? "" : "s"} — delete is blocked while in use.`
                            : `Delete "${brand.name}"? This cannot be undone.`
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
          open={editing !== null}
          onClose={() => setEditing(null)}
          title="Edit brand"
        >
          {editing && (
            <BrandEditForm
              key={`${editing.id}-${sessionKey}`}
              brand={editing}
              onDone={() => setEditing(null)}
            />
          )}
        </Modal>
      )}
    </>
  );
}

function BrandEditForm({
  brand,
  onDone,
}: {
  brand: BrandRowData;
  onDone: () => void;
}) {
  const [state, formAction, pending] = useActionState<
    ActionResult | undefined,
    FormData
  >(updateBrandAction, undefined);

  useEffect(() => {
    if (state?.ok) onDone();
  }, [state, onDone]);

  return (
    <form action={formAction} className="space-y-4">
      {state && !state.ok && (
        <FormMessage message={state.message} tone="error" />
      )}
      <input type="hidden" name="id" value={brand.id} />
      <Field label="Brand name *">
        <Input name="name" required maxLength={100} defaultValue={brand.name} />
      </Field>
      <Field label="Description">
        <Textarea
          name="description"
          defaultValue={brand.description ?? ""}
          rows={3}
        />
      </Field>
      <div className="flex justify-end gap-2">
        <Button type="button" variant="secondary" onClick={onDone}>
          Cancel
        </Button>
        <Button type="submit" disabled={pending}>
          {pending ? "Saving…" : "Save changes"}
        </Button>
      </div>
    </form>
  );
}
