"use client";

/**
 * Invoice client actions: print (browser) and PDF download (jsPDF,
 * generated fully client-side from the sale data passed as props).
 */
import { jsPDF } from "jspdf";
import { autoTable } from "jspdf-autotable";
import { formatPKR } from "@/lib/money";
import { Button } from "@/components/ui";

export type InvoiceData = {
  invoiceNumber: string;
  saleDateLabel: string;
  shopName: string;
  shopPhone: string | null;
  shopAddress: string | null;
  shopCity: string | null;
  customerName: string;
  customerPhone: string | null;
  customerAddress: string | null;
  items: Array<{
    name: string;
    qty: number;
    unitPricePaisa: number;
    discountPaisa: number;
    totalPaisa: number;
  }>;
  subtotalPaisa: number;
  discountPaisa: number;
  totalPaisa: number;
  paidPaisa: number;
  remainingPaisa: number;
  paymentMethod: string;
  notes: string | null;
};

export function PrintInvoiceButton() {
  return (
    <Button variant="secondary" onClick={() => window.print()}>
      🖨 Print Invoice
    </Button>
  );
}

export function InvoicePdfButton({ invoice }: { invoice: InvoiceData }) {
  const download = () => {
    const doc = new jsPDF();
    const left = 14;
    let y = 18;

    doc.setFontSize(18);
    doc.setFont("helvetica", "bold");
    doc.text(invoice.shopName, left, y);
    y += 7;
    doc.setFontSize(10);
    doc.setFont("helvetica", "normal");
    const addr = [invoice.shopAddress, invoice.shopCity]
      .filter(Boolean)
      .join(", ");
    if (addr) {
      doc.text(addr, left, y);
      y += 5;
    }
    if (invoice.shopPhone) {
      doc.text(`Phone: ${invoice.shopPhone}`, left, y);
      y += 5;
    }
    y += 4;

    doc.setFontSize(13);
    doc.setFont("helvetica", "bold");
    doc.text("SALES INVOICE", left, y);
    y += 6;
    doc.setFontSize(10);
    doc.setFont("helvetica", "normal");
    doc.text(`Invoice No: ${invoice.invoiceNumber}`, left, y);
    y += 5;
    doc.text(`Date: ${invoice.saleDateLabel}`, left, y);
    y += 5;
    doc.text(`Customer: ${invoice.customerName}`, left, y);
    y += 5;
    if (invoice.customerPhone) {
      doc.text(`Phone: ${invoice.customerPhone}`, left, y);
      y += 5;
    }
    if (invoice.customerAddress) {
      doc.text(`Address: ${invoice.customerAddress}`, left, y);
      y += 5;
    }
    y += 3;

    autoTable(doc, {
      startY: y,
      head: [["#", "Item", "Qty", "Unit Price", "Discount", "Total"]],
      body: invoice.items.map((it, i) => [
        String(i + 1),
        it.name,
        String(it.qty),
        formatPKR(it.unitPricePaisa),
        formatPKR(it.discountPaisa),
        formatPKR(it.totalPaisa),
      ]),
      foot: [
        ["", "", "", "", "Subtotal", formatPKR(invoice.subtotalPaisa)],
        ["", "", "", "", "Discount", formatPKR(invoice.discountPaisa)],
        ["", "", "", "", "Total", formatPKR(invoice.totalPaisa)],
        ["", "", "", "", "Paid", formatPKR(invoice.paidPaisa)],
        ["", "", "", "", "Remaining", formatPKR(invoice.remainingPaisa)],
      ],
      styles: { fontSize: 9 },
      headStyles: { fillColor: [30, 58, 138] },
      footStyles: { fillColor: [241, 245, 249], textColor: 20, fontStyle: "bold" },
    });

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const finalY = (doc as any).lastAutoTable?.finalY ?? y + 60;
    let noteY = finalY + 8;
    doc.setFontSize(10);
    doc.text(`Payment method: ${invoice.paymentMethod}`, left, noteY);
    if (invoice.notes) {
      noteY += 6;
      doc.text(`Notes: ${invoice.notes}`, left, noteY);
    }

    doc.save(`${invoice.invoiceNumber}.pdf`);
  };

  return (
    <Button variant="secondary" onClick={download}>
      ⬇ Download PDF
    </Button>
  );
}
