import { eq } from "drizzle-orm";
import { db } from "@/db";
import { settings } from "@/db/schema";
import { requireRole, type SessionUser } from "@/lib/auth";
import { Alert, Card, CardHeader, PageHeader } from "@/components/ui";
import { SettingsForm, type SettingsFormValues } from "./settings-client";

const DEFAULTS: SettingsFormValues = {
  shopName: "Asim Autos",
  phone: "",
  address: "",
  city: "Faisalabad",
  invoicePrefix: "INV",
  taxRateBps: 0,
  defaultMinStock: 5,
  defaultReorderQty: 10,
  businessHours: "",
};

function AccessDenied() {
  return (
    <div className="space-y-4">
      <PageHeader title="Settings" />
      <Alert tone="danger">
        Access denied. Only owners can change shop settings.
      </Alert>
    </div>
  );
}

function SummaryRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start justify-between gap-4 border-b border-slate-100 py-2.5 last:border-0">
      <dt className="text-sm text-slate-500">{label}</dt>
      <dd className="text-right text-sm font-medium text-slate-900">
        {value || "—"}
      </dd>
    </div>
  );
}

export default async function SettingsPage() {
  let session: SessionUser;
  try {
    session = await requireRole("OWNER");
  } catch {
    return <AccessDenied />;
  }

  const [row] = await db
    .select()
    .from(settings)
    .where(eq(settings.shopId, session.shopId))
    .limit(1);

  const current: SettingsFormValues = {
    ...DEFAULTS,
    ...(row
      ? {
          shopName: row.shopName,
          phone: row.phone ?? "",
          address: row.address ?? "",
          city: row.city,
          invoicePrefix: row.invoicePrefix,
          taxRateBps: row.taxRateBps,
          defaultMinStock: row.defaultMinStock,
          defaultReorderQty: row.defaultReorderQty,
          businessHours: row.businessHours ?? "",
        }
      : {}),
  };

  const taxLabel =
    current.taxRateBps === 0
      ? "0%"
      : `${(current.taxRateBps / 100).toFixed(2).replace(/\.?0+$/, "")}%`;

  return (
    <div className="space-y-4">
      <PageHeader
        title="Settings"
        subtitle="Shop profile and defaults used across the app."
      />

      <Alert tone="info">
        Changing the shop name only updates the profile — it does not rename
        anything else. The invoice prefix applies to <strong>future</strong>{" "}
        sale invoice numbers only.
      </Alert>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader
            title="Shop settings"
            subtitle="Saved immediately for the whole shop."
          />
          <div className="p-4 sm:p-5">
            <SettingsForm initial={current} />
          </div>
        </Card>

        <Card className="h-fit">
          <CardHeader title="Current values" />
          <dl className="px-4 py-2 sm:px-5">
            <SummaryRow label="Shop name" value={current.shopName} />
            <SummaryRow label="Phone" value={current.phone} />
            <SummaryRow label="City" value={current.city} />
            <SummaryRow label="Address" value={current.address} />
            <SummaryRow label="Business hours" value={current.businessHours} />
            <SummaryRow label="Invoice prefix" value={current.invoicePrefix} />
            <SummaryRow label="Tax rate" value={taxLabel} />
            <SummaryRow
              label="Default min stock"
              value={String(current.defaultMinStock)}
            />
            <SummaryRow
              label="Default reorder qty"
              value={String(current.defaultReorderQty)}
            />
          </dl>
        </Card>
      </div>
    </div>
  );
}
