/**
 * /reports/stock-movements — the full stock ledger with filters:
 * product search, movement type, date range. Paginated (25/page).
 */
import { and, desc, eq, gte, ilike, lt, sql, type SQL } from "drizzle-orm";
import { db } from "@/db";
import { stockMovements, products, users } from "@/db/schema";
import { requireSession } from "@/lib/auth";
import {
  Badge,
  Button,
  Card,
  EmptyState,
  Field,
  Input,
  LinkButton,
  PageHeader,
  Pagination,
  Select,
  Table,
  Td,
  Th,
} from "@/components/ui";
import { DateFilter } from "../date-filters";
import { ExportButtons, type ExportColumn } from "../export-buttons-client";
import { fmtDateTime, first, parseReportRange } from "../_lib";

export const dynamic = "force-dynamic";

const PAGE_SIZE = 25;

const MOVEMENT_TYPES = [
  "INITIAL",
  "PURCHASE",
  "SALE",
  "CUSTOMER_RETURN",
  "SUPPLIER_RETURN",
  "DAMAGE",
  "LOST",
  "ADJUSTMENT",
] as const;

function typeBadge(t: string) {
  const tone =
    t === "PURCHASE" || t === "CUSTOMER_RETURN" || t === "INITIAL"
      ? ("success" as const)
      : t === "SALE" || t === "SUPPLIER_RETURN"
        ? ("info" as const)
        : t === "DAMAGE" || t === "LOST"
          ? ("danger" as const)
          : ("default" as const);
  return <Badge tone={tone}>{t.replaceAll("_", " ")}</Badge>;
}

export default async function StockMovementsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const session = await requireSession();
  const shopId = session.shopId;
  const sp = await searchParams;
  const range = parseReportRange(sp);

  const page = Math.max(1, parseInt(first(sp.page, "1"), 10) || 1);
  const q = first(sp.q).trim();
  const rawType = first(sp.type);
  const type = (MOVEMENT_TYPES as readonly string[]).includes(rawType)
    ? rawType
    : "";

  const like = `%${q}%`;
  const conds: SQL[] = [
    eq(stockMovements.shopId, shopId),
    gte(stockMovements.createdAt, range.since),
    lt(stockMovements.createdAt, range.until),
  ];
  if (q) conds.push(ilike(products.name, like));
  if (type) conds.push(eq(stockMovements.type, type as (typeof MOVEMENT_TYPES)[number]));
  const where = and(...conds)!;

  const [countRows, rows] = await Promise.all([
    db
      .select({ v: sql<number>`count(*)` })
      .from(stockMovements)
      .innerJoin(products, eq(stockMovements.productId, products.id))
      .where(where),
    db
      .select({
        id: stockMovements.id,
        productName: products.name,
        previousQty: stockMovements.previousQty,
        changeQty: stockMovements.changeQty,
        newQty: stockMovements.newQty,
        type: stockMovements.type,
        note: stockMovements.note,
        userName: users.name,
        createdAt: stockMovements.createdAt,
      })
      .from(stockMovements)
      .innerJoin(products, eq(stockMovements.productId, products.id))
      .leftJoin(users, eq(stockMovements.userId, users.id))
      .where(where)
      .orderBy(desc(stockMovements.createdAt))
      .limit(PAGE_SIZE)
      .offset((page - 1) * PAGE_SIZE),
  ]);

  const total = Number(countRows[0]?.v ?? 0);
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  const qs = new URLSearchParams();
  for (const [k, v] of Object.entries(sp)) {
    if (k === "page") continue;
    const val = Array.isArray(v) ? v[0] : v;
    if (val) qs.set(k, val);
  }
  const query = qs.toString();

  const extra: Record<string, string> = {};
  if (q) extra.q = q;
  if (type) extra.type = type;

  const columns: ExportColumn[] = [
    { key: "date", label: "Date" },
    { key: "product", label: "Product" },
    { key: "type", label: "Type" },
    { key: "previous", label: "Previous qty" },
    { key: "change", label: "Change" },
    { key: "new", label: "New qty" },
    { key: "by", label: "By" },
    { key: "note", label: "Note" },
  ];
  const data = rows.map((r) => ({
    date: fmtDateTime(r.createdAt),
    product: r.productName,
    type: r.type.replaceAll("_", " "),
    previous: String(r.previousQty),
    change: (r.changeQty >= 0 ? "+" : "") + r.changeQty,
    new: String(r.newQty),
    by: r.userName ?? "—",
    note: r.note ?? "",
  }));

  return (
    <div>
      <PageHeader
        title="Stock Movements"
        subtitle={`${range.label} · ${total.toLocaleString()} movement${total === 1 ? "" : "s"}`}
        actions={
          <ExportButtons data={data} filename="stock-movements" columns={columns} />
        }
      />

      <div className="mb-4">
        <DateFilter
          basePath="/reports/stock-movements"
          preset={range.preset}
          from={range.from}
          to={range.to}
          extra={extra}
        />
      </div>

      <form
        method="get"
        action="/reports/stock-movements"
        className="mb-4 flex flex-wrap items-end gap-2"
      >
        <input type="hidden" name="preset" value={range.preset} />
        <input type="hidden" name="from" value={range.from} />
        <input type="hidden" name="to" value={range.to} />
        <Field label="Product">
          <Input
            name="q"
            defaultValue={q}
            placeholder="Product name…"
            className="w-52"
          />
        </Field>
        <Field label="Movement type">
          <Select name="type" defaultValue={type}>
            <option value="">All types</option>
            {MOVEMENT_TYPES.map((t) => (
              <option key={t} value={t}>
                {t.replaceAll("_", " ")}
              </option>
            ))}
          </Select>
        </Field>
        <Button type="submit">Apply</Button>
        {(q || type) && (
          <LinkButton
            href={`/reports/stock-movements?preset=${range.preset}&from=${range.from}&to=${range.to}`}
            variant="ghost"
          >
            Clear
          </LinkButton>
        )}
      </form>

      <Card>
        {rows.length === 0 ? (
          <div className="p-4">
            <EmptyState
              title="No movements found"
              message="No stock changes match these filters. Try a different date range."
            />
          </div>
        ) : (
          <>
            <Table>
              <thead>
                <tr>
                  <Th>Date</Th>
                  <Th>Product</Th>
                  <Th>Type</Th>
                  <Th className="text-right">Previous</Th>
                  <Th className="text-right">Change</Th>
                  <Th className="text-right">New</Th>
                  <Th>By</Th>
                  <Th>Note</Th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.id}>
                    <Td className="whitespace-nowrap">{fmtDateTime(r.createdAt)}</Td>
                    <Td className="font-medium">{r.productName}</Td>
                    <Td>{typeBadge(r.type)}</Td>
                    <Td className="text-right tabular-nums">{r.previousQty}</Td>
                    <Td
                      className={`text-right font-semibold tabular-nums ${r.changeQty >= 0 ? "text-emerald-700" : "text-red-700"}`}
                    >
                      {r.changeQty >= 0 ? "+" : ""}
                      {r.changeQty}
                    </Td>
                    <Td className="text-right font-semibold tabular-nums">
                      {r.newQty}
                    </Td>
                    <Td className="text-slate-500">{r.userName ?? "—"}</Td>
                    <Td className="max-w-56 truncate text-slate-500">
                      <span title={r.note ?? ""}>{r.note ?? "—"}</span>
                    </Td>
                  </tr>
                ))}
              </tbody>
            </Table>
            <Pagination
              page={page}
              totalPages={totalPages}
              basePath="/reports/stock-movements"
              query={query}
            />
          </>
        )}
      </Card>
    </div>
  );
}
