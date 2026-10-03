"use client";

/**
 * New-return form. Renders the customer-return or supplier-return variant
 * based on `returnType`. Line items are dynamic rows (product + qty + unit
 * price in PKR) serialized as JSON into a hidden field for the server action.
 */
import { useActionState, useState } from "react";
import {
  Button,
  Input,
  Textarea,
  Select,
  Field,
  Alert,
  Card,
  CardHeader,
} from "@/components/ui";
import {
  createCustomerReturnAction,
  createSupplierReturnAction,
} from "../actions";
import type { ActionResult } from "@/lib/actions";
import { formatPKR } from "@/lib/money";

export type ReturnProduct = {
  id: string;
  name: string;
  sku: string | null;
  salePrice: number; // paisa
  purchasePrice: number; // paisa
  currentStock: number;
};

type Line = {
  key: number;
  productId: string;
  qty: string;
  unitPricePkr: string;
};

let lineKey = 1;

export function ReturnsForm({
  returnType,
  customers,
  suppliers,
  recentSales,
  recentPurchases,
  products,
}: {
  returnType: "customer" | "supplier";
  customers: Array<{ id: string; name: string }>;
  suppliers: Array<{ id: string; name: string }>;
  recentSales: Array<{ id: string; invoiceNumber: string }>;
  recentPurchases: Array<{ id: string; invoiceNumber: string }>;
  products: ReturnProduct[];
}) {
  const action =
    returnType === "customer"
      ? createCustomerReturnAction
      : createSupplierReturnAction;
  const [state, formAction, pending] = useActionState<ActionResult | null, FormData>(
    action,
    null
  );

  const [lines, setLines] = useState<Line[]>([
    { key: lineKey++, productId: "", qty: "1", unitPricePkr: "" },
  ]);

  const addLine = () =>
    setLines((prev) => [
      ...prev,
      { key: lineKey++, productId: "", qty: "1", unitPricePkr: "" },
    ]);

  const updateLine = (key: number, patch: Partial<Line>) =>
    setLines((prev) => prev.map((l) => (l.key === key ? { ...l, ...patch } : l)));

  const removeLine = (key: number) =>
    setLines((prev) => (prev.length > 1 ? prev.filter((l) => l.key !== key) : prev));

  /** When a product is picked, default the unit price to its sale/purchase price. */
  const onProductPick = (key: number, productId: string) => {
    const p = products.find((x) => x.id === productId);
    const paisa =
      returnType === "customer" ? p?.salePrice : p?.purchasePrice;
    updateLine(key, {
      productId,
      unitPricePkr: paisa !== undefined ? (paisa / 100).toFixed(2) : "",
    });
  };

  const lineTotalPaisa = (l: Line) => {
    const q = parseInt(l.qty, 10);
    const p = parseFloat(l.unitPricePkr);
    if (!Number.isFinite(q) || !Number.isFinite(p)) return 0;
    return q * Math.round(p * 100);
  };
  const totalPaisa = lines.reduce((s, l) => s + lineTotalPaisa(l), 0);

  const itemsJson = JSON.stringify(
    lines
      .filter((l) => l.productId && l.qty)
      .map((l) => ({
        productId: l.productId,
        quantity: parseInt(l.qty, 10) || 0,
        unitPrice: l.unitPricePkr || "0",
      }))
  );

  return (
    <form action={formAction} className="space-y-4">
      {state && !state.ok && <Alert tone="danger">{state.message}</Alert>}
      <input type="hidden" name="itemsJson" value={itemsJson} />

      <Card>
        <CardHeader
          title={returnType === "customer" ? "Customer Return" : "Supplier Return"}
          subtitle={
            returnType === "customer"
              ? "Goods come back into stock"
              : "Goods go back to the supplier — stock decreases"
          }
        />
        <div className="space-y-4 p-4 sm:p-5">
          {returnType === "customer" ? (
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Customer (optional)">
                <Select name="customerId" defaultValue="">
                  <option value="">— Select —</option>
                  {customers.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field label="Linked sale (optional)" hint="Reduces the sale's remaining balance">
                <Select name="saleId" defaultValue="">
                  <option value="">— None —</option>
                  {recentSales.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.invoiceNumber}
                    </option>
                  ))}
                </Select>
              </Field>
            </div>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Supplier *">
                <Select name="supplierId" defaultValue="" required>
                  <option value="">— Select supplier —</option>
                  {suppliers.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field label="Linked purchase (optional)">
                <Select name="purchaseId" defaultValue="">
                  <option value="">— None —</option>
                  {recentPurchases.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.invoiceNumber}
                    </option>
                  ))}
                </Select>
              </Field>
            </div>
          )}

          <div>
            <p className="mb-2 text-sm font-medium text-slate-700">Items</p>
            <div className="space-y-2">
              {lines.map((l) => {
                const p = products.find((x) => x.id === l.productId);
                return (
                  <div
                    key={l.key}
                    className="grid grid-cols-12 items-end gap-2 rounded-xl border border-slate-200 p-2"
                  >
                    <div className="col-span-12 sm:col-span-5">
                      <Field label="Product">
                        <Select
                          value={l.productId}
                          onChange={(e) => onProductPick(l.key, e.target.value)}
                          className="h-8 text-sm"
                        >
                          <option value="">— Select product —</option>
                          {products.map((prod) => (
                            <option key={prod.id} value={prod.id}>
                              {prod.name}
                              {prod.sku ? ` (${prod.sku})` : ""}
                            </option>
                          ))}
                        </Select>
                      </Field>
                      {p && (
                        <p className="mt-1 text-xs text-slate-500">
                          Stock: {p.currentStock}
                        </p>
                      )}
                    </div>
                    <div className="col-span-4 sm:col-span-2">
                      <Field label="Qty">
                        <Input
                          type="number"
                          min={1}
                          step={1}
                          className="h-8 text-sm"
                          value={l.qty}
                          onChange={(e) => updateLine(l.key, { qty: e.target.value })}
                        />
                      </Field>
                    </div>
                    <div className="col-span-5 sm:col-span-3">
                      <Field label="Unit price (PKR)">
                        <Input
                          type="number"
                          min={0}
                          step="0.01"
                          className="h-8 text-sm"
                          value={l.unitPricePkr}
                          onChange={(e) =>
                            updateLine(l.key, { unitPricePkr: e.target.value })
                          }
                        />
                      </Field>
                    </div>
                    <div className="col-span-2 sm:col-span-1">
                      <p className="pb-2 text-right text-xs font-semibold tabular-nums text-slate-700">
                        {formatPKR(lineTotalPaisa(l))}
                      </p>
                    </div>
                    <div className="col-span-1">
                      <button
                        type="button"
                        onClick={() => removeLine(l.key)}
                        className="mb-2 rounded-lg px-2 py-1 text-lg text-slate-400 hover:bg-red-50 hover:text-red-600"
                        aria-label="Remove line"
                      >
                        ✕
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
            <Button
              type="button"
              variant="secondary"
              size="sm"
              className="mt-2"
              onClick={addLine}
            >
              ＋ Add item
            </Button>
          </div>

          <div className="flex justify-end">
            <p className="text-base font-bold text-slate-900">
              Total: <span className="tabular-nums">{formatPKR(totalPaisa)}</span>
            </p>
          </div>

          <Field label="Notes (optional)">
            <Textarea name="notes" placeholder="Reason for return…" />
          </Field>

          <Button type="submit" size="lg" disabled={pending}>
            {pending
              ? "Saving…"
              : returnType === "customer"
                ? "Record Customer Return"
                : "Record Supplier Return"}
          </Button>
        </div>
      </Card>
    </form>
  );
}
