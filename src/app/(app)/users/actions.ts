"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { and, count, eq } from "drizzle-orm";
import { db } from "@/db";
import { auditLogs, users } from "@/db/schema";
import { ForbiddenError, hashPassword, requireRole } from "@/lib/auth";
import { ok, toResult, type ActionResult } from "@/lib/actions";
import { userSchema } from "@/lib/validators";

/* ------------------------------------------------------------------ */
/* Helpers                                                             */
/* ------------------------------------------------------------------ */

async function writeAudit(input: {
  shopId: string;
  actorId: string;
  action: string;
  entityId: string;
  oldValue?: Record<string, unknown> | null;
  newValue?: Record<string, unknown> | null;
}): Promise<void> {
  await db.insert(auditLogs).values({
    shopId: input.shopId,
    userId: input.actorId,
    action: input.action,
    entity: "user",
    entityId: input.entityId,
    oldValue: input.oldValue ?? null,
    newValue: input.newValue ?? null,
  });
}

/** Fetch a user strictly scoped to the current shop. */
async function getTarget(shopId: string, id: string) {
  const [target] = await db
    .select()
    .from(users)
    .where(and(eq(users.id, id), eq(users.shopId, shopId)))
    .limit(1);
  return target;
}

async function activeOwnerCount(shopId: string): Promise<number> {
  const [row] = await db
    .select({ v: count() })
    .from(users)
    .where(
      and(
        eq(users.shopId, shopId),
        eq(users.role, "OWNER"),
        eq(users.active, true)
      )
    );
  return Number(row?.v ?? 0);
}

/** Row actions surface feedback through a redirect message banner. */
function done(message: string, tone: "success" | "error"): never {
  revalidatePath("/users");
  redirect(`/users?message=${encodeURIComponent(message)}&tone=${tone}`);
}

/* ------------------------------------------------------------------ */
/* Actions                                                             */
/* ------------------------------------------------------------------ */

/** Create a user (used with useActionState from /users/new). */
export async function createUser(
  _prevState: ActionResult,
  formData: FormData
): Promise<ActionResult> {
  try {
    const session = await requireRole("OWNER");
    const parsed = userSchema.parse({
      name: formData.get("name"),
      email: formData.get("email"),
      password: formData.get("password"),
      role: formData.get("role"),
    });
    const passwordHash = await hashPassword(parsed.password);
    const [created] = await db
      .insert(users)
      .values({
        shopId: session.shopId,
        name: parsed.name,
        email: parsed.email, // normalized to lowercase by userSchema
        passwordHash,
        role: parsed.role,
        active: true,
      })
      .returning({ id: users.id });
    await writeAudit({
      shopId: session.shopId,
      actorId: session.id,
      action: "USER_CREATED",
      entityId: created.id,
      newValue: { name: parsed.name, email: parsed.email, role: parsed.role },
    });
    revalidatePath("/users");
    return ok("User created successfully.");
  } catch (e) {
    return toResult(e);
  }
}

/** Toggle a user's active flag. Owners cannot deactivate themselves. */
export async function toggleUserActive(formData: FormData): Promise<never> {
  try {
    const session = await requireRole("OWNER");
    const id = String(formData.get("id") ?? "");
    if (id === session.id) {
      throw new ForbiddenError("You cannot deactivate your own account.");
    }
    const target = await getTarget(session.shopId, id);
    if (!target) throw new Error("User not found.");
    const newActive = !target.active;
    await db
      .update(users)
      .set({ active: newActive, updatedAt: new Date() })
      .where(eq(users.id, id));
    await writeAudit({
      shopId: session.shopId,
      actorId: session.id,
      action: newActive ? "USER_ACTIVATED" : "USER_DEACTIVATED",
      entityId: id,
      oldValue: { active: target.active },
      newValue: { active: newActive },
    });
    done(
      newActive ? `${target.name} is now active.` : `${target.name} is now inactive.`,
      "success"
    );
  } catch (e) {
    const r = toResult(e);
    done(r.ok ? "Done." : r.message, "error");
  }
}

/** Change a user's role. Owners cannot change their own role, and the last
 *  active owner cannot be demoted. */
export async function changeUserRole(formData: FormData): Promise<never> {
  try {
    const session = await requireRole("OWNER");
    const id = String(formData.get("id") ?? "");
    const role = String(formData.get("role") ?? "");
    if (role !== "OWNER" && role !== "STAFF") {
      throw new Error("Invalid role selected.");
    }
    if (id === session.id) {
      throw new ForbiddenError("You cannot change your own role.");
    }
    const target = await getTarget(session.shopId, id);
    if (!target) throw new Error("User not found.");
    if (target.role === "OWNER" && role === "STAFF" && target.active) {
      const owners = await activeOwnerCount(session.shopId);
      if (owners <= 1) {
        throw new ForbiddenError("Cannot demote the last active owner.");
      }
    }
    if (target.role !== role) {
      await db
        .update(users)
        .set({ role: role as "OWNER" | "STAFF", updatedAt: new Date() })
        .where(eq(users.id, id));
      await writeAudit({
        shopId: session.shopId,
        actorId: session.id,
        action: "USER_ROLE_CHANGED",
        entityId: id,
        oldValue: { role: target.role },
        newValue: { role },
      });
    }
    done(`${target.name} is now ${role}.`, "success");
  } catch (e) {
    const r = toResult(e);
    done(r.ok ? "Done." : r.message, "error");
  }
}

/** Delete a user. Cannot delete yourself or the last active owner. */
export async function deleteUser(formData: FormData): Promise<never> {
  try {
    const session = await requireRole("OWNER");
    const id = String(formData.get("id") ?? "");
    if (id === session.id) {
      throw new ForbiddenError("You cannot delete your own account.");
    }
    const target = await getTarget(session.shopId, id);
    if (!target) throw new Error("User not found.");
    if (target.role === "OWNER" && target.active) {
      const owners = await activeOwnerCount(session.shopId);
      if (owners <= 1) {
        throw new ForbiddenError(
          "Cannot delete the last active owner of this shop."
        );
      }
    }
    await db.delete(users).where(eq(users.id, id));
    await writeAudit({
      shopId: session.shopId,
      actorId: session.id,
      action: "USER_DELETED",
      entityId: id,
      oldValue: {
        name: target.name,
        email: target.email,
        role: target.role,
      },
    });
    done(`${target.name} has been deleted.`, "success");
  } catch (e) {
    const r = toResult(e);
    done(r.ok ? "Done." : r.message, "error");
  }
}
