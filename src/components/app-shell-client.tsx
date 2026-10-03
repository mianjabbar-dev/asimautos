"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Input } from "@/components/ui";
import { ScanButton } from "@/components/ui-client";

/** Topbar global search. Enter -> /search?q=...  USB scanners type + Enter. */
export function SearchBox() {
  const router = useRouter();
  const [value, setValue] = useState("");
  return (
    <form
      className="flex w-full max-w-xl flex-1 items-center gap-2"
      onSubmit={(e) => {
        e.preventDefault();
        if (value.trim()) router.push(`/search?q=${encodeURIComponent(value.trim())}`);
      }}
    >
      <Input
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder="Search products: name, SKU, part no, barcode, vehicle, rack…"
        className="h-10"
        aria-label="Global product search"
      />
      <ScanButton
        onScan={(code) => {
          setValue(code);
          router.push(`/search?q=${encodeURIComponent(code)}`);
        }}
      />
    </form>
  );
}

export function MobileMenu({
  items,
}: {
  items: Array<{ href: string; label: string }>;
}) {
  const [open, setOpen] = useState(false);
  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="flex flex-1 flex-col items-center gap-1 py-2 text-[11px] font-medium text-slate-500"
        aria-label="Open menu"
      >
        <span className="text-lg">☰</span>
        Menu
      </button>
    );
  }
  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-white">
      <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3">
        <p className="font-bold text-slate-900">ASIM AUTOS</p>
        <button
          onClick={() => setOpen(false)}
          className="rounded-lg px-3 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100"
        >
          ✕ Close
        </button>
      </div>
      <nav className="grid grid-cols-2 gap-2 overflow-y-auto p-4">
        {items.map((it) => (
          <a
            key={it.href}
            href={it.href}
            onClick={() => setOpen(false)}
            className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-4 text-sm font-medium text-slate-800 active:bg-slate-100"
          >
            {it.label}
          </a>
        ))}
      </nav>
    </div>
  );
}
