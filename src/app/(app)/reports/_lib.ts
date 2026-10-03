/**
 * Shared server helpers for the reports section.
 * (Underscore-prefixed file: not a route.)
 *
 * Parses ?preset=today|yesterday|week|month|lastmonth|custom&from&to
 * into an inclusive-exclusive [since, until) date range.
 */

export type ReportPreset =
  | "today"
  | "yesterday"
  | "week"
  | "month"
  | "lastmonth"
  | "custom";

export type ReportRange = {
  since: Date;
  until: Date;
  preset: ReportPreset;
  /** yyyy-mm-dd, for date-input defaults */
  from: string;
  to: string;
  /** Human label for the current range, e.g. "This Month" or "1 Oct 2026 → 3 Oct 2026" */
  label: string;
};

const PRESETS: ReportPreset[] = [
  "today",
  "yesterday",
  "week",
  "month",
  "lastmonth",
  "custom",
];

export function presetLabel(p: ReportPreset): string {
  switch (p) {
    case "today":
      return "Today";
    case "yesterday":
      return "Yesterday";
    case "week":
      return "This Week";
    case "month":
      return "This Month";
    case "lastmonth":
      return "Last Month";
    case "custom":
      return "Custom";
  }
}

/** First value of a search param (Next may give string | string[]). */
export function first(
  v: string | string[] | undefined,
  fallback = ""
): string {
  if (Array.isArray(v)) return v[0] ?? fallback;
  return v ?? fallback;
}

function startOfDay(d: Date): Date {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

function toInputDate(d: Date): string {
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

function parseInputDate(v: string): Date | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(v.trim());
  if (!m) return null;
  const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  return Number.isNaN(d.getTime()) ? null : d;
}

export function fmtShort(d: Date | null | undefined): string {
  if (!d) return "—";
  return d.toLocaleDateString("en-PK", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

export function fmtDateTime(d: Date | null | undefined): string {
  if (!d) return "—";
  return d.toLocaleString("en-PK", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
}

export function parseReportRange(
  sp: Record<string, string | string[] | undefined>
): ReportRange {
  const raw = first(sp.preset);
  const preset: ReportPreset = (PRESETS as string[]).includes(raw)
    ? (raw as ReportPreset)
    : "month";

  const now = new Date();
  const today = startOfDay(now);
  const DAY = 86_400_000;
  let since: Date;
  let until: Date;

  switch (preset) {
    case "today":
      since = today;
      until = new Date(today.getTime() + DAY);
      break;
    case "yesterday":
      since = new Date(today.getTime() - DAY);
      until = today;
      break;
    case "week": {
      // Monday of the current week through today.
      const dow = (today.getDay() + 6) % 7; // 0 = Monday
      since = new Date(today.getTime() - dow * DAY);
      until = new Date(today.getTime() + DAY);
      break;
    }
    case "lastmonth":
      since = new Date(today.getFullYear(), today.getMonth() - 1, 1);
      until = new Date(today.getFullYear(), today.getMonth(), 1);
      break;
    case "custom": {
      const f = parseInputDate(first(sp.from));
      const t = parseInputDate(first(sp.to));
      if (f && t && f <= t) {
        since = startOfDay(f);
        until = new Date(startOfDay(t).getTime() + DAY);
      } else {
        // Invalid custom input: fall back to this month.
        since = new Date(today.getFullYear(), today.getMonth(), 1);
        until = new Date(today.getTime() + DAY);
      }
      break;
    }
    case "month":
    default:
      since = new Date(today.getFullYear(), today.getMonth(), 1);
      until = new Date(today.getTime() + DAY);
      break;
  }

  const from =
    preset === "custom" && first(sp.from)
      ? first(sp.from)
      : toInputDate(since);
  const to =
    preset === "custom" && first(sp.to)
      ? first(sp.to)
      : toInputDate(new Date(until.getTime() - 1));
  const label =
    preset === "custom"
      ? `${fmtShort(since)} → ${fmtShort(new Date(until.getTime() - 1))}`
      : presetLabel(preset);

  return { since, until, preset, from, to, label };
}
