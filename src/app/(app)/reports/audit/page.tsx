/**
 * /reports/audit — audit log with action/entity text filters,
 * date range and pagination (25/page).
 */
import { and, desc, eq, gte, ilike, lt, sql, type SQL } from "drizzle-orm";
import { db } from "@/db";
import { auditLogs, users } from "@/db/schema";
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
import { ExportButtons, type ExportColumn } from "../export-buttons-client";
import { fmtDateTime, first, parseReportRange } from "../_lib";

export const dynamic = "force-dynamic";

const PAGE_SIZE = 25;

const ENTITIES = [
  "product",
  "sale",
  "purchase",
  "return",
  "customer",
  "supplier",
  "user",
  "settings",
];

function summarize(v: unknown): string {
  if (v === null || v === undefined) return "—";
  try {
    const s = JSON.stringify(v);
    return s.length > 140 ? s.slice(0, 137) + "…" : s;
  } catch {
    return "—";
  }
}

export default async function AuditLogPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const session = await requireSession();
  const shopId = session.shopId;
  const sp = await searchParams;
  const range = parseReportRange(sp);

  const page = Math.max(1, parseInt(first(sp.page, "1"), 10) || 1);
  const actionQ = first(sp.action).trim();
  const entity = ENTITIES.includes(first(sp.entity)) ? first(sp.entity) : "";

  const conds: SQL[] = [
    eq(auditLogs.shopId, shopId),
    gte(auditLogs.createdAt, range.since),
    lt(auditLogs.createdAt, range.until),
  ];
  if (actionQ) conds.push(ilike(auditLogs.action, `%${actionQ}%`));
  if (entity) conds.push(eq(auditLogs.entity, entity));
  const where = and(...conds)!;

  const [countRows, rows] = await Promise.all([
    db
      .select({ v: sql<number>`count(*)` })
      .from(auditLogs)
      .where(where),
    db
      .select({
        id: auditLogs.id,
        action: auditLogs.action,
        entity: auditLogs.entity,
        entityId: auditLogs.entityId,
        oldValue: auditLogs.oldValue,
        newValue: auditLogs.newValue,
        userName: users.name,
        createdAt: auditLogs.createdAt,
      })
      .from(auditLogs)
      .leftJoin(users, eq(auditLogs.userId, users.id))
      .where(where)
      .orderBy(desc(auditLogs.createdAt))
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

  const columns: ExportColumn[] = [
    { key: "date", label: "Date" },
    { key: "user", label: "User" },
    { key: "action", label: "Action" },
    { key: "entity", label: "Entity" },
    { key: "reference", label: "Reference ID" },
    { key: "changes", label: "Changes" },
  ];
  const data = rows.map((r) => ({
    date: fmtDateTime(r.createdAt),
    user: r.userName ?? "System",
    action: r.action,
    entity: r.entity,
    reference: r.entityId ?? "",
    changes: summarize(r.newValue ?? r.oldValue),
  }));

  return (
    <div>
      <PageHeader
        title="Audit Log"
        subtitle={`${range.label} · ${total.toLocaleString()} entr${total === 1 ? "y" : "ies"}`}
        actions={
          <ExportButtons data={data} filename="audit-log" columns={columns} />
        }
      />

      <form
        method="get"
        action="/reports/audit"
        className="mb-4 flex flex-wrap items-end gap-2"
      >
        <input type="hidden" name="preset" value="custom" />
        <input type="hidden" name="from" value={range.from} />
        <input type="hidden" name="to" value={range.to} />
        <Field label="Action contains">
          <Input
            name="action"
            defaultValue={actionQ}
            placeholder="e.g. SALE_CREATED"
            className="w-52"
          />
        </Field>
        <Field label="Entity">
          <Select name="entity" defaultValue={entity}>
            <option value="">All entities</option>
            {ENTITIES.map((e) => (
              <option key={e} value={e}>
                {e}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="From">
          <Input type="date" name="from" defaultValue={range.from} />
        </Field>
        <Field label="To">
          <Input type="date" name="to" defaultValue={range.to} />
        </Field>
        <Button type="submit">Apply</Button>
        {(actionQ || entity) && (
          <LinkButton
            href={`/reports/audit?preset=${range.preset}&from=${range.from}&to=${range.to}`}
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
              title="No audit entries"
              message="Nothing matches these filters. Actions are logged as you use the app."
            />
          </div>
        ) : (
          <>
            <Table>
              <thead>
                <tr>
                  <Th>Date</Th>
                  <Th>User</Th>
                  <Th>Action</Th>
                  <Th>Entity</Th>
                  <Th>Changes</Th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.id}>
                    <Td className="whitespace-nowrap">{fmtDateTime(r.createdAt)}</Td>
                    <Td className="text-slate-600">{r.userName ?? "System"}</Td>
                    <Td>
                      <Badge tone="info">{r.action.replaceAll("_", " ")}</Badge>
                    </Td>
                    <Td className="text-slate-600">{r.entity}</Td>
                    <Td className="max-w-72 truncate font-mono text-xs text-slate-500">
                      <span title={summarize(r.newValue ?? r.oldValue)}>
                        {summarize(r.newValue ?? r.oldValue)}
                      </span>
                    </Td>
                  </tr>
                ))}
              </tbody>
            </Table>
            <Pagination
              page={page}
              totalPages={totalPages}
              basePath="/reports/audit"
              query={query}
            />
          </>
        )}
      </Card>
    </div>
  );
}
