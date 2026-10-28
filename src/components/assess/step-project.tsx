"use client";

import { Plus, Trash2 } from "lucide-react";
import { useUpdate } from "@/components/assess/shared";
import { InfoTip } from "@/components/ui/overlays";
import { Badge, Button, Callout, Card, CardHeader, Checkbox, Field, Input, NumberInput, Segmented, Select, Textarea } from "@/components/ui/primitives";
import { PROFILE_DESCRIPTIONS, PROFILE_LABELS, buildingArea, newBuilding, type CalculationProfile, type Project } from "@/lib/engine";
import { formatNumber } from "@/lib/format";
import { BUILDING_TYPES, TERMS } from "@/lib/labels";
import { cn } from "@/lib/utils";

export function projectStepErrors(p: Project): Record<string, string> {
  const e: Record<string, string> = {};
  if (!p.name.trim()) e.name = "Give the project a name.";
  p.buildings.forEach((b, i) => {
    if (!Number.isInteger(b.count) || b.count < 1) e[`b${i}.count`] = "Whole number, at least 1.";
    if (b.floors === null || !Number.isInteger(b.floors) || b.floors < 1) e[`b${i}.floors`] = "Whole number of floors, at least 1.";
    if (b.areaPerFloorM2 === null || b.areaPerFloorM2 <= 0) e[`b${i}.area`] = "Built-up area per floor must be greater than 0.";
  });
  return e;
}

export function StepProject({ project, showErrors }: { project: Project; showErrors: boolean }) {
  const update = useUpdate(project.id);
  const errors = showErrors ? projectStepErrors(project) : {};
  const totalArea = project.buildings.reduce((s, b) => {
    const a = buildingArea(b);
    return a === null ? s : s + a * b.count;
  }, 0);

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader title="Project information" />
        <div className="grid gap-4 p-5 sm:grid-cols-2 lg:grid-cols-3">
          <Field label="Project name" error={errors.name} className="sm:col-span-2 lg:col-span-3">
            {(id) => <Input id={id} value={project.name} aria-invalid={!!errors.name} onChange={(e) => update((p) => void (p.name = e.target.value))} />}
          </Field>
          <Field label="Country">
            {(id) => <Input id={id} value={project.location.country} onChange={(e) => update((p) => void (p.location.country = e.target.value))} autoComplete="country-name" />}
          </Field>
          <Field label="State">
            {(id) => <Input id={id} value={project.location.state} onChange={(e) => update((p) => void (p.location.state = e.target.value))} />}
          </Field>
          <Field label="City">
            {(id) => <Input id={id} value={project.location.city} onChange={(e) => update((p) => void (p.location.city = e.target.value))} />}
          </Field>
          <Field label="Building type">
            {(id) => (
              <Select id={id} value={project.buildingType} onChange={(e) => update((p) => void (p.buildingType = e.target.value as Project["buildingType"]))}>
                {BUILDING_TYPES.map((t) => (
                  <option key={t.value} value={t.value}>
                    {t.label}
                  </option>
                ))}
              </Select>
            )}
          </Field>
          {project.buildingType === "other" ? (
            <Field label="Describe the building type">
              {(id) => <Input id={id} value={project.buildingTypeOther} onChange={(e) => update((p) => void (p.buildingTypeOther = e.target.value))} />}
            </Field>
          ) : null}
          <Field label="Construction status">
            {(id) => (
              <Select id={id} value={project.constructionStatus} onChange={(e) => update((p) => void (p.constructionStatus = e.target.value as Project["constructionStatus"]))}>
                <option value="planning">Planning</option>
                <option value="ongoing">Ongoing</option>
                <option value="completed">Completed</option>
              </Select>
            )}
          </Field>
          <Field label="Assessment period" optional hint="e.g. construction from Jan 2026 to Mar 2027">
            {(id) => <Input id={id} value={project.assessmentPeriod ?? ""} onChange={(e) => update((p) => void (p.assessmentPeriod = e.target.value))} />}
          </Field>
          <Field label="Project description" optional className="sm:col-span-2 lg:col-span-3">
            {(id) => <Textarea id={id} value={project.notes} onChange={(e) => update((p) => void (p.notes = e.target.value))} placeholder="Scope of the assessment, data sources, anything a reviewer should know" />}
          </Field>
        </div>
      </Card>

      <Card>
        <CardHeader
          title="Buildings"
          description="Enter buildings with different quantities as separate groups. A group is multiplied by its count only if you confirm that its buildings are identical."
          actions={
            <Button variant="secondary" size="sm" onClick={() => update((p) => void p.buildings.push(newBuilding({ name: `Building type ${p.buildings.length + 1}` })))}>
              <Plus /> Add a different building
            </Button>
          }
        />
        <div className="divide-y divide-line">
          {project.buildings.map((b, i) => {
            const area = buildingArea(b);
            return (
              <div key={b.id} className="grid gap-4 p-5 sm:grid-cols-2 lg:grid-cols-[1.5fr_0.7fr_0.7fr_1fr_0.9fr_auto]">
                <Field label="Group name">
                  {(id) => <Input id={id} value={b.name} onChange={(e) => update((p) => void (p.buildings[i].name = e.target.value))} />}
                </Field>
                <Field label="Number of buildings" error={errors[`b${i}.count`]}>
                  {(id) => <NumberInput id={id} value={b.count} min={1} onValueChange={(v) => update((p) => void (p.buildings[i].count = v === null ? 0 : v))} />}
                </Field>
                <Field label="Floors per building" error={errors[`b${i}.floors`]}>
                  {(id) => <NumberInput id={id} value={b.floors} min={1} onValueChange={(v) => update((p) => void (p.buildings[i].floors = v))} />}
                </Field>
                <Field label={<span className="flex items-center gap-1.5">Built-up area per floor <InfoTip label="built-up area">{TERMS.builtUp}</InfoTip></span>} error={errors[`b${i}.area`]}>
                  {(id) => <NumberInput id={id} value={b.areaPerFloorM2} min={0} suffix="m²" onValueChange={(v) => update((p) => void (p.buildings[i].areaPerFloorM2 = v))} />}
                </Field>
                <div className="space-y-1.5">
                  <p className="text-sm font-medium">Built-up area</p>
                  <p className="num flex h-10 items-center text-sm text-ink-muted">
                    {area === null ? "—" : `${formatNumber(area)} m² each`}
                  </p>
                </div>
                <div className="flex items-end">
                  {project.buildings.length > 1 ? (
                    <Button variant="ghost" size="icon" aria-label={`Remove ${b.name}`} onClick={() => update((p) => void p.buildings.splice(i, 1))}>
                      <Trash2 />
                    </Button>
                  ) : null}
                </div>
                {b.count > 1 ? (
                  <div className="sm:col-span-2 lg:col-span-6">
                    <Checkbox
                      checked={b.identicalConfirmed}
                      onChange={(e) => update((p) => void (p.buildings[i].identicalConfirmed = e.target.checked))}
                      label={`These ${b.count} buildings have identical quantities and construction activities`}
                      description="If they differ, add each different building as its own group. Unconfirmed groups are calculated for one building only."
                    />
                  </div>
                ) : null}
              </div>
            );
          })}
        </div>
        <div className="flex items-center justify-between border-t border-line bg-surface-sunken px-5 py-3 text-sm">
          <span className="text-ink-muted">Total built-up area (calculated)</span>
          <span className="num font-semibold">{totalArea > 0 ? `${formatNumber(totalArea)} m²` : "—"}</span>
        </div>
      </Card>

      <Card>
        <CardHeader title="Assessment settings" />
        <div className="space-y-6 p-5">
          <div>
            <p className="flex items-center gap-1.5 text-sm font-medium">Assessment boundary <InfoTip label="assessment boundary">{TERMS.boundary}</InfoTip></p>
            <div role="radiogroup" aria-label="Assessment boundary" className="mt-2 grid gap-3 md:grid-cols-2">
              <ChoiceCard
                selected={project.boundary === "construction_stage"}
                onSelect={() => update((p) => void (p.boundary = "construction_stage"))}
                title="Construction-stage emissions"
                badge="Reference study boundary"
                body="Embodied carbon of material wasted on site, plus diesel for transport (A4) and site machinery (A5). This is what the reference project assesses."
              />
              <ChoiceCard
                selected={project.boundary === "expanded"}
                onSelect={() => update((p) => void (p.boundary = "expanded"))}
                title="Expanded: add installed material (A1–A3)"
                body="Also counts the production emissions of all installed material where a production-only factor is selected. Still not a whole-life assessment: use stage (B) and end of life (C) are not covered."
              />
            </div>
            <p className="mt-2 text-xs text-ink-subtle">The reference project assesses the physical construction phase only, not the complete lifetime carbon footprint of the building.</p>
          </div>
          <div>
            <p className="flex items-center gap-1.5 text-sm font-medium">Calculation profile <InfoTip label="calculation profile">{TERMS.profile}</InfoTip></p>
            <div role="radiogroup" aria-label="Calculation profile" className="mt-2 grid gap-3 md:grid-cols-2">
              {(["report_master", "foundation_inclusive"] as CalculationProfile[]).map((pr) => (
                <ChoiceCard
                  key={pr}
                  selected={project.profile === pr}
                  onSelect={() => update((p) => void (p.profile = pr))}
                  title={PROFILE_LABELS[pr]}
                  badge={pr === "report_master" ? "Default" : undefined}
                  body={PROFILE_DESCRIPTIONS[pr]}
                />
              ))}
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <p className="text-sm font-medium">Default level for range factors</p>
            <Segmented
              label="Default factor level"
              value={project.defaultFactorLevel}
              onChange={(v) => update((p) => void (p.defaultFactorLevel = v))}
              options={[
                { value: "low", label: "Low" },
                { value: "central", label: "Central" },
                { value: "high", label: "High" },
              ]}
              size="sm"
            />
            <p className="text-xs text-ink-subtle">Applies to factors given as a range (e.g. rebar 1.80–2.40). Central is the midpoint of the range. Point values are not affected.</p>
          </div>
          {project.buildingType === "commercial" || project.buildingType === "industrial" ? (
            <Callout tone="warning" title="Reference ratios may not apply">
              The default waste allowances and quick-estimate ratios come from a low-rise residential RCC bungalow. Enter project-specific quantities for this building type.
            </Callout>
          ) : null}
        </div>
      </Card>
    </div>
  );
}

export function ChoiceCard({ selected, onSelect, title, body, badge }: { selected: boolean; onSelect: () => void; title: string; body: string; badge?: string }) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={selected}
      onClick={onSelect}
      className={cn(
        "rounded-xl border p-4 text-left transition-colors",
        selected ? "border-primary bg-surface-muted ring-1 ring-primary" : "border-line bg-surface hover:border-line-strong",
      )}
    >
      <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
        <span className={cn("inline-flex size-4 shrink-0 items-center justify-center rounded-full border", selected ? "border-primary" : "border-line-strong")}>
          {selected ? <span className="size-2 rounded-full bg-primary" /> : null}
        </span>
        <span className="font-medium">{title}</span>
        {badge ? <Badge tone="green">{badge}</Badge> : null}
      </span>
      <span className="mt-2 block text-sm text-ink-muted">{body}</span>
    </button>
  );
}
