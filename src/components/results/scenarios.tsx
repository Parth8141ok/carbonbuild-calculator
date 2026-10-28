"use client";

import { RotateCcw, Sparkles } from "lucide-react";
import { useMemo, type ReactNode } from "react";
import { ComparisonChart } from "@/components/charts";
import { Slider } from "@/components/ui/overlays";
import { Button, Callout, Card, CardHeader, NumberInput, Segmented, Select, Stat } from "@/components/ui/primitives";
import {
  EMPTY_SCENARIO,
  REPORT_SCENARIO,
  alternativeFactors,
  buildRecommendations,
  compareScenario,
  type FactorLevel,
  type MaterialCategory,
  type Project,
  type ProjectResult,
  type ScenarioSettings,
  type WasteAdjustment,
} from "@/lib/engine";
import { formatFixed, formatKg, formatShare } from "@/lib/format";
import { factorOptionLabel } from "@/lib/labels";
import { useScenario, useStore } from "@/lib/store";
import { cn } from "@/lib/utils";

export function useScenarioComparison(project: Project, result: ProjectResult) {
  const settings = useScenario(project.id);
  return useMemo(() => compareScenario(project, settings, result), [project, settings, result]);
}

export function ScenarioSimulator({ project, result }: { project: Project; result: ProjectResult }) {
  const settings = useScenario(project.id);
  const setScenario = useStore((s) => s.setScenario);
  const set = (patch: Partial<ScenarioSettings>) => setScenario(project.id, { ...settings, ...patch });
  const cmp = useScenarioComparison(project, result);
  const recs = buildRecommendations(result);
  const has = (cat: MaterialCategory) => project.buildings.some((b) => b.materials.some((m) => m.category === cat));
  const hasTransport = project.buildings.some((b) => b.transport.length > 0);
  const hasMachinery = project.buildings.some((b) => b.machinery.length > 0);
  const qtyCats = (["concrete", "steel", "masonry", "cement", "other"] as MaterialCategory[]).filter(has);

  const uniformWaste = (cat: MaterialCategory) => {
    const vals = new Set(project.buildings.flatMap((b) => b.materials.filter((m) => m.category === cat).map((m) => m.wastePercent)));
    return vals.size === 1 ? [...vals][0] : null;
  };

  return (
    <div className="space-y-6">
      <Callout tone="info" title="What-if scenarios recalculate the project from modified inputs">
        Baseline inputs are never changed. Each measure is also run on its own, so you can see when measures overlap. Results are potential reductions that depend on the quantities, factors and boundary chosen, not guaranteed real-world savings. CarbonBuild estimates emissions only: whether a lower-carbon material or a smaller quantity is structurally suitable and safe must be confirmed by a qualified engineer.
      </Callout>
      <div className="grid gap-6 lg:grid-cols-[360px_minmax(0,1fr)]">
        <Card className="self-start">
          <CardHeader
            title="Scenario settings"
            actions={
              <>
                <Button size="sm" variant="soft" onClick={() => setScenario(project.id, structuredClone(REPORT_SCENARIO))}>
                  <Sparkles /> Report measures
                </Button>
                <Button size="sm" variant="ghost" onClick={() => setScenario(project.id, structuredClone(EMPTY_SCENARIO))} aria-label="Reset scenario">
                  <RotateCcw />
                </Button>
              </>
            }
          />
          <div className="space-y-6 p-5">
            {has("masonry") ? <WasteControl label="Brick wastage" value={settings.masonryWaste} baseline={uniformWaste("masonry")} onChange={(v) => set({ masonryWaste: v })} /> : null}
            {has("concrete") ? <WasteControl label="Concrete wastage" value={settings.concreteWaste} baseline={uniformWaste("concrete")} onChange={(v) => set({ concreteWaste: v })} /> : null}
            {has("steel") ? <WasteControl label="Steel wastage" value={settings.steelWaste} baseline={uniformWaste("steel")} onChange={(v) => set({ steelWaste: v })} /> : null}
            {qtyCats.length ? (
              <div className="space-y-4">
                <p className="text-sm font-medium">Material quantities</p>
                {qtyCats.map((cat) => (
                  <PercentControl
                    key={cat}
                    label={`${cat[0].toUpperCase()}${cat.slice(1)} quantity`}
                    hint={cat === "steel" ? "e.g. optimised reinforcement design" : cat === "concrete" ? "e.g. leaner sections" : undefined}
                    value={settings.quantityChangePercent[cat] ?? 0}
                    onChange={(v) => set({ quantityChangePercent: { ...settings.quantityChangePercent, [cat]: v } })}
                  />
                ))}
              </div>
            ) : null}
            {hasTransport ? (
              <>
                <PercentControl label="Transport fuel use" hint="Fuel-based trucks: fleet efficiency, full loads" value={settings.transportFuelChangePercent} onChange={(v) => set({ transportFuelChangePercent: v })} />
                <PercentControl label="Transport distance" hint="Nearer suppliers; distance and tonne-km entries" value={settings.transportDistanceChangePercent} onChange={(v) => set({ transportDistanceChangePercent: v })} />
              </>
            ) : null}
            {hasMachinery ? (
              <PercentControl label="Machinery fuel use" hint="Less idling, efficient or hybrid equipment" value={settings.machineryFuelChangePercent} onChange={(v) => set({ machineryFuelChangePercent: v })} />
            ) : null}
            <div className="space-y-3">
              <p className="text-sm font-medium">Alternative emission factors</p>
              {(["concrete", "steel", "masonry", "cement", "other"] as MaterialCategory[])
                .filter(has)
                .map((cat) => {
                  const alts = alternativeFactors(project, cat);
                  const cur = settings.factorSwaps[cat];
                  const chosen = alts.find((a) => a.id === cur?.factorId);
                  return (
                    <div key={cat} className="space-y-1.5">
                      <label className="text-xs capitalize text-ink-muted" htmlFor={`swap-${cat}`}>
                        {cat}
                      </label>
                      <Select
                        id={`swap-${cat}`}
                        value={cur?.factorId ?? ""}
                        onChange={(e) => set({ factorSwaps: { ...settings.factorSwaps, [cat]: e.target.value ? { factorId: e.target.value } : undefined } })}
                        className="h-9 text-xs"
                      >
                        <option value="">Keep baseline factors</option>
                        {alts.map((a) => (
                          <option key={a.id} value={a.id}>
                            {factorOptionLabel(a)}
                          </option>
                        ))}
                      </Select>
                      {chosen?.range ? (
                        <Segmented
                          size="sm"
                          label={`${cat} factor level`}
                          value={cur?.level ?? project.defaultFactorLevel}
                          onChange={(v: FactorLevel) => set({ factorSwaps: { ...settings.factorSwaps, [cat]: { factorId: chosen.id, level: v } } })}
                          options={[
                            { value: "low", label: `Low ${chosen.range.low}` },
                            { value: "central", label: `Central ${chosen.value}` },
                            { value: "high", label: `High ${chosen.range.high}` },
                          ]}
                        />
                      ) : null}
                    </div>
                  );
                })}
              <p className="text-xs text-ink-subtle">Only factors of the same material category are offered. To test a different material (e.g. fly ash bricks), add a documented factor in the factor library first.</p>
            </div>
          </div>
        </Card>

        <div className="min-w-0 space-y-6">
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <Stat label="Baseline" value={formatKg(cmp.baseline.totals.totalKg)} />
            <Stat label="Scenario" value={formatKg(cmp.scenario.totals.totalKg)} />
            <Stat label="Saving" value={formatKg(cmp.savingsKg)} sub={cmp.savingsKg < 0 ? "Scenario is higher than baseline" : undefined} />
            <Stat label="Reduction" value={formatShare(cmp.reductionFraction, 1)} />
          </div>
          {cmp.warnings.map((w) => (
            <Callout key={w} tone="warning">
              {w}
            </Callout>
          ))}
          <ComparisonChart
            title="Baseline vs scenario by component"
            description="kg CO₂e"
            items={cmp.componentChanges.map((c) => ({ label: c.label, a: c.baselineKg, b: c.scenarioKg }))}
            aLabel="Baseline"
            bLabel="Scenario"
          />
          <Card>
            <CardHeader title="Changes by component" />
            <div className="overflow-x-auto p-5 pt-3">
              <table className="w-full min-w-[480px] text-sm">
                <thead className="text-left text-xs text-ink-muted">
                  <tr className="border-b border-line">
                    <th className="py-2 font-medium">Component</th>
                    <th className="py-2 text-right font-medium">Baseline</th>
                    <th className="py-2 text-right font-medium">Scenario</th>
                    <th className="py-2 text-right font-medium">Change</th>
                  </tr>
                </thead>
                <tbody>
                  {cmp.componentChanges.map((c) => (
                    <tr key={c.key} className="border-b border-line last:border-0">
                      <td className="py-2">{c.label}</td>
                      <td className="num py-2 text-right">{formatFixed(c.baselineKg)}</td>
                      <td className="num py-2 text-right">{formatFixed(c.scenarioKg)}</td>
                      <td className={cn("num py-2 text-right", c.deltaKg < -1e-9 ? "text-primary" : c.deltaKg > 1e-9 ? "text-danger" : "text-ink-subtle")}>
                        {c.deltaKg > 0 ? "+" : ""}
                        {formatFixed(c.deltaKg)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
          {cmp.measures.length ? (
            <Card>
              <CardHeader title="Measures applied alone" description="The combined saving is calculated once from all changes together, never by adding these figures" />
              <div className="p-5 pt-3">
                <table className="w-full text-sm">
                  <tbody>
                    {cmp.measures.map((m) => (
                      <tr key={m.key} className="border-b border-line">
                        <td className="py-2">{m.label}</td>
                        <td className="num py-2 text-right">{formatKg(m.savingsKg)}</td>
                      </tr>
                    ))}
                    <tr className="border-b border-line text-ink-muted">
                      <td className="py-2">Sum of single-measure savings</td>
                      <td className="num py-2 text-right">{formatKg(cmp.sumOfIndividualSavingsKg)}</td>
                    </tr>
                    <tr className="font-medium">
                      <td className="py-2">Combined saving (recalculated)</td>
                      <td className="num py-2 text-right">{formatKg(cmp.savingsKg)}</td>
                    </tr>
                  </tbody>
                </table>
                <p className="mt-2 text-xs text-ink-muted">
                  {Math.abs(cmp.interactionKg) < 1e-6
                    ? "These measures act on separate components, so the combined saving equals the sum."
                    : `Interaction: ${formatKg(cmp.interactionKg)}. The measures overlap, so their savings are not additive.`}
                </p>
              </div>
            </Card>
          ) : null}
          <Card>
            <CardHeader title="Recommendations for this project" description="Ranked by the share of your baseline they address. Potential measures, not guaranteed savings." />
            <ul className="divide-y divide-line">
              {recs.map((r) => (
                <li key={r.id} className="px-5 py-3">
                  <p className="flex items-baseline justify-between gap-3 font-medium">
                    {r.title} <span className="num shrink-0 text-xs font-normal text-ink-muted">{formatShare(r.addressesShare, 1)} of baseline</span>
                  </p>
                  <p className="mt-0.5 text-sm text-ink-muted">{r.detail}</p>
                </li>
              ))}
            </ul>
          </Card>
        </div>
      </div>
    </div>
  );
}

function ControlRow({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
  return (
    <div className="space-y-2">
      <div>
        <p className="text-sm font-medium">{label}</p>
        {hint ? <p className="text-xs text-ink-subtle">{hint}</p> : null}
      </div>
      {children}
    </div>
  );
}

function PercentControl({ label, hint, value, onChange }: { label: string; hint?: string; value: number; onChange: (v: number) => void }) {
  return (
    <ControlRow label={label} hint={hint}>
      <div className="flex items-center gap-3">
        <Slider label={`${label} change`} value={value} min={-100} max={50} step={1} onValueChange={onChange} />
        <NumberInput aria-label={`${label} change in percent`} value={value} onValueChange={(v) => onChange(Math.max(-100, Math.min(200, v ?? 0)))} suffix="%" className="h-9 w-24" />
      </div>
    </ControlRow>
  );
}

function WasteControl({ label, value, baseline, onChange }: { label: string; value: WasteAdjustment | null; baseline: number | null; onChange: (v: WasteAdjustment | null) => void }) {
  const mode = value?.mode ?? (baseline !== null ? "absolute" : "relative");
  const hint = baseline !== null ? `Baseline ${formatFixed(baseline, 2)}% on every entry` : "Entries have different baseline percentages";
  return (
    <ControlRow label={label} hint={hint}>
      <Segmented
        size="sm"
        label={`${label} adjustment mode`}
        value={mode}
        onChange={(m) => onChange(m === "absolute" ? { mode: "absolute", valuePercent: baseline ?? 0 } : { mode: "relative", changePercent: 0 })}
        options={[
          { value: "absolute", label: "Set to %" },
          { value: "relative", label: "Change by %" },
        ]}
      />
      {mode === "absolute" ? (
        <div className="flex items-center gap-3">
          <Slider label={`${label} percent`} value={value?.mode === "absolute" ? value.valuePercent : (baseline ?? 0)} min={0} max={20} step={0.5} onValueChange={(v) => onChange({ mode: "absolute", valuePercent: v })} />
          <NumberInput
            aria-label={`${label} percent`}
            value={value?.mode === "absolute" ? value.valuePercent : (baseline ?? 0)}
            onValueChange={(v) => onChange(v === null ? null : { mode: "absolute", valuePercent: Math.max(0, Math.min(100, v)) })}
            suffix="%"
            className="h-9 w-24"
          />
        </div>
      ) : (
        <div className="flex items-center gap-3">
          <Slider label={`${label} change`} value={value?.mode === "relative" ? value.changePercent : 0} min={-100} max={50} step={1} onValueChange={(v) => onChange({ mode: "relative", changePercent: v })} />
          <NumberInput
            aria-label={`${label} change in percent`}
            value={value?.mode === "relative" ? value.changePercent : 0}
            onValueChange={(v) => onChange({ mode: "relative", changePercent: Math.max(-100, Math.min(200, v ?? 0)) })}
            suffix="%"
            className="h-9 w-24"
          />
        </div>
      )}
    </ControlRow>
  );
}
