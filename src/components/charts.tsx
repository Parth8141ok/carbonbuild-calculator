"use client";

import { Table2 } from "lucide-react";
import { useState, type ReactNode } from "react";
import { Bar, BarChart, CartesianGrid, Cell, Legend, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import type { ProjectResult } from "@/lib/engine";
import { formatFixed, formatShare } from "@/lib/format";
import { cn } from "@/lib/utils";

/** Entity colours follow the material or activity, never its rank. */
export const ENTITY_COLORS: Record<string, string> = {
  concrete: "var(--series-1)",
  masonry: "var(--series-2)",
  steel: "var(--series-3)",
  transport: "var(--series-4)",
  machinery: "var(--series-5)",
  cement: "var(--series-6)",
  installed: "var(--series-7)",
  other: "var(--series-8)",
};

export const ENTITY_LABELS: Record<string, string> = {
  concrete: "Concrete wastage",
  masonry: "Masonry wastage",
  steel: "Steel wastage",
  cement: "Cement wastage",
  other: "Other material wastage",
  transport: "Transportation",
  machinery: "Site machinery",
  installed: "Installed material (A1–A3)",
};

const ENTITY_ORDER = ["concrete", "masonry", "steel", "transport", "machinery", "cement", "installed", "other"];

export function entityTotals(r: ProjectResult): { key: string; label: string; kg: number }[] {
  const m = new Map<string, number>();
  for (const l of r.lines) {
    if (!l.included) continue;
    const key = l.kind === "installed" ? "installed" : l.kind === "transport" ? "transport" : l.kind === "machinery" ? "machinery" : l.materialCategory;
    m.set(key, (m.get(key) ?? 0) + l.emissionsKg);
  }
  return ENTITY_ORDER.filter((k) => (m.get(k) ?? 0) > 0).map((k) => ({ key: k, label: ENTITY_LABELS[k], kg: m.get(k)! }));
}

const kgTick = (v: number) => (Math.abs(v) >= 1000 ? `${formatFixed(v / 1000, v % 1000 === 0 ? 0 : 1)}K` : formatFixed(v, 0));

function TooltipBox({ title, rows }: { title?: ReactNode; rows: { color?: string; label: ReactNode; value: ReactNode }[] }) {
  return (
    <div className="rounded-lg border border-line bg-surface px-3 py-2 text-xs shadow-lg">
      {title ? <p className="mb-1 font-medium text-ink">{title}</p> : null}
      {rows.map((r, i) => (
        <p key={i} className="flex items-center gap-2 text-ink-muted">
          {r.color ? <span className="inline-block size-2.5 rounded-sm" style={{ background: r.color }} /> : null}
          <span>{r.label}</span>
          <span className="num ml-auto pl-3 font-medium text-ink">{r.value}</span>
        </p>
      ))}
    </div>
  );
}

export function ChartCard({
  title,
  description,
  table,
  children,
  className,
  empty,
}: {
  title: string;
  description?: ReactNode;
  table: { head: string[]; rows: ReactNode[][] };
  children: ReactNode;
  className?: string;
  empty?: boolean;
}) {
  const [showTable, setShowTable] = useState(false);
  return (
    <section className={cn("@container rounded-xl border border-line bg-surface", className)} aria-label={title}>
      <div className="flex items-start justify-between gap-3 px-5 pt-4">
        <div>
          <h3 className="text-sm font-semibold text-ink">{title}</h3>
          {description ? <p className="mt-0.5 text-xs text-ink-muted">{description}</p> : null}
        </div>
        {!empty ? (
          <button
            type="button"
            onClick={() => setShowTable(!showTable)}
            aria-pressed={showTable}
            className="inline-flex shrink-0 items-center gap-1.5 rounded-md px-2 py-1 text-xs font-medium text-ink-muted hover:bg-surface-sunken hover:text-ink"
          >
            <Table2 className="size-3.5" aria-hidden />
            {showTable ? "Show chart" : "Show table"}
          </button>
        ) : null}
      </div>
      <div className="px-3 pb-4 pt-2 sm:px-5">
        {empty ? (
          <p className="py-12 text-center text-sm text-ink-subtle">No valid calculated data to chart yet.</p>
        ) : showTable ? (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-line text-left text-xs text-ink-muted">
                  {table.head.map((h, i) => (
                    <th key={h} className={cn("py-2 pr-3 font-medium", i > 0 && "text-right")}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {table.rows.map((r, i) => (
                  <tr key={i} className="border-b border-line last:border-0">
                    {r.map((c, j) => (
                      <td key={j} className={cn("py-2 pr-3", j > 0 && "num text-right")}>
                        {c}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div aria-hidden>{children}</div>
        )}
      </div>
    </section>
  );
}

export function CategoryDonut({ result, className }: { result: ProjectResult; className?: string }) {
  const data = entityTotals(result);
  const total = data.reduce((s, d) => s + d.kg, 0);
  return (
    <ChartCard
      className={className}
      title="Contribution by category"
      description="Share of the included total"
      empty={total <= 0}
      table={{ head: ["Category", "kg CO₂e", "Share"], rows: data.map((d) => [d.label, formatFixed(d.kg), formatShare(d.kg / total)]) }}
    >
      <div className="grid items-center gap-4 @md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <div className="relative h-56">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie data={data} dataKey="kg" nameKey="label" innerRadius="62%" outerRadius="92%" paddingAngle={1} stroke="var(--surface)" strokeWidth={2} isAnimationActive={false}>
                {data.map((d) => (
                  <Cell key={d.key} fill={ENTITY_COLORS[d.key]} />
                ))}
              </Pie>
              <Tooltip
                content={({ active, payload }) =>
                  active && payload?.length ? (
                    <TooltipBox rows={[{ color: ENTITY_COLORS[(payload[0].payload as { key: string }).key], label: payload[0].name, value: `${formatFixed(Number(payload[0].value))} kg (${formatShare(Number(payload[0].value) / total)})` }]} />
                  ) : null
                }
              />
            </PieChart>
          </ResponsiveContainer>
          <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
            <span className="num text-lg font-semibold">{formatFixed(total / 1000)}</span>
            <span className="text-xs text-ink-muted">t CO₂e</span>
          </div>
        </div>
        <ul className="space-y-2 text-sm">
          {data.map((d) => (
            <li key={d.key} className="flex items-center gap-2">
              <span className="inline-block size-3 shrink-0 rounded-sm" style={{ background: ENTITY_COLORS[d.key] }} />
              <span className="min-w-0 flex-1 truncate text-ink-muted">{d.label}</span>
              <span className="num font-medium">{formatShare(d.kg / total, 1)}</span>
            </li>
          ))}
        </ul>
      </div>
    </ChartCard>
  );
}

export function RankingChart({ result, className }: { result: ProjectResult; className?: string }) {
  const total = result.totals.totalKg;
  const data = result.bySource.filter((s) => s.kg > 0).map((s) => ({ ...s, share: total > 0 ? s.kg / total : 0 }));
  const height = Math.max(160, data.length * 36 + 30);
  return (
    <ChartCard
      className={className}
      title="Emission sources ranked"
      description="Material wastage by stage, and each fuel activity"
      empty={data.length === 0}
      table={{ head: ["Source", "kg CO₂e", "Share"], rows: data.map((d) => [d.label, formatFixed(d.kg), formatShare(d.share)]) }}
    >
      <div style={{ height }}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} layout="vertical" margin={{ top: 4, right: 64, bottom: 4, left: 4 }} barCategoryGap={8}>
            <CartesianGrid horizontal={false} stroke="var(--grid)" />
            <XAxis type="number" tickFormatter={kgTick} tick={{ fontSize: 11, fill: "var(--ink-subtle)" }} axisLine={false} tickLine={false} />
            <YAxis type="category" dataKey="label" width={150} tick={{ fontSize: 12, fill: "var(--ink-muted)" }} axisLine={false} tickLine={false} />
            <Tooltip
              cursor={{ fill: "var(--surface-sunken)" }}
              content={({ active, payload }) =>
                active && payload?.length ? (
                  <TooltipBox title={(payload[0].payload as { label: string }).label} rows={[{ label: "Emissions", value: `${formatFixed(Number(payload[0].value))} kg CO₂e` }, { label: "Share", value: formatShare((payload[0].payload as { share: number }).share) }]} />
                ) : null
              }
            />
            <Bar
              dataKey="kg"
              fill="var(--primary)"
              maxBarSize={22}
              radius={[0, 4, 4, 0]}
              isAnimationActive={false}
              label={{ position: "right", fontSize: 11, fill: "var(--ink-muted)", formatter: (v: unknown) => formatShare(Number(v) / total, 1) }}
            />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </ChartCard>
  );
}

/** Material wastage, transport and machinery side by side, each stacked by its contributors. */
export function ActivityStackChart({ result, className }: { result: ProjectResult; className?: string }) {
  const totals = entityTotals(result);
  const get = (k: string) => totals.find((t) => t.key === k)?.kg ?? 0;
  const wasteKeys = ["concrete", "masonry", "steel", "cement", "other"].filter((k) => get(k) > 0);
  const rows: Record<string, number | string>[] = [{ name: "Material wastage", ...Object.fromEntries(wasteKeys.map((k) => [k, get(k)])) }];
  if (get("transport") > 0) rows.push({ name: "Transportation", transport: get("transport") });
  if (get("machinery") > 0) rows.push({ name: "Site machinery", machinery: get("machinery") });
  if (get("installed") > 0) rows.push({ name: "Installed (A1–A3)", installed: get("installed") });
  const keys = [...wasteKeys, ...["transport", "machinery", "installed"].filter((k) => get(k) > 0)];
  const empty = keys.length === 0;
  return (
    <ChartCard
      className={className}
      title="Wastage vs transport vs machinery"
      description="kg CO₂e, stacked by contributor"
      empty={empty}
      table={{ head: ["Group", "Contributor", "kg CO₂e"], rows: rows.flatMap((r) => keys.filter((k) => r[k] !== undefined).map((k) => [String(r.name), ENTITY_LABELS[k], formatFixed(Number(r[k]))])) }}
    >
      <div className="h-64">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={rows} margin={{ top: 8, right: 8, bottom: 4, left: 0 }} barCategoryGap="30%">
            <CartesianGrid vertical={false} stroke="var(--grid)" />
            <XAxis dataKey="name" tick={{ fontSize: 12, fill: "var(--ink-muted)" }} axisLine={false} tickLine={false} />
            <YAxis tickFormatter={kgTick} tick={{ fontSize: 11, fill: "var(--ink-subtle)" }} axisLine={false} tickLine={false} width={44} />
            <Tooltip
              cursor={{ fill: "var(--surface-sunken)" }}
              content={({ active, payload, label }) =>
                active && payload?.length ? (
                  <TooltipBox title={label} rows={payload.filter((p) => Number(p.value) > 0).map((p) => ({ color: ENTITY_COLORS[String(p.dataKey)], label: ENTITY_LABELS[String(p.dataKey)], value: `${formatFixed(Number(p.value))} kg` }))} />
                ) : null
              }
            />
            <Legend wrapperStyle={{ fontSize: 12, color: "var(--ink-muted)" }} formatter={(v) => <span className="text-ink-muted">{ENTITY_LABELS[String(v)]}</span>} />
            {keys.map((k) => (
              <Bar key={k} dataKey={k} stackId="a" fill={ENTITY_COLORS[k]} stroke="var(--surface)" strokeWidth={2} maxBarSize={56} isAnimationActive={false} />
            ))}
          </BarChart>
        </ResponsiveContainer>
      </div>
    </ChartCard>
  );
}

export function StageChart({ result, className }: { result: ProjectResult; className?: string }) {
  const cats = ["concrete", "masonry", "steel", "cement", "other"] as const;
  const used = cats.filter((c) => result.byStage.some((s) => s.byMaterial[c] > 0));
  const data = result.byStage.map((s) => ({ name: s.stageName, ...s.byMaterial, total: s.kg }));
  const excluded = result.lines.filter((l) => l.valid && !l.included && l.kind === "material" && l.exclusionReason?.startsWith("Left out"));
  return (
    <ChartCard
      className={className}
      title="Material wastage by construction stage"
      description={excluded.length ? "Foundation shows 0 because the selected profile leaves it out" : "kg CO₂e, stacked by material"}
      empty={used.length === 0}
      table={{ head: ["Stage", ...used.map((c) => ENTITY_LABELS[c]), "Total"], rows: data.map((d) => [d.name, ...used.map((c) => formatFixed(d[c])), formatFixed(d.total)]) }}
    >
      <div className="h-64">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ top: 8, right: 8, bottom: 4, left: 0 }} barCategoryGap="28%">
            <CartesianGrid vertical={false} stroke="var(--grid)" />
            <XAxis dataKey="name" tick={{ fontSize: 11, fill: "var(--ink-muted)" }} axisLine={false} tickLine={false} interval={0} />
            <YAxis tickFormatter={kgTick} tick={{ fontSize: 11, fill: "var(--ink-subtle)" }} axisLine={false} tickLine={false} width={44} />
            <Tooltip
              cursor={{ fill: "var(--surface-sunken)" }}
              content={({ active, payload, label }) =>
                active && payload?.length ? (
                  <TooltipBox title={label} rows={payload.filter((p) => Number(p.value) > 0).map((p) => ({ color: ENTITY_COLORS[String(p.dataKey)], label: ENTITY_LABELS[String(p.dataKey)], value: `${formatFixed(Number(p.value))} kg` }))} />
                ) : null
              }
            />
            <Legend wrapperStyle={{ fontSize: 12 }} formatter={(v) => <span className="text-ink-muted">{ENTITY_LABELS[String(v)]}</span>} />
            {used.map((c) => (
              <Bar key={c} dataKey={c} stackId="s" fill={ENTITY_COLORS[c]} stroke="var(--surface)" strokeWidth={2} maxBarSize={48} isAnimationActive={false} />
            ))}
          </BarChart>
        </ResponsiveContainer>
      </div>
    </ChartCard>
  );
}

/** Two-series grouped comparison: baseline vs alternative per item. */
export function ComparisonChart({
  title,
  description,
  items,
  aLabel,
  bLabel,
  className,
}: {
  title: string;
  description?: string;
  items: { label: string; a: number; b: number }[];
  aLabel: string;
  bLabel: string;
  className?: string;
}) {
  const data = items.filter((i) => i.a > 0 || i.b > 0);
  const height = Math.max(180, data.length * 52 + 50);
  return (
    <ChartCard
      className={className}
      title={title}
      description={description}
      empty={data.length === 0}
      table={{ head: ["Item", aLabel, bLabel, "Change"], rows: data.map((d) => [d.label, formatFixed(d.a), formatFixed(d.b), formatFixed(d.b - d.a)]) }}
    >
      <div style={{ height }}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} layout="vertical" margin={{ top: 4, right: 16, bottom: 4, left: 4 }} barGap={2} barCategoryGap={12}>
            <CartesianGrid horizontal={false} stroke="var(--grid)" />
            <XAxis type="number" tickFormatter={kgTick} tick={{ fontSize: 11, fill: "var(--ink-subtle)" }} axisLine={false} tickLine={false} />
            <YAxis type="category" dataKey="label" width={150} tick={{ fontSize: 12, fill: "var(--ink-muted)" }} axisLine={false} tickLine={false} />
            <Tooltip
              cursor={{ fill: "var(--surface-sunken)" }}
              content={({ active, payload, label }) =>
                active && payload?.length ? (
                  <TooltipBox
                    title={label}
                    rows={[
                      { color: "var(--series-1)", label: aLabel, value: `${formatFixed(Number(payload[0]?.value))} kg` },
                      { color: "var(--series-2)", label: bLabel, value: `${formatFixed(Number(payload[1]?.value))} kg` },
                    ]}
                  />
                ) : null
              }
            />
            <Legend wrapperStyle={{ fontSize: 12 }} formatter={(v) => <span className="text-ink-muted">{v === "a" ? aLabel : bLabel}</span>} />
            <Bar dataKey="a" fill="var(--series-1)" maxBarSize={16} radius={[0, 4, 4, 0]} isAnimationActive={false} />
            <Bar dataKey="b" fill="var(--series-2)" maxBarSize={16} radius={[0, 4, 4, 0]} isAnimationActive={false} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </ChartCard>
  );
}
