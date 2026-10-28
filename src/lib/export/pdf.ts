import { jsPDF } from "jspdf";
import { autoTable, type RowInput } from "jspdf-autotable";
import {
  DATA_STATUS_LABELS,
  PROFILE_DESCRIPTIONS,
  PROFILE_LABELS,
  SOURCE_DISCREPANCIES,
  buildRecommendations,
  reconcileSample,
  type DataStatus,
  type Project,
  type ProjectResult,
  type ScenarioComparison,
  type UncertaintySummary,
} from "@/lib/engine";
import { formatFixed, formatShare } from "@/lib/format";
import { summariseFlagsPlain } from "./flags";
import { lineFactorText } from "./tables";

/**
 * The detailed PDF report. Every number comes from the ProjectResult passed in;
 * nothing is templated. Charts are drawn with PDF primitives from the same data.
 */
export interface PdfOptions {
  generatedAt: string;
  scenario?: ScenarioComparison | null;
  uncertainty?: UncertaintySummary | null;
}

const GREEN: [number, number, number] = [30, 77, 58];
const INK: [number, number, number] = [31, 35, 40];
const MUTED: [number, number, number] = [86, 92, 99];
const SERIES: [number, number, number][] = [
  [42, 120, 214],
  [235, 104, 52],
  [27, 175, 122],
  [237, 161, 0],
  [232, 123, 164],
  [0, 131, 0],
  [98, 80, 214],
];

/** The standard PDF fonts use WinAnsi encoding, so a few Unicode characters are replaced. */
export function pdfText(s: string): string {
  return s
    .replace(/₂/g, "2")
    .replace(/→/g, "->")
    .replace(/⌈/g, "ceil(")
    .replace(/⌉/g, ")")
    .replace(/≥/g, ">=")
    .replace(/≤/g, "<=")
    .replace(/[“”]/g, '"')
    .replace(/[‘’]/g, "'")
    .replace(/·/g, "-")
    .replace(/[^\x20-\x7E\n -ÿ–—•…]/g, "?");
}

const n2 = (v: number | null | undefined) => formatFixed(v, 2);

export function buildPdf(p: Project, r: ProjectResult, opts: PdfOptions): jsPDF {
  const doc = new jsPDF({ unit: "mm", format: "a4", compress: false });
  const W = doc.internal.pageSize.getWidth();
  const M = 16;
  let y = M;

  const ensure = (h: number) => {
    if (y + h > doc.internal.pageSize.getHeight() - 16) {
      doc.addPage();
      y = M;
    }
  };
  const heading = (t: string) => {
    ensure(16);
    y += 4;
    doc.setFont("helvetica", "bold").setFontSize(13).setTextColor(...GREEN);
    doc.text(pdfText(t), M, y);
    y += 2;
    doc.setDrawColor(...GREEN).setLineWidth(0.3).line(M, y, W - M, y);
    y += 6;
  };
  const para = (t: string, size = 9.5, color = MUTED) => {
    doc.setFont("helvetica", "normal").setFontSize(size).setTextColor(...color);
    const lines = doc.splitTextToSize(pdfText(t), W - 2 * M);
    for (const line of lines) {
      ensure(5);
      doc.text(line, M, y);
      y += size * 0.45;
    }
    y += 1.5;
  };
  const table = (head: string[], body: RowInput[], opts2: { colStyles?: Record<number, object>; fontSize?: number } = {}) => {
    autoTable(doc, {
      startY: y,
      head: [head.map(pdfText)],
      body: body.map((row) => (row as unknown[]).map((c) => (typeof c === "string" ? pdfText(c) : c))) as RowInput[],
      margin: { left: M, right: M },
      styles: { fontSize: opts2.fontSize ?? 8.5, cellPadding: 1.6, textColor: INK, lineColor: [226, 223, 215], lineWidth: 0.1 },
      headStyles: { fillColor: GREEN, textColor: [255, 255, 255], fontStyle: "bold" },
      alternateRowStyles: { fillColor: [248, 246, 241] },
      columnStyles: opts2.colStyles,
    });
    y = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 6;
  };
  const barChart = (items: { label: string; kg: number }[], total: number) => {
    const rows = items.filter((i) => i.kg > 0);
    if (!rows.length) return;
    const max = Math.max(...rows.map((i) => i.kg));
    const labelW = 52;
    const barMax = W - 2 * M - labelW - 34;
    ensure(rows.length * 7 + 4);
    doc.setFontSize(8.5);
    for (const it of rows) {
      doc.setTextColor(...MUTED).setFont("helvetica", "normal");
      doc.text(pdfText(it.label).slice(0, 34), M, y + 3.6);
      const w = Math.max(0.6, (it.kg / max) * barMax);
      doc.setFillColor(...GREEN).roundedRect(M + labelW, y, w, 5, 0.8, 0.8, "F");
      doc.setTextColor(...INK);
      doc.text(`${formatFixed(it.kg, 0)} kg (${formatShare(total > 0 ? it.kg / total : 0, 1)})`, M + labelW + w + 2, y + 3.6);
      y += 7;
    }
    y += 3;
  };

  // --- Cover -----------------------------------------------------------------
  doc.setFillColor(...GREEN).rect(0, 0, W, 34, "F");
  doc.setTextColor(255, 255, 255).setFont("helvetica", "bold").setFontSize(18);
  doc.text("CarbonBuild", M, 15);
  doc.setFont("helvetica", "normal").setFontSize(11);
  doc.text("Construction carbon footprint report", M, 23);
  doc.setFontSize(8.5).text("Measure. Understand. Reduce.", M, 29);
  y = 46;
  doc.setTextColor(...INK).setFont("helvetica", "bold").setFontSize(16);
  doc.text(pdfText(p.name || "Untitled project"), M, y);
  y += 8;
  table(
    ["Item", "Value"],
    [
      ["Location", [p.location.city, p.location.state, p.location.country].filter(Boolean).join(", ") || "Not stated"],
      ["Assessment date", opts.generatedAt.slice(0, 10)],
      ...(p.assessmentPeriod ? [["Assessment period", p.assessmentPeriod]] : []),
      ...(p.notes ? [["Description", p.notes]] : []),
      ["Construction status", p.constructionStatus],
      ["Building groups", p.buildings.map((b) => `${b.name}: ${b.count} x ${b.floors ?? "?"} floors x ${b.areaPerFloorM2 ?? "?"} m2${b.count > 1 && !b.identicalConfirmed ? " (NOT confirmed identical: 1 counted)" : ""}`).join("; ")],
      ["Calculation profile", `${PROFILE_LABELS[r.profile]}: ${PROFILE_DESCRIPTIONS[r.profile]}`],
      ["Assessment boundary", r.boundary === "construction_stage" ? "Construction stage only: embodied carbon of wasted material (A1–A3, plus C2–C4 where the factor includes it) and diesel for transport (A4) and machinery (A5). Not a whole-life assessment." : "Expanded: construction stage plus production (A1–A3) of installed material where a factor is selected. Use (B) and end of life (C) not included."],
      ["Versions", `Engine ${r.engineVersion}; factor dataset ${r.factorDatasetVersion}; default range level: ${r.defaultFactorLevel}`],
    ],
    { colStyles: { 0: { cellWidth: 42, fontStyle: "bold" } } },
  );

  // --- Summary ---------------------------------------------------------------
  const t = r.totals;
  heading("1. Total carbon footprint");
  table(
    ["Indicator", "Value"],
    [
      ["Total emissions", `${n2(t.totalKg)} kg CO2e (${n2(t.totalTonnes)} t CO2e)`],
      ["Emissions intensity", t.intensityKgPerM2 === null ? "Not available (built-up area missing)" : `${n2(t.intensityKgPerM2)} kg CO2e/m2 over ${formatFixed(t.builtUpAreaM2, 2)} m2`],
      ["Material wastage", `${n2(t.materialWasteKg)} kg CO2e`],
      ["Transportation", `${n2(t.transportKg)} kg CO2e`],
      ["Site machinery", `${n2(t.machineryKg)} kg CO2e`],
      ["Emissions per building", t.perBuildingKg === null ? "Not available" : `${n2(t.perBuildingKg)} kg CO2e (${t.buildingsCounted} counted)`],
      ["Excluded sections", r.excludedSections.length ? r.excludedSections.map((k) => (k === "transport" ? "transportation (A4)" : "site machinery (A5)")).join(", ") : "None"],
      ...(r.boundary === "expanded" ? [["Installed material (A1–A3)", `${n2(t.installedEmbodiedKg)} kg CO2e`]] : []),
      ["Diesel consumed", `${n2(t.dieselLitres)} L`],
      ["Report master profile total", `${n2(r.profileTotals.report_master)} kg CO2e`],
      ["Foundation-inclusive profile total", `${n2(r.profileTotals.foundation_inclusive)} kg CO2e`],
    ],
    { colStyles: { 0: { cellWidth: 70, fontStyle: "bold" } } },
  );
  table(
    ["Waste emissions by life-cycle part", "kg CO2e"],
    [
      ["Production of wasted material (A1–A3)", n2(t.waste.production)],
      ["Waste treatment and disposal (C2–C4)", n2(t.waste.treatment)],
      ["Production + disposal, combined factor", n2(t.waste.combined)],
      ["Boundary not stated", n2(t.waste.unclassified)],
      ["Material production of installed material (A1–A3)", r.boundary === "expanded" ? n2(t.installedEmbodiedKg) : "Outside boundary"],
    ],
  );
  table(
    ["Life-cycle module", "Status", "Note"],
    r.coverage.map((c) => [`${c.module} ${c.label}`, c.status, c.note]),
    { fontSize: 7.5, colStyles: { 0: { cellWidth: 52 }, 1: { cellWidth: 20 } } },
  );
  if (t.excludedByProfileKg > 0) para(`The selected profile leaves out ${n2(t.excludedByProfileKg)} kg CO2e of foundation-stage emissions, as the reference report's master schedule does.`);

  // --- Breakdown -------------------------------------------------------------
  heading("2. Material and activity breakdown");
  para("Emission sources ranked (material wastage by stage; fuel activities individually):", 9.5, INK);
  barChart(r.bySource.map((s) => ({ label: s.label, kg: s.kg })), t.totalKg);
  // Category split drawn as one stacked bar.
  const cats = r.byEmissionCategory.filter((c) => c.kg > 0);
  if (cats.length && t.totalKg > 0) {
    ensure(22);
    para("Split by emission category:", 9.5, INK);
    let x = M;
    const width = W - 2 * M;
    cats.forEach((c, i) => {
      const w = (c.kg / t.totalKg) * width;
      doc.setFillColor(...SERIES[i % SERIES.length]).rect(x, y, Math.max(0.3, w - 0.5), 6, "F");
      x += w;
    });
    y += 10;
    doc.setFontSize(8.5);
    let lx = M;
    cats.forEach((c, i) => {
      const label = pdfText(`${c.label} ${formatShare(c.kg / t.totalKg, 1)}`);
      doc.setFillColor(...SERIES[i % SERIES.length]).rect(lx, y - 2.6, 3, 3, "F");
      doc.setTextColor(...MUTED).text(label, lx + 4.5, y);
      lx += doc.getTextWidth(label) + 10;
    });
    y += 7;
  }
  table(
    ["Stage", "Concrete", "Steel", "Masonry", "Cement", "Other", "Total (kg CO2e)"],
    r.byStage.map((s) => [s.stageName, n2(s.byMaterial.concrete), n2(s.byMaterial.steel), n2(s.byMaterial.masonry), n2(s.byMaterial.cement), n2(s.byMaterial.other), n2(s.kg)]),
  );
  if (r.byBuilding.length > 1 || r.byBuilding[0]?.count > 1) {
    table(
      ["Building group", "Buildings counted", "Per building (kg CO2e)", "Group total (kg CO2e)"],
      r.byBuilding.map((b) => [b.name, `${b.multiplier} of ${b.count}`, n2(b.perBuildingKg), n2(b.totalKg)]),
    );
  }

  // --- Factors ---------------------------------------------------------------
  heading("3. Emission factors used");
  const used = new Map<string, { name: string; value: string; modules: string; source: string; status: string }>();
  for (const l of r.lines)
    for (const c of l.factorComponents)
      used.set(`${c.factorId}|${c.level}`, {
        name: c.name,
        value: `${c.originalValue} ${c.originalUnit}${c.level === "point" ? "" : ` (${c.level})`}`,
        modules: c.lifecycleModules.join(" + ") || "not stated",
        source: `${c.source}${c.sourceLocation ? `, ${c.sourceLocation}` : ""}`,
        status: `${c.status}${c.generic ? ", generic" : ""}`,
      });
  table(["Factor", "Value", "Boundary", "Source", "Status"], [...used.values()].map((f) => [f.name, f.value, f.modules, f.source, f.status]), {
    fontSize: 7.5,
    colStyles: { 0: { cellWidth: 44 }, 1: { cellWidth: 28 }, 2: { cellWidth: 22 } },
  });

  // --- Itemised calculations -------------------------------------------------
  heading("4. Itemised calculations");
  table(
    ["Item", "Stage", "Quantity", "Wasted / fuel", "Factor", "kg CO2e", "Share", "Status"],
    r.lines.map((l) => [
      `${l.name}${r.byBuilding.length > 1 ? ` (${l.buildingName})` : ""}`,
      l.stageName,
      `${l.inputQuantity === null ? "missing" : formatFixed(l.inputQuantity, 3)} ${l.inputUnit}`,
      l.wastedMassKg !== null ? `${formatFixed(l.wastedMassKg, 2)} kg (${l.wastePercent}%)` : l.dieselLitres !== null ? `${formatFixed(l.dieselLitres, 2)} L` : l.tonneKm !== null ? `${formatFixed(l.tonneKm, 2)} t-km` : "—",
      l.effectiveFactor === null ? "—" : `${formatFixed(l.effectiveFactor, 4)}`,
      l.included ? n2(l.emissionsKg) : `(${n2(l.emissionsKg)}) excl.`,
      l.included ? formatShare(l.share, 1) : "—",
      DATA_STATUS_LABELS[l.dataStatus],
    ]),
    { fontSize: 7.5, colStyles: { 0: { cellWidth: 40 } } },
  );
  para("Calculation steps for each item (formula = substitution = result):", 9.5, INK);
  for (const l of r.lines) {
    ensure(12);
    doc.setFont("helvetica", "bold").setFontSize(8.5).setTextColor(...INK);
    doc.text(pdfText(`${l.name} [${l.stageName}${r.byBuilding.length > 1 ? `, ${l.buildingName}` : ""}]${l.included ? "" : `: not in total (${l.exclusionReason ?? ""})`}`).slice(0, 150), M, y);
    y += 4;
    doc.setFont("courier", "normal").setFontSize(7.5).setTextColor(...MUTED);
    const steps = l.steps.map((s) => `${s.formula} = ${s.substitution} = ${formatFixed(s.value, 4)} ${s.unit}`);
    if (l.multiplier > 1) steps.push(`Project total = ${formatFixed(l.emissionsPerBuildingKg, 4)} x ${l.multiplier} = ${formatFixed(l.emissionsKg, 4)} kg CO2e`);
    if (!steps.length) steps.push(l.flags.filter((f) => f.severity === "error").map((f) => f.message).join(" ") || "No steps.");
    for (const s of steps) {
      for (const line of doc.splitTextToSize(pdfText(s), W - 2 * M - 4)) {
        ensure(4);
        doc.text(line, M + 2, y);
        y += 3.4;
      }
    }
    if (l.factorComponents.length) {
      for (const line of doc.splitTextToSize(pdfText(`Factor: ${lineFactorText(l)}`), W - 2 * M - 4)) {
        ensure(4);
        doc.text(line, M + 2, y);
        y += 3.4;
      }
    }
    y += 2;
  }

  // --- Data quality ----------------------------------------------------------
  heading("5. Data quality and uncertainty");
  const statuses = Object.keys(DATA_STATUS_LABELS) as DataStatus[];
  table(
    ["Data status", "Inputs", "Emissions (kg CO2e)", "Share of total"],
    statuses.map((s) => [DATA_STATUS_LABELS[s], String(r.dataQuality.inputCounts[s]), n2(r.dataQuality.emissionsByStatus[s]), formatShare(t.totalKg > 0 ? r.dataQuality.emissionsByStatus[s] / t.totalKg : 0, 1)]),
  );
  para(
    `Waste percentages: ${r.dataQuality.wasteSourceCounts.reference} reference assumptions, ${r.dataQuality.wasteSourceCounts.user} user-provided, ${r.dataQuality.wasteSourceCounts.measured} measured. Emissions using generic literature factors: ${n2(r.dataQuality.genericFactorKg)} kg CO2e. Emissions using factors with an unstated boundary: ${n2(r.dataQuality.boundaryUncertainKg)} kg CO2e. No overall confidence score is given; the main uncertainties are listed below.`,
  );
  const u = opts.uncertainty;
  if (u) {
    if (u.rangeFactorLow !== null && u.rangeFactorHigh !== null) {
      para(`Range factors (${u.rangeFactorsUsed.join(", ")}) at low / high bounds: ${n2(u.rangeFactorLow)} to ${n2(u.rangeFactorHigh)} kg CO2e.`, 9.5, INK);
    }
    if (u.sensitivities.length) table(["Sensitivity", "Change in total (kg CO2e)", "Change (%)"], u.sensitivities.map((s) => [s.label, n2(s.deltaKg), formatShare(s.deltaShare, 2)]));
  }

  // --- Assumptions and warnings ---------------------------------------------
  heading("6. Assumptions, missing information and warnings");
  table(["Severity", "Message"], summariseFlagsPlain(r).map((f) => [f.severity, f.message]), { fontSize: 7.5, colStyles: { 0: { cellWidth: 18 } } });

  // --- Scenario --------------------------------------------------------------
  const sc = opts.scenario;
  if (sc && sc.measures.length) {
    heading("7. Reduction scenario");
    table(
      ["", "kg CO2e"],
      [
        ["Baseline", n2(sc.baseline.totals.totalKg)],
        ["Scenario", n2(sc.scenario.totals.totalKg)],
        ["Saving", `${n2(sc.savingsKg)} (${formatShare(sc.reductionFraction, 1)})`],
        ["Sum of single-measure savings", n2(sc.sumOfIndividualSavingsKg)],
        ["Interaction between measures", n2(sc.interactionKg)],
      ],
    );
    table(["Measure (applied alone)", "Saving (kg CO2e)"], sc.measures.map((m) => [m.label, n2(m.savingsKg)]));
    table(["Component", "Baseline", "Scenario", "Change"], sc.componentChanges.map((c) => [c.label, n2(c.baselineKg), n2(c.scenarioKg), n2(c.deltaKg)]));
    for (const w of sc.warnings) para(w);
    para("Savings are potential reductions calculated from the inputs, not guaranteed outcomes.");
  }

  // --- Recommendations -------------------------------------------------------
  heading(`${sc && sc.measures.length ? 8 : 7}. Recommendations`);
  table(
    ["Potential measure", "Addresses", "Detail"],
    buildRecommendations(r).map((x) => [x.title, `${n2(x.addressesKg)} kg (${formatShare(x.addressesShare, 1)})`, x.detail]),
    { fontSize: 7.5, colStyles: { 0: { cellWidth: 40 }, 1: { cellWidth: 32 } } },
  );

  // --- Reference reconciliation (sample only) ---------------------------------
  if (p.isSample) {
    heading("Reference reconciliation (per bungalow)");
    table(
      ["Item", "Reported", "Calculated", "Difference", "Status"],
      reconcileSample(r).map((row) => [row.label, `${formatFixed(row.reported, 2)} ${row.unit}`, formatFixed(row.calculated, 4), formatFixed(row.delta, 4), row.matches ? "Matches" : `Differs: ${row.explanation ?? ""}`]),
      { fontSize: 7.5 },
    );
    for (const d of SOURCE_DISCREPANCIES) para(`${d.title}: ${d.detail}`);
  }

  // --- Methodology -----------------------------------------------------------
  heading("Methodology and sources");
  para(
    "Emission-factor method: E_total = sum(activity data x emission factor). Volumetric quantities are converted to mass with density (2,400 kg/m3 for RCC in the reference study). Wasted mass = total mass x waste % / 100; waste emissions = wasted mass x factor. Production (A1–A3) and disposal (C2–C4) factors are added only when their boundaries do not overlap. Transport diesel = trips x distance per trip (doubled for one-way distances) / fuel economy, unless measured fuel is entered. Machinery diesel = hours x litres per hour, unless measured. Fuel emissions = litres x diesel factor (2.68 kg CO2e/L). Tonne-km transport = transported mass (t) x distance (km) x factor per tonne-km; one method per delivery. Waste emissions are split by the life-cycle modules of each factor (A1–A3 production, C2–C4 treatment). Groups of buildings are multiplied by their count only when confirmed identical. Calculations run at full precision; values are rounded only for display.",
  );
  para(
    "Reference data: 'Carbon Footprint Assessment of Construction Projects', B.Tech Project 2026, Sarvajanik University, Surat, and its Chapters 7–14, 'Carbon Footprint Assessment using BIM'. Standards referenced there: EN 15978 (life-cycle modules), GHG Protocol (scopes), ISO 19650 and ISO 16739 (BIM, IFC), ICE database (generic factors).",
  );
  heading("Disclaimer");
  para(
    "This report is an estimate produced from the quantities, waste allowances and emission factors entered by the user and the reference values shown. It is not a certified or verified carbon assessment, an environmental product declaration, or a whole-life carbon assessment. Generic factors may not represent specific Indian suppliers. Check inputs against site records before relying on the result.",
  );

  const pages = doc.getNumberOfPages();
  for (let i = 1; i <= pages; i++) {
    doc.setPage(i);
    doc.setFont("helvetica", "normal").setFontSize(7.5).setTextColor(...MUTED);
    doc.text(pdfText(`CarbonBuild - ${p.name} - ${opts.generatedAt.slice(0, 10)}`), M, doc.internal.pageSize.getHeight() - 8);
    doc.text(`Page ${i} of ${pages}`, W - M, doc.internal.pageSize.getHeight() - 8, { align: "right" });
  }
  return doc;
}

