"use client";

import { FilePlus2, FlaskConical, FolderOpen, Upload } from "lucide-react";
import { useRef, useState } from "react";
import { PageShell } from "@/components/assess/shared";
import { Badge, Button, Callout, Card, PageHeader } from "@/components/ui/primitives";
import { locationLabel } from "@/lib/labels";
import { parseProjectFile } from "@/lib/projects";
import { useStore } from "@/lib/store";

export function StartScreen() {
  const { projects, createProject, loadSample, setActive, addProject } = useStore();
  const fileRef = useRef<HTMLInputElement>(null);
  const [importError, setImportError] = useState<string | null>(null);
  const recent = projects.filter((p) => !p.archived).slice(0, 6);

  async function onFile(file: File) {
    const res = parseProjectFile(await file.text());
    if (res.ok) {
      addProject(res.project);
      setImportError(null);
    } else setImportError(res.error);
  }

  return (
    <PageShell>
      <PageHeader eyebrow="New assessment" title="Start a construction carbon assessment" description="Create a project, load the reference project from the study, or open a saved project." />
      <div className="grid gap-4 md:grid-cols-3">
        <StartCard icon={<FilePlus2 />} title="New project" body="Start from a blank project. The wizard asks for building data, quantities, deliveries and machinery.">
          <Button onClick={() => createProject({ name: "New project" })}>Create project</Button>
        </StartCard>
        <StartCard icon={<FlaskConical />} title="Load sample project" body="Ten three-storey RCC bungalows at Surat, with the quantities and factors of the BIM report. Every value stays editable.">
          <Button variant="soft" onClick={() => loadSample()}>
            Load sample project
          </Button>
        </StartCard>
        <StartCard icon={<Upload />} title="Import project file" body="Open a CarbonBuild project file (.json) exported earlier, including its factor snapshot.">
          <input ref={fileRef} type="file" accept="application/json,.json" className="sr-only" onChange={(e) => e.target.files?.[0] && onFile(e.target.files[0])} aria-label="Project file" />
          <Button variant="secondary" onClick={() => fileRef.current?.click()}>
            Choose file
          </Button>
        </StartCard>
      </div>
      {importError ? (
        <Callout tone="error" title="Could not import the file" className="mt-4">
          {importError}
        </Callout>
      ) : null}
      {recent.length ? (
        <div className="mt-10">
          <h2 className="text-sm font-semibold text-ink">Recent projects</h2>
          <ul className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {recent.map((p) => (
              <li key={p.id}>
                <button type="button" onClick={() => setActive(p.id)} className="flex w-full items-start gap-3 rounded-xl border border-line bg-surface p-4 text-left hover:border-line-strong">
                  <FolderOpen className="mt-0.5 size-4 text-ink-subtle" aria-hidden />
                  <span className="min-w-0">
                    <span className="block truncate font-medium">{p.name}</span>
                    <span className="block text-xs text-ink-muted">{locationLabel(p)}</span>
                    <span className="mt-1 block text-xs text-ink-subtle">Updated {new Date(p.updatedAt).toLocaleString()}</span>
                  </span>
                  {p.isSample ? <Badge tone="green" className="ml-auto">Sample</Badge> : null}
                </button>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </PageShell>
  );
}

function StartCard({ icon, title, body, children }: { icon: React.ReactNode; title: string; body: string; children: React.ReactNode }) {
  return (
    <Card className="flex flex-col p-5">
      <span className="inline-flex size-9 items-center justify-center rounded-lg bg-primary-soft text-primary [&_svg]:size-4.5">{icon}</span>
      <h2 className="mt-4 font-semibold">{title}</h2>
      <p className="mt-1 flex-1 text-sm text-ink-muted">{body}</p>
      <div className="mt-4">{children}</div>
    </Card>
  );
}
