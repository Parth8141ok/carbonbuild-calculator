"use client";

import { Pencil } from "lucide-react";
import Link from "next/link";
import { LoadingState, PageShell, useProjectResult } from "@/components/assess/shared";
import { CalculationTable } from "@/components/results/calc-table";
import { ExportPanel } from "@/components/results/export-panel";
import { Overview } from "@/components/results/overview";
import { DataQuality } from "@/components/results/quality";
import { ScenarioSimulator } from "@/components/results/scenarios";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/overlays";
import { Badge, Button, Card, PageHeader, Segmented } from "@/components/ui/primitives";
import { PROFILE_LABELS, type CalculationProfile } from "@/lib/engine";
import { locationLabel } from "@/lib/labels";
import { useActiveProject, useHydrated, useStore, type ResultsTab } from "@/lib/store";

export function ResultsApp() {
  const hydrated = useHydrated();
  const project = useActiveProject();
  const result = useProjectResult(project);
  const tab = useStore((s) => s.resultsTab);
  const setTab = useStore((s) => s.setResultsTab);
  const updateProject = useStore((s) => s.updateProject);
  const loadSample = useStore((s) => s.loadSample);

  if (!hydrated) return <LoadingState />;
  if (!project || !result) {
    return (
      <PageShell>
        <PageHeader eyebrow="Results" title="No project selected" description="Start an assessment or load the reference sample project to see results." />
        <Card className="flex flex-wrap gap-3 p-5">
          <Button asChild>
            <Link href="/assess">Start assessment</Link>
          </Button>
          <Button variant="soft" onClick={() => loadSample()}>
            Load sample project
          </Button>
        </Card>
      </PageShell>
    );
  }

  return (
    <PageShell>
      <PageHeader
        eyebrow="Results dashboard"
        title={project.name}
        description={
          <span className="flex flex-wrap items-center gap-2">
            {locationLabel(project)}
            <Badge tone="outline">{project.boundary === "construction_stage" ? "Construction-stage boundary" : "Expanded boundary"}</Badge>
            <Badge tone="outline">Factors {project.factorDatasetVersion}</Badge>
            {project.isSample ? <Badge tone="green">Reference sample</Badge> : null}
          </span>
        }
        actions={
          <Button asChild variant="secondary">
            <Link href="/assess">
              <Pencil /> Edit inputs
            </Link>
          </Button>
        }
      />
      <div className="mb-5 flex flex-wrap items-center gap-3">
        <span className="text-sm font-medium">Calculation profile</span>
        <Segmented<CalculationProfile>
          label="Calculation profile"
          value={project.profile}
          onChange={(v) => updateProject(project.id, (p) => void (p.profile = v))}
          options={[
            { value: "report_master", label: PROFILE_LABELS.report_master },
            { value: "foundation_inclusive", label: PROFILE_LABELS.foundation_inclusive },
          ]}
        />
      </div>
      <Tabs value={tab} onValueChange={(v) => setTab(v as ResultsTab)}>
        <TabsList aria-label="Results sections">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="calculations">Calculation table</TabsTrigger>
          <TabsTrigger value="quality">Data quality</TabsTrigger>
          <TabsTrigger value="scenarios">What-if scenarios</TabsTrigger>
          <TabsTrigger value="export">Reports & export</TabsTrigger>
        </TabsList>
        <TabsContent value="overview" className="pt-6">
          <Overview project={project} result={result} />
        </TabsContent>
        <TabsContent value="calculations" className="pt-6">
          <CalculationTable project={project} result={result} />
        </TabsContent>
        <TabsContent value="quality" className="pt-6">
          <DataQuality project={project} result={result} />
        </TabsContent>
        <TabsContent value="scenarios" className="pt-6">
          <ScenarioSimulator project={project} result={result} />
        </TabsContent>
        <TabsContent value="export" className="pt-6">
          <ExportPanel project={project} result={result} />
        </TabsContent>
      </Tabs>
    </PageShell>
  );
}
