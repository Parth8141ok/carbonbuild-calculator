"use client";

import { Copy, FileUp, Pencil, Plus, Trash2 } from "lucide-react";
import { useState } from "react";
import { EstimatorPanel } from "@/components/assess/estimator-panel";
import { MaterialDialog, massFactors } from "@/components/assess/material-dialog";
import { useUpdate } from "@/components/assess/shared";
import { Dialog } from "@/components/ui/overlays";
import { Badge, Button, Callout, Card, CardHeader, Input, NumberInput, Segmented, Select, Textarea } from "@/components/ui/primitives";
import {
  DATA_STATUS_LABELS,
  MATERIAL_PRESETS,
  QUANTITY_UNIT_LABELS,
  createId,
  materialFromPreset,
  type MaterialEntry,
  type Project,
  type ProjectResult,
} from "@/lib/engine";
import { formatFixed } from "@/lib/format";
import { CSV_TEMPLATE, importMaterialCsv, type CsvRowResult } from "@/lib/import-csv";
import { STATUS_TONE, factorOptionLabel, factorRefLabel } from "@/lib/labels";
import { useStore } from "@/lib/store";
import { cn, downloadBlob } from "@/lib/utils";

export function BuildingSwitcher({ project, index, onChange }: { project: Project; index: number; onChange: (i: number) => void }) {
  if (project.buildings.length < 2) return null;
  return (
    <div className="flex flex-wrap items-center gap-3">
      <span className="text-sm font-medium">Building group</span>
      <Segmented
        label="Building group"
        value={String(index)}
        onChange={(v) => onChange(Number(v))}
        options={project.buildings.map((b, i) => ({ value: String(i), label: `${b.name} ×${b.count}` }))}
      />
    </div>
  );
}

export function StepMaterials({ project, result, buildingIndex, setBuildingIndex }: { project: Project; result: ProjectResult; buildingIndex: number; setBuildingIndex: (i: number) => void }) {
  const update = useUpdate(project.id);
  const b = project.buildings[buildingIndex] ?? project.buildings[0];
  const bi = project.buildings.indexOf(b);
  const [editing, setEditing] = useState<MaterialEntry | null>(null);
  const [csvOpen, setCsvOpen] = useState(false);
  const [newStage, setNewStage] = useState("");
  const detailed = project.inputMode === "detailed";

  const lineFor = (entryId: string) => result.lines.find((l) => l.buildingId === b.id && l.entryId === entryId && l.kind === "material");
  const installedFor = (entryId: string) => result.lines.find((l) => l.buildingId === b.id && l.entryId === entryId && l.kind === "installed");

  const saveEntry = (e: MaterialEntry) =>
    update((p) => {
      const list = p.buildings[bi].materials;
      const idx = list.findIndex((m) => m.id === e.id);
      if (idx >= 0) list[idx] = e;
      else list.push(e);
    });
  const addFactor = (f: Project["factors"][number]) => update((p) => void p.factors.push(f));

  return (
    <div className="space-y-6">
      <BuildingSwitcher project={project} index={bi} onChange={setBuildingIndex} />

      <EstimatorPanel project={project} buildingIndex={bi} defaultOpen={project.inputMode === "quick" || b.materials.length === 0} />

      {detailed ? (
        <Card>
          <CardHeader
            title="Import a take-off schedule"
            description="Paste or upload a CSV exported from a BIM material take-off (e.g. a Revit schedule) or a spreadsheet. Revit and IFC files are not read directly."
            actions={
              <>
                <Button variant="ghost" size="sm" onClick={() => downloadBlob(new Blob([CSV_TEMPLATE], { type: "text/csv" }), "carbonbuild-takeoff-template.csv")}>
                  Download template
                </Button>
                <Button variant="secondary" size="sm" onClick={() => setCsvOpen(true)}>
                  <FileUp /> Import CSV
                </Button>
              </>
            }
          />
        </Card>
      ) : null}

      <Card>
        <CardHeader
          title={`Materials by construction stage${project.buildings.length > 1 ? ` · ${b.name}` : ""}`}
          description={`Quantities for one building${b.count > 1 ? ` (multiplied by ${b.identicalConfirmed ? b.count : "1, because the buildings are not confirmed identical"})` : ""}. Waste emissions = quantity → mass × waste % × emission factor.`}
        />
        <div className="divide-y divide-line">
          {project.stages.map((stage) => {
            const items = b.materials.filter((m) => m.stageId === stage.id);
            const stageKg = items.reduce((s, m) => s + (lineFor(m.id)?.emissionsPerBuildingKg ?? 0), 0);
            return (
              <section key={stage.id} aria-label={stage.name} className="px-5 py-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <h3 className="flex items-center gap-2 font-semibold">
                    {stage.name}
                    {stage.id === "foundation" && project.profile === "report_master" ? <Badge tone="amber">Not in master-profile total</Badge> : null}
                  </h3>
                  <div className="flex min-w-0 max-w-full flex-wrap items-center gap-2">
                    <span className="num text-sm text-ink-muted">{formatFixed(stageKg)} kg CO₂e</span>
                    <AddMaterial
                      onAdd={(key) => {
                        const entry = materialFromPreset(key, stage.id);
                        saveEntry(entry);
                        if (detailed) setEditing(entry);
                      }}
                    />
                    {!stage.builtIn && items.length === 0 ? (
                      <Button variant="ghost" size="icon" aria-label={`Remove stage ${stage.name}`} onClick={() => update((p) => void (p.stages = p.stages.filter((s) => s.id !== stage.id)))}>
                        <Trash2 />
                      </Button>
                    ) : null}
                  </div>
                </div>
                {items.length === 0 ? (
                  <p className="mt-2 text-sm text-ink-subtle">No materials in this stage.</p>
                ) : (
                  <ul className="mt-3 space-y-2">
                    {items.map((m) => (
                      <MaterialRow
                        key={m.id}
                        project={project}
                        entry={m}
                        line={lineFor(m.id)}
                        installed={installedFor(m.id)}
                        expanded={project.boundary === "expanded"}
                        detailed={detailed}
                        onChange={(patch) => saveEntry({ ...m, ...patch })}
                        onEdit={() => setEditing(m)}
                        onDuplicate={() => update((p) => void p.buildings[bi].materials.push({ ...structuredClone(m), id: createId("mat"), origin: "manual" }))}
                        onRemove={() => update((p) => void (p.buildings[bi].materials = p.buildings[bi].materials.filter((x) => x.id !== m.id)))}
                      />
                    ))}
                  </ul>
                )}
              </section>
            );
          })}
        </div>
        <form
          className="flex flex-wrap items-center gap-2 border-t border-line bg-surface-sunken px-5 py-3"
          onSubmit={(e) => {
            e.preventDefault();
            const name = newStage.trim();
            if (!name) return;
            update((p) => void p.stages.push({ id: createId("stage"), name, builtIn: false }));
            setNewStage("");
          }}
        >
          <label htmlFor="new-stage" className="text-sm text-ink-muted">
            Add a stage
          </label>
          <Input id="new-stage" value={newStage} onChange={(e) => setNewStage(e.target.value)} placeholder="e.g. Staircase, Water tank" className="h-9 max-w-64" />
          <Button type="submit" variant="secondary" size="sm" disabled={!newStage.trim()}>
            <Plus /> Add stage
          </Button>
        </form>
      </Card>

      {editing ? (
        <MaterialDialog key={editing.id} project={project} buildingIndex={bi} entry={editing} open onOpenChange={(o) => !o && setEditing(null)} onSave={saveEntry} onAddFactor={addFactor} />
      ) : null}
      {csvOpen ? <CsvImportDialog project={project} onClose={() => setCsvOpen(false)} onApply={(entries) => update((p) => void p.buildings[bi].materials.push(...entries))} /> : null}
    </div>
  );
}

function AddMaterial({ onAdd }: { onAdd: (presetKey: string) => void }) {
  return (
    <Select
      aria-label="Add material"
      value=""
      onChange={(e) => {
        if (e.target.value) onAdd(e.target.value);
      }}
      className="h-8 w-auto max-w-full py-0 pl-3 text-xs"
    >
      <option value="">+ Add material…</option>
      {MATERIAL_PRESETS.map((p) => (
        <option key={p.key} value={p.key}>
          {p.label}
        </option>
      ))}
    </Select>
  );
}

function MaterialRow({
  project,
  entry,
  line,
  installed,
  expanded,
  detailed,
  onChange,
  onEdit,
  onDuplicate,
  onRemove,
}: {
  project: Project;
  entry: MaterialEntry;
  line: ProjectResult["lines"][number] | undefined;
  installed: ProjectResult["lines"][number] | undefined;
  expanded: boolean;
  detailed: boolean;
  onChange: (patch: Partial<MaterialEntry>) => void;
  onEdit: () => void;
  onDuplicate: () => void;
  onRemove: () => void;
}) {
  const errors = line?.flags.filter((f) => f.severity === "error") ?? [];
  const warnings = line?.flags.filter((f) => f.severity === "warning") ?? [];
  const options = massFactors(project, entry.category);
  const singleFactor = entry.factors.length <= 1;
  const split = line?.wasteSplit;
  const splitParts = split
    ? ([
        ["production of wasted material", split.production],
        ["waste treatment & disposal", split.treatment],
        ["production + disposal (combined factor)", split.combined],
        ["boundary not stated", split.unclassified],
      ] as const).filter(([, v]) => v > 0)
    : [];
  return (
    <li className={cn("rounded-lg border bg-surface p-3", errors.length ? "border-danger-line" : "border-line")}>
      <div className="grid grid-cols-[minmax(0,1fr)] items-end gap-3 sm:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)_minmax(0,0.6fr)_minmax(0,0.9fr)_auto]">
        <div className="min-w-0">
          <p className="truncate font-medium">{entry.name || "Unnamed material"}</p>
          <div className="mt-1 flex flex-wrap gap-1">
            <Badge tone={STATUS_TONE[entry.dataStatus]}>{DATA_STATUS_LABELS[entry.dataStatus]}</Badge>
            {entry.origin === "estimator" ? <Badge tone="outline">From estimator</Badge> : entry.origin === "import" ? <Badge tone="outline">Imported</Badge> : null}
            {entry.wasteSource === "reference" ? <Badge tone="outline">Reference waste %</Badge> : null}
            {entry.category === "cement" && entry.cementScope === "in_concrete" ? <Badge tone="amber">Info only</Badge> : null}
          </div>
        </div>
        <div>
          <label className="text-xs text-ink-muted" htmlFor={`${entry.id}-q`}>
            Quantity ({QUANTITY_UNIT_LABELS[entry.unit]})
          </label>
          <NumberInput id={`${entry.id}-q`} value={entry.quantity} min={0} onValueChange={(v) => onChange({ quantity: v })} className="mt-1 h-9" />
        </div>
        <div>
          <label className="text-xs text-ink-muted" htmlFor={`${entry.id}-w`}>
            Waste %
          </label>
          <NumberInput id={`${entry.id}-w`} value={entry.wastePercent} min={0} onValueChange={(v) => onChange({ wastePercent: v, wasteSource: "user" })} className="mt-1 h-9" />
        </div>
        <div className="text-right">
          <p className="text-xs text-ink-muted">Waste emissions</p>
          <p className={cn("num mt-1 text-sm font-semibold", !line?.valid && "text-danger")}>{line?.valid ? `${formatFixed(line.emissionsPerBuildingKg)} kg` : "Incomplete"}</p>
          <p className="truncate text-xs text-ink-subtle" title={entry.factors.map((f) => factorRefLabel(project, f)).join(" + ")}>
            × {entry.factors.map((f) => factorRefLabel(project, f)).join(" + ") || "no factor"}
          </p>
        </div>
        <div className="flex justify-end gap-0.5">
          <Button variant="ghost" size="icon" aria-label={`Edit all details of ${entry.name}`} onClick={onEdit}>
            <Pencil />
          </Button>
          <Button variant="ghost" size="icon" aria-label={`Duplicate ${entry.name}`} onClick={onDuplicate}>
            <Copy />
          </Button>
          <Button variant="ghost" size="icon" aria-label={`Remove ${entry.name}`} onClick={onRemove}>
            <Trash2 />
          </Button>
        </div>
      </div>
      {detailed ? (
        <div className="mt-3 grid grid-cols-[minmax(0,1fr)] gap-3 border-t border-line pt-3 sm:grid-cols-[minmax(0,1fr)_minmax(0,2fr)_minmax(0,1fr)]">
          <div>
            <label className="text-xs text-ink-muted" htmlFor={`${entry.id}-spec`}>
              Grade / specification
            </label>
            <Input id={`${entry.id}-spec`} value={entry.specification} onChange={(e) => onChange({ specification: e.target.value })} className="mt-1 h-9" />
          </div>
          <div>
            <label className="text-xs text-ink-muted" htmlFor={`${entry.id}-f`}>
              Emission factor{singleFactor ? "" : " (components, edit to change)"}
            </label>
            {singleFactor ? (
              <Select id={`${entry.id}-f`} value={entry.factors[0]?.factorId ?? ""} onChange={(e) => onChange({ factors: e.target.value ? [{ factorId: e.target.value }] : [] })} className="mt-1 h-9">
                {entry.factors.length === 0 ? <option value="">Choose a factor…</option> : null}
                {options.map((o) => (
                  <option key={o.id} value={o.id}>
                    {factorOptionLabel(o)}
                  </option>
                ))}
              </Select>
            ) : (
              <p className="mt-1 flex h-9 items-center truncate text-sm">{entry.factors.map((f) => project.factors.find((x) => x.id === f.factorId)?.name ?? f.factorId).join(" + ")}</p>
            )}
          </div>
          <div>
            <label className="text-xs text-ink-muted" htmlFor={`${entry.id}-ds`}>
              Data status
            </label>
            <Select id={`${entry.id}-ds`} value={entry.dataStatus} onChange={(e) => onChange({ dataStatus: e.target.value as MaterialEntry["dataStatus"] })} className="mt-1 h-9">
              {Object.entries(DATA_STATUS_LABELS).map(([k, v]) => (
                <option key={k} value={k}>
                  {v}
                </option>
              ))}
            </Select>
          </div>
        </div>
      ) : null}
      {line?.valid ? (
        <dl className="num mt-2 flex flex-wrap gap-x-4 gap-y-1 border-t border-line pt-2 text-xs text-ink-muted">
          <div>
            <dt className="inline">Gross mass </dt>
            <dd className="inline text-ink">{formatFixed(line.totalMassKg, 2)} kg</dd>
          </div>
          <div>
            <dt className="inline">Waste mass </dt>
            <dd className="inline text-ink">{formatFixed(line.wastedMassKg, 2)} kg</dd>
          </div>
          {splitParts.map(([label, v]) => (
            <div key={label}>
              <dt className="inline">{label[0].toUpperCase() + label.slice(1)} </dt>
              <dd className="inline text-ink">{formatFixed(v, 2)} kg CO₂e</dd>
            </div>
          ))}
          <div>
            <dt className="inline">Material production, installed (A1–A3) </dt>
            <dd className="inline text-ink">
              {!expanded ? "outside boundary" : installed?.valid ? `${formatFixed(installed.emissionsPerBuildingKg, 2)} kg CO₂e` : "no production factor selected"}
            </dd>
          </div>
        </dl>
      ) : null}
      {errors.length || warnings.length ? (
        <ul className="mt-2 space-y-1 text-xs">
          {errors.map((f, i) => (
            <li key={`e${i}`} className="text-danger">
              {f.message}
            </li>
          ))}
          {warnings.map((f, i) => (
            <li key={`w${i}`} className="text-amber">
              {f.message}
            </li>
          ))}
        </ul>
      ) : null}
      {entry.notes ? <p className="mt-2 text-xs text-ink-subtle">{entry.notes}</p> : null}
    </li>
  );
}

function CsvImportDialog({ project, onClose, onApply }: { project: Project; onClose: () => void; onApply: (e: MaterialEntry[]) => void }) {
  const [text, setText] = useState("");
  const [rows, setRows] = useState<CsvRowResult[] | null>(null);
  const [headerError, setHeaderError] = useState<string | null>(null);
  const factorIds = useStore((s) => s.projects.find((p) => p.id === project.id)?.factors.map((f) => f.id) ?? []);

  const parse = (t: string) => {
    const r = importMaterialCsv(t, project.stages, new Set(factorIds));
    setRows(r.rows);
    setHeaderError(r.headerError);
  };
  const valid = rows?.filter((r) => r.entry) ?? [];

  return (
    <Dialog
      open
      onOpenChange={(o) => !o && onClose()}
      wide
      title="Import take-off schedule (CSV)"
      description="Columns: stage, material, quantity, unit, and optionally category, waste_percent, density, factor_id, specification. Imported rows are marked as user-provided."
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button
            disabled={!valid.length}
            onClick={() => {
              onApply(valid.map((r) => r.entry!));
              onClose();
            }}
          >
            Import {valid.length} row{valid.length === 1 ? "" : "s"}
          </Button>
        </>
      }
    >
      <div className="space-y-3">
        <input
          type="file"
          accept=".csv,text/csv"
          aria-label="CSV file"
          className="block text-sm"
          onChange={async (e) => {
            const f = e.target.files?.[0];
            if (f) {
              const t = await f.text();
              setText(t);
              parse(t);
            }
          }}
        />
        <Textarea aria-label="CSV text" value={text} onChange={(e) => setText(e.target.value)} placeholder={CSV_TEMPLATE} className="min-h-32 font-mono text-xs" />
        <Button variant="secondary" size="sm" onClick={() => parse(text)} disabled={!text.trim()}>
          Check rows
        </Button>
        {headerError ? <Callout tone="error">{headerError}</Callout> : null}
        {rows ? (
          <div className="max-h-64 overflow-auto rounded-lg border border-line">
            <table className="w-full text-xs">
              <thead className="bg-surface-sunken text-left text-ink-muted">
                <tr>
                  <th className="px-2 py-1.5">Row</th>
                  <th className="px-2 py-1.5">Material</th>
                  <th className="px-2 py-1.5">Stage</th>
                  <th className="px-2 py-1.5 text-right">Quantity</th>
                  <th className="px-2 py-1.5">Result</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.row} className="border-t border-line">
                    <td className="px-2 py-1.5">{r.row}</td>
                    <td className="px-2 py-1.5">{r.raw.material}</td>
                    <td className="px-2 py-1.5">{r.raw.stage}</td>
                    <td className="num px-2 py-1.5 text-right">
                      {r.raw.quantity} {r.raw.unit}
                    </td>
                    <td className={cn("px-2 py-1.5", r.entry ? "text-primary" : "text-danger")}>{r.entry ? "OK" : r.errors.join(" ")}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : null}
      </div>
    </Dialog>
  );
}
