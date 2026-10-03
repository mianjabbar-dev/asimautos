/**
 * /sales/[id] — professional sales invoice.
 * Print-friendly (print-area class), with Record Payment form.
 */
import { notFound } from "next/navigation";
import { eq, and } from "drizzle-orm";
import { db } from "@/db";
import { sales, saleItems, products, customers, settings } from "@/db/schema";
import { requireSession } from "@/lib/auth";
import { formatPKR } from "@/lib/money";
import {
  PageHeader,
  LinkButton,
  Card,
  CardHeader,
  Table,
  Th,
  Td,
  Badge,
} from "@/components/ui";
import {
  PrintInvoiceButton,
  InvoicePdfButton,
  type InvoiceData,
} from "./invoice-client";
import { PaySaleForm } from "../pay-form-client";

const METHOD_LABEL: Record<string, string> = {
  CASH: "Cash",
  BANK: "Bank Transfer",
  CREDIT: "Credit",
  OTHER: "Other",
};

const STATUS_TONE: Record<string, "success" | "warning" | "danger"> = {
  PAID: "success",
  PARTIAL: "warning",
  PENDING: "danger",
};

function dateLabel(d: Date): string {
  return (
    d.toLocaleDateString("en-PK", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    }) +
    " " +
    d.toLocaleTimeString("en-PK", { hour: "2-digit", minute: "2-digit" })
  );
}

export default async function SaleInvoicePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await requireSession();
  const { id } = await params;

  const [sale] = await db
    .select()
    .from(sales)
    .where(and(eq(sales.id, id), eq(sales.shopId, session.shopId)))
    .limit(1);
  if (!sale) notFound();

  const [customer] = sale.customerId
    ? await db
        .select()
        .from(customers)
        .where(eq(customers.id, sale.customerId))
        .limit(1)
    : [null];

  const items = await db
    .select({
      name: products.name,
      quantity: saleItems.quantity,
      salePrice: saleItems.salePrice,
      discount: saleItems.discount,
      total: saleItems.total,
    })
    .from(saleItems)
    .innerJoin(products, eq(saleItems.productId, products.id))
    .where(eq(saleItems.saleId, sale.id));

  const [shop] = await db
    .select()
    .from(settings)
    .where(eq(settings.shopId, session.shopId))
    .limit(1);

  const invoice: InvoiceData = {
    invoiceNumber: sale.invoiceNumber,
    saleDateLabel: dateLabel(new Date(sale.saleDate)),
    shopName: shop?.shopName ?? "ASIM AUTOS",
    shopPhone: shop?.phone ?? null,
    shopAddress: shop?.address ?? null,
    shopCity: shop?.city ?? null,
    customerName: customer?.name ?? "Walk-in customer",
    customerPhone: customer?.phone ?? null,
    customerAddress: customer?.address ?? null,
    items: items.map((it) => ({
      name: it.name,
      qty: it.quantity,
      unitPricePaisa: it.salePrice,
      discountPaisa: it.discount,
      totalPaisa: it.total,
    })),
    subtotalPaisa: sale.subtotal,
    discountPaisa: sale.discount,
    totalPaisa: sale.total,
    paidPaisa: sale.paidAmount,
    remainingPaisa: sale.remaining,
    paymentMethod: METHOD_LABEL[sale.paymentMethod] ?? sale.paymentMethod,
    notes: sale.notes,
  };

  return (
    <div>
      <div className="no-print">
        <PageHeader
          title={`Invoice ${sale.invoiceNumber}`}
          subtitle="Sales invoice"
          actions={
            <>
              <PrintInvoiceButton />
              <InvoicePdfButton invoice={invoice} />
              <LinkButton href="/sales" variant="secondary">
                Back to Sales
              </LinkButton>
            </>
          }
        />
      </div>

      {/* ---------- Printable invoice ---------- */}
      <Card className="print-area mx-auto max-w-3xl p-6 sm:p-10">
        <div className="border-b-2 border-slate-900 pb-4">
          <h1 className="text-2xl font-black tracking-wide text-slate-900">
            {invoice.shopName}
          </h1>
          <p className="mt-1 text-sm text-slate-600">
            {[invoice.shopAddress, invoice.shopCity].filter(Boolean).join(", ")}
            {invoice.shopPhone ? ` · Phone: ${invoice.shopPhone}` : ""}
          </p>
        </div>

        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              Billed to
            </p>
            <p className="mt-1 font-semibold text-slate-900">{invoice.customerName}</p>
            {invoice.customerPhone && (
              <p className="text-sm text-slate-600">{invoice.customerPhone}</p>
            )}
            {invoice.customerAddress && (
              <p className="text-sm text-slate-600">{invoice.customerAddress}</p>
            )}
          </div>
          <div className="sm:text-right">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              Invoice
            </p>
            <p className="mt-1 font-mono font-bold text-slate-900">
              {sale.invoiceNumber}
            </p>
            <p className="text-sm text-slate-600">{invoice.saleDateLabel}</p>
            <p className="mt-1">
              <Badge tone={STATUS_TONE[sale.paymentStatus] ?? "default"}>
                {sale.paymentStatus}
              </Badge>
            </p>
          </div>
        </div>

        <div className="mt-6">
          <Table>
            <thead>
              <tr>
                <Th>#</Th>
                <Th>Item</Th>
                <Th className="text-right">Qty</Th>
                <Th className="text-right">Unit Price</Th>
                <Th className="text-right">Discount</Th>
                <Th className="text-right">Total</Th>
              </tr>
            </thead>
            <tbody>
              {items.map((it, i) => (
                <tr key={i}>
                  <Td>{i + 1}</Td>
                  <Td className="font-medium">{it.name}</Td>
                  <Td className="text-right tabular-nums">{it.quantity}</Td>
                  <Td className="text-right tabular-nums">{formatPKR(it.salePrice)}</Td>
                  <Td className="text-right tabular-nums">{formatPKR(it.discount)}</Td>
                  <Td className="text-right tabular-nums font-medium">
                    {formatPKR(it.total)}
                  </Td>
                </tr>
              ))}
            </tbody>
          </Table>
        </div>

        <div className="mt-4 flex justify-end">
          <div className="w-full max-w-xs space-y-1 text-sm">
            <div className="flex justify-between text-slate-600">
              <span>Subtotal</span>
              <span className="tabular-nums">{formatPKR(sale.subtotal)}</span>
            </div>
            <div className="flex justify-between text-slate-600">
              <span>Discount</span>
              <span className="tabular-nums">− {formatPKR(sale.discount)}</span>
            </div>
            <div className="flex justify-between border-t border-slate-200 pt-2 text-base font-bold text-slate-900">
              <span>Total</span>
              <span className="tabular-nums">{formatPKR(sale.total)}</span>
            </div>
            <div className="flex justify-between text-slate-600">
              <span>Paid ({METHOD_LABEL[sale.paymentMethod] ?? sale.paymentMethod})</span>
              <span className="tabular-nums">{formatPKR(sale.paidAmount)}</span>
            </div>
            <div
              className={`flex justify-between font-bold ${
                sale.remaining > 0 ? "text-red-700" : "text-slate-900"
              }`}
            >
              <span>Remaining</span>
              <span className="tabular-nums">{formatPKR(sale.remaining)}</span>
            </div>
          </div>
        </div>

        {sale.notes && (
          <p className="mt-6 text-sm text-slate-600">
            <span className="font-semibold">Notes:</span> {sale.notes}
          </p>
        )}

        <p className="mt-8 border-t border-slate-200 pt-4 text-center text-xs text-slate-400">
          Thank you for your business.
        </p>
      </Card>

      {/* ---------- Record payment ---------- */}
      {sale.remaining > 0 && (
        <Card className="no-print mx-auto mt-4 max-w-3xl">
          <CardHeader
            title="Record Payment"
            subtitle={`Outstanding balance: ${formatPKR(sale.remaining)}`}
          />
          <div className="p-4 sm:p-5">
            <PaySaleForm saleId={sale.id} remainingPaisa={sale.remaining} />
          </div>
        </Card>
      )}
    </div>
  );
}
