/**
 * /sales/new — POS screen. Server wrapper loads the customer dropdown,
 * the heavy interactive UI lives in pos-client.tsx.
 */
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { customers } from "@/db/schema";
import { requireSession } from "@/lib/auth";
import { PageHeader } from "@/components/ui";
import { PosClient } from "./pos-client";

export default async function NewSalePage() {
  const session = await requireSession();
  const customerList = await db
    .select({ id: customers.id, name: customers.name, phone: customers.phone })
    .from(customers)
    .where(eq(customers.shopId, session.shopId))
    .orderBy(customers.name)
    .limit(500);

  return (
    <div>
      <PageHeader title="New Sale" subtitle="Point of sale — fast billing" />
      <PosClient customers={customerList} />
    </div>
  );
}
