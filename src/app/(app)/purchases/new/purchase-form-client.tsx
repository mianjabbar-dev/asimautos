"use client";

import { useRef, useState } from "react";
import { searchProductsAction } from "../actions";
import {
  Input,
  Select,
  Field,
  Textarea,
  Button,
  Card,
  CardHeader,
  FormMessage,
} from "@/components/ui";

type ProductOption = { id: string; name: string; purchasePrice: number };

export type PrefillLine = {
  productId: string;
  productName: string;
  purchasePrice: number; // paisa
  qty: number;
} | null;

type Row = {
  key: number;
  productId: string;
  productName: string;
  search: string;
  results: ProductOption[];
  open: boolean;
  qty: string;
  price: string;
  discount: string;
};

let rowCounter = 0;

function num(v: string): number {
  const n = parseFloat(v.replace(/,/g, "").trim());
  return Number.isFinite(n) ? n : 0;
}

function paisaToPkr(paisa: number): string {
  return (paisa / 100).toFixed(2).replace(/\.00$/, "");
}

function makeRow(prefill?: PrefillLine): Row {
  rowCounter += 1;
  return {
    key: rowCounter,
    productId: prefill?.productId ?? "",
    productName: prefill?.productName ?? "",
    search: prefill?.productName ?? "",
    results: [],
    open: false,
    qty: prefill ? String(prefill.qty) : "1",
    price: prefill ? paisaToPkr(prefill.purchasePrice) : "",
    discount: "0",
  };
}

function lineTotal(r: Row): number {
  return Math.max(0, num(r.qty) * num(r.price) - num(r.discount));
}

export function PurchaseForm({
  suppliers,
  createAction,
  prefill,
  error,
  today,
}: {
  suppliers: Array<{ id: string; name: string }>;
  createAction: (formData: FormData) => Promise<void>;
  prefill: PrefillLine;
  error?: string;
  today: string;
}) {
  const [rows, setRows] = useState<Row[]>(() => [makeRow(prefill ?? undefined)]);
  const [paid, setPaid] = useState("0");
  const [clientError, setClientError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const grandTotal = rows.reduce((s, r) => s + lineTotal(r), 0);
  const paidNum = num(paid);
  const remaining = Math.max(0, grandTotal - paidNum);

  function updateRow(key: number, patch: Partial<Row>) {
    setRows((rs) => rs.map((r) => (r.key === key ? { ...r, ...patch } : r)));
  }

  function onSearchChange(key: number, value: string) {
    updateRow(key, { search: value, productId: "", open: true });
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(async () => {
      if (!value.trim()) {
        updateRow(key, { results: [], open: false });
        return;
      }
      const results = await searchProductsAction(value);
      setRows((rs) => rs.map((r) => (r.key === key ? { ...r, results, open: true } : r)));
    }, 300);
  }

  function selectProduct(key: number, opt: ProductOption) {
    if (timer.current) clearTimeout(timer.current);
    updateRow(key, {
      productId: opt.id,
      productName: opt.name,
      search: opt.name,
      results: [],
      open: false,
      price: paisaToPkr(opt.purchasePrice),
    });
  }

  function addRow() {
    setRows((rs) => [...rs, makeRow()]);
  }

  function removeRow(key: number) {
    setRows((rs) => (rs.length > 1 ? rs.filter((r) => r.key !== key) : rs));
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setClientError(null);
    const valid = rows.filter((r) => r.productId && num(r.qty) > 0);
    if (valid.length === 0) {
      setClientError("Add at least one product with a quantity greater than zero.");
      return;
    }
    if (paidNum > grandTotal) {
      setClientError("Paid amount cannot be more than the invoice total.");
      return;
    }
    setSubmitting(true);
    try {
      const fd = new FormData(e.currentTarget);
      fd.set(
        "items",
        JSON.stringify(
          valid.map((r) => ({
            productId: r.productId,
            quantity: Math.floor(num(r.qty)),
            purchasePrice: r.price || "0",
            discount: r.discount || "0",
          }))
        )
      );
      await createAction(fd);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit}>
      {(error || clientError) && (
        <div className="mb-4">
          <FormMessage message={clientError ?? error} tone="error" />
        </div>
      )}

      <Card className="mb-4">
        <CardHeader title="Invoice details" />
        <div className="grid gap-4 p-4 sm:grid-cols-3 sm:p-5">
          <Field label="Supplier *">
            <Select name="supplierId" required defaultValue="">
              <option value="" disabled>
                Select supplier…
              </option>
              {suppliers.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Invoice number *">
            <Input
              name="invoiceNumber"
              required
              maxLength={100}
              placeholder="e.g. SUP-2026-001"
            />
          </Field>
          <Field label="Purchase date">
            <Input name="purchaseDate" type="date" defaultValue={today} />
          </Field>
        </div>
      </Card>

      <Card className="mb-4">
        <CardHeader
          title="Line items"
          subtitle="Search a product, set quantity and purchase price — stock is added when you save."
          action={
            <Button type="button" variant="secondary" size="sm" onClick={addRow}>
              + Add row
            </Button>
          }
        />
        <div className="space-y-3 p-4 sm:p-5">
          {rows.map((r, i) => (
            <div
              key={r.key}
              className="rounded-lg border border-slate-200 bg-slate-50/60 p-3"
            >
              <div className="mb-2 flex items-center justify-between">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Item {i + 1}
                </p>
                {rows.length > 1 && (
                  <button
                    type="button"
                    onClick={() => removeRow(r.key)}
                    className="text-xs font-medium text-red-600 hover:underline"
                  >
                    Remove
                  </button>
                )}
              </div>
              <div className="grid gap-3 sm:grid-cols-12">
                <div className="relative sm:col-span-5">
                  <Field label="Product *">
                    <Input
                      value={r.search}
                      onChange={(e) => onSearchChange(r.key, e.target.value)}
                      onBlur={() =>
                        setTimeout(
                          () => updateRow(r.key, { open: false }),
                          150
                        )
                      }
                      onFocus={() =>
                        r.results.length > 0 && updateRow(r.key, { open: true })
                      }
                      placeholder="Type to search products…"
                      autoComplete="off"
                    />
                  </Field>
                  {r.open && r.results.length > 0 && (
                    <ul className="absolute z-20 mt-1 max-h-56 w-full overflow-y-auto rounded-lg border border-slate-200 bg-white shadow-lg">
                      {r.results.map((opt) => (
                        <li key={opt.id}>
                          <button
                            type="button"
                            onMouseDown={() => selectProduct(r.key, opt)}
                            className="block w-full px-3 py-2 text-left text-sm hover:bg-blue-50"
                          >
                            <span className="font-medium text-slate-900">
                              {opt.name}
                            </span>
                            <span className="ml-2 text-xs text-slate-500">
                              PKR {paisaToPkr(opt.purchasePrice)}
                            </span>
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}
                  {r.open && r.search.trim() && r.results.length === 0 && (
                    <p className="mt-1 text-xs text-slate-500">
                      Searching… no matches yet.
                    </p>
                  )}
                </div>
                <div className="sm:col-span-2">
                  <Field label="Qty *">
                    <Input
                      value={r.qty}
                      onChange={(e) => updateRow(r.key, { qty: e.target.value })}
                      inputMode="numeric"
                      placeholder="1"
                    />
                  </Field>
                </div>
                <div className="sm:col-span-2">
                  <Field label="Price (PKR) *">
                    <Input
                      value={r.price}
                      onChange={(e) => updateRow(r.key, { price: e.target.value })}
                      inputMode="decimal"
                      placeholder="0"
                    />
                  </Field>
                </div>
                <div className="sm:col-span-2">
                  <Field label="Disc. (PKR)">
                    <Input
                      value={r.discount}
                      onChange={(e) =>
                        updateRow(r.key, { discount: e.target.value })
                      }
                      inputMode="decimal"
                      placeholder="0"
                    />
                  </Field>
                </div>
                <div className="flex items-end sm:col-span-1">
                  <p className="pb-2.5 text-sm font-semibold tabular-nums text-slate-900">
                    {lineTotal(r).toLocaleString("en-PK", {
                      minimumFractionDigits: 2,
                      maximumFractionDigits: 2,
                    })}
                  </p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </Card>

      <Card>
        <CardHeader title="Payment" />
        <div className="grid gap-4 p-4 sm:grid-cols-3 sm:p-5">
          <Field label="Paid now (PKR)">
            <Input
              name="paidAmount"
              value={paid}
              onChange={(e) => setPaid(e.target.value)}
              inputMode="decimal"
              placeholder="0"
            />
          </Field>
          <div className="sm:col-span-2">
            <Field label="Notes">
              <Textarea name="notes" placeholder="Optional note for this purchase" />
            </Field>
          </div>
        </div>
        <div className="flex flex-col gap-2 border-t border-slate-100 px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-5">
          <dl className="flex gap-6 text-sm">
            <div>
              <dt className="text-slate-500">Invoice total</dt>
              <dd className="text-lg font-bold tabular-nums text-slate-900">
                PKR{" "}
                {grandTotal.toLocaleString("en-PK", {
                  minimumFractionDigits: 2,
                  maximumFractionDigits: 2,
                })}
              </dd>
            </div>
            <div>
              <dt className="text-slate-500">Remaining</dt>
              <dd
                className={`text-lg font-bold tabular-nums ${
                  remaining > 0 ? "text-red-700" : "text-emerald-700"
                }`}
              >
                PKR{" "}
                {remaining.toLocaleString("en-PK", {
                  minimumFractionDigits: 2,
                  maximumFractionDigits: 2,
                })}
              </dd>
            </div>
          </dl>
          <Button type="submit" size="lg" disabled={submitting}>
            {submitting ? "Saving…" : "Save Purchase"}
          </Button>
        </div>
      </Card>
    </form>
  );
}
