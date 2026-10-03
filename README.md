# ASIM AUTOS — Auto Parts Management System

A production-ready inventory, sales, purchases and stock management web app for
**Asim Autos**, an auto spare parts shop in Faisalabad, Pakistan (currency: PKR).

**Stack:** Next.js 16 (App Router) · TypeScript · Tailwind CSS v4 · Drizzle ORM ·
PostgreSQL 16 · PWA (installable) · Vitest.

## Features

- **Dashboard** — 12 live stat cards (today's sales, month revenue, total products,
  low/out-of-stock, inventory value, purchases, returns, customers, suppliers,
  pending payments…), ACTION REQUIRED section with suggested purchases, recent
  sales/purchases, top sellers, slow movers, recent stock changes, notifications.
- **Products** — full catalog (SKU, part #, OEM #, barcode, purchase/sale price,
  stock, min/max/reorder, rack/shelf/bin location, images, active flag), vehicle
  compatibility (many-to-many), search/filter/sort/pagination.
- **Categories, Brands, Vehicles** — full CRUD with usage counts.
- **Suppliers** — profiles, outstanding balances, purchase history, products supplied.
- **Purchases** — create with dynamic line items, record supplier payments,
  payment status (Paid/Partial/Pending). Purchase **adds** stock.
- **Sales / POS** — fast touch-friendly point of sale, product search +
  camera/USB barcode scan, cart with quantity steppers, discounts, customer
  select, payment methods, credit sales. Sale **subtracts** stock and **blocks
  overselling** ("Insufficient stock. Only X units are available.").
- **Customers** — credit support, outstanding balances, payment tracking.
- **Returns** — customer returns (restock) and supplier returns (destock).
- **Inventory** — live stock table, owner-only manual adjustments (Damage/Lost/
  Adjustment) with reason + audit trail.
- **Low Stock / Out of Stock** — dedicated pages with rule-based, explainable
  reorder suggestions and one-click "Create Purchase" prefill.
- **Reports** — sales, purchases, inventory valuation (total + by
  category/brand/supplier), profit (GROSS PROFIT = sale price − purchase cost),
  stock movements, customer/supplier statements, top & slow movers, audit log —
  all with date filters and **CSV / Excel / PDF export**.
- **Global search** — name, SKU, part/OEM/barcode, brand, category, vehicle,
  rack, supplier; partial matching.
- **Invoices** — printable + PDF download, shop header from settings.
- **Users & Staff** — role-based (OWNER full access, STAFF restricted),
  server-side enforcement: staff cannot delete products, edit purchase prices,
  manage users/settings, or adjust stock.
- **Notifications** — low/out-of-stock and payment alerts stored in DB, unread count.
- **Audit log** — every stock change and admin action, who/when/what.
- **Settings** — shop profile, invoice prefix, tax rate, default stock levels.
- **PWA** — installable (manifest + icons + service worker + offline page).
- **Multi-tenant ready** — every shop-scoped table carries `shop_id`
  (Asim Autos = `ASIM001`); all queries and transaction functions are shop-scoped.

## Quick start (local)

### 1. Prerequisites

- Node.js 20+ and npm
- PostgreSQL 16 (see "Database setup" below)

### 2. Install & configure

```bash
git clone <your-repo-url> asim-autos
cd asim-autos
npm install
cp .env.example .env
# edit .env — set DATABASE_URL, AUTH_SECRET (32+ random chars), SEED_ADMIN_PASSWORD
```

Required env vars (see `.env.example`):

| Var | Example | Purpose |
|---|---|---|
| `DATABASE_URL` | `postgres://asim:secret@localhost:5432/asim_autos` | Postgres connection (pool) |
| `AUTH_SECRET` | 32+ random chars | Signs session JWTs |
| `NEXT_PUBLIC_APP_URL` | `http://localhost:3000` | Used in metadata/links |
| `SEED_ADMIN_PASSWORD` | (dev only) | Owner password created by the seed script |

### 3. Database setup

**Option A — local PostgreSQL (Ubuntu/Debian):**

```bash
sudo apt-get install -y postgresql
sudo -u postgres psql -c "CREATE ROLE asim WITH LOGIN PASSWORD 'choose-a-password';"
sudo -u postgres psql -c "CREATE DATABASE asim_autos OWNER asim;"
npm run db:generate   # create migration files (already committed under drizzle/)
npm run db:migrate    # apply migrations
npm run db:seed       # seed shop ASIM001: 54 products, 20 categories, 15 brands,
                      # 30 vehicles, 10 suppliers, 30 customers, sample transactions
```

**Option B — Neon (recommended for production/Vercel):**

1. Create a free project at https://neon.tech → copy the pooled connection string.
2. Set `DATABASE_URL` to the Neon string (in `.env` locally and in Vercel env vars).
3. Run `npm run db:migrate` once from your machine (it connects to Neon).

### 4. Run

```bash
npm run dev        # http://localhost:3000
# or production:
npm run build && npm start
```

### 5. Log in

Seeded accounts (dev only — change passwords after first login):

- **Owner:** `admin@asimautos.pk` / value of `SEED_ADMIN_PASSWORD` (default `Admin@12345`)
- **Staff:** `staff@asimautos.pk` / `Staff@12345`

To create the very first admin on a **fresh production DB** (no seed): run the seed
once (`npm run db:seed` creates the shop + owner), then change the password, or add
users via the Users page as the owner.

## Deploy to Vercel

1. Push this repo to GitHub.
2. Import the repo in Vercel → framework preset **Next.js**.
3. Add env vars in Vercel → Project → Settings → Environment Variables:
   `DATABASE_URL` (Neon pooled string), `AUTH_SECRET` (generate 32+ random chars),
   `NEXT_PUBLIC_APP_URL` (`https://your-app.vercel.app`).
4. Deploy. Then, from your machine: `DATABASE_URL=<neon-string> npm run db:migrate`
   (and `npm run db:seed` once for the initial shop + admin).
5. Log in and change the seeded passwords immediately.

## Testing

```bash
npm test            # 15 critical stock tests (vitest, real PostgreSQL)
npm run typecheck   # tsc --noEmit
npm run build       # production build
```

### Critical stock tests (all 15 pass)

Against a real database via the app's own transaction functions (`src/lib/tx.ts`):

1. Sell 2 from stock 10 → stock becomes 8
2. Purchase 20 → stock increases correctly
3. Stock ≤ minimum → classified **LOW STOCK**
4. Sell all remaining → **OUT OF STOCK** (0)
5. Oversell attempt → blocked with *"Insufficient stock. Only X units are available."*, stock unchanged
6. Customer return → stock increases
7. Supplier return → stock decreases
8. Manual adjustment → writes stock_movements row + audit log
9. Staff attempts purchase/adjustment/supplier-return → denied server-side (`ForbiddenError`); staff sale still works
10. Search by part number → correct product
11. Search by vehicle (e.g. Corolla) → compatible products
12. Purchase → supplier balance + inventory update; payment reduces balance
13. Credit sale → customer outstanding balance updates
14. Payment against customer balance → outstanding decreases
15. Multi-tenant isolation — second shop's data invisible; cross-shop product ids rejected

## Project structure

```
src/
  app/
    login/            # login page + action
    (app)/            # authenticated group (sidebar + mobile bottom nav)
      page.tsx        # dashboard
      products/ categories/ brands/ vehicles/
      suppliers/ purchases/
      sales/          # POS + invoice
      customers/ returns/
      inventory/ low-stock/ out-of-stock/
      reports/        # 10 reports + CSV/Excel/PDF export
      users/ notifications/ settings/
      search/         # global search results
    offline/          # PWA offline fallback
  components/         # ui.tsx (server-safe kit), ui-client.tsx, app-shell-client.tsx
  db/                 # schema.ts, index.ts, seed.ts
  lib/                # auth.ts, tx.ts (transaction engine), validators.ts,
                      # money.ts, stats.ts, search.ts, actions.ts
drizzle/              # committed migrations
tests/                # critical-stock.test.ts
public/               # manifest, icons, service worker
```

## Key design decisions

- **Money as integer paisa** — never floats; `formatPKR()` renders `PKR 1,250`.
- **Stock only moves via transactions** — purchases, sales, returns, adjustments.
  Every change writes a `stock_movements` row (prev/change/new, type, reference,
  user, note) and an `audit_logs` row. Negative stock is impossible: sales lock
  the product row (`FOR UPDATE`) and oversells are rejected.
- **Auth**: signed JWT (jose) in an httpOnly cookie, bcryptjs password hashing,
  edge-safe auth gate in `src/proxy.ts` (Next.js 16 convention), RBAC enforced
  server-side in pages, layouts and every server action/transaction function.
- **Reorder suggestions** are rule-based and explainable (current stock, minimum,
  reorder qty, average monthly sales) — no fake ML.

## Known limitations

- Product images are URL-based (no upload handling yet) — paste an image URL.
- Single currency (PKR); tax is recorded as a setting but not auto-applied per invoice line.
- Barcode scanning uses the device camera via `@zxing/browser`; a USB scanner works as a keyboard wedge in the search box.
- The service worker caches the app shell for offline resilience but live data requires connectivity.
- Email/SMS notifications are not implemented (in-app notification center only).
