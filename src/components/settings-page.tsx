"use client";

import { Download, Trash2, Upload } from "lucide-react";
import { useRef, useState } from "react";
import { LoadingState, PageShell } from "@/components/assess/shared";
import { Dialog } from "@/components/ui/overlays";
import { Button, Callout, Card, CardHeader, Field, Input, PageHeader, Segmented, Select } from "@/components/ui/primitives";
import { PROFILE_LABELS, type AssessmentBoundary, type CalculationProfile } from "@/lib/engine";
import { useHydrated, useStore } from "@/lib/store";
import { downloadBlob } from "@/lib/utils";

export function SettingsPage() {
  const hydrated = useHydrated();
  const preferences = useStore((s) => s.preferences);
  const projectCount = useStore((s) => s.projects.length);
  const versionCount = useStore((s) => s.versions.length);
  const library = useStore((s) => s.library);
  const counts = { projects: projectCount, versions: versionCount, userFactors: library.filter((f) => f.status === "user" || f.status === "verified_external").length };
  const { setPreferences, exportBackup, importBackup, clearAll } = useStore();
  const fileRef = useRef<HTMLInputElement>(null);
  const [message, setMessage] = useState<{ tone: "info" | "error"; text: string } | null>(null);
  const [confirmClear, setConfirmClear] = useState(false);

  if (!hydrated) return <LoadingState />;

  async function onImport(file: File) {
    try {
      const res = importBackup(JSON.parse(await file.text()));
      setMessage(res.ok ? { tone: "info", text: `Imported ${res.projects} project(s). Existing projects with the same ID were replaced.` } : { tone: "error", text: res.error });
    } catch {
      setMessage({ tone: "error", text: "The file is not valid JSON." });
    }
  }

  return (
    <PageShell>
      <PageHeader eyebrow="Settings" title="Settings" description="Defaults for new projects, and the data stored in this browser." />
      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader title="Defaults for new projects" description="Applied when a project is created. Existing projects keep their own settings." />
          <div className="space-y-5 p-5">
            <div className="space-y-1.5">
              <p className="text-sm font-medium">Range factors level</p>
              <Segmented
                label="Default range factor level"
                value={preferences.defaultFactorLevel}
                onChange={(v) => setPreferences({ defaultFactorLevel: v })}
                options={[
                  { value: "low", label: "Low" },
                  { value: "central", label: "Central (midpoint)" },
                  { value: "high", label: "High" },
                ]}
              />
            </div>
            <Field label="Assessment boundary">
              {(id) => (
                <Select id={id} value={preferences.defaultBoundary} onChange={(e) => setPreferences({ defaultBoundary: e.target.value as AssessmentBoundary })}>
                  <option value="construction_stage">Construction stage (reference study boundary)</option>
                  <option value="expanded">Expanded: add production of installed material (A1–A3)</option>
                </Select>
              )}
            </Field>
            <Field label="Calculation profile">
              {(id) => (
                <Select id={id} value={preferences.defaultProfile} onChange={(e) => setPreferences({ defaultProfile: e.target.value as CalculationProfile })}>
                  {(Object.keys(PROFILE_LABELS) as CalculationProfile[]).map((k) => (
                    <option key={k} value={k}>
                      {PROFILE_LABELS[k]}
                    </option>
                  ))}
                </Select>
              )}
            </Field>
            <Field label="Default country">{(id) => <Input id={id} value={preferences.country} onChange={(e) => setPreferences({ country: e.target.value })} />}</Field>
          </div>
        </Card>

        <Card>
          <CardHeader title="Your data" description="CarbonBuild has no accounts. Everything is stored in this browser's local storage on this device." />
          <div className="space-y-4 p-5">
            <p className="text-sm text-ink-muted">
              {counts.projects} project(s), {counts.versions} saved version(s) and {counts.userFactors} user factor(s) are stored here. Clearing the browser&apos;s site data deletes them, so keep a backup.
            </p>
            <div className="flex flex-wrap gap-2">
              <Button
                variant="secondary"
                onClick={() => downloadBlob(new Blob([JSON.stringify(exportBackup(), null, 2)], { type: "application/json" }), `carbonbuild-backup-${new Date().toISOString().slice(0, 10)}.json`)}
              >
                <Download /> Download backup
              </Button>
              <input ref={fileRef} type="file" accept="application/json,.json" className="sr-only" aria-label="Backup file" onChange={(e) => e.target.files?.[0] && onImport(e.target.files[0])} />
              <Button variant="secondary" onClick={() => fileRef.current?.click()}>
                <Upload /> Restore from backup
              </Button>
              <Button variant="danger" onClick={() => setConfirmClear(true)}>
                <Trash2 /> Clear all data
              </Button>
            </div>
            {message ? <Callout tone={message.tone}>{message.text}</Callout> : null}
          </div>
        </Card>
      </div>
      <Dialog
        open={confirmClear}
        onOpenChange={setConfirmClear}
        title="Clear all data?"
        description="All projects, saved versions, user factors and settings in this browser will be deleted. This cannot be undone."
        footer={
          <>
            <Button variant="secondary" onClick={() => setConfirmClear(false)}>
              Cancel
            </Button>
            <Button
              variant="danger"
              onClick={() => {
                clearAll();
                setConfirmClear(false);
                setMessage({ tone: "info", text: "All local data was cleared." });
              }}
            >
              Delete everything
            </Button>
          </>
        }
      >
        <p className="text-sm text-ink-muted">Download a backup first if you may need the data again.</p>
      </Dialog>
    </PageShell>
  );
}
