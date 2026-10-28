"use client";

import { useState } from "react";
import { Dialog } from "@/components/ui/overlays";
import { Button, Checkbox, Field, Input, NumberInput, Select, Textarea } from "@/components/ui/primitives";
import { createId, userFactorInputSchema, type EmissionFactor, type FactorCategory, type FactorUnit, type LifecycleModule } from "@/lib/engine";

const MODULES: { value: LifecycleModule; label: string }[] = [
  { value: "A1-A3", label: "A1–A3 production" },
  { value: "A4", label: "A4 transport" },
  { value: "A5", label: "A5 construction" },
  { value: "C2-C4", label: "C2–C4 waste processing & disposal" },
];

type Draft = {
  name: string;
  category: FactorCategory;
  unit: FactorUnit;
  value: number | null;
  low: number | null;
  high: number | null;
  specification: string;
  geography: string;
  source: string;
  sourceDocument: string;
  version: string;
  lifecycleModules: LifecycleModule[];
  boundaryNotes: string;
  status: "user" | "verified_external";
};

function toDraft(f?: EmissionFactor, category?: FactorCategory): Draft {
  return {
    name: f?.name ?? "",
    category: f?.category ?? category ?? "concrete",
    unit: f?.unit ?? (category === "fuel" ? "kgCO2e/L" : category === "transport" ? "kgCO2e/tkm" : "kgCO2e/kg"),
    value: f?.value ?? null,
    low: f?.range?.low ?? null,
    high: f?.range?.high ?? null,
    specification: f?.specification ?? "",
    geography: f?.geography ?? "",
    source: f?.status === "reference" ? `${f.source} (adapted)` : f?.status === "illustrative" ? "" : (f?.source ?? ""),
    sourceDocument: f?.sourceDocument ?? "",
    version: f?.version ?? new Date().toISOString().slice(0, 10),
    lifecycleModules: f?.lifecycleModules ?? [],
    boundaryNotes: f?.boundaryNotes ?? "",
    status: f?.status === "verified_external" ? "verified_external" : "user",
  };
}

/**
 * Creates or edits a user factor. Reference factors are never edited in place:
 * editing one creates a user copy, so the reference dataset stays intact.
 */
export function FactorFormDialog({
  open,
  onOpenChange,
  initial,
  defaultCategory,
  onSave,
  lockCategory,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  initial?: EmissionFactor;
  defaultCategory?: FactorCategory;
  onSave: (f: EmissionFactor) => void;
  lockCategory?: boolean;
}) {
  const [d, setD] = useState<Draft>(() => toDraft(initial, defaultCategory));
  const [errors, setErrors] = useState<Record<string, string>>({});
  const editingUser = !!initial && (initial.status === "user" || initial.status === "verified_external");

  const set = <K extends keyof Draft>(k: K, v: Draft[K]) => setD((x) => ({ ...x, [k]: v }));

  function save() {
    const parsed = userFactorInputSchema.safeParse({ ...d, value: d.value ?? Number.NaN });
    if (!parsed.success) {
      const e: Record<string, string> = {};
      for (const i of parsed.error.issues) e[String(i.path[0] ?? "form")] ??= i.message;
      setErrors(e);
      return;
    }
    const v = parsed.data;
    onSave({
      id: editingUser ? initial!.id : createId("usr"),
      name: v.name,
      category: v.category,
      unit: v.unit,
      value: v.value,
      range: v.low !== null && v.high !== null ? { low: v.low, high: v.high } : undefined,
      specification: v.specification,
      geography: v.geography || "Not stated",
      source: v.source,
      sourceDocument: v.sourceDocument || undefined,
      version: v.version || new Date().toISOString().slice(0, 10),
      lifecycleModules: v.lifecycleModules,
      boundaryStated: v.lifecycleModules.length > 0,
      boundaryNotes: v.boundaryNotes,
      intendedUse: "User-defined",
      status: v.status,
      generic: false,
    });
    onOpenChange(false);
  }

  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      wide
      title={editingUser ? "Edit user factor" : initial ? `New factor based on "${initial.name}"` : "Add emission factor"}
      description="Record a source and the boundary, so that the result can be reproduced. Factors in kg CO₂e/tonne are converted to per kg."
      footer={
        <>
          <Button variant="secondary" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={save}>Save factor</Button>
        </>
      }
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Name" error={errors.name} className="sm:col-span-2">
          {(id) => <Input id={id} value={d.name} onChange={(e) => set("name", e.target.value)} placeholder="e.g. Fly ash brick, supplier X" />}
        </Field>
        <Field label="Category">
          {(id) => (
            <Select id={id} value={d.category} disabled={lockCategory} onChange={(e) => {
              const c = e.target.value as FactorCategory;
              setD((x) => ({ ...x, category: c, unit: c === "fuel" ? "kgCO2e/L" : c === "transport" ? "kgCO2e/tkm" : x.unit === "kgCO2e/L" || x.unit === "kgCO2e/tkm" ? "kgCO2e/kg" : x.unit }));
            }}>
              <option value="concrete">Concrete</option>
              <option value="cement">Cement</option>
              <option value="steel">Steel</option>
              <option value="masonry">Masonry</option>
              <option value="fuel">Fuel</option>
              <option value="transport">Transport (per tonne-km)</option>
              <option value="other">Other</option>
            </Select>
          )}
        </Field>
        <Field label="Unit" error={errors.unit}>
          {(id) => (
            <Select id={id} value={d.unit} onChange={(e) => set("unit", e.target.value as FactorUnit)}>
              {d.category === "fuel" ? (
                <option value="kgCO2e/L">kg CO₂e per litre</option>
              ) : d.category === "transport" ? (
                <option value="kgCO2e/tkm">kg CO₂e per tonne-km</option>
              ) : (
                <>
                  <option value="kgCO2e/kg">kg CO₂e per kg</option>
                  <option value="kgCO2e/t">kg CO₂e per tonne</option>
                </>
              )}
            </Select>
          )}
        </Field>
        <Field label="Value (central)" error={errors.value}>
          {(id) => <NumberInput id={id} value={d.value} onValueChange={(v) => set("value", v)} min={0} />}
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Range low" optional error={errors.low}>
            {(id) => <NumberInput id={id} value={d.low} onValueChange={(v) => set("low", v)} min={0} />}
          </Field>
          <Field label="Range high" optional>
            {(id) => <NumberInput id={id} value={d.high} onValueChange={(v) => set("high", v)} min={0} />}
          </Field>
        </div>
        <Field label="Specification" optional>
          {(id) => <Input id={id} value={d.specification} onChange={(e) => set("specification", e.target.value)} />}
        </Field>
        <Field label="Geographic applicability" optional>
          {(id) => <Input id={id} value={d.geography} onChange={(e) => set("geography", e.target.value)} placeholder="e.g. Gujarat, India" />}
        </Field>
        <Field label="Source" error={errors.source} hint="EPD number, database name, report, supplier declaration">
          {(id) => <Input id={id} value={d.source} onChange={(e) => set("source", e.target.value)} />}
        </Field>
        <Field label="Source document or URL" optional>
          {(id) => <Input id={id} value={d.sourceDocument} onChange={(e) => set("sourceDocument", e.target.value)} />}
        </Field>
        <Field label="Version or date">
          {(id) => <Input id={id} value={d.version} onChange={(e) => set("version", e.target.value)} />}
        </Field>
        <Field label="Status">
          {(id) => (
            <Select id={id} value={d.status} onChange={(e) => set("status", e.target.value as Draft["status"])}>
              <option value="user">User-supplied value</option>
              <option value="verified_external">Verified external value (e.g. third-party EPD)</option>
            </Select>
          )}
        </Field>
        <fieldset className="sm:col-span-2">
          <legend className="text-sm font-medium">Life-cycle modules covered</legend>
          <p className="mt-0.5 text-xs text-ink-subtle">Leave all unticked if the source does not say. The factor is then flagged as having an uncertain boundary, and cannot be combined with other factors.</p>
          <div className="mt-2 grid gap-2 sm:grid-cols-2">
            {MODULES.map((m) => (
              <Checkbox
                key={m.value}
                label={m.label}
                checked={d.lifecycleModules.includes(m.value)}
                onChange={(e) => set("lifecycleModules", e.target.checked ? [...d.lifecycleModules, m.value] : d.lifecycleModules.filter((x) => x !== m.value))}
              />
            ))}
          </div>
        </fieldset>
        <Field label="Boundary notes" optional className="sm:col-span-2">
          {(id) => <Textarea id={id} value={d.boundaryNotes} onChange={(e) => set("boundaryNotes", e.target.value)} />}
        </Field>
      </div>
    </Dialog>
  );
}
