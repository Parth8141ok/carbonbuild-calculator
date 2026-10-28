"use client";

import { CheckCircle2, CircleAlert } from "lucide-react";
import { reconcileSample, type ProjectResult } from "@/lib/engine";
import { formatFixed } from "@/lib/format";
import { cn } from "@/lib/utils";

/** Line-by-line comparison of engine output with the values printed in the reference report. */
export function ReconciliationTable({ result, compact }: { result: ProjectResult; compact?: boolean }) {
  const rows = reconcileSample(result);
  const mismatches = rows.filter((r) => !r.matches).length;
  return (
    <div className="space-y-3">
      <p className="text-sm text-ink-muted">
        Values per bungalow. A row matches when the full-precision engine value rounds to the reported 2-decimal value. {rows.length - mismatches} of {rows.length} rows match;
        the {mismatches} that differ are explained.
      </p>
      <div className="overflow-x-auto rounded-lg border border-line">
        <table className="w-full min-w-[640px] text-sm">
          <thead className="bg-surface-sunken text-left text-xs text-ink-muted">
            <tr>
              <th className="px-3 py-2 font-medium">Item</th>
              <th className="px-3 py-2 text-right font-medium">Reported</th>
              <th className="px-3 py-2 text-right font-medium">Calculated</th>
              <th className="px-3 py-2 text-right font-medium">Difference</th>
              <th className="px-3 py-2 font-medium">Status</th>
              {!compact ? <th className="px-3 py-2 font-medium">Source</th> : null}
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.key} className={cn("border-t border-line align-top", r.level === "total" && "bg-surface-muted/50 font-medium", r.level === "item" && "text-ink-muted")}>
                <td className={cn("px-3 py-2", r.level === "item" && "pl-6")}>{r.label}</td>
                <td className="num px-3 py-2 text-right">
                  {formatFixed(r.reported)} <span className="text-xs text-ink-subtle">{r.unit}</span>
                </td>
                <td className="num px-3 py-2 text-right">{formatFixed(r.calculated, 4)}</td>
                <td className={cn("num px-3 py-2 text-right", !r.matches && "text-amber")}>{r.matches ? "—" : `${r.delta > 0 ? "+" : ""}${formatFixed(r.delta, 4)}`}</td>
                <td className="px-3 py-2">
                  {r.matches ? (
                    <span className="inline-flex items-center gap-1 text-primary">
                      <CheckCircle2 className="size-3.5" aria-hidden /> Matches
                    </span>
                  ) : (
                    <span className="inline-flex items-start gap-1 text-amber">
                      <CircleAlert className="mt-0.5 size-3.5 shrink-0" aria-hidden />
                      <span>
                        Differs
                        {r.explanation ? <span className="block text-xs text-ink-muted">{r.explanation}</span> : null}
                      </span>
                    </span>
                  )}
                </td>
                {!compact ? <td className="px-3 py-2 text-xs text-ink-subtle">{r.source}</td> : null}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
