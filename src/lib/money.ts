/**
 * Money helpers. All monetary values are stored as INTEGER paisa in the DB.
 * 1 PKR = 100 paisa. Never use floats for money.
 */

/** Convert a PKR amount (e.g. 1250.50) to integer paisa. */
export function toPaisa(pkr: number | string): number {
  const n = typeof pkr === "string" ? parseFloat(pkr) : pkr;
  if (!Number.isFinite(n)) throw new Error(`Invalid money value: ${pkr}`);
  return Math.round(n * 100);
}

/** Convert integer paisa back to PKR as a number. */
export function fromPaisa(paisa: number): number {
  return paisa / 100;
}

/** Format integer paisa as "PKR 1,250.50". */
export function formatPKR(paisa: number | null | undefined): string {
  const v = (paisa ?? 0) / 100;
  return `PKR ${v.toLocaleString("en-PK", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

/** Compact format for dashboard cards, e.g. "PKR 1.25M". */
export function formatPKRCompact(paisa: number | null | undefined): string {
  const v = (paisa ?? 0) / 100;
  if (Math.abs(v) >= 1_000_000)
    return `PKR ${(v / 1_000_000).toFixed(2)}M`;
  if (Math.abs(v) >= 1_000) return `PKR ${(v / 1_000).toFixed(1)}K`;
  return formatPKR(paisa);
}

/** Parse a user-entered PKR string safely into paisa (throws on invalid). */
export function parsePaisaInput(input: string | number): number {
  if (typeof input === "number") return toPaisa(input);
  const cleaned = input.replace(/[,₨\s]/g, "").replace(/^PKR/i, "").trim();
  if (cleaned === "") return 0;
  return toPaisa(cleaned);
}
