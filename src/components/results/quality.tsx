"use client";

import { useMemo } from "react";
import { FlagList, summariseFlags } from "@/components/flags";
import { Card, CardHeader } from "@/components/ui/primitives";
import { DATA_STATUS_LABELS, analyseUncertainty, type DataStatus, type Project, type ProjectResult } from "@/lib/engine";
import { formatFixed, formatKg, formatShare } from "@/lib/format";
import { DATA_STATUS_OPTIONS } from "@/lib/labels";

const STATUS_COLORS: Record<DataStatus, string> = {
  measured: "var(--series-6)",
  user_provided: "var(--series-1)",
  estimated: "var(--series-3)",
  assumed: "var(--series-4)",
};

export function DataQuality({ project, result }: { project: Project; result: ProjectResult }) {
  const dq = result.dataQuality;
  const total = result.totals.totalKg;
  const u = useMemo(() => analyseUncertainty(project, result), [project, result]);
  const statuses = Object.keys(DATA_STATUS_LABELS) as DataStatus[];
  const flags = summariseFlags(result);

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader title="Basis of the result" description="Share of the included emissions by how the activity data was obtained. No overall confidence score is given, because it would be arbitrary." />
        <div className="space-y-5 p-5">
          {total > 0 ? (
            <div>
              <div className="flex h-4 overflow-hidden rounded-md" role="img" aria-label={statuses.map((s) => `${DATA_STATUS_LABELS[s]} ${formatShare(dq.emissionsByStatus[s] / total, 1)}`).join(", ")}>
                {statuses.map((s) =>
                  dq.emissionsByStatus[s] > 0 ? <div key={s} style={{ width: `${(dq.emissionsByStatus[s] / total) * 100}%`, background: STATUS_COLORS[s] }} className="border-r-2 border-surface last:border-r-0" /> : null,
                )}
              </div>
            </div>
          ) : null}
          <div className="overflow-x-auto">
            <table className="w-full min-w-[520px] text-sm">
              <thead className="text-left text-xs text-ink-muted">
                <tr className="border-b border-line">
                  <th className="py-2 font-medium">Status</th>
                  <th className="py-2 font-medium">Meaning</th>
                  <th className="py-2 text-right font-medium">Inputs</th>
                  <th className="py-2 text-right font-medium">kg CO₂e</th>
                  <th className="py-2 text-right font-medium">Share</th>
                </tr>
              </thead>
              <tbody>
                {DATA_STATUS_OPTIONS.map((o) => (
                  <tr key={o.value} className="border-b border-line last:border-0">
                    <td className="py-2">
                      <span className="inline-flex items-center gap-2 font-medium">
                        <span className="size-2.5 rounded-sm" style={{ background: STATUS_COLORS[o.value] }} />
                        {o.label}
                      </span>
                    </td>
                    <td className="py-2 text-ink-muted">{o.description}</td>
                    <td className="num py-2 text-right">{dq.inputCounts[o.value]}</td>
                    <td className="num py-2 text-right">{formatFixed(dq.emissionsByStatus[o.value])}</td>
                    <td className="num py-2 text-right">{total > 0 ? formatShare(dq.emissionsByStatus[o.value] / total, 1) : "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <dl className="grid gap-3 text-sm sm:grid-cols-3">
            <div className="rounded-lg bg-surface-sunken p-3">
              <dt className="text-xs text-ink-muted">Waste percentages</dt>
              <dd className="mt-1">
                {dq.wasteSourceCounts.reference} reference · {dq.wasteSourceCounts.user} user · {dq.wasteSourceCounts.measured} measured
              </dd>
            </div>
            <div className="rounded-lg bg-surface-sunken p-3">
              <dt className="text-xs text-ink-muted">Emissions using generic factors</dt>
              <dd className="num mt-1">{formatKg(dq.genericFactorKg)}</dd>
            </div>
            <div className="rounded-lg bg-surface-sunken p-3">
              <dt className="text-xs text-ink-muted">Emissions using factors with an unstated boundary</dt>
              <dd className="num mt-1">{formatKg(dq.boundaryUncertainKg)}</dd>
            </div>
          </dl>
        </div>
      </Card>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader title="Main uncertainties" description="How much the total moves when one assumption changes, calculated from your inputs" />
          <div className="space-y-4 p-5">
            {u.rangeFactorLow !== null && u.rangeFactorHigh !== null ? (
              <div className="rounded-lg border border-line p-3">
                <p className="text-sm font-medium">Range-based factors at their low and high bounds</p>
                <p className="num mt-1 text-sm">
                  {formatKg(u.rangeFactorLow)} to {formatKg(u.rangeFactorHigh)} <span className="text-ink-muted">(selected: {formatKg(total)})</span>
                </p>
                <p className="mt-1 text-xs text-ink-subtle">Affects: {u.rangeFactorsUsed.join(", ")}</p>
              </div>
            ) : (
              <p className="text-sm text-ink-muted">No range-based factors are in use. The study-specific point factors have no published range. Use the What-if tab to test the generic ranges as alternatives.</p>
            )}
            <ul className="space-y-2">
              {u.sensitivities.map((s) => (
                <li key={s.key} className="flex items-start justify-between gap-3 rounded-lg border border-line p-3 text-sm">
                  <span>
                    <span className="font-medium">{s.label}</span>
                    <span className="block text-xs text-ink-subtle">{s.description}</span>
                  </span>
                  <span className="num shrink-0 text-right">
                    {s.deltaKg >= 0 ? "+" : ""}
                    {formatFixed(s.deltaKg)} kg
                    <span className="block text-xs text-ink-muted">{formatShare(s.deltaShare, 2)}</span>
                  </span>
                </li>
              ))}
            </ul>
          </div>
        </Card>
        <Card>
          <CardHeader title="Warnings and boundary notes" />
          <div className="p-5">
            <FlagList flags={flags} />
          </div>
        </Card>
      </div>
    </div>
  );
}
