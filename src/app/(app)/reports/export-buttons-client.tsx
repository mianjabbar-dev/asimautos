"use client";

/**
 * Reusable export buttons for every report page.
 * data: array of plain (JSON-serializable) objects.
 * columns: [{ key, label }] — key maps into each data object.
 * CSV downloads via Blob; Excel via xlsx; PDF via jspdf + jspdf-autotable.
 */
import { useState } from "react";
import { Button, Spinner } from "@/components/ui";

export type ExportColumn = { key: string; label: string };

type Busy = "csv" | "xlsx" | "pdf" | null;

function csvEscape(v: string): string {
  return /[",\n\r]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v;
}

function cell(v: unknown): string {
  if (v === null || v === undefined) return "";
  return String(v);
}

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function ExportButtons({
  data,
  filename,
  columns,
}: {
  data: Record<string, unknown>[];
  filename: string;
  columns: ExportColumn[];
}) {
  const [busy, setBusy] = useState<Busy>(null);
  if (data.length === 0 || columns.length === 0) return null;

  const rows = () => data.map((r) => columns.map((c) => cell(r[c.key])));

  const doCsv = () => {
    setBusy("csv");
    try {
      const lines = [
        columns.map((c) => csvEscape(c.label)).join(","),
        ...rows().map((r) => r.map(csvEscape).join(",")),
      ];
      downloadBlob(
        new Blob(["\uFEFF" + lines.join("\r\n")], {
          type: "text/csv;charset=utf-8",
        }),
        `${filename}.csv`
      );
    } finally {
      setBusy(null);
    }
  };

  const doXlsx = async () => {
    setBusy("xlsx");
    try {
      const XLSX = await import("xlsx");
      const ws = XLSX.utils.aoa_to_sheet([
        columns.map((c) => c.label),
        ...rows(),
      ]);
      ws["!cols"] = columns.map(() => ({ wch: 22 }));
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "Report");
      XLSX.writeFile(wb, `${filename}.xlsx`);
    } finally {
      setBusy(null);
    }
  };

  const doPdf = async () => {
    setBusy("pdf");
    try {
      const [{ jsPDF }, autoTableMod] = await Promise.all([
        import("jspdf"),
        import("jspdf-autotable"),
      ]);
      const autoTable = autoTableMod.default;
      const doc = new jsPDF({ orientation: "landscape", unit: "pt" });
      doc.setFontSize(14);
      doc.text(filename.replace(/[-_]/g, " "), 40, 40);
      doc.setFontSize(9);
      doc.setTextColor(100);
      doc.text(`ASIM AUTOS · generated ${new Date().toLocaleString()}`, 40, 56);
      autoTable(doc, {
        startY: 70,
        head: [columns.map((c) => c.label)],
        body: rows(),
        styles: { fontSize: 8, cellPadding: 5 },
        headStyles: {
          fillColor: [30, 64, 175],
          textColor: 255,
          fontStyle: "bold",
        },
        alternateRowStyles: { fillColor: [248, 250, 252] },
      });
      doc.save(`${filename}.pdf`);
    } finally {
      setBusy(null);
    }
  };

  const btn = (kind: Exclude<Busy, null>, label: string, run: () => void) => (
    <Button
      key={kind}
      size="sm"
      variant="secondary"
      disabled={busy !== null}
      onClick={run}
    >
      {busy === kind ? <Spinner /> : null}
      {label}
    </Button>
  );

  return (
    <div className="flex flex-wrap items-center gap-2">
      {btn("csv", "CSV", doCsv)}
      {btn("xlsx", "Excel", doXlsx)}
      {btn("pdf", "PDF", doPdf)}
    </div>
  );
}
