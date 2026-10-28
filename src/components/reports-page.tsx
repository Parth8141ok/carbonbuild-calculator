"use client";

import Link from "next/link";
import { LoadingState, PageShell, useProjectResult } from "@/components/assess/shared";
import { ExportPanel } from "@/components/results/export-panel";
import { Button, Card, PageHeader, Select } from "@/components/ui/primitives";
import { formatKg } from "@/lib/format";
import { useActiveProject, useHydrated, useStore } from "@/lib/store";

export function ReportsPage() {
  const hydrated = useHydrated();
  const projects = useStore((s) => s.projects);
  const setActive = useStore((s) => s.setActive);
  const loadSample = useStore((s) => s.loadSample);
  const project = useActiveProject();
  const result = useProjectResult(project);

  if (!hydrated) return <LoadingState />;
  const choices = projects.filter((p) => !p.archived);

  return (
    <PageShell>
      <PageHeader eyebrow="Reports" title="Reports and exports" description="Generate a PDF report, an Excel workbook, a CSV calculation table or a project file from a project's current calculated data." />
      {choices.length === 0 ? (
        <Card className="p-8 text-center">
          <p className="font-medium">No projects to report on</p>
          <p className="mt-1 text-sm text-ink-muted">Create a project or load the sample project first.</p>
          <div className="mt-4 flex justify-center gap-3">
            <Button asChild>
              <Link href="/assess">New project</Link>
            </Button>
            <Button variant="soft" onClick={() => loadSample()}>
              Load sample project
            </Button>
          </div>
        </Card>
      ) : (
        <div className="space-y-6">
          <Card className="flex flex-wrap items-end gap-4 p-5">
            <div className="min-w-64 flex-1">
              <label htmlFor="report-project" className="text-sm font-medium">
                Project
              </label>
              <Select id="report-project" className="mt-1.5" value={project?.id ?? ""} onChange={(e) => setActive(e.target.value || null)}>
                <option value="">Select a project…</option>
                {choices.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </Select>
            </div>
            {result ? <p className="num pb-2 text-sm text-ink-muted">Current total: {formatKg(result.totals.totalKg)}</p> : null}
          </Card>
          {project && result ? <ExportPanel project={project} result={result} /> : <p className="text-sm text-ink-muted">Select a project to see its export options.</p>}
        </div>
      )}
    </PageShell>
  );
}
