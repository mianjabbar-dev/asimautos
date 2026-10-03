import Link from "next/link";
import { and, desc, eq, sql } from "drizzle-orm";
import { db } from "@/db";
import { notifications, type Notification } from "@/db/schema";
import { requireSession } from "@/lib/auth";
import {
  Badge,
  Button,
  Card,
  CardHeader,
  EmptyState,
  LinkButton,
  PageHeader,
  Table,
  Td,
  Th,
} from "@/components/ui";
import { cn } from "@/lib/cn";
import { markAllAsRead, markOneAsRead } from "./actions";

type Props = {
  searchParams: Promise<{ filter?: string }>;
};

const TYPE_META: Record<
  Notification["type"],
  { label: string; tone: "warning" | "danger" | "info" | "default" }
> = {
  LOW_STOCK: { label: "Low stock", tone: "warning" },
  OUT_OF_STOCK: { label: "Out of stock", tone: "danger" },
  SUPPLIER_PAYMENT: { label: "Supplier payment", tone: "info" },
  INFO: { label: "Info", tone: "default" },
};

function formatTime(d: Date): string {
  return new Date(d).toLocaleString("en-GB", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default async function NotificationsPage({ searchParams }: Props) {
  const session = await requireSession();
  const { filter } = await searchParams;
  const unreadOnly = filter === "unread";

  const shopScope = eq(notifications.shopId, session.shopId);
  const rows = await db
    .select()
    .from(notifications)
    .where(unreadOnly ? and(shopScope, eq(notifications.isRead, false)) : shopScope)
    .orderBy(desc(notifications.createdAt))
    .limit(100);

  const [unreadRow] = await db
    .select({ v: sql<number>`count(*)` })
    .from(notifications)
    .where(and(shopScope, eq(notifications.isRead, false)));
  const unreadCount = Number(unreadRow?.v ?? 0);

  const tabCls = (active: boolean) =>
    cn(
      "inline-flex h-8 items-center rounded-lg px-3 text-sm font-medium transition-colors",
      active
        ? "bg-slate-900 text-white"
        : "bg-white text-slate-700 border border-slate-300 hover:bg-slate-50"
    );

  return (
    <div className="space-y-4">
      <PageHeader
        title="Notifications"
        subtitle="Stock alerts, supplier payments and shop updates."
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <Link href="/notifications" className={tabCls(!unreadOnly)}>
              All
            </Link>
            <Link
              href="/notifications?filter=unread"
              className={tabCls(unreadOnly)}
            >
              Unread{unreadCount > 0 ? ` (${unreadCount})` : ""}
            </Link>
            <form action={markAllAsRead}>
              <input
                type="hidden"
                name="filter"
                value={unreadOnly ? "unread" : "all"}
              />
              <Button
                type="submit"
                size="sm"
                variant="secondary"
                disabled={unreadCount === 0}
              >
                Mark all as read
              </Button>
            </form>
          </div>
        }
      />

      <Card>
        <CardHeader
          title={unreadOnly ? "Unread notifications" : "All notifications"}
          subtitle={`Showing up to 100, newest first`}
        />
        {rows.length === 0 ? (
          <div className="p-4 sm:p-5">
            <EmptyState
              title={unreadOnly ? "All caught up" : "No notifications"}
              message={
                unreadOnly
                  ? "There are no unread notifications."
                  : "Nothing to show yet. Stock alerts and updates will appear here."
              }
            />
          </div>
        ) : (
          <Table>
            <thead>
              <tr>
                <Th>Type</Th>
                <Th>Notification</Th>
                <Th>Time</Th>
                <Th className="text-right">Actions</Th>
              </tr>
            </thead>
            <tbody>
              {rows.map((n) => {
                const meta = TYPE_META[n.type];
                return (
                  <tr
                    key={n.id}
                    className={cn(!n.isRead && "bg-blue-50/40")}
                  >
                    <Td>
                      <Badge tone={meta.tone}>{meta.label}</Badge>
                    </Td>
                    <Td>
                      <div className="flex items-start gap-2">
                        {!n.isRead && (
                          <span
                            className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-blue-600"
                            aria-label="Unread"
                          />
                        )}
                        <div>
                          <p
                            className={cn(
                              "text-slate-900",
                              !n.isRead && "font-semibold"
                            )}
                          >
                            {n.title}
                          </p>
                          {n.message && (
                            <p className="mt-0.5 text-sm text-slate-500">
                              {n.message}
                            </p>
                          )}
                        </div>
                      </div>
                    </Td>
                    <Td className="whitespace-nowrap text-slate-600">
                      {formatTime(n.createdAt)}
                    </Td>
                    <Td>
                      <div className="flex items-center justify-end gap-2">
                        {n.link && (
                          <LinkButton href={n.link} size="sm" variant="secondary">
                            View
                          </LinkButton>
                        )}
                        {!n.isRead && (
                          <form action={markOneAsRead}>
                            <input type="hidden" name="id" value={n.id} />
                            <input
                              type="hidden"
                              name="filter"
                              value={unreadOnly ? "unread" : "all"}
                            />
                            <Button type="submit" size="sm" variant="ghost">
                              Mark read
                            </Button>
                          </form>
                        )}
                      </div>
                    </Td>
                  </tr>
                );
              })}
            </tbody>
          </Table>
        )}
      </Card>
    </div>
  );
}
