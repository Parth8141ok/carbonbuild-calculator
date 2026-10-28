"use client";

import { Plus, Trash2 } from "lucide-react";
import { useMemo, useState } from "react";
import { AuditSteps } from "@/components/audit";
import { FactorFormDialog } from "@/components/factor-form";
import { Dialog } from "@/components/ui/overlays";
import { Badge, Button, Callout, Field, Input, NumberInput, Select, Textarea } from "@/components/ui/primitives";
import {
  QUANTITY_UNIT_LABELS,
  calculateProject,
  type EmissionFactor,
  type FactorLevel,
  type FactorRef,
  type MaterialCategory,
  type MaterialEntry,
  type Project,
  type QuantityUnit,
} from "@/lib/engine";
import { formatKg } from "@/lib/format";
import { DATA_STATUS_OPTIONS, factorOptionLabel } from "@/lib/labels";

export function massFactors(project: Project, category: MaterialCategory): EmissionFactor[] {
  return project.factors.filter((f) => (f.unit === "kgCO2e/kg" || f.unit === "kgCO2e/t") && (category === "other" || f.category === category || f.category === "other"));
}

/** Full editor for one material entry. Changes are previewed live and saved on confirm. */
export function MaterialDialog({
  project,
  buildingIndex,
  entry,
  open,
  onOpenChange,
  onSave,
  onAddFactor,
}: {
  project: Project;
  buildingIndex: number;
  entry: MaterialEntry;
  open: boolean;
  onOpenChange: (o: boolean) => void;
  onSave: (e: MaterialEntry) => void;
  onAddFactor: (f: EmissionFactor) => void;
}) {
  const [d, setD] = useState<MaterialEntry>(() => structuredClone(entry));
  const [factorFormFor, setFactorFormFor] = useState<"waste" | "installed" | null>(null);
  const set = <K extends keyof MaterialEntry>(k: K, v: MaterialEntry[K]) => setD((x) => ({ ...x, [k]: v }));
  const options = massFactors(project, d.category);

  const preview = useMemo(() => {
    const p = structuredClone(project);
    const b = p.buildings[buildingIndex];
    const idx = b.materials.findIndex((m) => m.id === d.id);
    if (idx >= 0) b.materials[idx] = d;
    else b.materials.push(d);
    return calculateProject(p).lines.filter((l) => l.entryId === d.id && l.buildingId === b.id);
  }, [project, buildingIndex, d]);

  const waste = preview.find((l) => l.kind === "material");
  const installed = preview.find((l) => l.kind === "installed");

  const setFactor = (i: number, ref: Partial<FactorRef>) => setD((x) => ({ ...x, factors: x.factors.map((f, j) => (j === i ? { ...f, ...ref } : f)) }));

  return (
    <>
      <Dialog
        open={open}
        onOpenChange={onOpenChange}
        wide
        title={entry.name ? `Edit: ${entry.name}` : "Material entry"}
        description="Quantity, waste allowance and emission factors. The calculation below updates as you type."
        footer={
          <>
            <Button variant="secondary" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button
              onClick={() => {
                onSave(d);
                onOpenChange(false);
              }}
            >
              Save entry
            </Button>
          </>
        }
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Material name">{(id) => <Input id={id} value={d.name} onChange={(e) => set("name", e.target.value)} />}</Field>
          <Field label="Grade or specification" optional>
            {(id) => <Input id={id} value={d.specification} onChange={(e) => set("specification", e.target.value)} placeholder="e.g. M25, Fe500, 43 grade" />}
          </Field>
          <Field label="Construction stage">
            {(id) => (
              <Select id={id} value={d.stageId} onChange={(e) => set("stageId", e.target.value)}>
                {project.stages.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </Select>
            )}
          </Field>
          <Field label="Material category">
            {(id) => (
              <Select id={id} value={d.category} onChange={(e) => set("category", e.target.value as MaterialCategory)}>
                <option value="concrete">Concrete (finished mix)</option>
                <option value="cement">Cement (standalone)</option>
                <option value="steel">Steel</option>
                <option value="masonry">Masonry</option>
                <option value="other">Other</option>
              </Select>
            )}
          </Field>
          {d.category === "cement" ? (
            <Field label="Cement scope" className="sm:col-span-2" hint="A concrete mix factor already includes the cement in it. Count cement separately only when it is not part of a concrete entry.">
              {(id) => (
                <Select id={id} value={d.cementScope ?? "standalone"} onChange={(e) => set("cementScope", e.target.value as MaterialEntry["cementScope"])}>
                  <option value="standalone">Standalone: not part of any concrete entry (counted)</option>
                  <option value="in_concrete">Contained in a concrete entry (information only, not counted)</option>
                </Select>
              )}
            </Field>
          ) : null}
          <Field label="Quantity">{(id) => <NumberInput id={id} value={d.quantity} min={0} onValueChange={(v) => set("quantity", v)} />}</Field>
          <Field label="Unit">
            {(id) => (
              <Select id={id} value={d.unit} onChange={(e) => set("unit", e.target.value as QuantityUnit)}>
                {(Object.keys(QUANTITY_UNIT_LABELS) as QuantityUnit[]).map((u) => (
                  <option key={u} value={u}>
                    {QUANTITY_UNIT_LABELS[u]}
                  </option>
                ))}
              </Select>
            )}
          </Field>
          {d.unit === "m3" ? (
            <Field label="Density" hint="Reinforced concrete: 2,400 kg/m³ in the reference study">
              {(id) => <NumberInput id={id} value={d.densityKgPerM3} min={0} suffix="kg/m³" onValueChange={(v) => set("densityKgPerM3", v)} />}
            </Field>
          ) : null}
          {d.unit === "m3_brickwork" ? (
            <Field label="Bricks per m³" hint="500 with 10 mm joints in the reference study">
              {(id) => <NumberInput id={id} value={d.bricksPerM3} min={0} onValueChange={(v) => set("bricksPerM3", v)} />}
            </Field>
          ) : null}
          {d.unit === "bricks" || d.unit === "m3_brickwork" ? (
            <Field label="Mass of one brick" hint="3 kg in the reference study">
              {(id) => <NumberInput id={id} value={d.brickMassKg} min={0} suffix="kg" onValueChange={(v) => set("brickMassKg", v)} />}
            </Field>
          ) : null}
          <Field label="Material waste">{(id) => <NumberInput id={id} value={d.wastePercent} min={0} suffix="%" onValueChange={(v) => set("wastePercent", v)} />}</Field>
          <Field label="Waste % source">
            {(id) => (
              <Select id={id} value={d.wasteSource} onChange={(e) => set("wasteSource", e.target.value as MaterialEntry["wasteSource"])}>
                <option value="reference">Reference assumption (industry average)</option>
                <option value="user">User-provided</option>
                <option value="measured">Measured on site</option>
              </Select>
            )}
          </Field>
          <Field label="Quantity data status" className="sm:col-span-2" hint={DATA_STATUS_OPTIONS.find((o) => o.value === d.dataStatus)?.description}>
            {(id) => (
              <Select id={id} value={d.dataStatus} onChange={(e) => set("dataStatus", e.target.value as MaterialEntry["dataStatus"])}>
                {DATA_STATUS_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </Select>
            )}
          </Field>

          <fieldset className="space-y-3 rounded-lg border border-line p-4 sm:col-span-2">
            <legend className="px-1 text-sm font-medium">Emission factor applied to the wasted mass</legend>
            <p className="text-xs text-ink-muted">
              Add a second component only for separately modelled production (A1–A3) and disposal (C2–C4). Components with overlapping or unknown boundaries are rejected, because they would count emissions twice.
            </p>
            {d.factors.map((ref, i) => {
              const f = project.factors.find((x) => x.id === ref.factorId);
              return (
                <div key={i} className="grid gap-2 sm:grid-cols-[1fr_auto_auto]">
                  <Select aria-label={`Factor component ${i + 1}`} value={ref.factorId} onChange={(e) => setFactor(i, { factorId: e.target.value, level: undefined })}>
                    {!f ? <option value={ref.factorId}>Missing: {ref.factorId}</option> : null}
                    {options.map((o) => (
                      <option key={o.id} value={o.id}>
                        {factorOptionLabel(o)}
                      </option>
                    ))}
                  </Select>
                  {f?.range ? (
                    <Select aria-label="Range level" value={ref.level ?? ""} onChange={(e) => setFactor(i, { level: (e.target.value || undefined) as FactorLevel | undefined })} className="sm:w-44">
                      <option value="">Project default ({project.defaultFactorLevel})</option>
                      <option value="low">Low ({f.range.low})</option>
                      <option value="central">Central ({f.value})</option>
                      <option value="high">High ({f.range.high})</option>
                    </Select>
                  ) : (
                    <span />
                  )}
                  <Button variant="ghost" size="icon" aria-label="Remove factor component" disabled={d.factors.length === 1} onClick={() => set("factors", d.factors.filter((_, j) => j !== i))}>
                    <Trash2 />
                  </Button>
                </div>
              );
            })}
            {d.factors.length === 0 ? <p className="text-sm text-danger">No factor selected.</p> : null}
            <div className="flex flex-wrap gap-2">
              <Button variant="secondary" size="sm" disabled={!options.length} onClick={() => set("factors", [...d.factors, { factorId: options[0]?.id ?? "" }])}>
                <Plus /> Add component
              </Button>
              <Button variant="ghost" size="sm" onClick={() => setFactorFormFor("waste")}>
                <Plus /> New custom factor
              </Button>
            </div>
            {d.factors.map((r) => project.factors.find((f) => f.id === r.factorId)).filter(Boolean).map((f) => (
              <p key={f!.id} className="text-xs text-ink-subtle">
                <span className="font-medium text-ink-muted">{f!.name}:</span> {f!.boundaryNotes} <span className="italic">Source: {f!.source}{f!.sourceLocation ? `, ${f!.sourceLocation}` : ""}.</span>
              </p>
            ))}
          </fieldset>

          {project.boundary === "expanded" ? (
            <fieldset className="space-y-2 rounded-lg border border-line p-4 sm:col-span-2">
              <legend className="px-1 text-sm font-medium">Installed material production factor (A1–A3)</legend>
              <p className="text-xs text-ink-muted">Expanded boundary only. Applied to the full installed quantity. Choose a production-only factor.</p>
              <Select aria-label="Installed material factor" value={d.installedFactor?.factorId ?? ""} onChange={(e) => set("installedFactor", e.target.value ? { factorId: e.target.value } : null)}>
                <option value="">None: installed embodied carbon not calculated</option>
                {options.map((o) => (
                  <option key={o.id} value={o.id}>
                    {factorOptionLabel(o)} [{o.lifecycleModules.join(" + ") || "boundary not stated"}]
                  </option>
                ))}
              </Select>
              <Button variant="ghost" size="sm" onClick={() => setFactorFormFor("installed")}>
                <Plus /> New custom factor
              </Button>
            </fieldset>
          ) : null}

          <Field label="Notes" optional className="sm:col-span-2">
            {(id) => <Textarea id={id} value={d.notes} onChange={(e) => set("notes", e.target.value)} />}
          </Field>
        </div>

        <div className="mt-6 space-y-3 rounded-lg bg-surface-sunken p-4">
          <div className="flex items-center justify-between gap-3">
            <p className="text-sm font-semibold">Calculation preview</p>
            {waste ? <Badge tone={waste.valid ? "green" : "red"}>{waste.valid ? formatKg(waste.emissionsPerBuildingKg) : "Invalid input"}</Badge> : null}
          </div>
          {waste ? <AuditSteps line={waste} /> : null}
          {installed ? (
            <>
              <p className="pt-2 text-sm font-semibold">Installed material (A1–A3)</p>
              <AuditSteps line={installed} />
            </>
          ) : null}
          {waste?.flags.filter((f) => f.severity !== "info").map((f, i) => (
            <Callout key={i} tone={f.severity === "error" ? "error" : "warning"}>
              {f.message}
            </Callout>
          ))}
        </div>
      </Dialog>
      {factorFormFor ? (
        <FactorFormDialog
          open
          onOpenChange={(o) => !o && setFactorFormFor(null)}
          defaultCategory={d.category === "other" ? "other" : d.category}
          onSave={(f) => {
            onAddFactor(f);
            if (factorFormFor === "waste") set("factors", [{ factorId: f.id }]);
            else set("installedFactor", { factorId: f.id });
          }}
        />
      ) : null}
    </>
  );
}
