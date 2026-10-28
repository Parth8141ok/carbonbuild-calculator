import { AlertTriangle, Info, OctagonAlert } from "lucide-react";
import type { Flag } from "@/lib/engine";
import { cn } from "@/lib/utils";

export { summariseFlagsPlain as summariseFlags } from "@/lib/export/flags";

export function FlagList({ flags, className, limit }: { flags: Flag[]; className?: string; limit?: number }) {
  const shown = limit ? flags.slice(0, limit) : flags;
  if (!shown.length) return <p className="text-sm text-ink-subtle">No warnings.</p>;
  return (
    <ul className={cn("space-y-2", className)}>
      {shown.map((f, i) => {
        const Icon = f.severity === "error" ? OctagonAlert : f.severity === "warning" ? AlertTriangle : Info;
        return (
          <li key={i} className="flex gap-2.5 text-sm">
            <Icon className={cn("mt-0.5 size-4 shrink-0", f.severity === "error" ? "text-danger" : f.severity === "warning" ? "text-amber" : "text-ink-subtle")} aria-hidden />
            <span>
              <span className="sr-only">{f.severity}: </span>
              <span className={f.severity === "info" ? "text-ink-muted" : "text-ink"}>{f.message}</span>
            </span>
          </li>
        );
      })}
      {limit && flags.length > limit ? <li className="text-xs text-ink-subtle">and {flags.length - limit} more</li> : null}
    </ul>
  );
}
