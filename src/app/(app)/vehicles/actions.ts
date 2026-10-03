"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { eq, and } from "drizzle-orm";
import { db } from "@/db";
import { vehicles } from "@/db/schema";
import { requireRole } from "@/lib/auth";
import { toResult, ok, fail, type ActionResult } from "@/lib/actions";
import { vehicleSchema } from "@/lib/validators";

function s(formData: FormData, name: string): string {
  const v = formData.get(name);
  return typeof v === "string" ? v : "";
}

/** "" means "not provided" for optional fields. */
function opt(formData: FormData, name: string): string | undefined {
  const v = s(formData, name);
  return v === "" ? undefined : v;
}

function parseVehicleForm(formData: FormData) {
  return vehicleSchema.safeParse({
    make: s(formData, "make"),
    model: s(formData, "model"),
    variant: s(formData, "variant"),
    yearFrom: opt(formData, "yearFrom"),
    yearTo: opt(formData, "yearTo"),
    engine: s(formData, "engine"),
    fuelType: s(formData, "fuelType"),
    notes: s(formData, "notes"),
  });
}

export async function createVehicleAction(
  _prev: ActionResult | undefined,
  formData: FormData
): Promise<ActionResult> {
  try {
    const session = await requireRole("OWNER");
    const parsed = parseVehicleForm(formData);
    if (!parsed.success) return toResult(parsed.error);
    const d = parsed.data;
    await db.insert(vehicles).values({
      shopId: session.shopId,
      make: d.make,
      model: d.model,
      variant: d.variant ?? null,
      yearFrom: d.yearFrom ?? null,
      yearTo: d.yearTo ?? null,
      engine: d.engine ?? null,
      fuelType: d.fuelType ?? null,
      notes: d.notes ?? null,
    });
    revalidatePath("/vehicles");
    return ok("Vehicle added.");
  } catch (e) {
    return toResult(e);
  }
}

export async function updateVehicleAction(
  _prev: ActionResult | undefined,
  formData: FormData
): Promise<ActionResult> {
  try {
    const session = await requireRole("OWNER");
    const id = s(formData, "id");
    if (!id) return fail("Missing vehicle id.");
    const parsed = parseVehicleForm(formData);
    if (!parsed.success) return toResult(parsed.error);
    const d = parsed.data;
    const [updated] = await db
      .update(vehicles)
      .set({
        make: d.make,
        model: d.model,
        variant: d.variant ?? null,
        yearFrom: d.yearFrom ?? null,
        yearTo: d.yearTo ?? null,
        engine: d.engine ?? null,
        fuelType: d.fuelType ?? null,
        notes: d.notes ?? null,
        updatedAt: new Date(),
      })
      .where(and(eq(vehicles.id, id), eq(vehicles.shopId, session.shopId)))
      .returning({ id: vehicles.id });
    if (!updated) return fail("Vehicle not found.");
    revalidatePath("/vehicles");
    return ok("Vehicle updated.");
  } catch (e) {
    return toResult(e);
  }
}

export async function deleteVehicleAction(formData: FormData) {
  const id = s(formData, "id");
  try {
    const session = await requireRole("OWNER");
    if (!id) throw new Error("Missing vehicle id.");
    const [existing] = await db
      .select({ id: vehicles.id, make: vehicles.make, model: vehicles.model })
      .from(vehicles)
      .where(and(eq(vehicles.id, id), eq(vehicles.shopId, session.shopId)))
      .limit(1);
    if (!existing) throw new Error("Vehicle not found.");
    // product_vehicles FKs are ON DELETE CASCADE, so linked products only
    // lose this compatibility link — still verify the record is ours.
    await db
      .delete(vehicles)
      .where(and(eq(vehicles.id, id), eq(vehicles.shopId, session.shopId)));
    revalidatePath("/vehicles");
  } catch (e) {
    const r = toResult(e);
    redirect(
      "/vehicles?error=" +
        encodeURIComponent(r.ok ? "Something went wrong." : r.message)
    );
  }
  redirect("/vehicles?message=" + encodeURIComponent("Vehicle deleted."));
}
