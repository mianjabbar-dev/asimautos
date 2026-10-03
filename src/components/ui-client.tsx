"use client";

/**
 * Client-side UI primitives: modals, destructive-action confirmations,
 * and the camera barcode scanner (via @zxing/browser).
 */
import { useEffect, useRef, useState, type ReactNode } from "react";
import { cn } from "@/lib/cn";
import { Button, Spinner } from "./ui";

/* ------------------------------------------------------------------ */

export function Modal({
  open,
  onClose,
  title,
  children,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
}) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [open, onClose]);

  if (!open) return null;
  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-slate-900/50 p-0 sm:items-center sm:p-6"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label={title}
    >
      <div
        className="max-h-[92vh] w-full max-w-lg overflow-y-auto rounded-t-2xl bg-white p-5 shadow-xl sm:rounded-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-slate-900">{title}</h2>
          <button
            onClick={onClose}
            className="rounded-lg p-2 text-slate-500 hover:bg-slate-100"
            aria-label="Close"
          >
            ✕
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

/**
 * A submit button that asks for confirmation before submitting its form.
 * Use inside a <form action={...}> for destructive operations.
 */
export function ConfirmSubmit({
  children,
  message,
  variant = "danger",
  size = "sm",
  className,
}: {
  children: ReactNode;
  message: string;
  variant?: "primary" | "secondary" | "danger" | "ghost";
  size?: "sm" | "md" | "lg";
  className?: string;
}) {
  const [confirming, setConfirming] = useState(false);
  const variants: Record<string, string> = {
    primary: "bg-blue-700 text-white hover:bg-blue-800",
    secondary: "bg-white text-slate-800 border border-slate-300 hover:bg-slate-50",
    danger: "bg-red-600 text-white hover:bg-red-700",
    ghost: "text-slate-700 hover:bg-slate-100",
  };
  const sizes: Record<string, string> = {
    sm: "h-8 px-3 text-sm",
    md: "h-10 px-4 text-sm",
    lg: "h-12 px-6 text-base",
  };
  return (
    <>
      <button
        type="button"
        onClick={() => setConfirming(true)}
        className={cn(
          "inline-flex cursor-pointer items-center justify-center gap-2 rounded-lg font-medium transition-colors",
          variants[variant],
          sizes[size],
          className
        )}
      >
        {children}
      </button>
      <Modal open={confirming} onClose={() => setConfirming(false)} title="Please confirm">
        <p className="text-sm text-slate-700">{message}</p>
        <div className="mt-5 flex justify-end gap-2">
          <Button variant="secondary" onClick={() => setConfirming(false)}>
            Cancel
          </Button>
          <Button
            variant="danger"
            onClick={(e) => {
              const form = (e.target as HTMLElement).closest("form");
              setConfirming(false);
              // Submit the enclosing form programmatically after confirmation.
              form?.requestSubmit();
            }}
          >
            Yes, continue
          </Button>
        </div>
      </Modal>
    </>
  );
}

/* ------------------------------------------------------------------ */
/* Barcode scanner (camera) via @zxing/browser                         */
/* ------------------------------------------------------------------ */

export function BarcodeScanner({
  onResult,
  onClose,
}: {
  onResult: (code: string) => void;
  onClose: () => void;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [starting, setStarting] = useState(true);

  useEffect(() => {
    let controls: { stop: () => void } | null = null;
    let cancelled = false;
    (async () => {
      try {
        const { BrowserMultiFormatReader } = await import("@zxing/browser");
        const reader = new BrowserMultiFormatReader();
        if (cancelled || !videoRef.current) return;
        controls = await reader.decodeFromVideoDevice(
          undefined,
          videoRef.current,
          (result, err) => {
            if (result) {
              const code = result.getText();
              onResult(code);
            }
          }
        );
        setStarting(false);
      } catch (e) {
        setError(
          e instanceof Error
            ? e.message
            : "Could not start the camera. Check camera permission."
        );
        setStarting(false);
      }
    })();
    return () => {
      cancelled = true;
      controls?.stop();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-slate-950">
      <div className="flex items-center justify-between p-4">
        <p className="font-medium text-white">Scan barcode</p>
        <button
          onClick={onClose}
          className="rounded-lg bg-white/10 px-4 py-2 text-sm font-medium text-white"
        >
          Close
        </button>
      </div>
      <div className="relative flex-1">
        {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
        <video ref={videoRef} className="h-full w-full object-cover" playsInline muted />
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
          <div className="h-40 w-72 rounded-lg border-4 border-blue-500/80" />
        </div>
        {starting && (
          <div className="absolute inset-0 flex items-center justify-center bg-slate-950/60">
            <Spinner className="h-8 w-8 text-white" />
          </div>
        )}
      </div>
      {error && (
        <p className="bg-red-600 px-4 py-3 text-center text-sm text-white">{error}</p>
      )}
      <p className="bg-slate-950 px-4 py-3 text-center text-xs text-slate-400">
        Point the camera at the product barcode. USB scanners work automatically —
        just click the search field and scan.
      </p>
    </div>
  );
}

/** Button that opens the camera scanner and fills a callback with the code. */
export function ScanButton({ onScan }: { onScan: (code: string) => void }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button type="button" variant="secondary" onClick={() => setOpen(true)}>
        📷 Scan
      </Button>
      {open && (
        <BarcodeScanner
          onClose={() => setOpen(false)}
          onResult={(code) => {
            setOpen(false);
            onScan(code);
          }}
        />
      )}
    </>
  );
}
