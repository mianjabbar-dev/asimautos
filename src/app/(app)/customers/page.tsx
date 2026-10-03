/**
 * /customers — customer list with search, total purchased and outstanding
 * balance per customer.
 */
import { and, eq, ilike, or, desc, sql } from "drizzle-orm";
import Link from "next/link";
import { db } from "@/db";
import { customers, sales } from "@/db/schema";
import { requireSession } from "@/lib/auth";
import { formatPKR } from "@/lib/money";
import {
  PageHeader,
  LinkButton,
  Card,
  Table,
  Th,
  Td,
  EmptyState,
  Pagination,
  Input,
  Field,
  Button,
  FormMessage,
} from "@/components/ui";
import { ConfirmSubmit } from "@/components/ui-client";
import { deleteCustomerAction } from "./actions";

const PAGE_SIZE = 20;

export default async function CustomersPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; page?: string; error?: string; message?: string }>;
}) {
  const session = await requireSession();
  const { q, page: pageParam, error, message } = await searchParams;
  const page = Math.max(1, parseInt(pageParam ?? "1", 10) || 1);

  const conditions = [eq(customers.shopId, session.shopId)];
  if (q?.trim()) {
    const like = `%${q.trim()}%`;
    conditions.push(
      or(ilike(customers.name, like), ilike(customers.phone, like))!
    );
  }
  const where = and(...conditions);

  const [rows, countRows] = await Promise.all([
    db
      .select({
        id: customers.id,
        name: customers.name,
        phone: customers.phone,
        vehicle: customers.vehicle,
        totalPurchased: sql<number>`coalesce(sum(${sales.total}),0)`,
        outstanding: sql<number>`coalesce(sum(${sales.remaining}),0)`,
      })
      .from(customers)
      .leftJoin(
        sales,
        and(eq(sales.customerId, customers.id), eq(sales.shopId, session.shopId))
      )
      .where(where)
      .groupBy(customers.id, customers.name, customers.phone, customers.vehicle)
      .orderBy(desc(sql`coalesce(sum(${sales.remaining}),0)`), customers.name)
      .limit(PAGE_SIZE)
      .offset((page - 1) * PAGE_SIZE),
    db
      .select({ v: sql<number>`count(*)` })
      .from(customers)
      .where(where),
  ]);

  const total = Number(countRows[0]?.v ?? 0);
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const query = q ? `q=${encodeURIComponent(q)}` : "";

  return (
    <div>
      <PageHeader
        title="Customers"
        subtitle="Customer records, purchases and balances"
        actions={<LinkButton href="/customers/new">＋ New Customer</LinkButton>}
      />

      <Card className="mb-4 p-4">
        {(error || message) && (
          <div className="mb-3">
            <FormMessage message={error ?? message} tone={error ? "error" : "success"} />
          </div>
        )}
        <form method="GET" action="/customers" className="flex gap-2">
          <div className="flex-1">
            <Field label="Search">
              <Input
                name="q"
                defaultValue={q ?? ""}
                placeholder="Name or phone…"
              />
            </Field>
          </div>
          <div className="flex items-end gap-2">
            <Button type="submit" variant="secondary">
              Search
            </Button>
            <LinkButton href="/customers" variant="ghost">
              Clear
            </LinkButton>
          </div>
        </form>
      </Card>

      {rows.length === 0 ? (
        <EmptyState
          title="No customers found"
          message={
            q
              ? "Try a different search."
              : "Add your first customer to track their purchases and balances."
          }
          action={<LinkButton href="/customers/new">New Customer</LinkButton>}
        />
      ) : (
        <Card>
          <Table>
            <thead>
              <tr>
                <Th>Name</Th>
                <Th>Phone</Th>
                <Th>Vehicle</Th>
                <Th className="text-right">Total Purchased</Th>
                <Th className="text-right">Outstanding</Th>
                <Th className="text-right">Actions</Th>
              </tr>
            </thead>
            <tbody>
              {rows.map((c) => (
                <tr key={c.id} className="hover:bg-slate-50">
                  <Td>
                    <Link
                      href={`/customers/${c.id}`}
                      className="font-semibold text-blue-700 hover:underline"
                    >
                      {c.name}
                    </Link>
                  </Td>
                  <Td>{c.phone ?? "—"}</Td>
                  <Td>{c.vehicle ?? "—"}</Td>
                  <Td className="text-right tabular-nums">
                    {formatPKR(Number(c.totalPurchased ?? 0))}
                  </Td>
                  <Td
                    className={`text-right tabular-nums font-medium ${
                      Number(c.outstanding ?? 0) > 0
                        ? "text-red-700"
                        : "text-slate-500"
                    }`}
                  >
                    {formatPKR(Number(c.outstanding ?? 0))}
                  </Td>
                  <Td className="text-right">
                    <div className="flex justify-end gap-2">
                      <LinkButton
                        href={`/customers/${c.id}/edit`}
                        variant="secondary"
                        size="sm"
                      >
                        Edit
                      </LinkButton>
                      <form action={deleteCustomerAction}>
                        <input type="hidden" name="id" value={c.id} />
                        <input type="hidden" name="from" value="/customers" />
                        <ConfirmSubmit message={`Delete customer "${c.name}"? This cannot be undone.`}>
                          Delete
                        </ConfirmSubmit>
                      </form>
                    </div>
                  </Td>
                </tr>
              ))}
            </tbody>
          </Table>
          <Pagination page={page} totalPages={totalPages} basePath="/customers" query={query} />
        </Card>
      )}
    </div>
  );
}
