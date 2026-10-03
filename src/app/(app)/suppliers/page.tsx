import Link from "next/link";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { suppliers } from "@/db/schema";
import { requireSession } from "@/lib/auth";
import { getSupplierBalances } from "@/lib/stats";
import { formatPKR } from "@/lib/money";
import {
  PageHeader,
  LinkButton,
  Card,
  Table,
  Th,
  Td,
  EmptyState,
  Input,
  Button,
} from "@/components/ui";

export const dynamic = "force-dynamic";

export default async function SuppliersPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const session = await requireSession();
  const { q } = await searchParams;
  const query = (q ?? "").trim().toLowerCase();
  const isOwner = session.role === "OWNER";

  const [rows, balances] = await Promise.all([
    db
      .select({
        id: suppliers.id,
        name: suppliers.name,
        contactPerson: suppliers.contactPerson,
        phone: suppliers.phone,
        city: suppliers.city,
      })
      .from(suppliers)
      .where(eq(suppliers.shopId, session.shopId))
      .orderBy(suppliers.name),
    getSupplierBalances(session.shopId),
  ]);

  const balanceById = new Map(balances.map((b) => [b.id, b]));
  const list = rows
    .map((s) => ({ ...s, outstanding: Number(balanceById.get(s.id)?.outstanding ?? 0) }))
    .filter(
      (s) =>
        !query ||
        s.name.toLowerCase().includes(query) ||
        (s.phone ?? "").toLowerCase().includes(query)
    );

  return (
    <div>
      <PageHeader
        title="Suppliers"
        subtitle="Everyone you buy stock from — balances update with every purchase and payment."
        actions={
          isOwner ? (
            <LinkButton href="/suppliers/new" size="sm">
              + New Supplier
            </LinkButton>
          ) : undefined
        }
      />

      <form action="/suppliers" method="get" className="mb-4 flex gap-2">
        <Input
          name="q"
          defaultValue={q ?? ""}
          placeholder="Search by name or phone…"
          className="max-w-sm"
        />
        <Button type="submit" variant="secondary">
          Search
        </Button>
        {query && (
          <LinkButton href="/suppliers" variant="ghost" size="md">
            Clear
          </LinkButton>
        )}
      </form>

      {list.length === 0 ? (
        <EmptyState
          title={query ? "No suppliers found" : "No suppliers yet"}
          message={
            query
              ? `Nothing matches "${q}". Try a different name or phone number.`
              : "Add your first supplier to start recording purchases and tracking what you owe."
          }
          action={
            isOwner && !query ? (
              <LinkButton href="/suppliers/new">+ New Supplier</LinkButton>
            ) : undefined
          }
        />
      ) : (
        <Card>
          <Table>
            <thead>
              <tr>
                <Th>Name</Th>
                <Th>Contact person</Th>
                <Th>Phone</Th>
                <Th>City</Th>
                <Th className="text-right">Outstanding</Th>
              </tr>
            </thead>
            <tbody>
              {list.map((s) => (
                <tr key={s.id} className="hover:bg-slate-50">
                  <Td>
                    <Link
                      href={`/suppliers/${s.id}`}
                      className="font-medium text-blue-700 hover:underline"
                    >
                      {s.name}
                    </Link>
                  </Td>
                  <Td>{s.contactPerson ?? "—"}</Td>
                  <Td className="whitespace-nowrap">{s.phone ?? "—"}</Td>
                  <Td>{s.city ?? "—"}</Td>
                  <Td
                    className={`text-right font-medium tabular-nums ${
                      s.outstanding > 0 ? "text-red-700" : "text-slate-500"
                    }`}
                  >
                    {formatPKR(s.outstanding)}
                  </Td>
                </tr>
              ))}
            </tbody>
          </Table>
        </Card>
      )}
    </div>
  );
}
