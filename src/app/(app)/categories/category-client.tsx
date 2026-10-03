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
  createCategoryAction,
  updateCategoryAction,
  deleteCategoryAction,
} from "./actions";

export type CategoryRowData = {
  id: string;
  name: string;
  description: string | null;
  productCount: number;
};

/* ------------------------------------------------------------------ */
/* Inline create card                                                  */
/* ------------------------------------------------------------------ */

export function CategoryCreateForm() {
  const [state, formAction, pending] = useActionState<
    ActionResult | undefined,
    FormData
  >(createCategoryAction, undefined);
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
        <Field label="Category name *">
          <Input name="name" required maxLength={100} placeholder="e.g. Brake System" />
        </Field>
        <Field label="Description">
          <Input name="description" maxLength={500} placeholder="Optional" />
        </Field>
      </div>
      <Button type="submit" size="sm" disabled={pending}>
        {pending ? "Adding…" : "+ Add Category"}
      </Button>
    </form>
  );
}

/* ------------------------------------------------------------------ */
/* Table (rows + one shared edit modal, rendered outside the table)    */
/* ------------------------------------------------------------------ */

export function CategoryTable({
  categories,
  canEdit,
}: {
  categories: CategoryRowData[];
  canEdit: boolean;
}) {
  const [editing, setEditing] = useState<CategoryRowData | null>(null);
  const [sessionKey, setSessionKey] = useState(0);
  const openEdit = (category: CategoryRowData) => {
    setSessionKey((k) => k + 1);
    setEditing(category);
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
          {categories.map((category) => (
            <tr key={category.id} className="hover:bg-slate-50">
              <Td className="font-medium text-slate-900">{category.name}</Td>
              <Td>
                <Badge tone={category.productCount > 0 ? "info" : "default"}>
                  {category.productCount} product
                  {category.productCount === 1 ? "" : "s"}
                </Badge>
              </Td>
              <Td className="max-w-60 truncate text-slate-500">
                {category.description ?? "—"}
              </Td>
              {canEdit && (
                <Td className="whitespace-nowrap">
                  <div className="flex items-center gap-2">
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() => openEdit(category)}
                    >
                      Edit
                    </Button>
                    <form action={deleteCategoryAction}>
                      <input type="hidden" name="id" value={category.id} />
                      <ConfirmSubmit
                        message={
                          category.productCount > 0
                            ? `Delete "${category.name}"? It is used by ${category.productCount} product${category.productCount === 1 ? "" : "s"} — delete is blocked while in use.`
                            : `Delete "${category.name}"? This cannot be undone.`
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
          title="Edit category"
        >
          {editing && (
            <CategoryEditForm
              key={`${editing.id}-${sessionKey}`}
              category={editing}
              onDone={() => setEditing(null)}
            />
          )}
        </Modal>
      )}
    </>
  );
}

function CategoryEditForm({
  category,
  onDone,
}: {
  category: CategoryRowData;
  onDone: () => void;
}) {
  const [state, formAction, pending] = useActionState<
    ActionResult | undefined,
    FormData
  >(updateCategoryAction, undefined);

  useEffect(() => {
    if (state?.ok) onDone();
  }, [state, onDone]);

  return (
    <form action={formAction} className="space-y-4">
      {state && !state.ok && (
        <FormMessage message={state.message} tone="error" />
      )}
      <input type="hidden" name="id" value={category.id} />
      <Field label="Category name *">
        <Input name="name" required maxLength={100} defaultValue={category.name} />
      </Field>
      <Field label="Description">
        <Textarea
          name="description"
          defaultValue={category.description ?? ""}
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
