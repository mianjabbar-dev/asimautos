/**
 * /sales — sales list with date range, payment-method and invoice search
 * filters + pagination.
 */
import { and, eq, ilike, or, desc, sql, gte, lte } from "drizzle-orm";
import { db } from "@/db";
import { sales, customers } from "@/db/schema";
import { requireSession } from "@/lib/auth";
import { formatPKR } from "@/lib/money";
import {
  PageHeader,
  LinkButton,
  Card,
  Table,
  Th,
  Td,
  Badge,
  EmptyState,
  Pagination,
  Input,
  Select,
  Field,
  Button,
} from "@/components/ui";
import Link from "next/link";

const PAGE_SIZE = 20;

const METHOD_TONE: Record<string, "success" | "info" | "warning" | "default"> = {
  CASH: "success",
  BANK: "info",
  CREDIT: "warning",
  OTHER: "default",
};

const METHOD_LABEL: Record<string, string> = {
  CASH: "Cash",
  BANK: "Bank Transfer",
  CREDIT: "Credit",
  OTHER: "Other",
};

const STATUS_TONE: Record<string, "success" | "warning" | "danger"> = {
  PAID: "success",
  PARTIAL: "warning",
  PENDING: "danger",
};

type Filters = {
  q?: string;
  from?: string;
  to?: string;
  method?: string;
  page?: string;
};

export default async function SalesPage({
  searchParams,
}: {
  searchParams: Promise<Filters>;
}) {
  const session = await requireSession();
  const f = await searchParams;

  const page = Math.max(1, parseInt(f.page ?? "1", 10) || 1);
  const conditions = [eq(sales.shopId, session.shopId)];

  if (f.q?.trim()) {
    const like = `%${f.q.trim()}%`;
    conditions.push(
      or(ilike(sales.invoiceNumber, like), ilike(customers.name, like))!
    );
  }
  if (f.from) {
    const d = new Date(`${f.from}T00:00:00`);
    if (!isNaN(d.getTime())) conditions.push(gte(sales.saleDate, d));
  }
  if (f.to) {
    const d = new Date(`${f.to}T23:59:59`);
    if (!isNaN(d.getTime())) conditions.push(lte(sales.saleDate, d));
  }
  if (f.method && ["CASH", "BANK", "CREDIT", "OTHER"].includes(f.method)) {
    conditions.push(
      eq(sales.paymentMethod, f.method as "CASH" | "BANK" | "CREDIT" | "OTHER")
    );
  }

  const where = and(...conditions);

  const [rows, countRows] = await Promise.all([
    db
      .select({
        id: sales.id,
        invoiceNumber: sales.invoiceNumber,
        saleDate: sales.saleDate,
        customerName: customers.name,
        total: sales.total,
        paidAmount: sales.paidAmount,
        remaining: sales.remaining,
        paymentMethod: sales.paymentMethod,
        paymentStatus: sales.paymentStatus,
      })
      .from(sales)
      .leftJoin(customers, eq(sales.customerId, customers.id))
      .where(where)
      .orderBy(desc(sales.saleDate))
      .limit(PAGE_SIZE)
      .offset((page - 1) * PAGE_SIZE),
    db
      .select({ v: sql<number>`count(*)` })
      .from(sales)
      .leftJoin(customers, eq(sales.customerId, customers.id))
      .where(where),
  ]);

  const total = Number(countRows[0]?.v ?? 0);
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  const queryParts: string[] = [];
  if (f.q) queryParts.push(`q=${encodeURIComponent(f.q)}`);
  if (f.from) queryParts.push(`from=${encodeURIComponent(f.from)}`);
  if (f.to) queryParts.push(`to=${encodeURIComponent(f.to)}`);
  if (f.method) queryParts.push(`method=${encodeURIComponent(f.method)}`);
  const query = queryParts.join("&");

  return (
    <div>
      <PageHeader
        title="Sales"
        subtitle="Invoices, payments and balances"
        actions={
          <LinkButton href="/sales/new" size="lg">
            🧾 New Sale (POS)
          </LinkButton>
        }
      />

      <Card className="mb-4 p-4">
        <form method="GET" action="/sales" className="grid gap-3 sm:grid-cols-5">
          <Field label="Search invoice / customer">
            <Input
              name="q"
              defaultValue={f.q ?? ""}
              placeholder="Invoice no or customer…"
            />
          </Field>
          <Field label="From date">
            <Input name="from" type="date" defaultValue={f.from ?? ""} />
          </Field>
          <Field label="To date">
            <Input name="to" type="date" defaultValue={f.to ?? ""} />
          </Field>
          <Field label="Payment method">
            <Select name="method" defaultValue={f.method ?? ""}>
              <option value="">All</option>
              <option value="CASH">Cash</option>
              <option value="BANK">Bank Transfer</option>
              <option value="CREDIT">Credit</option>
              <option value="OTHER">Other</option>
            </Select>
          </Field>
          <div className="flex items-end gap-2">
            <Button type="submit" variant="secondary">
              Filter
            </Button>
            <LinkButton href="/sales" variant="ghost">
              Clear
            </LinkButton>
          </div>
        </form>
      </Card>

      {rows.length === 0 ? (
        <EmptyState
          title="No sales found"
          message={
            f.q || f.from || f.to || f.method
              ? "Try adjusting your filters."
              : "No sales recorded yet. Start a new sale from the POS screen."
          }
          action={<LinkButton href="/sales/new">New Sale (POS)</LinkButton>}
        />
      ) : (
        <Card>
          <Table>
            <thead>
              <tr>
                <Th>Invoice</Th>
                <Th>Date</Th>
                <Th>Customer</Th>
                <Th className="text-right">Total</Th>
                <Th className="text-right">Paid</Th>
                <Th className="text-right">Remaining</Th>
                <Th>Method</Th>
                <Th>Status</Th>
              </tr>
            </thead>
            <tbody>
              {rows.map((s) => (
                <tr key={s.id} className="hover:bg-slate-50">
                  <Td>
                    <Link
                      href={`/sales/${s.id}`}
                      className="font-semibold text-blue-700 hover:underline"
                    >
                      {s.invoiceNumber}
                    </Link>
                  </Td>
                  <Td className="whitespace-nowrap">
                    {new Date(s.saleDate).toLocaleDateString("en-PK", {
                      day: "2-digit",
                      month: "short",
                      year: "numeric",
                    })}
                  </Td>
                  <Td>{s.customerName ?? "Walk-in"}</Td>
                  <Td className="text-right tabular-nums">{formatPKR(s.total)}</Td>
                  <Td className="text-right tabular-nums">
                    {formatPKR(s.paidAmount)}
                  </Td>
                  <Td
                    className={`text-right tabular-nums font-medium ${
                      s.remaining > 0 ? "text-red-700" : "text-slate-500"
                    }`}
                  >
                    {formatPKR(s.remaining)}
                  </Td>
                  <Td>
                    <Badge tone={METHOD_TONE[s.paymentMethod] ?? "default"}>
                      {METHOD_LABEL[s.paymentMethod] ?? s.paymentMethod}
                    </Badge>
                  </Td>
                  <Td>
                    <Badge tone={STATUS_TONE[s.paymentStatus] ?? "default"}>
                      {s.paymentStatus}
                    </Badge>
                  </Td>
                </tr>
              ))}
            </tbody>
          </Table>
          <Pagination page={page} totalPages={totalPages} basePath="/sales" query={query} />
        </Card>
      )}
    </div>
  );
}
