import Link from "next/link";
import { eq, and, ilike, gte, lt, sql, desc } from "drizzle-orm";
import { db } from "@/db";
import { purchases, suppliers } from "@/db/schema";
import { requireSession } from "@/lib/auth";
import { formatPKR } from "@/lib/money";
import {
  PageHeader,
  LinkButton,
  Card,
  CardHeader,
  Badge,
  Table,
  Th,
  Td,
  EmptyState,
  Input,
  Select,
  Field,
  Button,
  Pagination,
} from "@/components/ui";

export const dynamic = "force-dynamic";

const PAGE_SIZE = 20;

function StatusBadge({ status }: { status: "PAID" | "PARTIAL" | "PENDING" }) {
  const tone =
    status === "PAID" ? "success" : status === "PARTIAL" ? "warning" : "danger";
  return <Badge tone={tone}>{status}</Badge>;
}

function fmtDate(d: Date) {
  return d.toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

type SearchParams = {
  q?: string;
  supplier?: string;
  status?: string;
  from?: string;
  to?: string;
  page?: string;
};

export default async function PurchasesPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const session = await requireSession();
  const sp = await searchParams;
  const isOwner = session.role === "OWNER";

  const q = (sp.q ?? "").trim();
  const supplierFilter = sp.supplier || "";
  const statusFilter = sp.status || "";
  const from = sp.from || "";
  const to = sp.to || "";
  const page = Math.max(1, parseInt(sp.page ?? "1", 10) || 1);

  const conditions = [eq(purchases.shopId, session.shopId)];
  if (supplierFilter) conditions.push(eq(purchases.supplierId, supplierFilter));
  if (statusFilter === "PAID" || statusFilter === "PARTIAL" || statusFilter === "PENDING") {
    conditions.push(eq(purchases.paymentStatus, statusFilter));
  }
  if (from) conditions.push(gte(purchases.purchaseDate, new Date(`${from}T00:00:00`)));
  if (to) {
    const end = new Date(`${to}T00:00:00`);
    end.setDate(end.getDate() + 1);
    conditions.push(lt(purchases.purchaseDate, end));
  }
  if (q) conditions.push(ilike(purchases.invoiceNumber, `%${q}%`));
  const where = and(...conditions);

  const [supplierOptions, countRows, rows] = await Promise.all([
    db
      .select({ id: suppliers.id, name: suppliers.name })
      .from(suppliers)
      .where(eq(suppliers.shopId, session.shopId))
      .orderBy(suppliers.name),
    db
      .select({ v: sql<number>`count(*)` })
      .from(purchases)
      .where(where),
    db
      .select({
        id: purchases.id,
        invoiceNumber: purchases.invoiceNumber,
        purchaseDate: purchases.purchaseDate,
        total: purchases.total,
        paidAmount: purchases.paidAmount,
        remaining: purchases.remaining,
        paymentStatus: purchases.paymentStatus,
        supplierName: suppliers.name,
      })
      .from(purchases)
      .leftJoin(suppliers, eq(purchases.supplierId, suppliers.id))
      .where(where)
      .orderBy(desc(purchases.purchaseDate))
      .limit(PAGE_SIZE)
      .offset((page - 1) * PAGE_SIZE),
  ]);

  const totalCount = Number(countRows[0]?.v ?? 0);
  const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE));

  const qs = new URLSearchParams();
  if (q) qs.set("q", q);
  if (supplierFilter) qs.set("supplier", supplierFilter);
  if (statusFilter) qs.set("status", statusFilter);
  if (from) qs.set("from", from);
  if (to) qs.set("to", to);

  const hasFilters = Boolean(q || supplierFilter || statusFilter || from || to);

  return (
    <div>
      <PageHeader
        title="Purchases"
        subtitle="Stock you bought from suppliers — recording a purchase adds stock automatically."
        actions={
          isOwner ? (
            <LinkButton href="/purchases/new" size="sm">
              + New Purchase
            </LinkButton>
          ) : undefined
        }
      />

      <Card className="mb-4">
        <form action="/purchases" method="get" className="grid gap-3 p-4 sm:grid-cols-2 lg:grid-cols-6">
          <Field label="Invoice no.">
            <Input name="q" defaultValue={q} placeholder="Search invoice…" className="h-8 text-sm" />
          </Field>
          <Field label="Supplier">
            <Select name="supplier" defaultValue={supplierFilter} className="h-8 text-sm">
              <option value="">All suppliers</option>
              {supplierOptions.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Payment status">
            <Select name="status" defaultValue={statusFilter} className="h-8 text-sm">
              <option value="">All</option>
              <option value="PAID">PAID</option>
              <option value="PARTIAL">PARTIAL</option>
              <option value="PENDING">PENDING</option>
            </Select>
          </Field>
          <Field label="From">
            <Input name="from" type="date" defaultValue={from} className="h-8 text-sm" />
          </Field>
          <Field label="To">
            <Input name="to" type="date" defaultValue={to} className="h-8 text-sm" />
          </Field>
          <div className="flex items-end gap-2">
            <Button type="submit" size="sm">
              Filter
            </Button>
            {hasFilters && (
              <LinkButton href="/purchases" variant="ghost" size="sm">
                Clear
              </LinkButton>
            )}
          </div>
        </form>
      </Card>

      {rows.length === 0 ? (
        <EmptyState
          title={hasFilters ? "No purchases found" : "No purchases yet"}
          message={
            hasFilters
              ? "No invoices match these filters. Try widening the date range or clearing a filter."
              : "Record your first purchase to add stock and track what you owe suppliers."
          }
          action={
            isOwner && !hasFilters ? (
              <LinkButton href="/purchases/new">+ New Purchase</LinkButton>
            ) : undefined
          }
        />
      ) : (
        <Card>
          <CardHeader
            title="Purchase invoices"
            subtitle={`${totalCount.toLocaleString()} invoice${totalCount === 1 ? "" : "s"}`}
          />
          <Table>
            <thead>
              <tr>
                <Th>Invoice</Th>
                <Th>Date</Th>
                <Th>Supplier</Th>
                <Th className="text-right">Total</Th>
                <Th className="text-right">Paid</Th>
                <Th className="text-right">Remaining</Th>
                <Th>Status</Th>
              </tr>
            </thead>
            <tbody>
              {rows.map((p) => (
                <tr key={p.id} className="hover:bg-slate-50">
                  <Td>
                    <Link
                      href={`/purchases/${p.id}`}
                      className="font-medium text-blue-700 hover:underline"
                    >
                      {p.invoiceNumber}
                    </Link>
                  </Td>
                  <Td className="whitespace-nowrap">{fmtDate(p.purchaseDate)}</Td>
                  <Td>{p.supplierName ?? "—"}</Td>
                  <Td className="text-right font-medium tabular-nums">
                    {formatPKR(p.total)}
                  </Td>
                  <Td className="text-right tabular-nums">{formatPKR(p.paidAmount)}</Td>
                  <Td
                    className={`text-right tabular-nums ${
                      p.remaining > 0 ? "font-medium text-red-700" : "text-slate-500"
                    }`}
                  >
                    {formatPKR(p.remaining)}
                  </Td>
                  <Td>
                    <StatusBadge status={p.paymentStatus} />
                  </Td>
                </tr>
              ))}
            </tbody>
          </Table>
          <Pagination
            page={page}
            totalPages={totalPages}
            basePath="/purchases"
            query={qs.toString()}
          />
        </Card>
      )}
    </div>
  );
}
