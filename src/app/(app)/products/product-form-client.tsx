"use client";

import { useActionState } from "react";
import {
  Button,
  Field,
  Input,
  Select,
  Textarea,
  FormMessage,
} from "@/components/ui";
import { fromPaisa } from "@/lib/money";
import type { ActionResult } from "@/lib/actions";

export type CatalogOption = { id: string; name: string };
export type VehicleOption = {
  id: string;
  make: string;
  model: string;
  variant: string | null;
  yearFrom: number | null;
  yearTo: number | null;
};

export type ProductDefaults = {
  name: string;
  sku: string;
  partNumber: string;
  oemNumber: string;
  barcode: string;
  categoryId: string;
  brandId: string;
  supplierId: string;
  purchasePrice: number; // paisa
  salePrice: number; // paisa
  currentStock: number;
  minStock: number;
  maxStock: number | null;
  reorderQty: number;
  rack: string;
  shelf: string;
  bin: string;
  imageUrl: string;
  description: string;
  active: boolean;
  vehicleIds: string[];
};

function vehicleLabel(v: VehicleOption): string {
  const years =
    v.yearFrom && v.yearTo
      ? ` (${v.yearFrom}–${v.yearTo})`
      : v.yearFrom
        ? ` (${v.yearFrom})`
        : v.yearTo
          ? ` (${v.yearTo})`
          : "";
  return `${v.model}${v.variant ? ` ${v.variant}` : ""}${years}`;
}

export function ProductForm({
  mode,
  action,
  defaults,
  categories,
  brands,
  suppliers,
  vehicles,
}: {
  mode: "new" | "edit";
  action: (
    prev: ActionResult | undefined,
    formData: FormData
  ) => Promise<ActionResult>;
  defaults: ProductDefaults;
  categories: CatalogOption[];
  brands: CatalogOption[];
  suppliers: CatalogOption[];
  vehicles: VehicleOption[];
}) {
  const [state, formAction, pending] = useActionState<
    ActionResult | undefined,
    FormData
  >(action, undefined);

  // Group vehicles by make for the compatibility checklist.
  const grouped = new Map<string, VehicleOption[]>();
  for (const v of vehicles) {
    const list = grouped.get(v.make) ?? [];
    list.push(v);
    grouped.set(v.make, list);
  }
  const makes = [...grouped.keys()].sort((a, b) => a.localeCompare(b));

  const selectedCount = defaults.vehicleIds.length;

  return (
    <form action={formAction} className="space-y-6">
      {state && !state.ok && <FormMessage message={state.message} tone="error" />}

      {/* -------- Basic info -------- */}
      <div className="rounded-xl border border-slate-200 bg-white p-4 sm:p-5">
        <h2 className="mb-4 text-base font-semibold text-slate-900">
          Basic information
        </h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Product name *">
            <Input name="name" required defaultValue={defaults.name} placeholder="e.g. Brake Pad Front" />
          </Field>
          <Field label="SKU">
            <Input name="sku" defaultValue={defaults.sku} placeholder="e.g. BP-101" />
          </Field>
          <Field label="Part number">
            <Input name="partNumber" defaultValue={defaults.partNumber} />
          </Field>
          <Field label="OEM number">
            <Input name="oemNumber" defaultValue={defaults.oemNumber} />
          </Field>
          <Field label="Barcode">
            <Input name="barcode" defaultValue={defaults.barcode} />
          </Field>
          <Field label="Category">
            <Select name="categoryId" defaultValue={defaults.categoryId}>
              <option value="">— None —</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Brand">
            <Select name="brandId" defaultValue={defaults.brandId}>
              <option value="">— None —</option>
              {brands.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Preferred supplier">
            <Select name="supplierId" defaultValue={defaults.supplierId}>
              <option value="">— None —</option>
              {suppliers.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </Select>
          </Field>
        </div>
        <div className="mt-4">
          <Field label="Description">
            <Textarea name="description" defaultValue={defaults.description} rows={3} />
          </Field>
        </div>
        <div className="mt-4">
          <Field label="Image URL" hint="Direct link to a product photo (optional).">
            <Input name="imageUrl" type="url" defaultValue={defaults.imageUrl} placeholder="https://" />
          </Field>
        </div>
      </div>

      {/* -------- Pricing -------- */}
      <div className="rounded-xl border border-slate-200 bg-white p-4 sm:p-5">
        <h2 className="mb-4 text-base font-semibold text-slate-900">Pricing</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Purchase price (PKR) *" hint="Your cost per unit.">
            <Input
              name="purchasePrice"
              required
              inputMode="decimal"
              defaultValue={defaults.purchasePrice ? String(fromPaisa(defaults.purchasePrice)) : ""}
              placeholder="0.00"
            />
          </Field>
          <Field label="Sale price (PKR) *" hint="Customer price per unit.">
            <Input
              name="salePrice"
              required
              inputMode="decimal"
              defaultValue={defaults.salePrice ? String(fromPaisa(defaults.salePrice)) : ""}
              placeholder="0.00"
            />
          </Field>
        </div>
      </div>

      {/* -------- Stock -------- */}
      <div className="rounded-xl border border-slate-200 bg-white p-4 sm:p-5">
        <h2 className="mb-4 text-base font-semibold text-slate-900">Stock</h2>
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          {mode === "new" && (
            <Field label="Initial stock" hint="Opening quantity.">
              <Input name="currentStock" type="number" min={0} step={1} defaultValue={String(defaults.currentStock)} />
            </Field>
          )}
          <Field label="Min stock" hint="Low-stock alert at/below this.">
            <Input name="minStock" type="number" min={0} step={1} defaultValue={String(defaults.minStock)} />
          </Field>
          <Field label="Max stock">
            <Input name="maxStock" type="number" min={0} step={1} defaultValue={defaults.maxStock == null ? "" : String(defaults.maxStock)} />
          </Field>
          <Field label="Reorder qty" hint="Suggested purchase quantity.">
            <Input name="reorderQty" type="number" min={0} step={1} defaultValue={String(defaults.reorderQty)} />
          </Field>
        </div>
        {mode === "edit" && (
          <p className="mt-3 text-xs text-slate-500">
            Current stock is <b>{defaults.currentStock}</b> — stock only changes
            through purchases, sales and adjustments, so it is not editable here.
          </p>
        )}
      </div>

      {/* -------- Location -------- */}
      <div className="rounded-xl border border-slate-200 bg-white p-4 sm:p-5">
        <h2 className="mb-4 text-base font-semibold text-slate-900">
          Shelf location
        </h2>
        <div className="grid grid-cols-3 gap-4">
          <Field label="Rack">
            <Input name="rack" defaultValue={defaults.rack} placeholder="B" />
          </Field>
          <Field label="Shelf">
            <Input name="shelf" defaultValue={defaults.shelf} placeholder="04" />
          </Field>
          <Field label="Bin">
            <Input name="bin" defaultValue={defaults.bin} placeholder="12" />
          </Field>
        </div>
      </div>

      {/* -------- Vehicle compatibility -------- */}
      <div className="rounded-xl border border-slate-200 bg-white p-4 sm:p-5">
        <h2 className="mb-1 text-base font-semibold text-slate-900">
          Vehicle compatibility
        </h2>
        <p className="mb-4 text-sm text-slate-500">
          {vehicles.length === 0
            ? "No vehicles in your catalog yet — add them under Vehicles first."
            : `Tick every vehicle this part fits (${selectedCount} selected).`}
        </p>
        <div className="space-y-5">
          {makes.map((make) => (
            <fieldset key={make}>
              <legend className="mb-2 text-sm font-semibold text-slate-700">
                {make}
              </legend>
              <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                {grouped.get(make)!.map((v) => (
                  <label
                    key={v.id}
                    className="flex cursor-pointer items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-700 hover:border-blue-400 hover:bg-blue-50/50 has-checked:border-blue-600 has-checked:bg-blue-50"
                  >
                    <input
                      type="checkbox"
                      name="vehicleIds"
                      value={v.id}
                      defaultChecked={defaults.vehicleIds.includes(v.id)}
                      className="h-4 w-4 accent-blue-700"
                    />
                    {vehicleLabel(v)}
                  </label>
                ))}
              </div>
            </fieldset>
          ))}
        </div>
      </div>

      {/* -------- Status -------- */}
      <div className="rounded-xl border border-slate-200 bg-white p-4 sm:p-5">
        <label className="flex cursor-pointer items-center gap-3">
          <input
            type="checkbox"
            name="active"
            defaultChecked={defaults.active}
            className="h-5 w-5 accent-blue-700"
          />
          <span className="text-sm font-medium text-slate-800">
            Active <span className="font-normal text-slate-500">(inactive products are hidden from new sales)</span>
          </span>
        </label>
      </div>

      <div className="flex gap-3">
        <Button type="submit" disabled={pending}>
          {pending ? "Saving…" : mode === "new" ? "Create product" : "Save changes"}
        </Button>
      </div>
    </form>
  );
}
