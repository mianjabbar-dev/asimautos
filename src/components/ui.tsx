/**
 * Shared server-safe UI primitives for ASIM AUTOS.
 * Minimal, professional, Tailwind v4. Import from "@/components/ui".
 */
import Link from "next/link";
import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

/* ------------------------------------------------------------------ */

export function Button({
  children,
  variant = "primary",
  size = "md",
  className,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "secondary" | "danger" | "ghost";
  size?: "sm" | "md" | "lg";
}) {
  const variants: Record<string, string> = {
    primary:
      "bg-blue-700 text-white hover:bg-blue-800 focus-visible:ring-blue-600 disabled:bg-blue-300",
    secondary:
      "bg-white text-slate-800 border border-slate-300 hover:bg-slate-50 focus-visible:ring-blue-600 disabled:opacity-50",
    danger:
      "bg-red-600 text-white hover:bg-red-700 focus-visible:ring-red-600 disabled:bg-red-300",
    ghost: "text-slate-700 hover:bg-slate-100 focus-visible:ring-blue-600",
  };
  const sizes: Record<string, string> = {
    sm: "h-8 px-3 text-sm",
    md: "h-10 px-4 text-sm",
    lg: "h-12 px-6 text-base",
  };
  return (
    <button
      className={cn(
        "inline-flex items-center justify-center gap-2 rounded-lg font-medium transition-colors",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2",
        "disabled:cursor-not-allowed cursor-pointer",
        variants[variant],
        sizes[size],
        className
      )}
      {...props}
    >
      {children}
    </button>
  );
}

export function LinkButton({
  href,
  children,
  variant = "primary",
  size = "md",
  className,
}: {
  href: string;
  children: ReactNode;
  variant?: "primary" | "secondary" | "danger" | "ghost";
  size?: "sm" | "md" | "lg";
  className?: string;
}) {
  const variants: Record<string, string> = {
    primary: "bg-blue-700 text-white hover:bg-blue-800",
    secondary:
      "bg-white text-slate-800 border border-slate-300 hover:bg-slate-50",
    danger: "bg-red-600 text-white hover:bg-red-700",
    ghost: "text-slate-700 hover:bg-slate-100",
  };
  const sizes: Record<string, string> = {
    sm: "h-8 px-3 text-sm",
    md: "h-10 px-4 text-sm",
    lg: "h-12 px-6 text-base",
  };
  return (
    <Link
      href={href}
      className={cn(
        "inline-flex items-center justify-center gap-2 rounded-lg font-medium transition-colors",
        variants[variant],
        sizes[size],
        className
      )}
    >
      {children}
    </Link>
  );
}

/* ------------------------------------------------------------------ */

export function Field({
  label,
  error,
  hint,
  children,
  className,
}: {
  label: string;
  error?: string;
  hint?: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <label className={cn("block", className)}>
      <span className="mb-1 block text-sm font-medium text-slate-700">
        {label}
      </span>
      {children}
      {hint && !error && (
        <span className="mt-1 block text-xs text-slate-500">{hint}</span>
      )}
      {error && (
        <span className="mt-1 block text-xs font-medium text-red-600">
          {error}
        </span>
      )}
    </label>
  );
}

const inputCls =
  "block w-full rounded-lg border border-slate-300 bg-white px-3 text-slate-900 placeholder:text-slate-400 shadow-sm transition-colors focus:border-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-600/20 disabled:bg-slate-100 disabled:text-slate-500";

export function Input(
  props: Omit<React.InputHTMLAttributes<HTMLInputElement>, "size"> & { size?: "sm" | "md" }
) {
  const { size = "md", className, ...rest } = props;
  return (
    <input
      className={cn(inputCls, size === "sm" ? "h-8 text-sm" : "h-10 text-sm", className)}
      {...rest}
    />
  );
}

export function Select(
  props: Omit<React.SelectHTMLAttributes<HTMLSelectElement>, "size"> & { size?: "sm" | "md" }
) {
  const { size = "md", className, children, ...rest } = props;
  return (
    <select
      className={cn(inputCls, size === "sm" ? "h-8 text-sm" : "h-10 text-sm", className)}
      {...rest}
    >
      {children}
    </select>
  );
}

export function Textarea(props: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  const { className, ...rest } = props;
  return (
    <textarea
      className={cn(inputCls, "min-h-20 py-2 text-sm", className)}
      {...rest}
    />
  );
}

/* ------------------------------------------------------------------ */

export function Card({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "rounded-xl border border-slate-200 bg-white shadow-sm",
        className
      )}
    >
      {children}
    </div>
  );
}

export function CardHeader({
  title,
  subtitle,
  action,
}: {
  title: string;
  subtitle?: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex items-start justify-between gap-4 border-b border-slate-100 px-4 py-3 sm:px-5">
      <div>
        <h2 className="text-base font-semibold text-slate-900">{title}</h2>
        {subtitle && <p className="mt-0.5 text-sm text-slate-500">{subtitle}</p>}
      </div>
      {action}
    </div>
  );
}

export function Stat({
  label,
  value,
  sub,
  tone = "default",
}: {
  label: string;
  value: string;
  sub?: string;
  tone?: "default" | "danger" | "warning" | "success";
}) {
  const tones: Record<string, string> = {
    default: "text-slate-900",
    danger: "text-red-700",
    warning: "text-amber-700",
    success: "text-emerald-700",
  };
  return (
    <Card className="p-4">
      <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
        {label}
      </p>
      <p className={cn("mt-1 text-2xl font-bold tabular-nums", tones[tone])}>
        {value}
      </p>
      {sub && <p className="mt-1 text-xs text-slate-500">{sub}</p>}
    </Card>
  );
}

export function Badge({
  children,
  tone = "default",
  className,
}: {
  children: ReactNode;
  tone?: "default" | "success" | "warning" | "danger" | "info";
  className?: string;
}) {
  const tones: Record<string, string> = {
    default: "bg-slate-100 text-slate-700",
    success: "bg-emerald-100 text-emerald-800",
    warning: "bg-amber-100 text-amber-800",
    danger: "bg-red-100 text-red-800",
    info: "bg-blue-100 text-blue-800",
  };
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium whitespace-nowrap",
        tones[tone],
        className
      )}
    >
      {children}
    </span>
  );
}

export function EmptyState({
  title,
  message,
  action,
}: {
  title: string;
  message: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-slate-300 bg-slate-50 px-6 py-12 text-center">
      <p className="text-base font-semibold text-slate-800">{title}</p>
      <p className="mt-1 max-w-sm text-sm text-slate-500">{message}</p>
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

export function Alert({
  tone = "info",
  children,
}: {
  tone?: "info" | "success" | "warning" | "danger";
  children: ReactNode;
}) {
  const tones: Record<string, string> = {
    info: "border-blue-200 bg-blue-50 text-blue-900",
    success: "border-emerald-200 bg-emerald-50 text-emerald-900",
    warning: "border-amber-200 bg-amber-50 text-amber-900",
    danger: "border-red-200 bg-red-50 text-red-900",
  };
  return (
    <div className={cn("rounded-lg border px-4 py-3 text-sm", tones[tone])}>
      {children}
    </div>
  );
}

export function Spinner({ className }: { className?: string }) {
  return (
    <span
      className={cn(
        "inline-block h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent",
        className
      )}
      aria-label="Loading"
    />
  );
}

/* ------------------------------------------------------------------ */
/* Tables                                                              */
/* ------------------------------------------------------------------ */

export function Table({ children }: { children: ReactNode }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[640px] border-collapse text-sm">
        {children}
      </table>
    </div>
  );
}

export function Th({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <th
      className={cn(
        "border-b border-slate-200 bg-slate-50 px-3 py-2.5 text-left text-xs font-semibold uppercase tracking-wide text-slate-600",
        className
      )}
    >
      {children}
    </th>
  );
}

export function Td({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <td className={cn("border-b border-slate-100 px-3 py-2.5 text-slate-800", className)}>
      {children}
    </td>
  );
}

export function PageHeader({
  title,
  subtitle,
  actions,
}: {
  title: string;
  subtitle?: string;
  actions?: ReactNode;
}) {
  return (
    <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
      <div>
        <h1 className="text-xl font-bold text-slate-900 sm:text-2xl">{title}</h1>
        {subtitle && <p className="mt-1 text-sm text-slate-500">{subtitle}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}

export function Pagination({
  page,
  totalPages,
  basePath,
  query = "",
}: {
  page: number;
  totalPages: number;
  basePath: string;
  query?: string;
}) {
  if (totalPages <= 1) return null;
  const href = (p: number) => `${basePath}?page=${p}${query ? `&${query}` : ""}`;
  return (
    <div className="flex items-center justify-between px-4 py-3">
      <p className="text-sm text-slate-500">
        Page {page} of {totalPages}
      </p>
      <div className="flex gap-2">
        {page > 1 ? (
          <LinkButton href={href(page - 1)} variant="secondary" size="sm">
            Previous
          </LinkButton>
        ) : (
          <Button variant="secondary" size="sm" disabled>
            Previous
          </Button>
        )}
        {page < totalPages ? (
          <LinkButton href={href(page + 1)} variant="secondary" size="sm">
            Next
          </LinkButton>
        ) : (
          <Button variant="secondary" size="sm" disabled>
            Next
          </Button>
        )}
      </div>
    </div>
  );
}

/** Renders a server-action form result message passed via searchParams. */
export function FormMessage({ message, tone }: { message?: string; tone?: string }) {
  if (!message) return null;
  return (
    <Alert tone={tone === "error" ? "danger" : tone === "success" ? "success" : "info"}>
      {message}
    </Alert>
  );
}
