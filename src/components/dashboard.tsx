"use client";

import { ArrowRight, BarChart3, BookOpen, FilePlus2, FlaskConical, FolderOpen, Library, Pencil } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo } from "react";
import { LoadingState, PageShell } from "@/components/assess/shared";
import { CategoryDonut } from "@/components/charts";
import { FlagList, summariseFlags } from "@/components/flags";
import { InfoTip } from "@/components/ui/overlays";
import { Badge, Button, Card, CardHeader, PageHeader, Stat } from "@/components/ui/primitives";
import { PROFILE_LABELS, calculateProject } from "@/lib/engine";
import { formatFixed, formatKg } from "@/lib/format";
import { TERMS, locationLabel } from "@/lib/labels";
import { useHydrated, useStore } from "@/lib/store";

export function Dashboard() {
  const hydrated = useHydrated();
  const router = useRouter();
  const projects = useStore((s) => s.projects);
  const versions = useStore((s) => s.versions);
  const activeId = useStore((s) => s.activeProjectId);
  const { setActive, createProject, loadSample, setResultsTab } = useStore();
  const active = useMemo(() => projects.filter((p) => !p.archived), [projects]);
  const results = useMemo(() => new Map(active.map((p) => [p.id, calculateProject(p)])), [active]);

  if (!hydrated) return <LoadingState />;

  const current = active.find((p) => p.id === activeId) ?? active[0] ?? null;
  const currentResult = current ? results.get(current.id)! : null;
  const open = (id: string, path: string) => {
    setActive(id);
    router.push(path);
  };

  return (
    <PageShell>
      <PageHeader
        eyebrow="Dashboard"
        title="Construction carbon overview"
        description="Your projects and their calculated construction-stage emissions. All figures come from the inputs you have entered."
        actions={
          <>
            <Button variant="secondary" onClick={() => { loadSample(); router.push("/results"); }}>
              <FlaskConical /> Load sample project
            </Button>
            <Button onClick={() => { createProject({ name: "New project" }); router.push("/assess"); }}>
              <FilePlus2 /> New project
            </Button>
          </>
        }
      />

      {active.length === 0 ? (
        <Card className="p-10 text-center">
          <p className="text-lg font-semibold">No projects yet</p>
          <p className="mx-auto mt-2 max-w-lg text-sm text-ink-muted">
            Create a project to estimate its construction carbon footprint, or load the reference project (ten RCC bungalows at Surat) to explore a complete worked example.
          </p>
          <div className="mt-6 flex flex-wrap justify-center gap-3">
            <Button onClick={() => { createProject({ name: "New project" }); router.push("/assess"); }}>
              <FilePlus2 /> New project
            </Button>
            <Button variant="soft" onClick={() => { loadSample(); router.push("/results"); }}>
              <FlaskConical /> Load sample project
            </Button>
            <Button asChild variant="ghost">
              <Link href="/methodology">How it works</Link>
            </Button>
          </div>
        </Card>
      ) : (
        <div className="space-y-6">
          {current && currentResult ? (
            <Card>
              <CardHeader
                title={
                  <span className="flex flex-wrap items-center gap-2">
                    {current.name}
                    {current.isSample ? <Badge tone="green">Sample</Badge> : null}
                    {currentResult.hasErrors ? <Badge tone="red">Has input errors</Badge> : null}
                  </span>
                }
                description={`${locationLabel(current)} · ${PROFILE_LABELS[current.profile]} · ${current.boundary === "construction_stage" ? "construction-stage boundary" : "expanded boundary"}`}
                actions={
                  <>
                    <Button size="sm" variant="secondary" onClick={() => open(current.id, "/assess")}>
                      <Pencil /> Edit inputs
                    </Button>
                    <Button size="sm" onClick={() => { setResultsTab("overview"); open(current.id, "/results"); }}>
                      <BarChart3 /> Full results
                    </Button>
                  </>
                }
              />
              <div className="grid gap-5 p-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
                <div className="space-y-3">
                  <div className="grid gap-3 sm:grid-cols-2">
                    <Stat
                      label={<span className="flex items-center gap-1.5">Total emissions <InfoTip label="kg CO₂e">{TERMS.kgco2e}</InfoTip></span>}
                      value={formatKg(currentResult.totals.totalKg)}
                      sub={`${formatFixed(currentResult.totals.totalTonnes)} t CO₂e`}
                    />
                    <Stat
                      label={<span className="flex items-center gap-1.5">Intensity <InfoTip label="emissions intensity">{TERMS.intensity}</InfoTip></span>}
                      value={currentResult.totals.intensityKgPerM2 === null ? "—" : `${formatFixed(currentResult.totals.intensityKgPerM2)} kg/m²`}
                      sub={currentResult.totals.builtUpAreaM2 ? `${formatFixed(currentResult.totals.builtUpAreaM2, 0)} m² built-up` : "Built-up area missing"}
                    />
                    <Stat label="Per building" value={currentResult.totals.perBuildingKg === null ? "—" : formatKg(currentResult.totals.perBuildingKg)} sub={`${currentResult.totals.buildingsCounted} building(s) counted`} />
                    <Stat label="Material wastage" value={formatKg(currentResult.totals.materialWasteKg)} sub={`Transport ${formatFixed(currentResult.totals.transportKg)} · machinery ${formatFixed(currentResult.totals.machineryKg)} kg`} />
                  </div>
                  <div className="rounded-xl border border-line p-4">
                    <p className="text-sm font-medium">Top warnings</p>
                    <FlagList flags={summariseFlags(currentResult).filter((f) => f.severity !== "info")} limit={4} className="mt-2" />
                  </div>
                </div>
                <CategoryDonut result={currentResult} />
              </div>
            </Card>
          ) : null}

          <Card>
            <CardHeader
              title="Projects"
              description={`${active.length} active project${active.length === 1 ? "" : "s"} · ${versions.length} saved version${versions.length === 1 ? "" : "s"}. Totals use each project's own boundary and profile, so compare them with care.`}
              actions={
                <Button asChild size="sm" variant="ghost">
                  <Link href="/projects">
                    Manage <ArrowRight />
                  </Link>
                </Button>
              }
            />
            <div className="overflow-x-auto">
              <table className="w-full min-w-[720px] text-sm">
                <thead className="bg-surface-sunken text-left text-xs text-ink-muted">
                  <tr>
                    <th className="px-5 py-2 font-medium">Project</th>
                    <th className="px-3 py-2 font-medium">Boundary · profile</th>
                    <th className="px-3 py-2 text-right font-medium">Total (t CO₂e)</th>
                    <th className="px-3 py-2 text-right font-medium">kg CO₂e/m²</th>
                    <th className="px-3 py-2 font-medium">Status</th>
                    <th className="px-5 py-2" />
                  </tr>
                </thead>
                <tbody>
                  {active.map((p) => {
                    const r = results.get(p.id)!;
                    const warnings = r.flags.filter((f) => f.severity === "warning").length;
                    return (
                      <tr key={p.id} className="border-t border-line">
                        <td className="px-5 py-3">
                          <p className="font-medium">{p.name}</p>
                          <p className="text-xs text-ink-subtle">
                            {locationLabel(p)} · updated {new Date(p.updatedAt).toLocaleDateString()}
                          </p>
                        </td>
                        <td className="px-3 py-3 text-xs text-ink-muted">
                          {p.boundary === "construction_stage" ? "Construction stage" : "Expanded"} · {PROFILE_LABELS[p.profile]}
                        </td>
                        <td className="num px-3 py-3 text-right font-medium">{formatFixed(r.totals.totalTonnes)}</td>
                        <td className="num px-3 py-3 text-right">{r.totals.intensityKgPerM2 === null ? "—" : formatFixed(r.totals.intensityKgPerM2)}</td>
                        <td className="px-3 py-3">
                          {r.hasErrors ? <Badge tone="red">Errors</Badge> : warnings ? <Badge tone="amber">{warnings} warning{warnings === 1 ? "" : "s"}</Badge> : <Badge tone="green">Complete</Badge>}
                        </td>
                        <td className="px-5 py-3 text-right">
                          <Button size="sm" variant="ghost" onClick={() => open(p.id, "/assess")}>
                            <FolderOpen /> Open
                          </Button>
                          <Button size="sm" variant="ghost" onClick={() => { setResultsTab("overview"); open(p.id, "/results"); }}>
                            <BarChart3 /> Results
                          </Button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </Card>
        </div>
      )}

      <div className="mt-6 grid gap-4 sm:grid-cols-3">
        <QuickLink href="/factors" icon={<Library />} title="Emission factors" body="Review the reference factors, their sources and boundaries, or add your own." />
        <QuickLink href="/materials" icon={<BookOpen />} title="Material library" body="Materials available in the calculator, with their units, densities and default factors." />
        <QuickLink href="/methodology" icon={<BookOpen />} title="Methodology" body="Formulas, boundaries, assumptions and the reconciliation with the reference report." />
      </div>
    </PageShell>
  );
}

function QuickLink({ href, icon, title, body }: { href: string; icon: React.ReactNode; title: string; body: string }) {
  return (
    <Link href={href} className="group rounded-xl border border-line bg-surface p-5 hover:border-line-strong">
      <span className="inline-flex size-8 items-center justify-center rounded-md bg-primary-soft text-primary [&_svg]:size-4">{icon}</span>
      <p className="mt-3 flex items-center gap-1 font-medium">
        {title} <ArrowRight className="size-3.5 opacity-0 transition-opacity group-hover:opacity-100" aria-hidden />
      </p>
      <p className="mt-1 text-sm text-ink-muted">{body}</p>
    </Link>
  );
}
