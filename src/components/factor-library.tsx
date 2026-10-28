"use client";

import { Copy, Pencil, Plus, RefreshCw, Trash2 } from "lucide-react";
import { Fragment, useState } from "react";
import { LoadingState, PageShell } from "@/components/assess/shared";
import { FactorFormDialog } from "@/components/factor-form";
import { Badge, Button, Callout, Card, CardHeader, PageHeader, Select } from "@/components/ui/primitives";
import { FACTOR_DATASET_VERSION, FACTOR_UNIT_LABELS, REFERENCE_PARAMETERS, type EmissionFactor } from "@/lib/engine";
import { fmt } from "@/lib/format";
import { FACTOR_STATUS_LABELS, FACTOR_STATUS_TONE } from "@/lib/labels";
import { refreshProjectFactors } from "@/lib/projects";
import { useActiveProject, useHydrated, useStore } from "@/lib/store";

export function FactorLibrary() {
  const hydrated = useHydrated();
  const library = useStore((s) => s.library);
  const { addLibraryFactor, updateLibraryFactor, removeLibraryFactor, resetLibrary, replaceProject } = useStore();
  const active = useActiveProject();
  const [editing, setEditing] = useState<{ base?: EmissionFactor } | null>(null);
  const [category, setCategory] = useState("all");
  const [refreshed, setRefreshed] = useState(false);

  if (!hydrated) return <LoadingState />;
  const shown = library.filter((f) => category === "all" || f.category === category);
  const differs = active && JSON.stringify(active.factors) !== JSON.stringify(library);

  return (
    <PageShell>
      <PageHeader
        eyebrow="Reference data"
        title="Emission-factor library"
        description={`Dataset ${FACTOR_DATASET_VERSION}. Each project keeps its own snapshot of this library, so editing the library never silently changes an existing assessment.`}
        actions={
          <>
            <Button variant="secondary" onClick={() => resetLibrary()}>
              <RefreshCw /> Restore reference values
            </Button>
            <Button onClick={() => setEditing({})}>
              <Plus /> Add factor
            </Button>
          </>
        }
      />
      <Callout tone="warning" title="These values are not interchangeable" className="mb-6">
        The generic ranges from the B.Tech report&apos;s materials table (cradle-to-gate, boundary not stated) and the study-specific factors of the BIM material library (with stated boundaries per stage) are different kinds of value. The default template uses the BIM factors stage by stage. Ranges use the midpoint as the central value; choose low or high per project or per entry. They are secondary values, not supplier-specific declarations.
      </Callout>
      {active && differs ? (
        <Card className="mb-6 flex flex-wrap items-center justify-between gap-3 p-4">
          <p className="text-sm text-ink-muted">
            The active project <strong className="text-ink">{active.name}</strong> uses its own factor snapshot ({active.factorDatasetVersion}), which differs from this library.
          </p>
          <Button
            variant="secondary"
            size="sm"
            onClick={() => {
              replaceProject(refreshProjectFactors(structuredClone(active), library));
              setRefreshed(true);
            }}
          >
            Update the project to this library
          </Button>
        </Card>
      ) : null}
      {refreshed ? (
        <Callout tone="info" className="mb-6">
          The project&apos;s factors were updated. Saved versions keep their original factors.
        </Callout>
      ) : null}

      <Card>
        <CardHeader
          title="Factors"
          actions={
            <Select aria-label="Filter by category" value={category} onChange={(e) => setCategory(e.target.value)} className="h-9 w-auto">
              <option value="all">All categories</option>
              {["cement", "concrete", "steel", "masonry", "fuel", "transport", "other"].map((c) => (
                <option key={c} value={c}>
                  {c[0].toUpperCase() + c.slice(1)}
                </option>
              ))}
            </Select>
          }
        />
        <div className="overflow-x-auto">
          <table className="w-full min-w-[1000px] text-sm">
            <thead className="bg-surface-sunken text-left text-xs text-ink-muted">
              <tr>
                <th className="px-4 py-2 font-medium">Material or activity</th>
                <th className="px-4 py-2 text-right font-medium">Value</th>
                <th className="px-4 py-2 font-medium">Boundary</th>
                <th className="px-4 py-2 font-medium">Applicability</th>
                <th className="px-4 py-2 font-medium">Source</th>
                <th className="px-4 py-2 font-medium">Status</th>
                <th className="px-4 py-2" />
              </tr>
            </thead>
            <tbody>
              {shown.map((f) => (
                <Fragment key={f.id}>
                  <tr className="border-t border-line align-top">
                    <td className="px-4 py-3">
                      <p className="font-medium">{f.name}</p>
                      <p className="text-xs text-ink-subtle">{f.specification}</p>
                      <p className="mt-1 font-mono text-[11px] text-ink-subtle">{f.id}</p>
                    </td>
                    <td className="num px-4 py-3 text-right">
                      <p className="font-medium">{f.range ? `${fmt(f.range.low)}–${fmt(f.range.high)}` : fmt(f.value)}</p>
                      <p className="text-xs text-ink-subtle">{FACTOR_UNIT_LABELS[f.unit]}</p>
                      {f.range ? <p className="text-xs text-ink-subtle">central {fmt(f.value)}</p> : null}
                    </td>
                    <td className="max-w-64 px-4 py-3">
                      <p>{f.lifecycleModules.join(" + ") || <span className="text-amber">Not stated</span>}</p>
                      <p className="text-xs text-ink-subtle">{f.boundaryNotes}</p>
                    </td>
                    <td className="max-w-56 px-4 py-3 text-xs text-ink-muted">
                      <p>{f.intendedUse}</p>
                      <p className="mt-1 text-ink-subtle">{f.geography}</p>
                    </td>
                    <td className="max-w-56 px-4 py-3 text-xs text-ink-muted">
                      <p>{f.source}</p>
                      {f.sourceLocation ? <p className="text-ink-subtle">{f.sourceLocation}</p> : null}
                      {f.sourceDocument ? <p className="break-all text-ink-subtle">{f.sourceDocument}</p> : null}
                      <p className="text-ink-subtle">Version {f.version}</p>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex flex-col items-start gap-1">
                        <Badge tone={FACTOR_STATUS_TONE[f.status]}>{FACTOR_STATUS_LABELS[f.status]}</Badge>
                        {f.generic ? <Badge tone="outline">Generic range</Badge> : null}
                        {!f.boundaryStated ? <Badge tone="amber">Boundary uncertain</Badge> : null}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex justify-end gap-0.5">
                        {f.status === "reference" || f.status === "illustrative" ? (
                          <Button variant="ghost" size="icon" aria-label={`Create a user factor based on ${f.name}`} title="Create a user copy to modify" onClick={() => setEditing({ base: f })}>
                            <Copy />
                          </Button>
                        ) : (
                          <>
                            <Button variant="ghost" size="icon" aria-label={`Edit ${f.name}`} onClick={() => setEditing({ base: f })}>
                              <Pencil />
                            </Button>
                            <Button variant="ghost" size="icon" aria-label={`Delete ${f.name}`} onClick={() => removeLibraryFactor(f.id)}>
                              <Trash2 />
                            </Button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                </Fragment>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      <Card className="mt-6">
        <CardHeader title="Reference parameters" description="Conversion values used by the reference template and the estimator. Each one can be edited per entry." />
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <tbody>
              {REFERENCE_PARAMETERS.map((p) => (
                <tr key={p.key} className="border-t border-line first:border-0">
                  <td className="px-5 py-2">{p.label}</td>
                  <td className="num px-5 py-2 text-right font-medium">
                    {fmt(p.value)} {p.unit}
                  </td>
                  <td className="px-5 py-2 text-xs text-ink-subtle">{p.source}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      {editing ? (
        <FactorFormDialog
          open
          onOpenChange={(o) => !o && setEditing(null)}
          initial={editing.base}
          onSave={(f) => (library.some((x) => x.id === f.id) ? updateLibraryFactor(f) : addLibraryFactor(f))}
        />
      ) : null}
    </PageShell>
  );
}
