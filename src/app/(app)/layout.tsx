import Link from "next/link";
import { redirect } from "next/navigation";
import { eq, and, sql } from "drizzle-orm";
import { getSession } from "@/lib/auth";
import { db } from "@/db";
import { notifications } from "@/db/schema";
import { logoutAction } from "./actions";
import { SearchBox, MobileMenu } from "@/components/app-shell-client";
import { cn } from "@/lib/cn";

/** All app pages are authenticated + data-driven: never prerender statically. */
export const dynamic = "force-dynamic";

type NavItem = { href: string; label: string; icon: string; ownerOnly?: boolean };

const NAV: NavItem[] = [
  { href: "/", label: "Dashboard", icon: "▦" },
  { href: "/sales", label: "Sales / POS", icon: "🧾" },
  { href: "/products", label: "Products", icon: "📦" },
  { href: "/categories", label: "Categories", icon: "🗂" },
  { href: "/vehicles", label: "Vehicles", icon: "🚗" },
  { href: "/suppliers", label: "Suppliers", icon: "🏭" },
  { href: "/purchases", label: "Purchases", icon: "🧮" },
  { href: "/inventory", label: "Inventory", icon: "📊" },
  { href: "/low-stock", label: "Low Stock", icon: "⚠️" },
  { href: "/out-of-stock", label: "Out of Stock", icon: "⛔" },
  { href: "/customers", label: "Customers", icon: "👥" },
  { href: "/reports", label: "Reports", icon: "📈" },
  { href: "/users", label: "Users & Staff", icon: "👤", ownerOnly: true },
  { href: "/notifications", label: "Notifications", icon: "🔔" },
  { href: "/settings", label: "Settings", icon: "⚙️", ownerOnly: true },
];

const BOTTOM_NAV = ["/", "/sales", "/products", "/inventory"];

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getSession();
  if (!session) redirect("/login");

  const visible = NAV.filter((n) => !n.ownerOnly || session.role === "OWNER");
  const bottomItems = BOTTOM_NAV.map(
    (href) => visible.find((v) => v.href === href)!
  ).filter(Boolean);

  const [unread] = await db
    .select({ v: sql<number>`count(*)` })
    .from(notifications)
    .where(
      and(
        eq(notifications.shopId, session.shopId),
        eq(notifications.isRead, false)
      )
    );
  const unreadCount = Number(unread?.v ?? 0);

  return (
    <div className="min-h-screen">
      {/* ---------- Desktop sidebar ---------- */}
      <aside className="no-print fixed inset-y-0 left-0 z-40 hidden w-60 flex-col border-r border-slate-200 bg-white lg:flex">
        <div className="flex items-center gap-3 border-b border-slate-100 px-5 py-4">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-900 text-sm font-black text-white">
            AA
          </div>
          <div>
            <p className="text-sm font-bold text-slate-900">ASIM AUTOS</p>
            <p className="text-xs text-slate-500">{session.role}</p>
          </div>
        </div>
        <nav className="flex-1 overflow-y-auto px-3 py-3">
          {visible.map((n) => (
            <NavLink key={n.href} item={n} />
          ))}
        </nav>
        <div className="border-t border-slate-100 p-3">
          <form action={logoutAction}>
            <button
              type="submit"
              className="w-full rounded-lg px-3 py-2 text-left text-sm font-medium text-slate-600 hover:bg-slate-100"
            >
              ⎋ Log out ({session.name})
            </button>
          </form>
        </div>
      </aside>

      {/* ---------- Topbar ---------- */}
      <header className="no-print sticky top-0 z-30 border-b border-slate-200 bg-white/95 backdrop-blur lg:pl-60">
        <div className="flex items-center gap-3 px-4 py-2.5">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-blue-900 text-xs font-black text-white lg:hidden">
            AA
          </div>
          <SearchBox />
          <Link
            href="/notifications"
            className="relative rounded-lg p-2.5 text-slate-600 hover:bg-slate-100"
            aria-label="Notifications"
          >
            <span className="text-xl">🔔</span>
            {unreadCount > 0 && (
              <span className="absolute -right-0.5 -top-0.5 flex h-5 min-w-5 items-center justify-center rounded-full bg-red-600 px-1 text-[11px] font-bold text-white">
                {unreadCount > 99 ? "99+" : unreadCount}
              </span>
            )}
          </Link>
        </div>
      </header>

      {/* ---------- Content ---------- */}
      <main className="px-4 py-5 pb-24 sm:px-6 lg:pl-66 lg:pr-8">
        <div className="mx-auto max-w-7xl">{children}</div>
      </main>

      {/* ---------- Mobile bottom nav ---------- */}
      <nav className="no-print fixed inset-x-0 bottom-0 z-40 border-t border-slate-200 bg-white lg:hidden">
        <div className="flex">
          {bottomItems.map((n) => (
            <Link
              key={n.href}
              href={n.href}
              className="flex flex-1 flex-col items-center gap-1 py-2 text-[11px] font-medium text-slate-500 active:text-blue-700"
            >
              <span className="text-lg">{n.icon}</span>
              {n.label.replace(" / POS", "")}
            </Link>
          ))}
          <MobileMenu items={visible} />
        </div>
      </nav>
    </div>
  );
}

function NavLink({ item }: { item: NavItem }) {
  return (
    <Link
      href={item.href}
      className={cn(
        "mb-0.5 flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-slate-600",
        "hover:bg-slate-100 hover:text-slate-900"
      )}
    >
      <span className="w-6 text-center text-base">{item.icon}</span>
      {item.label}
    </Link>
  );
}
