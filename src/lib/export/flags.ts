import type { Flag, ProjectResult } from "@/lib/engine";

/** Deduplicated, severity-ordered flags for reports. Generic-factor notes collapse into one line. */
export function summariseFlagsPlain(r: ProjectResult): Flag[] {
  const seen = new Set<string>();
  const out: Flag[] = [];
  const generic = new Set<string>();
  for (const f of r.flags) {
    if (f.code === "generic_factor") {
      const name = f.message.match(/"([^"]+)"/)?.[1];
      if (name) generic.add(name);
      continue;
    }
    const key = `${f.code}|${f.message}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(f);
  }
  if (generic.size) out.push({ code: "generic_factor", severity: "info", message: `Generic literature factors in use: ${[...generic].join(", ")}. They are not supplier-specific.` });
  const rank = { error: 0, warning: 1, info: 2 } as const;
  return out.sort((a, b) => rank[a.severity] - rank[b.severity]);
}
