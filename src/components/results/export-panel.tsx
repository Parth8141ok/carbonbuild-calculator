"use client";

import { FileJson, FileSpreadsheet, FileText, Save, Table } from "lucide-react";
import { useMemo, useState } from "react";
import { useScenarioComparison } from "@/components/results/scenarios";
import { Button, Callout, Card, CardHeader, Input } from "@/components/ui/primitives";
import { analyseUncertainty, type Project, type ProjectResult } from "@/lib/engine";
import { calculationCsv } from "@/lib/export/tables";
import { formatKg } from "@/lib/format";
import { exportProjectFile } from "@/lib/projects";
import { useStore } from "@/lib/store";
import { downloadBlob, slugify } from "@/lib/utils";

export function ExportPanel({ project, result }: { project: Project; result: ProjectResult }) {
  const cmp = useScenarioComparison(project, result);
  const saveVersion = useStore((s) => s.saveVersion);
  const allVersions = useStore((s) => s.versions);
  const versions = useMemo(() => allVersions.filter((v) => v.projectId === project.id), [allVersions, project.id]);
  const [busy, setBusy] = useState<string | null>(null);
  const [label, setLabel] = useState("");
  const [saved, setSaved] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const base = slugify(project.name);

  async function run(kind: string, fn: () => Promise<void>) {
    setBusy(kind);
    setError(null);
    try {
      await fn();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)]">
      <Card>
        <CardHeader title="Reports and exports" description="Every file contains this project's calculated data, the selected profile, the factors used and the assumptions, so another person can reproduce the result." />
        <div className="grid gap-3 p-5 sm:grid-cols-2">
          <ExportCard icon={<FileText />} title="PDF report" body={`Overview, boundary, breakdown, charts, factors, itemised calculations, data quality, warnings${cmp.measures.length ? ", the current what-if scenario" : ""}, recommendations, methodology and disclaimer.`}>
            <Button
              disabled={!!busy}
              onClick={() =>
                run("pdf", async () => {
                  const { buildPdf } = await import("@/lib/export/pdf");
                  const doc = buildPdf(project, result, { generatedAt: new Date().toISOString(), scenario: cmp.measures.length ? cmp : null, uncertainty: analyseUncertainty(project, result) });
                  doc.save(`${base}-carbon-report.pdf`);
                })
              }
            >
              {busy === "pdf" ? "Preparing…" : "Download PDF"}
            </Button>
          </ExportCard>
          <ExportCard icon={<FileSpreadsheet />} title="Excel workbook" body="Sheets: summary, calculations with formula trails, emission factors, assumptions and warnings, recommendations.">
            <Button
              variant="secondary"
              disabled={!!busy}
              onClick={() =>
                run("xlsx", async () => {
                  const { buildWorkbook } = await import("@/lib/export/xlsx");
                  const buf = await buildWorkbook(project, result, new Date().toISOString());
                  downloadBlob(new Blob([buf], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }), `${base}-carbon.xlsx`);
                })
              }
            >
              {busy === "xlsx" ? "Preparing…" : "Download Excel"}
            </Button>
          </ExportCard>
          <ExportCard icon={<Table />} title="CSV calculation table" body="One row per item at full precision, including factor sources and calculation steps.">
            <Button variant="secondary" onClick={() => downloadBlob(new Blob([calculationCsv(result)], { type: "text/csv;charset=utf-8" }), `${base}-calculations.csv`)}>
              Download CSV
            </Button>
          </ExportCard>
          <ExportCard icon={<FileJson />} title="Project file (JSON)" body="All inputs plus the project's factor snapshot. Import it on the Assessment page to reproduce or continue the work.">
            <Button variant="secondary" onClick={() => downloadBlob(new Blob([exportProjectFile(project)], { type: "application/json" }), `${base}.carbonbuild.json`)}>
              Download project file
            </Button>
          </ExportCard>
        </div>
        {error ? (
          <div className="px-5 pb-5">
            <Callout tone="error" title="Export failed">
              {error}
            </Callout>
          </div>
        ) : null}
      </Card>
      <Card className="self-start">
        <CardHeader title="Save this assessment" description="A saved version stores the inputs and factor snapshot. Later changes to the factor library do not alter it." />
        <form
          className="space-y-3 p-5"
          onSubmit={(e) => {
            e.preventDefault();
            saveVersion(project.id, label);
            setSaved(`Saved "${label.trim() || "version"}" with total ${formatKg(result.totals.totalKg)}.`);
            setLabel("");
          }}
        >
          <label htmlFor="ver-label" className="text-sm font-medium">
            Version label
          </label>
          <Input id="ver-label" value={label} onChange={(e) => setLabel(e.target.value)} placeholder="e.g. Baseline before site audit" />
          <Button type="submit" variant="soft">
            <Save /> Save version
          </Button>
          {saved ? <p className="text-sm text-primary" role="status">{saved}</p> : null}
          <p className="text-xs text-ink-subtle">
            {versions.length} saved version{versions.length === 1 ? "" : "s"} of this project. Compare them on the Projects page.
          </p>
        </form>
      </Card>
    </div>
  );
}

function ExportCard({ icon, title, body, children }: { icon: React.ReactNode; title: string; body: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col rounded-lg border border-line p-4">
      <span className="inline-flex size-8 items-center justify-center rounded-md bg-primary-soft text-primary [&_svg]:size-4">{icon}</span>
      <p className="mt-3 font-medium">{title}</p>
      <p className="mt-1 flex-1 text-sm text-ink-muted">{body}</p>
      <div className="mt-3">{children}</div>
    </div>
  );
}
