"use client";

import { ActivityStackChart, CategoryDonut, ComparisonChart, RankingChart, StageChart } from "@/components/charts";
import { CoveragePanel } from "@/components/coverage";
import { InfoTip } from "@/components/ui/overlays";
import { FlagList, summariseFlags } from "@/components/flags";
import { ReconciliationTable } from "@/components/results/reconciliation";
import { Callout, Card, CardHeader, Stat } from "@/components/ui/primitives";
import { DATA_STATUS_LABELS, PROFILE_LABELS, buildRecommendations, type DataStatus, type Project, type ProjectResult } from "@/lib/engine";
import { formatFixed, formatKg, formatShare } from "@/lib/format";
import { TERMS } from "@/lib/labels";

export function Overview({ project, result }: { project: Project; result: ProjectResult }) {
  const t = result.totals;
  const dq = result.dataQuality;
  const measured = dq.inputCounts.measured;
  const assumedOrEstimated = dq.inputCounts.assumed + dq.inputCounts.estimated;
  const otherProfile = project.profile === "report_master" ? "foundation_inclusive" : "report_master";
  const errors = result.flags.filter((f) => f.severity === "error");
  const recs = buildRecommendations(result).slice(0, 4);

  return (
    <div className="space-y-6">
      {errors.length ? (
        <Callout tone="error" title={`${errors.length} input error${errors.length === 1 ? "" : "s"}`}>
          Entries with errors are left out of the totals below. <FlagList flags={summariseFlags(result).filter((f) => f.severity === "error")} limit={5} className="mt-2" />
        </Callout>
      ) : null}

      {result.excludedSections.length ? (
        <Callout tone="warning" title={`Excluded from this assessment: ${result.excludedSections.map((k) => (k === "transport" ? "transportation (A4)" : "site machinery fuel (A5)")).join(" and ")}`}>
          These sections were switched off, so their emissions are not in any total below. Include them in step 4 of the assessment when data is available.
        </Callout>
      ) : null}

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Stat className="sm:col-span-2" label={project.boundary === "expanded" ? "Total emissions (expanded boundary)" : "Total construction-stage emissions"} value={<span className="text-3xl">{formatKg(t.totalKg)}</span>} sub={`${formatFixed(t.totalTonnes)} t CO₂e · ${PROFILE_LABELS[project.profile]}`} />
        <Stat label="Total in tonnes" value={`${formatFixed(t.totalTonnes)} t CO₂e`} sub={`${formatFixed(t.dieselLitres)} L of diesel`} />
        <Stat label={<span className="flex items-center gap-1.5">Emissions intensity <InfoTip label="emissions intensity">{TERMS.intensity}</InfoTip></span>} value={t.intensityKgPerM2 === null ? "—" : `${formatFixed(t.intensityKgPerM2)} kg CO₂e/m²`} sub={t.builtUpAreaM2 ? `over ${formatFixed(t.builtUpAreaM2, 0)} m² built-up area` : "Built-up area missing"} />
        <Stat label="Emissions per building" value={t.perBuildingKg === null ? "—" : formatKg(t.perBuildingKg)} sub={`${t.buildingsCounted} building${t.buildingsCounted === 1 ? "" : "s"} counted`} />
        <Stat label="Material wastage" value={formatKg(t.materialWasteKg)} sub={formatShare(t.totalKg ? t.materialWasteKg / t.totalKg : 0, 1)} />
        <Stat label="Transportation" value={formatKg(t.transportKg)} sub={formatShare(t.totalKg ? t.transportKg / t.totalKg : 0, 1)} />
        <Stat label="Site machinery" value={formatKg(t.machineryKg)} sub={formatShare(t.totalKg ? t.machineryKg / t.totalKg : 0, 1)} />
        <Stat
          label="Inputs: measured vs estimated/assumed"
          value={`${measured} vs ${assumedOrEstimated}`}
          sub={(Object.keys(DATA_STATUS_LABELS) as DataStatus[]).map((s) => `${DATA_STATUS_LABELS[s]} ${dq.inputCounts[s]}`).join(" · ")}
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)]">
        <Card>
          <CardHeader
            title={<span className="flex items-center gap-1.5">Material production vs waste <InfoTip label="production and waste emissions">{TERMS.productionVsWaste}</InfoTip></span>}
            description="Split by the life-cycle modules of each factor. Nothing is counted twice."
          />
          <dl className="divide-y divide-line px-5 text-sm">
            <SplitRow label="Material production, installed (A1–A3)" value={project.boundary === "expanded" ? formatKg(t.installedEmbodiedKg) : "Outside the boundary"} note={project.boundary === "expanded" ? "Installed quantity × production factor, where one is selected." : "The construction-stage boundary counts wasted material only."} />
            <SplitRow label="Production of wasted material (A1–A3)" value={formatKg(t.waste.production)} note="Wasted mass × production-only factor." />
            <SplitRow label="Waste treatment and disposal (C2–C4)" value={formatKg(t.waste.treatment)} note="Wasted mass × disposal factor, where modelled separately." />
            <SplitRow label="Waste: production + disposal combined" value={formatKg(t.waste.combined)} note="Factors that include both and cannot be separated (e.g. 0.142)." />
            {t.waste.unclassified > 0 ? <SplitRow label="Waste: boundary not stated" value={formatKg(t.waste.unclassified)} note="Factors whose source does not state the boundary (e.g. slab concrete 0.138)." /> : null}
            {t.tonneKm > 0 ? <SplitRow label="Transport activity" value={`${formatFixed(t.tonneKm)} t·km`} note="Tonne-km entries." /> : null}
          </dl>
        </Card>
        <Card>
          <CardHeader title="Life-cycle stages covered" description="EN 15978 modules included in this result. This is not a whole-life assessment." />
          <div className="px-5 pb-3">
            <CoveragePanel coverage={result.coverage} />
          </div>
        </Card>
      </div>

      <Callout tone="info" title={`Profile: ${PROFILE_LABELS[project.profile]}`}>
        {PROFILE_LABELS[otherProfile]} total: <strong>{formatKg(result.profileTotals[otherProfile])}</strong>. The difference ({formatKg(Math.abs(result.profileTotals.foundation_inclusive - result.profileTotals.report_master))}) is the foundation stage, which the reference report&apos;s master schedule leaves out.
        {project.boundary === "construction_stage" ? " The boundary is the construction stage only. The embodied carbon of installed material, the use stage and end of life are not included." : ""}
      </Callout>

      <div className="grid gap-4 lg:grid-cols-2">
        <CategoryDonut result={result} />
        <RankingChart result={result} />
        <ActivityStackChart result={result} />
        <StageChart result={result} />
        {result.byBuilding.length > 1 ? (
          <ComparisonChart
            title="Building groups"
            description="Per building vs group total, kg CO₂e"
            items={result.byBuilding.map((b) => ({ label: b.name, a: b.perBuildingKg, b: b.totalKg }))}
            aLabel="Per building"
            bLabel="Group total"
          />
        ) : null}
        <ComparisonChart
          title="Calculation profiles"
          description="Same inputs, both profiles (kg CO₂e)"
          items={[
            { label: "Material wastage", a: sumWaste(result, "report_master"), b: sumWaste(result, "foundation_inclusive") },
            { label: "Total", a: result.profileTotals.report_master, b: result.profileTotals.foundation_inclusive },
          ]}
          aLabel="Report master"
          bLabel="Foundation-inclusive"
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader title="Where to act first" description="Potential measures ranked by the share of your result they address. Savings are not guaranteed." />
          <ul className="divide-y divide-line">
            {recs.map((r) => (
              <li key={r.id} className="px-5 py-3">
                <p className="flex items-baseline justify-between gap-3 font-medium">
                  {r.title}
                  <span className="num shrink-0 text-xs font-normal text-ink-muted">addresses {formatShare(r.addressesShare, 1)}</span>
                </p>
                <p className="mt-0.5 text-sm text-ink-muted">{r.detail}</p>
              </li>
            ))}
            {!recs.length ? <li className="px-5 py-4 text-sm text-ink-subtle">No emissions calculated yet.</li> : null}
          </ul>
        </Card>
        <Card>
          <CardHeader title="Assumptions and warnings" />
          <div className="max-h-96 overflow-y-auto p-5">
            <FlagList flags={summariseFlags(result)} />
          </div>
        </Card>
      </div>

      {project.isSample ? (
        <Card>
          <CardHeader title="Reconciliation with the reference report" description="Each component of the sample, calculated by the engine, compared with the BIM report's master schedule." />
          <div className="p-5">
            <ReconciliationTable result={result} compact />
          </div>
        </Card>
      ) : null}
    </div>
  );
}

function sumWaste(r: ProjectResult, profile: "report_master" | "foundation_inclusive") {
  return r.lines
    .filter((l) => l.valid && l.kind === "material" && !(profile === "report_master" && l.stageId === "foundation") && !(l.materialCategory === "cement" && l.exclusionReason?.startsWith("Cement")))
    .reduce((s, l) => s + l.emissionsKg, 0);
}

function SplitRow({ label, value, note }: { label: string; value: string; note: string }) {
  return (
    <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-0.5 py-2.5">
      <dt>
        <span className="font-medium">{label}</span>
        <span className="block text-xs text-ink-subtle">{note}</span>
      </dt>
      <dd className="num font-medium">{value}</dd>
    </div>
  );
}
