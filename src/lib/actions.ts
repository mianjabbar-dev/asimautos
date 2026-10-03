/**
 * Standard result shape for server actions + error mapping.
 * Server actions should catch and return ActionResult (never throw to the UI,
 * except redirect()).
 */
import { AuthError, ForbiddenError } from "./auth";
import { BusinessError, InsufficientStockError } from "./tx";
import { ZodError } from "zod";

export type ActionResult =
  | { ok: true; message?: string; id?: string }
  | { ok: false; message: string };

export function ok(message?: string, id?: string): ActionResult {
  return { ok: true, message, id };
}

export function fail(message: string): ActionResult {
  return { ok: false, message };
}

/** Map known domain errors to friendly messages. */
export function toResult(e: unknown): ActionResult {
  if (e instanceof InsufficientStockError) return fail(e.message);
  if (e instanceof BusinessError) return fail(e.message);
  if (e instanceof ForbiddenError) return fail(e.message);
  if (e instanceof AuthError) return fail("Please log in again.");
  if (e instanceof ZodError) {
    const first = e.issues[0];
    return fail(first ? `${first.path.join(".")}: ${first.message}` : "Invalid input.");
  }
  const msg = e instanceof Error ? e.message : String(e);
  if (/unique|duplicate/i.test(msg)) {
    if (/sku/i.test(msg)) return fail("This SKU already exists for your shop.");
    if (/barcode/i.test(msg)) return fail("This barcode already exists for your shop.");
    if (/invoice/i.test(msg)) return fail("This invoice number is already used.");
    if (/email/i.test(msg)) return fail("This email is already registered.");
    return fail("A record with these details already exists.");
  }
  if (/foreign key|violates/i.test(msg)) {
    return fail("Cannot delete: this record is used by other transactions.");
  }
  console.error("[action error]", e);
  return fail("Something went wrong. Please try again.");
}
