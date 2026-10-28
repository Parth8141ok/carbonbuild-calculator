import type { LineResult } from "@/lib/engine";
import { fmt, formatFixed } from "@/lib/format";

/** Renders a line's audit trail: formula, numerical substitution and result for each step. */
export function AuditSteps({ line }: { line: LineResult }) {
  if (line.steps.length === 0) {
    return <p className="text-sm text-ink-subtle">No calculation steps yet. Complete the required inputs.</p>;
  }
  return (
    <ol className="space-y-2">
      {line.steps.map((s, i) => (
        <li key={i} className="rounded-md border border-line bg-surface px-3 py-2">
          <p className="text-xs font-medium text-ink-muted">
            {i + 1}. {s.label}
          </p>
          <p className="mt-1 font-mono text-xs text-ink">{s.formula}</p>
          <p className="num mt-0.5 font-mono text-xs text-ink-muted">
            = {s.substitution} = <span className="font-semibold text-ink">{s.value >= 100 ? formatFixed(s.value, 2) : fmt(s.value)}</span> {s.unit}
          </p>
        </li>
      ))}
      {line.multiplier > 1 ? (
        <li className="rounded-md border border-line bg-surface px-3 py-2">
          <p className="text-xs font-medium text-ink-muted">{line.steps.length + 1}. Project total for identical buildings</p>
          <p className="num mt-1 font-mono text-xs text-ink-muted">
            = {formatFixed(line.emissionsPerBuildingKg)} × {line.multiplier} = <span className="font-semibold text-ink">{formatFixed(line.emissionsKg)}</span> kg CO₂e
          </p>
        </li>
      ) : null}
    </ol>
  );
}
