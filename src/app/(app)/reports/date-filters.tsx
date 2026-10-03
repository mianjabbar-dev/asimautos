/**
 * Date preset filter UI (server component). Preset buttons are plain links;
 * the custom range is a GET form. Extra query params (e.g. product search,
 * movement type) are preserved on both.
 */
import { Button, Input, LinkButton } from "@/components/ui";
import { presetLabel, type ReportPreset } from "./_lib";

const PRESETS: ReportPreset[] = [
  "today",
  "yesterday",
  "week",
  "month",
  "lastmonth",
];

export function DateFilter({
  basePath,
  preset,
  from,
  to,
  extra = {},
}: {
  basePath: string;
  preset: ReportPreset;
  from: string;
  to: string;
  extra?: Record<string, string>;
}) {
  const linkFor = (p: ReportPreset) => {
    const params = new URLSearchParams({ preset: p, ...extra });
    return `${basePath}?${params.toString()}`;
  };

  return (
    <div className="flex flex-wrap items-center gap-2">
      {PRESETS.map((p) => (
        <LinkButton
          key={p}
          href={linkFor(p)}
          variant={preset === p ? "primary" : "secondary"}
          size="sm"
        >
          {presetLabel(p)}
        </LinkButton>
      ))}
      <form
        method="get"
        action={basePath}
        className="flex flex-wrap items-center gap-2"
      >
        <input type="hidden" name="preset" value="custom" />
        {Object.entries(extra).map(([k, v]) => (
          <input key={k} type="hidden" name={k} value={v} />
        ))}
        <Input
          type="date"
          name="from"
          defaultValue={from}
          aria-label="From date"
          required
        />
        <span className="text-sm text-slate-400">→</span>
        <Input
          type="date"
          name="to"
          defaultValue={to}
          aria-label="To date"
          required
        />
        <Button
          type="submit"
          variant={preset === "custom" ? "primary" : "secondary"}
          size="sm"
        >
          Apply
        </Button>
      </form>
    </div>
  );
}
