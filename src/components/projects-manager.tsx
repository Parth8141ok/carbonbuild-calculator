"use client";

import { Archive, ArchiveRestore, BarChart3, Copy, Download, FolderOpen, History, Trash2 } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { LoadingState, PageShell } from "@/components/assess/shared";
import { Dialog } from "@/components/ui/overlays";
import { Badge, Button, Card, CardHeader, PageHeader, Segmented } from "@/components/ui/primitives";
import { PROFILE_LABELS, calculateProject } from "@/lib/engine";
import { formatFixed, formatKg } from "@/lib/format";
import { locationLabel } from "@/lib/labels";
import { exportProjectFile } from "@/lib/projects";
import { useHydrated, useStore } from "@/lib/store";
import { downloadBlob, slugify } from "@/lib/utils";

export function ProjectsManager() {
  const hydrated = useHydrated();
  const router = useRouter();
  const { projects, versions, setActive, duplicate, setArchived, deleteProject, deleteVersion, restoreVersion } = useStore();
  const [view, setView] = useState<"active" | "archived">("active");
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  const totals = useMemo(() => new Map(projects.map((p) => [p.id, calculateProject(p)])), [projects]);

  if (!hydrated) return <LoadingState />;
  const shown = projects.filter((p) => (view === "archived" ? p.archived : !p.archived));
  const toDelete = projects.find((p) => p.id === confirmDelete);

  return (
    <PageShell>
      <PageHeader
        eyebrow="Project management"
        title="Projects"
        description="Projects and saved versions are stored in this browser only. Export a project file to move it to another device or to share it."
        actions={
          <Button asChild>
            <Link href="/assess" onClick={() => setActive(null)}>
              New assessment
            </Link>
          </Button>
        }
      />
      <Segmented
        label="Project list"
        value={view}
        onChange={setView}
        options={[
          { value: "active", label: `Active (${projects.filter((p) => !p.archived).length})` },
          { value: "archived", label: `Archived (${projects.filter((p) => p.archived).length})` },
        ]}
        className="mb-4"
      />
      {shown.length === 0 ? (
        <Card className="p-8 text-center text-sm text-ink-muted">{view === "active" ? "No projects yet. Start an assessment or load the sample project." : "No archived projects."}</Card>
      ) : (
        <div className="space-y-4">
          {shown.map((p) => {
            const r = totals.get(p.id)!;
            const pv = versions.filter((v) => v.projectId === p.id);
            return (
              <Card key={p.id}>
                <div className="flex flex-wrap items-start justify-between gap-4 p-5">
                  <div className="min-w-0">
                    <p className="flex flex-wrap items-center gap-2 font-semibold">
                      {p.name}
                      {p.isSample ? <Badge tone="green">Sample</Badge> : null}
                      {r.hasErrors ? <Badge tone="red">Has input errors</Badge> : null}
                    </p>
                    <p className="text-sm text-ink-muted">
                      {locationLabel(p)} · {PROFILE_LABELS[p.profile]} · updated {new Date(p.updatedAt).toLocaleString()}
                    </p>
                    <p className="num mt-2 text-lg font-semibold">
                      {formatKg(r.totals.totalKg)}
                      <span className="ml-2 text-sm font-normal text-ink-muted">{r.totals.intensityKgPerM2 === null ? "" : `${formatFixed(r.totals.intensityKgPerM2)} kg/m²`}</span>
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    <Button size="sm" variant="secondary" onClick={() => { setActive(p.id); router.push("/assess"); }}>
                      <FolderOpen /> Open
                    </Button>
                    <Button size="sm" variant="secondary" onClick={() => { setActive(p.id); router.push("/results"); }}>
                      <BarChart3 /> Results
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => duplicate(p.id)}>
                      <Copy /> Duplicate
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => downloadBlob(new Blob([exportProjectFile(p)], { type: "application/json" }), `${slugify(p.name)}.carbonbuild.json`)}>
                      <Download /> Export
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => setArchived(p.id, !p.archived)}>
                      {p.archived ? <ArchiveRestore /> : <Archive />} {p.archived ? "Restore" : "Archive"}
                    </Button>
                    <Button size="sm" variant="danger" onClick={() => setConfirmDelete(p.id)}>
                      <Trash2 /> Delete
                    </Button>
                  </div>
                </div>
                {pv.length ? (
                  <div className="border-t border-line">
                    <CardHeader title={<span className="flex items-center gap-2 text-sm"><History className="size-4" aria-hidden /> Saved versions</span>} description="Compared with the project as it is now" className="border-0 py-3" />
                    <div className="overflow-x-auto px-5 pb-4">
                      <table className="w-full min-w-[640px] text-sm">
                        <thead className="text-left text-xs text-ink-muted">
                          <tr className="border-b border-line">
                            <th className="py-2 font-medium">Version</th>
                            <th className="py-2 font-medium">Saved</th>
                            <th className="py-2 font-medium">Profile · factors</th>
                            <th className="py-2 text-right font-medium">Total (kg CO₂e)</th>
                            <th className="py-2 text-right font-medium">Current − version</th>
                            <th className="py-2" />
                          </tr>
                        </thead>
                        <tbody>
                          <tr className="border-b border-line font-medium">
                            <td className="py-2">Current</td>
                            <td className="py-2 text-ink-muted">now</td>
                            <td className="py-2 text-ink-muted">{PROFILE_LABELS[p.profile]} · {p.factorDatasetVersion}</td>
                            <td className="num py-2 text-right">{formatFixed(r.totals.totalKg)}</td>
                            <td />
                            <td />
                          </tr>
                          {pv.map((v) => {
                            const d = r.totals.totalKg - v.summary.totalKg;
                            return (
                              <tr key={v.id} className="border-b border-line last:border-0">
                                <td className="py-2">{v.label}</td>
                                <td className="py-2 text-ink-muted">{new Date(v.savedAt).toLocaleString()}</td>
                                <td className="py-2 text-ink-muted">
                                  {PROFILE_LABELS[v.summary.profile]} · {v.factorDatasetVersion} · engine {v.engineVersion}
                                </td>
                                <td className="num py-2 text-right">{formatFixed(v.summary.totalKg)}</td>
                                <td className="num py-2 text-right">{Math.abs(d) < 0.005 ? "—" : `${d > 0 ? "+" : ""}${formatFixed(d)}`}</td>
                                <td className="py-2 text-right">
                                  <Button size="sm" variant="ghost" onClick={() => { restoreVersion(v.id); router.push("/results"); }}>
                                    Open as copy
                                  </Button>
                                  <Button size="icon" variant="ghost" aria-label={`Delete version ${v.label}`} onClick={() => deleteVersion(v.id)}>
                                    <Trash2 />
                                  </Button>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </div>
                ) : null}
              </Card>
            );
          })}
        </div>
      )}
      <Dialog
        open={!!toDelete}
        onOpenChange={(o) => !o && setConfirmDelete(null)}
        title="Delete project?"
        description={toDelete ? `"${toDelete.name}" and its saved versions will be removed from this browser. This cannot be undone. Export it first if you may need it.` : undefined}
        footer={
          <>
            <Button variant="secondary" onClick={() => setConfirmDelete(null)}>
              Cancel
            </Button>
            <Button
              variant="danger"
              onClick={() => {
                if (toDelete) deleteProject(toDelete.id);
                setConfirmDelete(null);
              }}
            >
              Delete project
            </Button>
          </>
        }
      >
        <p className="text-sm text-ink-muted">Archive keeps the project out of the active list without deleting it.</p>
      </Dialog>
    </PageShell>
  );
}
