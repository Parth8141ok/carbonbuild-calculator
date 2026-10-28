import { DATA_STATUS_LABELS, EMISSION_CATEGORY_LABELS, PROFILE_LABELS, type LineResult, type Project, type ProjectResult } from "@/lib/engine";
import { round } from "@/lib/format";

/**
 * Table builders shared by the CSV, Excel and PDF exports, so that every format
 * carries the same calculated data.
 */
export type Cell = string | number | null;

export const CALCULATION_HEADERS = [
  "Building group",
  "Stage",
  "Type",
  "Material or activity",
  "Specification / supplier",
  "Input quantity",
  "Input unit",
  "Total mass (kg)",
  "Waste (%)",
  "Wasted mass (kg)",
  "Distance (km)",
  "Tonne-km",
  "Diesel (L)",
  "Emission factor(s)",
  "Effective factor",
  "Factor unit",
  "Emissions per building (kg CO2e)",
  "Waste: production of wasted material (kg CO2e)",
  "Waste: treatment and disposal (kg CO2e)",
  "Waste: production + disposal combined (kg CO2e)",
  "Waste: boundary not stated (kg CO2e)",
  "Buildings counted",
  "Emissions (kg CO2e)",
  "Share of total (%)",
  "Included",
  "Exclusion reason",
  "Data status",
  "Factor source(s)",
  "Calculation steps",
] as const;

export function lineFactorText(l: LineResult): string {
  return l.factorComponents
    .map((c) => `${c.name} = ${c.originalValue} ${c.originalUnit}${c.level === "point" ? "" : ` (${c.level})`} [${c.lifecycleModules.join("+") || "boundary not stated"}]`)
    .join(" + ");
}

export function lineStepsText(l: LineResult): string {
  return l.steps.map((s) => `${s.label}: ${s.formula} = ${s.substitution} = ${round(s.value, 4)} ${s.unit}`).join(" | ");
}

export function calculationRows(r: ProjectResult): Cell[][] {
  return r.lines.map((l) => [
    l.buildingName,
    l.stageName,
    EMISSION_CATEGORY_LABELS[l.emissionCategory],
    l.name,
    l.specification,
    l.inputQuantity,
    l.inputUnit,
    l.totalMassKg,
    l.wastePercent,
    l.wastedMassKg,
    l.distanceKm,
    l.tonneKm,
    l.dieselLitres,
    lineFactorText(l),
    l.effectiveFactor,
    l.effectiveFactorUnit,
    l.emissionsPerBuildingKg,
    l.wasteSplit?.production ?? null,
    l.wasteSplit?.treatment ?? null,
    l.wasteSplit?.combined ?? null,
    l.wasteSplit?.unclassified ?? null,
    l.multiplier,
    l.emissionsKg,
    l.included ? l.share * 100 : 0,
    l.included ? "Yes" : "No",
    l.exclusionReason ?? "",
    DATA_STATUS_LABELS[l.dataStatus],
    [...new Set(l.factorComponents.map((c) => `${c.source}${c.sourceLocation ? `, ${c.sourceLocation}` : ""}`))].join("; "),
    lineStepsText(l),
  ]);
}

export function summaryRows(p: Project, r: ProjectResult, generatedAt: string): Cell[][] {
  const t = r.totals;
  return [
    ["Project", p.name],
    ["Location", [p.location.city, p.location.state, p.location.country].filter(Boolean).join(", ")],
    ["Assessment date", generatedAt],
    ["Calculation profile", PROFILE_LABELS[r.profile]],
    ["Assessment boundary", r.boundary === "construction_stage" ? "Construction stage (wasted material A1–A3 + disposal where included; diesel A4, A5)" : "Expanded: construction stage + installed material A1–A3"],
    ["Engine version", r.engineVersion],
    ["Factor dataset version", r.factorDatasetVersion],
    ["Default range-factor level", r.defaultFactorLevel],
    ["Total emissions (kg CO2e)", t.totalKg],
    ["Total emissions (t CO2e)", t.totalTonnes],
    ["Material wastage (kg CO2e)", t.materialWasteKg],
    ["Transportation (kg CO2e)", t.transportKg],
    ["Site machinery (kg CO2e)", t.machineryKg],
    ["Installed material A1–A3 (kg CO2e)", t.installedEmbodiedKg],
    ["Waste: production of wasted material (kg CO2e)", t.waste.production],
    ["Waste: treatment and disposal (kg CO2e)", t.waste.treatment],
    ["Waste: production + disposal combined (kg CO2e)", t.waste.combined],
    ["Waste: boundary not stated (kg CO2e)", t.waste.unclassified],
    ["Diesel (L)", t.dieselLitres],
    ["Transport activity (tonne-km)", t.tonneKm],
    ["Buildings counted", t.buildingsCounted],
    ["Emissions per building (kg CO2e)", t.perBuildingKg],
    ["Built-up area (m²)", t.builtUpAreaM2],
    ["Intensity (kg CO2e/m²)", t.intensityKgPerM2],
    ["Report master profile total (kg CO2e)", r.profileTotals.report_master],
    ["Foundation-inclusive profile total (kg CO2e)", r.profileTotals.foundation_inclusive],
    ["Left out by selected profile (kg CO2e)", t.excludedByProfileKg],
    ["Excluded sections", r.excludedSections.length ? r.excludedSections.join(", ") : "None"],
    ["Assessment period", p.assessmentPeriod ?? ""],
    ["Description", p.notes],
    ...r.coverage.map((c): Cell[] => [`Life-cycle ${c.module} (${c.label})`, `${c.status}: ${c.note}`]),
  ];
}

export const FACTOR_HEADERS = ["ID", "Name", "Category", "Value", "Range low", "Range high", "Unit", "Specification", "Geography", "Life-cycle modules", "Boundary stated", "Boundary notes", "Source", "Source location", "Version", "Status", "Generic"];

export function factorRows(p: Project, r: ProjectResult): Cell[][] {
  const used = new Set(r.lines.flatMap((l) => l.factorComponents.map((c) => c.factorId)));
  return p.factors
    .filter((f) => used.has(f.id))
    .map((f) => [f.id, f.name, f.category, f.value, f.range?.low ?? null, f.range?.high ?? null, f.unit, f.specification, f.geography, f.lifecycleModules.join(", ") || "not stated", f.boundaryStated ? "Yes" : "No", f.boundaryNotes, f.source, f.sourceLocation ?? "", f.version, f.status, f.generic ? "Yes" : "No"]);
}

function csvCell(v: Cell): string {
  if (v === null || v === undefined) return "";
  // Six decimals removes floating-point noise (8985.599999999999) without losing meaningful precision.
  const s = typeof v === "number" ? (Number.isFinite(v) ? String(round(v, 6)) : "") : v;
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export function toCsv(headers: readonly string[], rows: Cell[][]): string {
  return [headers, ...rows].map((r) => r.map((c) => csvCell(c as Cell)).join(",")).join("\r\n") + "\r\n";
}

/** Detailed calculation table as CSV. Values keep full precision so that results can be reproduced. */
export function calculationCsv(r: ProjectResult): string {
  return "﻿" + toCsv(CALCULATION_HEADERS, calculationRows(r));
}
