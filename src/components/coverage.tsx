import { CheckCircle2, CircleDashed, CircleSlash } from "lucide-react";
import type { CoverageRow } from "@/lib/engine";
import { cn } from "@/lib/utils";

const ICON = { included: CheckCircle2, partial: CircleDashed, excluded: CircleSlash } as const;
const TEXT = { included: "Included", partial: "Partly included", excluded: "Not included" } as const;
const COLOR = { included: "text-primary", partial: "text-amber", excluded: "text-ink-subtle" } as const;

/** EN 15978 modules covered by a result. A partial assessment is never presented as whole-life. */
export function CoveragePanel({ coverage, compact }: { coverage: CoverageRow[]; compact?: boolean }) {
  return (
    <ul className={cn("divide-y divide-line", compact ? "text-sm" : "")}>
      {coverage.map((c) => {
        const Icon = ICON[c.status];
        return (
          <li key={c.module} className="flex gap-3 py-2.5">
            <Icon className={cn("mt-0.5 size-4 shrink-0", COLOR[c.status])} aria-hidden />
            <div className="min-w-0">
              <p className="text-sm">
                <span className="font-mono text-xs text-ink-muted">{c.module}</span> <span className="font-medium">{c.label}</span>{" "}
                <span className={cn("text-xs", COLOR[c.status])}>· {TEXT[c.status]}</span>
              </p>
              {!compact ? <p className="text-xs text-ink-muted">{c.note}</p> : null}
            </div>
          </li>
        );
      })}
    </ul>
  );
}
