"use client";

import { ArrowDown, ArrowUp, ChevronRight, Download } from "lucide-react";
import { Fragment, useMemo, useState } from "react";
import { AuditSteps } from "@/components/audit";
import { Badge, Button, Card, Input, Select } from "@/components/ui/primitives";
import { DATA_STATUS_LABELS, EMISSION_CATEGORY_LABELS, type Project, type ProjectResult } from "@/lib/engine";
import { formatFixed, formatNumber, formatShare } from "@/lib/format";
import { calculationCsv } from "@/lib/export/tables";
import { STATUS_TONE } from "@/lib/labels";
import { cn, downloadBlob, slugify } from "@/lib/utils";

type SortKey = "name" | "stage" | "emissions" | "share" | "status";

export function CalculationTable({ project, result }: { project: Project; result: ProjectResult }) {
  const [query, setQuery] = useState("");
  const [stage, setStage] = useState("all");
  const [category, setCategory] = useState("all");
  const [status, setStatus] = useState("all");
  const [inclusion, setInclusion] = useState("all");
  const [sort, setSort] = useState<{ key: SortKey; dir: 1 | -1 }>({ key: "emissions", dir: -1 });
  const [open, setOpen] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState(false);

  const stages = [...new Set(result.lines.map((l) => l.stageName))];
  const rows = useMemo(() => {
    const q = query.trim().toLowerCase();
    const list = result.lines.filter(
      (l) =>
        (stage === "all" || l.stageName === stage) &&
        (category === "all" || l.emissionCategory === category) &&
        (status === "all" || l.dataStatus === status) &&
        (inclusion === "all" || (inclusion === "included" ? l.included : !l.included)) &&
        (!q || `${l.name} ${l.specification} ${l.buildingName}`.toLowerCase().includes(q)),
    );
    const val = (l: (typeof list)[number]) =>
      sort.key === "name" ? l.name : sort.key === "stage" ? l.stageName : sort.key === "status" ? l.dataStatus : sort.key === "share" ? l.share : l.emissionsKg;
    return [...list].sort((a, b) => {
      const x = val(a);
      const y = val(b);
      return (typeof x === "number" && typeof y === "number" ? x - y : String(x).localeCompare(String(y))) * sort.dir;
    });
  }, [result, query, stage, category, status, inclusion, sort]);

  const toggle = (id: string) => setOpen((s) => {
    const n = new Set(s);
    if (n.has(id)) n.delete(id);
    else n.add(id);
    return n;
  });

  const th = (key: SortKey, label: string, right = false) => (
    <th scope="col" className={cn("px-3 py-2 font-medium", right && "text-right")} aria-sort={sort.key === key ? (sort.dir === 1 ? "ascending" : "descending") : "none"}>
      <button type="button" className={cn("inline-flex items-center gap-1 hover:text-ink", right && "flex-row-reverse")} onClick={() => setSort((s) => ({ key, dir: s.key === key ? ((-s.dir) as 1 | -1) : key === "emissions" || key === "share" ? -1 : 1 }))}>
        {label}
        {sort.key === key ? sort.dir === 1 ? <ArrowUp className="size-3" /> : <ArrowDown className="size-3" /> : null}
      </button>
    </th>
  );

  async function exportXlsx() {
    setBusy(true);
    try {
      const { buildWorkbook } = await import("@/lib/export/xlsx");
      const buf = await buildWorkbook(project, result, new Date().toISOString());
      downloadBlob(new Blob([buf], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }), `${slugify(project.name)}-calculations.xlsx`);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card>
      <div className="flex flex-wrap items-end gap-3 border-b border-line px-5 py-4">
        <div className="min-w-48 flex-1">
          <label htmlFor="calc-q" className="text-xs text-ink-muted">
            Search
          </label>
          <Input id="calc-q" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Material or activity" className="mt-1 h-9" />
        </div>
        <FilterSelect id="calc-stage" label="Stage" value={stage} onChange={setStage} options={[["all", "All stages"], ...stages.map((s) => [s, s] as [string, string])]} />
        <FilterSelect id="calc-cat" label="Type" value={category} onChange={setCategory} options={[["all", "All types"], ...Object.entries(EMISSION_CATEGORY_LABELS)]} />
        <FilterSelect id="calc-status" label="Data status" value={status} onChange={setStatus} options={[["all", "All"], ...Object.entries(DATA_STATUS_LABELS)]} />
        <FilterSelect id="calc-inc" label="In total" value={inclusion} onChange={setInclusion} options={[["all", "All"], ["included", "Included"], ["excluded", "Not included"]]} />
        <div className="flex gap-2">
          <Button variant="secondary" size="sm" onClick={() => downloadBlob(new Blob([calculationCsv(result)], { type: "text/csv;charset=utf-8" }), `${slugify(project.name)}-calculations.csv`)}>
            <Download /> CSV
          </Button>
          <Button variant="secondary" size="sm" onClick={exportXlsx} disabled={busy}>
            <Download /> {busy ? "Preparing…" : "Excel"}
          </Button>
        </div>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[980px] text-sm">
          <caption className="sr-only">Itemised calculations. Select a row to show its formula and numerical substitution.</caption>
          <thead className="bg-surface-sunken text-left text-xs text-ink-muted">
            <tr>
              <th className="w-8" />
              {th("stage", "Stage")}
              {th("name", "Material or activity")}
              <th className="px-3 py-2 text-right font-medium">Input</th>
              <th className="px-3 py-2 text-right font-medium">Total mass</th>
              <th className="px-3 py-2 text-right font-medium">Waste</th>
              <th className="px-3 py-2 text-right font-medium">Wasted / activity</th>
              <th className="px-3 py-2 text-right font-medium">Factor</th>
              {th("emissions", "kg CO₂e", true)}
              {th("share", "Share", true)}
              {th("status", "Status")}
            </tr>
          </thead>
          <tbody>
            {rows.map((l) => {
              const isOpen = open.has(l.id);
              return (
                <Fragment key={l.id}>
                  <tr className={cn("border-t border-line hover:bg-page", !l.included && "text-ink-subtle")}>
                    <td className="pl-3">
                      <button type="button" aria-expanded={isOpen} aria-label={`Show calculation for ${l.name}`} onClick={() => toggle(l.id)} className="rounded p-1 hover:bg-surface-sunken">
                        <ChevronRight className={cn("size-4 transition-transform", isOpen && "rotate-90")} />
                      </button>
                    </td>
                    <td className="px-3 py-2">{l.stageName}</td>
                    <td className="px-3 py-2">
                      <button type="button" onClick={() => toggle(l.id)} className="text-left font-medium text-ink hover:underline">
                        {l.name}
                      </button>
                      <span className="block text-xs text-ink-subtle">
                        {EMISSION_CATEGORY_LABELS[l.emissionCategory]}
                        {result.byBuilding.length > 1 ? ` · ${l.buildingName}` : ""}
                      </span>
                    </td>
                    <td className="num px-3 py-2 text-right">
                      {l.inputQuantity === null ? <span className="text-danger">missing</span> : formatNumber(l.inputQuantity, 3)} <span className="text-xs text-ink-subtle">{l.inputUnit}</span>
                    </td>
                    <td className="num px-3 py-2 text-right">{l.totalMassKg === null ? "—" : `${formatNumber(l.totalMassKg, 2)} kg`}</td>
                    <td className="num px-3 py-2 text-right">{l.wastePercent === null ? "—" : `${formatNumber(l.wastePercent, 2)}%`}</td>
                    <td className="num px-3 py-2 text-right">{l.wastedMassKg !== null ? `${formatNumber(l.wastedMassKg, 2)} kg` : l.dieselLitres !== null ? `${formatNumber(l.dieselLitres, 2)} L` : l.tonneKm !== null ? `${formatNumber(l.tonneKm, 2)} t·km` : "—"}</td>
                    <td className="num px-3 py-2 text-right">{l.effectiveFactor === null ? "—" : `${formatNumber(l.effectiveFactor, 4)}`}</td>
                    <td className="num px-3 py-2 text-right font-medium">{l.valid ? formatFixed(l.emissionsKg) : "—"}</td>
                    <td className="num px-3 py-2 text-right">{l.included ? formatShare(l.share, 1) : "—"}</td>
                    <td className="px-3 py-2">
                      <div className="flex flex-wrap gap-1">
                        <Badge tone={STATUS_TONE[l.dataStatus]}>{DATA_STATUS_LABELS[l.dataStatus]}</Badge>
                        {!l.valid ? <Badge tone="red">Invalid</Badge> : !l.included ? <Badge tone="amber">Not in total</Badge> : null}
                      </div>
                    </td>
                  </tr>
                  {isOpen ? (
                    <tr className="border-t border-line bg-page">
                      <td />
                      <td colSpan={10} className="px-3 py-4">
                        <div className="grid gap-4 lg:grid-cols-[1.3fr_1fr]">
                          <AuditSteps line={l} />
                          <div className="space-y-3 text-sm">
                            {l.exclusionReason ? <p className="rounded-md bg-amber-soft px-3 py-2 text-ink">{l.exclusionReason}</p> : null}
                            {l.factorComponents.map((c) => (
                              <div key={c.factorId} className="rounded-md border border-line bg-surface p-3">
                                <p className="font-medium">{c.name}</p>
                                <p className="num text-xs text-ink-muted">
                                  {c.originalValue} {c.originalUnit}
                                  {c.level !== "point" ? ` (${c.level} of range)` : ""} · {c.lifecycleModules.join(" + ") || "boundary not stated"} · {c.status}
                                  {c.generic ? ", generic" : ""}
                                </p>
                                <p className="mt-1 text-xs text-ink-subtle">{c.boundaryNotes}</p>
                                <p className="mt-1 text-xs text-ink-subtle">
                                  Source: {c.source}
                                  {c.sourceLocation ? `, ${c.sourceLocation}` : ""}
                                </p>
                              </div>
                            ))}
                            {l.flags.filter((f) => f.code !== "generic_factor").map((f, i) => (
                              <p key={i} className={cn("text-xs", f.severity === "error" ? "text-danger" : f.severity === "warning" ? "text-amber" : "text-ink-muted")}>
                                {f.message}
                              </p>
                            ))}
                          </div>
                        </div>
                      </td>
                    </tr>
                  ) : null}
                </Fragment>
              );
            })}
            {!rows.length ? (
              <tr>
                <td colSpan={11} className="px-5 py-10 text-center text-sm text-ink-subtle">
                  No rows match the filters.
                </td>
              </tr>
            ) : null}
          </tbody>
          <tfoot>
            <tr className="border-t-2 border-line-strong bg-surface-sunken font-semibold">
              <td colSpan={8} className="px-3 py-2 text-right">
                Included total
              </td>
              <td className="num px-3 py-2 text-right">{formatFixed(result.totals.totalKg)}</td>
              <td className="num px-3 py-2 text-right">100%</td>
              <td />
            </tr>
          </tfoot>
        </table>
      </div>
    </Card>
  );
}

function FilterSelect({ id, label, value, onChange, options }: { id: string; label: string; value: string; onChange: (v: string) => void; options: [string, string][] }) {
  return (
    <div>
      <label htmlFor={id} className="text-xs text-ink-muted">
        {label}
      </label>
      <Select id={id} value={value} onChange={(e) => onChange(e.target.value)} className="mt-1 h-9 w-auto min-w-32">
        {options.map(([v, l]) => (
          <option key={v} value={v}>
            {l}
          </option>
        ))}
      </Select>
    </div>
  );
}
