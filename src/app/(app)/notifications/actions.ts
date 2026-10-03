"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { notifications } from "@/db/schema";
import { requireSession } from "@/lib/auth";

/** Mark every unread notification for this shop as read. */
export async function markAllAsRead(formData: FormData): Promise<never> {
  const session = await requireSession();
  const filter = String(formData.get("filter") ?? "all");
  await db
    .update(notifications)
    .set({ isRead: true })
    .where(
      and(
        eq(notifications.shopId, session.shopId),
        eq(notifications.isRead, false)
      )
    );
  revalidatePath("/notifications");
  redirect(
    filter === "unread" ? "/notifications?filter=unread" : "/notifications"
  );
}

/** Mark a single notification as read (scoped to this shop). */
export async function markOneAsRead(formData: FormData): Promise<never> {
  const session = await requireSession();
  const id = String(formData.get("id") ?? "");
  const filter = String(formData.get("filter") ?? "all");
  await db
    .update(notifications)
    .set({ isRead: true })
    .where(
      and(eq(notifications.id, id), eq(notifications.shopId, session.shopId))
    );
  revalidatePath("/notifications");
  redirect(
    filter === "unread" ? "/notifications?filter=unread" : "/notifications"
  );
}
