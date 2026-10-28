"use client";

import { ArrowLeft, ArrowRight, Check, Save } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { PageShell, useProjectResult } from "@/components/assess/shared";
import { StartScreen } from "@/components/assess/start-screen";
import { StepLogistics } from "@/components/assess/step-logistics";
import { StepMaterials } from "@/components/assess/step-materials";
import { StepMethod } from "@/components/assess/step-method";
import { StepProject, projectStepErrors } from "@/components/assess/step-project";
import { StepReview } from "@/components/assess/step-review";
import { LoadingState } from "@/components/assess/shared";
import { Badge, Button, Callout } from "@/components/ui/primitives";
import { PROFILE_LABELS, type Project, type ProjectResult } from "@/lib/engine";
import { formatFixed, formatKg } from "@/lib/format";
import { useActiveProject, useHydrated, useStore } from "@/lib/store";
import { cn } from "@/lib/utils";

const STEPS = ["Project", "Input method", "Materials", "Transport & machinery", "Review"];

export function AssessApp() {
  const hydrated = useHydrated();
  const project = useActiveProject();
  if (!hydrated) return <LoadingState />;
  if (!project) return <StartScreen />;
  return <Wizard key={project.id} project={project} />;
}

function Wizard({ project }: { project: Project }) {
  const step = useStore((s) => s.wizardStep[project.id] ?? 0);
  const setStep = useStore((s) => s.setWizardStep);
  const setActive = useStore((s) => s.setActive);
  const [showErrors, setShowErrors] = useState(false);
  const [buildingIndex, setBuildingIndex] = useState(0);
  const result = useProjectResult(project)!;

  const go = (n: number) => {
    if (n > step && step === 0 && Object.keys(projectStepErrors(project)).length) {
      setShowErrors(true);
      return;
    }
    setShowErrors(false);
    setStep(project.id, Math.max(0, Math.min(STEPS.length - 1, n)));
    window.scrollTo({ top: 0, behavior: "smooth" });
  };
  const step0Blocked = showErrors && Object.keys(projectStepErrors(project)).length > 0;

  return (
    <PageShell>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-leaf">Assessment</p>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight">{project.name || "Untitled project"}</h1>
          <p className="mt-1 flex items-center gap-1.5 text-sm text-ink-muted">
            <Save className="size-3.5" aria-hidden /> Saved automatically in this browser
            {project.isSample ? <Badge tone="green" className="ml-1">Reference sample</Badge> : null}
          </p>
        </div>
        <Button variant="ghost" size="sm" onClick={() => setActive(null)}>
          Switch project
        </Button>
      </div>

      <nav aria-label="Assessment steps" className="mt-6">
        <ol className="flex gap-1 overflow-x-auto pb-1">
          {STEPS.map((s, i) => (
            <li key={s} className="min-w-36 flex-1">
              <button
                type="button"
                onClick={() => go(i)}
                aria-current={i === step ? "step" : undefined}
                className={cn("w-full rounded-lg border-t-[3px] px-1 pt-2 text-left", i === step ? "border-primary" : i < step ? "border-leaf/60" : "border-line")}
              >
                <span className="flex items-center gap-1.5 text-xs text-ink-subtle">
                  {i < step ? <Check className="size-3.5 text-leaf" aria-hidden /> : null}Step {i + 1}
                </span>
                <span className={cn("block text-sm font-medium", i === step ? "text-ink" : "text-ink-muted")}>{s}</span>
              </button>
            </li>
          ))}
        </ol>
      </nav>

      <div className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,1fr)_300px]">
        <div className="min-w-0 space-y-6">
          {step0Blocked ? <Callout tone="error" title="Complete the highlighted fields to continue" /> : null}
          {step === 0 ? <StepProject project={project} showErrors={showErrors} /> : null}
          {step === 1 ? <StepMethod project={project} result={result} /> : null}
          {step === 2 ? <StepMaterials project={project} result={result} buildingIndex={buildingIndex} setBuildingIndex={setBuildingIndex} /> : null}
          {step === 3 ? <StepLogistics project={project} result={result} buildingIndex={buildingIndex} setBuildingIndex={setBuildingIndex} /> : null}
          {step === 4 ? <StepReview project={project} result={result} /> : null}

          <div className="flex items-center justify-between border-t border-line pt-5">
            <Button variant="secondary" onClick={() => go(step - 1)} disabled={step === 0}>
              <ArrowLeft /> Back
            </Button>
            {step < STEPS.length - 1 ? (
              <Button onClick={() => go(step + 1)}>
                Continue <ArrowRight />
              </Button>
            ) : (
              <Button asChild>
                <Link href="/results">
                  View results <ArrowRight />
                </Link>
              </Button>
            )}
          </div>
        </div>
        <LiveTotal project={project} result={result} />
      </div>
    </PageShell>
  );
}

function LiveTotal({ project, result }: { project: Project; result: ProjectResult }) {
  const t = result.totals;
  const errors = result.flags.filter((f) => f.severity === "error").length;
  return (
    <aside aria-label="Running total" className="lg:sticky lg:top-24 lg:self-start">
      <div className="rounded-xl border border-line bg-surface p-5">
        <p className="text-xs font-medium text-ink-muted">Running total</p>
        <p className="num mt-1 text-3xl font-semibold tracking-tight" aria-live="polite">
          {formatFixed(t.totalTonnes)}
          <span className="ml-1 text-base font-medium text-ink-muted">t CO₂e</span>
        </p>
        <p className="num text-sm text-ink-muted">{formatKg(t.totalKg)}</p>
        <dl className="mt-4 space-y-2 border-t border-line pt-4 text-sm">
          <Row label="Material wastage" value={formatFixed(t.materialWasteKg)} />
          <Row label="Transportation" value={formatFixed(t.transportKg)} />
          <Row label="Site machinery" value={formatFixed(t.machineryKg)} />
          {project.boundary === "expanded" ? <Row label="Installed (A1–A3)" value={formatFixed(t.installedEmbodiedKg)} /> : null}
          <Row label="Intensity" value={t.intensityKgPerM2 === null ? "—" : `${formatFixed(t.intensityKgPerM2)} kg/m²`} />
        </dl>
        <p className="mt-4 text-xs text-ink-subtle">
          {PROFILE_LABELS[project.profile]}
          {t.excludedByProfileKg > 0 ? `; ${formatFixed(t.excludedByProfileKg)} kg of foundation emissions left out` : ""}.
        </p>
        {errors ? (
          <p className="mt-3 rounded-md bg-danger-soft px-2.5 py-1.5 text-xs text-danger">
            {errors} input error{errors === 1 ? "" : "s"}. Those entries are not counted.
          </p>
        ) : null}
      </div>
    </aside>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-3">
      <dt className="text-ink-muted">{label}</dt>
      <dd className="num font-medium">{value}</dd>
    </div>
  );
}
