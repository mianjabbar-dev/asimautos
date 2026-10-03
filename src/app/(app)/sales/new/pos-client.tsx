"use client";

/**
 * POS client — mobile-first, touch-friendly billing screen.
 *
 * Left/top: product search (debounced server action) with stock badges,
 * plus a barcode ScanButton that fills the search box.
 * Right/bottom (sticky on mobile): cart with qty steppers, bill discount,
 * customer, payment method, paid amount and the big Complete Sale button.
 *
 * All money math here is in paisa (integers). Sale prices are sent to the
 * server action in PKR and converted back to paisa there.
 */

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { formatPKR } from "@/lib/money";
import { Button, Card, CardHeader, Badge, Alert, Input, Select, Field } from "@/components/ui";
import { ScanButton } from "@/components/ui-client";
import {
  searchProductsAction,
  createSaleAction,
  type PosProduct,
  type CreateSaleInput,
} from "../actions";

type CartLine = {
  productId: string;
  name: string;
  sku: string | null;
  salePricePaisa: number;
  stock: number;
  qty: number;
};

type PaymentMethod = "CASH" | "BANK" | "CREDIT" | "OTHER";

const METHODS: Array<{ value: PaymentMethod; label: string }> = [
  { value: "CASH", label: "Cash" },
  { value: "BANK", label: "Bank Transfer" },
  { value: "CREDIT", label: "Credit" },
  { value: "OTHER", label: "Other" },
];

export function PosClient({
  customers,
}: {
  customers: Array<{ id: string; name: string; phone: string | null }>;
}) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<PosProduct[]>([]);
  const [searching, setSearching] = useState(false);
  const [cart, setCart] = useState<CartLine[]>([]);
  const [discountPkr, setDiscountPkr] = useState("");
  const [customerId, setCustomerId] = useState("");
  const [method, setMethod] = useState<PaymentMethod>("CASH");
  // null = user hasn't typed a paid amount yet → derive the default
  // (full total, or 0 for credit).
  const [paidPkr, setPaidPkr] = useState<string | null>(null);
  const [notes, setNotes] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const debounce = useRef<ReturnType<typeof setTimeout> | null>(null);
  const searchBoxRef = useRef<HTMLInputElement>(null);

  /* ---------------- search ---------------- */

  const runSearch = async (q: string) => {
    const trimmed = q.trim();
    if (!trimmed) {
      setResults([]);
      setSearching(false);
      return;
    }
    setSearching(true);
    try {
      const rows = await searchProductsAction(trimmed);
      setResults(rows);
    } catch {
      setResults([]);
    } finally {
      setSearching(false);
    }
  };

  const onQueryChange = (q: string) => {
    setQuery(q);
    if (debounce.current) clearTimeout(debounce.current);
    debounce.current = setTimeout(() => runSearch(q), 250);
  };

  useEffect(() => {
    return () => {
      if (debounce.current) clearTimeout(debounce.current);
    };
  }, []);

  /* ---------------- cart ---------------- */

  const addToCart = (p: PosProduct) => {
    setCart((prev) => {
      const existing = prev.find((l) => l.productId === p.id);
      if (existing) {
        return prev.map((l) =>
          l.productId === p.id ? { ...l, qty: l.qty + 1 } : l
        );
      }
      return [
        ...prev,
        {
          productId: p.id,
          name: p.name,
          sku: p.sku,
          salePricePaisa: p.salePrice,
          stock: p.currentStock,
          qty: 1,
        },
      ];
    });
    setError(null);
  };

  const setQty = (productId: string, qty: number) => {
    setCart((prev) =>
      prev
        .map((l) => (l.productId === productId ? { ...l, qty: Math.max(0, qty) } : l))
        .filter((l) => l.qty > 0)
    );
  };

  const removeLine = (productId: string) =>
    setCart((prev) => prev.filter((l) => l.productId !== productId));

  /* ---------------- totals ---------------- */

  const subtotalPaisa = useMemo(
    () => cart.reduce((s, l) => s + l.qty * l.salePricePaisa, 0),
    [cart]
  );
  const discountPaisa = useMemo(() => {
    const n = parseFloat(discountPkr);
    if (!Number.isFinite(n) || n <= 0) return 0;
    return Math.round(n * 100);
  }, [discountPkr]);
  const totalPaisa = Math.max(0, subtotalPaisa - discountPaisa);

  // Paid amount: user's typed value, or the live default (full total / 0 for credit).
  const effectivePaidPkr =
    paidPkr ?? (method === "CREDIT" ? "0" : (totalPaisa / 100).toFixed(2));

  const paidPaisa = useMemo(() => {
    const n = parseFloat(effectivePaidPkr);
    if (!Number.isFinite(n) || n < 0) return 0;
    return Math.round(n * 100);
  }, [effectivePaidPkr]);

  const remainingPaisa = totalPaisa - paidPaisa; // >0 = customer owes, <0 = change

  /* ---------------- submit ---------------- */

  const completeSale = async () => {
    if (cart.length === 0) {
      setError("Add at least one product to the cart.");
      return;
    }
    setSubmitting(true);
    setError(null);
    const input: CreateSaleInput = {
      customerId: customerId || undefined,
      items: cart.map((l) => ({
        productId: l.productId,
        quantity: l.qty,
        salePrice: l.salePricePaisa / 100, // PKR — action converts to paisa
      })),
      discount: discountPaisa / 100,
      paidAmount: paidPaisa / 100,
      paymentMethod: method,
      notes: notes.trim() || undefined,
    };
    const result = await createSaleAction(input);
    setSubmitting(false);
    if (result.ok && result.id) {
      router.push(`/sales/${result.id}`);
    } else {
      setError(result.ok ? "Something went wrong." : result.message);
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  };

  return (
    <div className="grid gap-4 lg:grid-cols-5">
      {/* ---------- Product search ---------- */}
      <div className="lg:col-span-3">
        <Card>
          <CardHeader
            title="Products"
            subtitle="Search by name, SKU, part no, OEM or barcode"
          />
          <div className="p-4">
            <div className="flex gap-2">
              <div className="flex-1">
                <input
                  ref={searchBoxRef}
                  value={query}
                  onChange={(e) => onQueryChange(e.target.value)}
                  placeholder="Type to search, or scan a barcode…"
                  autoFocus
                  className="block h-12 w-full rounded-lg border border-slate-300 bg-white px-3 text-base text-slate-900 placeholder:text-slate-400 shadow-sm transition-colors focus:border-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-600/20"
                />
              </div>
              <ScanButton
                onScan={(code) => {
                  setQuery(code);
                  runSearch(code);
                  searchBoxRef.current?.focus();
                }}
              />
            </div>

            <div className="mt-3 space-y-2">
              {searching && (
                <p className="py-6 text-center text-sm text-slate-500">Searching…</p>
              )}
              {!searching && query.trim() && results.length === 0 && (
                <p className="py-6 text-center text-sm text-slate-500">
                  No products found for “{query.trim()}”.
                </p>
              )}
              {results.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => addToCart(p)}
                  className="flex w-full items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white px-4 py-3 text-left transition-colors hover:border-blue-400 hover:bg-blue-50 active:bg-blue-100"
                >
                  <div className="min-w-0">
                    <p className="truncate font-medium text-slate-900">{p.name}</p>
                    <p className="text-xs text-slate-500">
                      {p.sku ?? "No SKU"} · {formatPKR(p.salePrice)}
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    <Badge tone={p.currentStock > 0 ? "success" : "danger"}>
                      {p.currentStock > 0 ? `${p.currentStock} in stock` : "Out of stock"}
                    </Badge>
                    <span className="text-lg font-bold text-blue-700">＋</span>
                  </div>
                </button>
              ))}
            </div>
          </div>
        </Card>
      </div>

      {/* ---------- Cart / bill ---------- */}
      <div className="lg:col-span-2">
        <div className="lg:sticky lg:top-16">
          <Card>
            <CardHeader
              title={`Bill (${cart.length} item${cart.length === 1 ? "" : "s"})`}
              action={
                cart.length > 0 ? (
                  <button
                    type="button"
                    onClick={() => setCart([])}
                    className="text-xs font-medium text-red-600 hover:underline"
                  >
                    Clear all
                  </button>
                ) : undefined
              }
            />
            <div className="space-y-3 p-4">
              {error && <Alert tone="danger">{error}</Alert>}

              {cart.length === 0 ? (
                <p className="py-8 text-center text-sm text-slate-500">
                  Cart is empty. Search and tap a product to add it.
                </p>
              ) : (
                <div className="space-y-2">
                  {cart.map((l) => (
                    <div
                      key={l.productId}
                      className="rounded-xl border border-slate-200 p-3"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <p className="truncate text-sm font-medium text-slate-900">
                            {l.name}
                          </p>
                          <p className="text-xs text-slate-500">
                            {formatPKR(l.salePricePaisa)} each
                            {l.qty > l.stock && (
                              <span className="ml-1 font-semibold text-red-600">
                                · only {l.stock} in stock
                              </span>
                            )}
                          </p>
                        </div>
                        <button
                          type="button"
                          onClick={() => removeLine(l.productId)}
                          className="rounded-lg px-2 py-1 text-lg leading-none text-slate-400 hover:bg-red-50 hover:text-red-600"
                          aria-label={`Remove ${l.name}`}
                        >
                          ✕
                        </button>
                      </div>
                      <div className="mt-2 flex items-center justify-between">
                        <div className="flex items-center gap-1">
                          <button
                            type="button"
                            onClick={() => setQty(l.productId, l.qty - 1)}
                            className="flex h-10 w-10 items-center justify-center rounded-lg border border-slate-300 text-xl font-bold text-slate-700 active:bg-slate-100"
                            aria-label="Decrease quantity"
                          >
                            −
                          </button>
                          <input
                            type="number"
                            min={1}
                            value={l.qty}
                            onChange={(e) =>
                              setQty(l.productId, parseInt(e.target.value, 10) || 0)
                            }
                            className="h-10 w-14 rounded-lg border border-slate-300 text-center text-base font-semibold"
                            aria-label="Quantity"
                          />
                          <button
                            type="button"
                            onClick={() => setQty(l.productId, l.qty + 1)}
                            className="flex h-10 w-10 items-center justify-center rounded-lg border border-slate-300 text-xl font-bold text-slate-700 active:bg-slate-100"
                            aria-label="Increase quantity"
                          >
                            ＋
                          </button>
                        </div>
                        <p className="text-base font-bold tabular-nums text-slate-900">
                          {formatPKR(l.qty * l.salePricePaisa)}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              <Field label="Bill discount (PKR)">
                <Input
                  type="number"
                  min={0}
                  step="0.01"
                  value={discountPkr}
                  onChange={(e) => setDiscountPkr(e.target.value)}
                  placeholder="0"
                  className="h-11 text-base"
                />
              </Field>

              <Field label="Customer (optional)">
                <Select
                  value={customerId}
                  onChange={(e) => setCustomerId(e.target.value)}
                  className="h-11 text-base"
                >
                  <option value="">Walk-in customer</option>
                  {customers.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                      {c.phone ? ` — ${c.phone}` : ""}
                    </option>
                  ))}
                </Select>
              </Field>

              <Field label="Payment method">
                <div className="grid grid-cols-2 gap-2">
                  {METHODS.map((m) => (
                    <button
                      key={m.value}
                      type="button"
                      onClick={() => setMethod(m.value)}
                      className={`h-11 rounded-xl border text-sm font-semibold transition-colors ${
                        method === m.value
                          ? "border-blue-700 bg-blue-700 text-white"
                          : "border-slate-300 bg-white text-slate-700 active:bg-slate-100"
                      }`}
                    >
                      {m.label}
                    </button>
                  ))}
                </div>
              </Field>

              <Field label="Paid amount (PKR)">
                <Input
                  type="number"
                  min={0}
                  step="0.01"
                  value={effectivePaidPkr}
                  onChange={(e) => setPaidPkr(e.target.value)}
                  className="h-11 text-base"
                />
              </Field>

              <div className="rounded-xl bg-slate-50 p-3 text-sm">
                <div className="flex justify-between py-0.5 text-slate-600">
                  <span>Subtotal</span>
                  <span className="tabular-nums">{formatPKR(subtotalPaisa)}</span>
                </div>
                <div className="flex justify-between py-0.5 text-slate-600">
                  <span>Discount</span>
                  <span className="tabular-nums">− {formatPKR(discountPaisa)}</span>
                </div>
                <div className="flex justify-between border-t border-slate-200 py-1.5 text-base font-bold text-slate-900">
                  <span>Total</span>
                  <span className="tabular-nums">{formatPKR(totalPaisa)}</span>
                </div>
                <div className="flex justify-between py-0.5">
                  <span className="text-slate-600">Paid</span>
                  <span className="tabular-nums">{formatPKR(paidPaisa)}</span>
                </div>
                <div
                  className={`flex justify-between py-0.5 font-semibold ${
                    remainingPaisa > 0
                      ? "text-red-700"
                      : remainingPaisa < 0
                        ? "text-emerald-700"
                        : "text-slate-600"
                  }`}
                >
                  <span>{remainingPaisa < 0 ? "Change to return" : "Remaining due"}</span>
                  <span className="tabular-nums">
                    {formatPKR(Math.abs(remainingPaisa))}
                  </span>
                </div>
              </div>

              <Field label="Notes (optional)">
                <Input
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Any note…"
                />
              </Field>

              <Button
                type="button"
                size="lg"
                className="h-14 w-full text-lg font-bold"
                disabled={submitting || cart.length === 0}
                onClick={completeSale}
              >
                {submitting ? "Saving…" : `Complete Sale · ${formatPKR(totalPaisa)}`}
              </Button>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
