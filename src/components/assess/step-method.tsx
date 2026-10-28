"use client";

import { ChoiceCard } from "@/components/assess/step-project";
import { useUpdate } from "@/components/assess/shared";
import { CoveragePanel } from "@/components/coverage";
import { Button, Callout, Card, CardHeader } from "@/components/ui/primitives";
import type { InputMode, Project, ProjectResult } from "@/lib/engine";

const MODES: { value: InputMode; title: string; body: string; stages: string; badge?: string }[] = [
  {
    value: "quick",
    title: "A · Quick estimate",
    body: "Enter footprint, floors and a few dimensions. Missing quantities are estimated from disclosed reference-bungalow ratios and marked as assumed. Best for early planning of RCC buildings similar to the reference.",
    stages: "Covers: production and disposal of wasted material (A1–A3 / C2–C4 of waste, part of A5), transport (A4) and machinery (A5), all from assumed quantities.",
  },
  {
    value: "material",
    title: "B · Material-based calculation",
    badge: "Recommended",
    body: "Enter the actual quantities of concrete, steel, bricks, cement and other materials by stage, with waste percentages and fuel use. The estimator is still available for any quantity you do not know.",
    stages: "Covers: material wastage with the selected factors, plus transport and machinery where entered.",
  },
  {
    value: "detailed",
    title: "C · Detailed engineering assessment",
    body: "Everything in B, plus material grades, densities, range factors, life-cycle boundaries, tonne-km transport, supplier details, and import of a BIM or spreadsheet take-off schedule (CSV).",
    stages: "Covers: production of installed material (A1–A3, with the expanded boundary), construction waste, transport and machinery.",
  },
];

export function StepMethod({ project, result }: { project: Project; result: ProjectResult }) {
  const update = useUpdate(project.id);
  return (
    <div className="space-y-6">
      <Card>
        <CardHeader title="Choose the input method" description="You can switch at any time. Entries you have made are kept." />
        <div className="space-y-4 p-5">
          <div role="radiogroup" aria-label="Input method" className="grid gap-3 lg:grid-cols-3">
            {MODES.map((m) => (
              <ChoiceCard key={m.value} selected={project.inputMode === m.value} onSelect={() => update((p) => void (p.inputMode = m.value))} title={m.title} body={`${m.body} ${m.stages}`} badge={m.badge} />
            ))}
          </div>
          {project.inputMode === "quick" ? (
            <Callout tone="warning" title="Quick estimates carry large uncertainty">
              Building dimensions alone cannot fix the reinforcement, concrete or brick quantities of a particular building. Ratio-based quantities are scaled linearly from one reference bungalow (110 m² footprint, three storeys, RCC frame with brick infill), and they are labelled as assumed throughout the results.
            </Callout>
          ) : null}
          {project.inputMode === "detailed" && project.boundary === "construction_stage" ? (
            <Callout tone="info" title="Include material production?">
              <p>
                The project uses the construction-stage boundary of the reference study, which counts only wasted material. A detailed assessment usually also counts the production (A1–A3) of all installed material.
              </p>
              <Button size="sm" variant="soft" className="mt-2" onClick={() => update((p) => void (p.boundary = "expanded"))}>
                Switch to the expanded boundary
              </Button>
            </Callout>
          ) : null}
        </div>
      </Card>
      <Card>
        <CardHeader
          title="What this assessment will cover"
          description="Life-cycle modules (EN 15978) included with the current settings and entries. Never read a partial result as the building's whole-life footprint."
        />
        <div className="px-5 pb-3">
          <CoveragePanel coverage={result.coverage} />
        </div>
      </Card>
    </div>
  );
}
