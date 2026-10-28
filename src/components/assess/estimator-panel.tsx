"use client";

import * as Collapsible from "@radix-ui/react-collapsible";
import { ChevronDown, Wand2 } from "lucide-react";
import { useMemo, useState } from "react";
import { useUpdate } from "@/components/assess/shared";
import { Badge, Button, Callout, Card, Checkbox, Field, NumberInput } from "@/components/ui/primitives";
import { defaultEstimatorInput, estimateQuantities, type EstimatorInput, type Project } from "@/lib/engine";
import { formatNumber } from "@/lib/format";

const STATUS_BADGE = {
  user_provided: { tone: "neutral", label: "Entered" },
  estimated: { tone: "outline", label: "Estimated" },
  assumed: { tone: "amber", label: "Assumed" },
  missing: { tone: "red", label: "Missing" },
} as const;

export function EstimatorPanel({ project, buildingIndex, defaultOpen }: { project: Project; buildingIndex: number; defaultOpen: boolean }) {
  const b = project.buildings[buildingIndex];
  const update = useUpdate(project.id);
  const [open, setOpen] = useState(defaultOpen);
  const [input, setInput] = useState<EstimatorInput>(() => defaultEstimatorInput(b.areaPerFloorM2, b.floors));
  const [applied, setApplied] = useState<string | null>(null);
  const out = useMemo(() => estimateQuantities(input), [input]);
  const set = <K extends keyof EstimatorInput>(k: K, v: EstimatorInput[K]) => setInput((x) => ({ ...x, [k]: v }));
  const setKnown = (k: keyof EstimatorInput["known"], v: number | null) => setInput((x) => ({ ...x, known: { ...x.known, [k]: v } }));
  const manualCount = b.materials.filter((m) => m.origin !== "estimator").length;

  function apply() {
    update((p) => {
      const g = p.buildings[buildingIndex];
      g.materials = [...g.materials.filter((m) => m.origin !== "estimator"), ...out.materials];
      if (input.estimateLogistics) {
        g.transport = [...g.transport.filter((t) => t.origin !== "estimator"), ...out.transport];
        g.machinery = [...g.machinery.filter((m) => m.origin !== "estimator"), ...out.machinery];
      }
    });
    setApplied(`Added ${out.materials.length} material entries${input.estimateLogistics ? `, ${out.transport.length} transport and ${out.machinery.length} machinery entries` : ""}. Earlier estimator entries were replaced; your own entries were kept.`);
  }

  return (
    <Card>
      <Collapsible.Root open={open} onOpenChange={setOpen}>
        <Collapsible.Trigger className="flex w-full items-center justify-between gap-3 px-5 py-4 text-left">
          <span>
            <span className="flex items-center gap-2 font-semibold">
              <Wand2 className="size-4 text-leaf" aria-hidden /> Simplified quantity estimator
            </span>
            <span className="mt-0.5 block text-sm text-ink-muted">Derive quantities from building dimensions where possible, with disclosed reference ratios for the rest.</span>
          </span>
          <ChevronDown className={`size-4 shrink-0 text-ink-muted transition-transform ${open ? "rotate-180" : ""}`} aria-hidden />
        </Collapsible.Trigger>
        <Collapsible.Content className="border-t border-line">
          <div className="grid gap-6 p-5 lg:grid-cols-[1fr_1.2fr]">
            <div className="space-y-5">
              <fieldset>
                <legend className="text-sm font-semibold">Building dimensions</legend>
                <div className="mt-3 grid grid-cols-2 gap-3">
                  <Field label="Footprint per floor">{(id) => <NumberInput id={id} value={input.footprintM2} suffix="m²" min={0} onValueChange={(v) => set("footprintM2", v)} />}</Field>
                  <Field label="Number of floors">{(id) => <NumberInput id={id} value={input.floors} min={1} onValueChange={(v) => set("floors", v)} />}</Field>
                  <Field label="Clear wall height">{(id) => <NumberInput id={id} value={input.clearWallHeightM} suffix="m" min={0} onValueChange={(v) => set("clearWallHeightM", v)} />}</Field>
                  <Field label="Slab thickness">{(id) => <NumberInput id={id} value={input.slabThicknessM} suffix="m" min={0} onValueChange={(v) => set("slabThicknessM", v)} />}</Field>
                  <Field label="Wall thickness">{(id) => <NumberInput id={id} value={input.wallThicknessM} suffix="m" min={0} onValueChange={(v) => set("wallThicknessM", v)} />}</Field>
                  <Field label="Wall length per floor" optional hint="Total internal + external">
                    {(id) => <NumberInput id={id} value={input.wallLengthPerFloorM} suffix="m" min={0} onValueChange={(v) => set("wallLengthPerFloorM", v)} />}
                  </Field>
                  <Field label="Openings (doors, windows)">{(id) => <NumberInput id={id} value={input.openingsPercent} suffix="%" min={0} onValueChange={(v) => set("openingsPercent", v)} />}</Field>
                  <Field label="Beam allowance in slab" optional hint="Per floor">
                    {(id) => <NumberInput id={id} value={input.beamAllowancePerFloorM3} suffix="m³" min={0} onValueChange={(v) => set("beamAllowancePerFloorM3", v)} />}
                  </Field>
                  <Field label="Bricks per m³">{(id) => <NumberInput id={id} value={input.bricksPerM3} min={0} onValueChange={(v) => set("bricksPerM3", v)} />}</Field>
                  <Field label="Mass per brick">{(id) => <NumberInput id={id} value={input.brickMassKg} suffix="kg" min={0} onValueChange={(v) => set("brickMassKg", v)} />}</Field>
                  <Field label="Concrete density">{(id) => <NumberInput id={id} value={input.densityKgPerM3} suffix="kg/m³" min={0} onValueChange={(v) => set("densityKgPerM3", v)} />}</Field>
                </div>
              </fieldset>
              <fieldset>
                <legend className="text-sm font-semibold">Quantities you already know</legend>
                <p className="text-xs text-ink-subtle">Leave blank if unknown. A value entered here overrides the estimate.</p>
                <div className="mt-3 grid grid-cols-2 gap-3">
                  <Field label="Foundation concrete" optional>{(id) => <NumberInput id={id} value={input.known.foundationConcreteM3} suffix="m³" min={0} onValueChange={(v) => setKnown("foundationConcreteM3", v)} />}</Field>
                  <Field label="Plinth concrete" optional>{(id) => <NumberInput id={id} value={input.known.plinthConcreteM3} suffix="m³" min={0} onValueChange={(v) => setKnown("plinthConcreteM3", v)} />}</Field>
                  <Field label="Columns & beams concrete" optional>{(id) => <NumberInput id={id} value={input.known.frameConcreteM3} suffix="m³" min={0} onValueChange={(v) => setKnown("frameConcreteM3", v)} />}</Field>
                  <Field label="Slab concrete" optional>{(id) => <NumberInput id={id} value={input.known.slabConcreteM3} suffix="m³" min={0} onValueChange={(v) => setKnown("slabConcreteM3", v)} />}</Field>
                  <Field label="Plinth steel" optional>{(id) => <NumberInput id={id} value={input.known.plinthSteelKg} suffix="kg" min={0} onValueChange={(v) => setKnown("plinthSteelKg", v)} />}</Field>
                  <Field label="Columns & beams steel" optional>{(id) => <NumberInput id={id} value={input.known.frameSteelKg} suffix="kg" min={0} onValueChange={(v) => setKnown("frameSteelKg", v)} />}</Field>
                  <Field label="Slab steel" optional>{(id) => <NumberInput id={id} value={input.known.slabSteelKg} suffix="kg" min={0} onValueChange={(v) => setKnown("slabSteelKg", v)} />}</Field>
                  <Field label="Number of bricks" optional>{(id) => <NumberInput id={id} value={input.known.brickCount} min={0} onValueChange={(v) => setKnown("brickCount", v)} />}</Field>
                </div>
              </fieldset>
              <div className="space-y-3">
                <Checkbox
                  checked={input.useReferenceRatios}
                  onChange={(e) => set("useReferenceRatios", e.target.checked)}
                  label="Use reference-bungalow ratios for quantities that cannot be derived"
                  description="Concrete and steel in the frame, plinth and foundation cannot be derived from dimensions. Untick to leave them missing instead."
                />
                <Checkbox checked={input.includeFoundation} onChange={(e) => set("includeFoundation", e.target.checked)} label="Include a foundation stage" />
                <Checkbox
                  checked={input.estimateLogistics}
                  onChange={(e) => set("estimateLogistics", e.target.checked)}
                  label="Also estimate deliveries and machinery (assumed)"
                  description="RMC trips from concrete volume ÷ 7 m³; delivery trips and machine hours from reference ratios per m² of built-up area."
                />
                {input.estimateLogistics ? (
                  <Checkbox
                    checked={input.includeFoundationInRmc}
                    onChange={(e) => set("includeFoundationInRmc", e.target.checked)}
                    label="Count foundation concrete in RMC trips"
                    description="The reference report counts only plinth, frame and slab concrete (134 m³ → 20 trips)."
                  />
                ) : null}
              </div>
            </div>

            <div className="space-y-3">
              <p className="text-sm font-semibold">Estimated quantities (per building)</p>
              {out.warnings.map((w) => (
                <Callout key={w} tone="warning">
                  {w}
                </Callout>
              ))}
              <ul className="space-y-2">
                {out.quantities.map((q) => (
                  <li key={q.key} className="rounded-lg border border-line bg-page p-3">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-sm font-medium">{q.label}</span>
                      <span className="flex items-center gap-2">
                        <span className="num text-sm font-semibold">{q.value === null ? "—" : `${formatNumber(q.value, 2)} ${q.unit}`}</span>
                        <Badge tone={STATUS_BADGE[q.status].tone}>{STATUS_BADGE[q.status].label}</Badge>
                      </span>
                    </div>
                    <p className="mt-1 font-mono text-[11px] text-ink-muted">{q.basis}</p>
                  </li>
                ))}
              </ul>
              {input.estimateLogistics && (out.transport.length || out.machinery.length) ? (
                <ul className="space-y-2">
                  {[...out.transport, ...out.machinery].map((t) => (
                    <li key={t.id} className="rounded-lg border border-line bg-page p-3">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-sm font-medium">{t.name}</span>
                        <Badge tone="amber">Assumed</Badge>
                      </div>
                      <p className="mt-1 font-mono text-[11px] text-ink-muted">{t.notes}</p>
                    </li>
                  ))}
                </ul>
              ) : null}
              <div className="flex flex-wrap items-center gap-3 pt-1">
                <Button onClick={apply} disabled={out.materials.length === 0}>
                  Apply to {b.name}
                </Button>
                {manualCount > 0 ? <p className="text-xs text-ink-muted">Your {manualCount} existing entr{manualCount === 1 ? "y is" : "ies are"} kept. Check for overlap with the estimated entries.</p> : null}
              </div>
              {applied ? <Callout tone="info">{applied}</Callout> : null}
            </div>
          </div>
        </Collapsible.Content>
      </Collapsible.Root>
    </Card>
  );
}
