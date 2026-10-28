import { fmt } from "../format";
import { MATERIAL_CATEGORY_LABELS } from "./stages";
import type {
  BuildingBreakdown,
  BuildingGroup,
  CalcStep,
  CalculationProfile,
  DataStatus,
  EmissionCategory,
  EmissionFactor,
  FactorLevel,
  FactorRef,
  FactorStatus,
  Flag,
  LifecycleModule,
  LineResult,
  MachineryEntry,
  MaterialCategory,
  MaterialEntry,
  Project,
  ProjectResult,
  ResolvedFactor,
  StageBreakdown,
  TransportEntry,
  CoverageRow,
  WasteSplit,
} from "./types";
import {
  QUANTITY_UNIT_LABELS,
  isMassBasedFactorUnit,
  isNonNegativeFinite,
  isPositiveFinite,
  normaliseFactorValue,
} from "./units";

export const ENGINE_VERSION = "1.0.0";

export const PROFILE_LABELS: Record<CalculationProfile, string> = {
  report_master: "Report master schedule",
  foundation_inclusive: "Foundation-inclusive sensitivity",
};

export const PROFILE_DESCRIPTIONS: Record<CalculationProfile, string> = {
  report_master:
    "Follows the consolidated master schedule of the reference report (BIM report Table 9.10). Foundation-stage entries are calculated and shown, but left out of the total, as in the report.",
  foundation_inclusive:
    "Adds the foundation stage to the total. This is the sensitivity case in BIM report §9.11.",
};

export const EMISSION_CATEGORY_LABELS: Record<EmissionCategory, string> = {
  material_waste: "Material wastage",
  transport: "Transportation",
  machinery: "Site machinery",
  installed_embodied: "Installed material (A1–A3)",
};

export const DATA_STATUS_LABELS: Record<DataStatus, string> = {
  measured: "Measured",
  user_provided: "User-provided",
  estimated: "Estimated",
  assumed: "Assumed",
};

const FUEL_CATEGORY_LABEL = "Diesel";

interface Context {
  factors: Map<string, EmissionFactor>;
  defaultLevel: FactorLevel;
  stageNames: Map<string, string>;
  boundary: Project["boundary"];
}

type Draft = Omit<
  LineResult,
  "buildingId" | "buildingName" | "multiplier" | "emissionsKg" | "included" | "exclusionReason" | "share" | "id"
> & { scopeExclusion: string | null };

// ---------------------------------------------------------------------------
// Factors
// ---------------------------------------------------------------------------

export function resolveFactor(
  ref: FactorRef | null | undefined,
  factors: Map<string, EmissionFactor>,
  defaultLevel: FactorLevel,
  basis: "mass" | "fuel" | "tkm",
): { factor: ResolvedFactor | null; error: string | null } {
  if (!ref || !ref.factorId) return { factor: null, error: "No emission factor selected." };
  const f = factors.get(ref.factorId);
  if (!f) return { factor: null, error: `Emission factor "${ref.factorId}" is not in this project's factor library.` };

  const massBased = isMassBasedFactorUnit(f.unit);
  if (basis === "mass" && !massBased) {
    return { factor: null, error: `"${f.name}" is expressed in ${f.unit}; a material needs a factor per kg or per tonne.` };
  }
  if (basis === "fuel" && f.unit !== "kgCO2e/L") {
    return { factor: null, error: `"${f.name}" is expressed in ${f.unit}; fuel needs a factor per litre.` };
  }
  if (basis === "tkm" && f.unit !== "kgCO2e/tkm") {
    return { factor: null, error: `"${f.name}" is expressed in ${f.unit}; the tonne-km method needs a factor per tonne-km.` };
  }

  let level: ResolvedFactor["level"] = "point";
  let raw = f.value;
  if (f.range) {
    level = ref.level ?? defaultLevel;
    raw = level === "low" ? f.range.low : level === "high" ? f.range.high : f.value;
  }
  if (!Number.isFinite(raw) || raw < 0) {
    return { factor: null, error: `"${f.name}" has an invalid value (${raw}). Factors must be zero or positive.` };
  }

  return {
    factor: {
      factorId: f.id,
      name: f.name,
      value: normaliseFactorValue(raw, f.unit),
      originalValue: raw,
      originalUnit: f.unit,
      level,
      source: f.source,
      sourceLocation: f.sourceLocation,
      lifecycleModules: [...f.lifecycleModules],
      boundaryStated: f.boundaryStated,
      boundaryNotes: f.boundaryNotes,
      status: f.status,
      generic: f.generic,
    },
    error: null,
  };
}

/**
 * Factor components may only be added when their life-cycle modules are known and
 * do not overlap, e.g. production (A1–A3) + disposal (C2–C4). Anything else risks
 * counting the same emissions twice.
 */
export function checkComponentBoundaries(components: ResolvedFactor[]): string | null {
  if (components.length < 2) return null;
  const unknown = components.filter((c) => c.lifecycleModules.length === 0);
  if (unknown.length > 0) {
    return `Cannot combine factors: the boundary of "${unknown[0].name}" is unknown, so overlap cannot be ruled out.`;
  }
  const seen = new Map<LifecycleModule, string>();
  for (const c of components) {
    for (const m of c.lifecycleModules) {
      const other = seen.get(m);
      if (other) {
        return `Double counting: "${c.name}" and "${other}" both cover module ${m}. Use one of them, or factors whose boundaries do not overlap.`;
      }
      seen.set(m, c.name);
    }
  }
  return null;
}

/** Which part of the waste emissions a factor component represents, from its life-cycle modules. */
export function classifyComponent(c: Pick<ResolvedFactor, "lifecycleModules">): keyof WasteSplit {
  const m = c.lifecycleModules;
  const prod = m.includes("A1-A3");
  const treat = m.includes("C2-C4");
  if (prod && treat) return "combined";
  if (treat) return "treatment";
  if (prod) return "production";
  return "unclassified";
}

function factorLabel(c: ResolvedFactor): string {
  const unit = { "kgCO2e/t": "kg CO₂e/t", "kgCO2e/L": "kg CO₂e/L", "kgCO2e/tkm": "kg CO₂e/t·km", "kgCO2e/kg": "kg CO₂e/kg" }[c.originalUnit];
  const lvl = c.level === "point" ? "" : ` (${c.level})`;
  return `${fmt(c.originalValue)} ${unit}${lvl}`;
}

function factorFlags(components: ResolvedFactor[], entryId: string): Flag[] {
  const flags: Flag[] = [];
  for (const c of components) {
    if (!c.boundaryStated) {
      flags.push({
        code: "boundary_uncertain",
        severity: "warning",
        message: `The system boundary of "${c.name}" is not stated by its source.`,
        entryId,
      });
    }
    if (c.generic) {
      flags.push({
        code: "generic_factor",
        severity: "info",
        message: `"${c.name}" is a generic literature value, not a supplier-specific declaration.`,
        entryId,
      });
    }
    if (c.status === "illustrative") {
      flags.push({
        code: "illustrative_factor",
        severity: "warning",
        message: `"${c.name}" is an illustrative placeholder value, not a verified factor. Replace it with a sourced value before relying on the result.`,
        entryId,
      });
    }
    if (c.status === "user" && !c.source.trim()) {
      flags.push({
        code: "factor_source_missing",
        severity: "warning",
        message: `User factor "${c.name}" has no source recorded.`,
        entryId,
      });
    }
  }
  return flags;
}

// ---------------------------------------------------------------------------
// Material entries
// ---------------------------------------------------------------------------

function baseDraft(partial: Partial<Draft> & Pick<Draft, "entryId" | "kind" | "emissionCategory" | "name">): Draft {
  return {
    stageId: null,
    stageName: "",
    materialCategory: "fuel",
    specification: "",
    inputQuantity: null,
    inputUnit: "",
    totalMassKg: null,
    wastePercent: null,
    wastedMassKg: null,
    brickCount: null,
    wastedBricks: null,
    distanceKm: null,
    tonneKm: null,
    dieselLitres: null,
    factorComponents: [],
    wasteSplit: null,
    effectiveFactor: null,
    effectiveFactorUnit: "kgCO2e/kg",
    emissionsPerBuildingKg: 0,
    valid: true,
    dataStatus: "user_provided",
    wasteSource: null,
    steps: [],
    flags: [],
    scopeExclusion: null,
    ...partial,
  };
}

/** Converts an entry's quantity to kilograms, recording each step. */
export function computeMaterialMass(entry: MaterialEntry): {
  massKg: number | null;
  brickCount: number | null;
  steps: CalcStep[];
  errors: string[];
} {
  const steps: CalcStep[] = [];
  const errors: string[] = [];
  const q = entry.quantity;

  if (q === null || q === undefined || Number.isNaN(q)) {
    return { massKg: null, brickCount: null, steps, errors: ["Quantity is missing."] };
  }
  if (!Number.isFinite(q) || q < 0) {
    return { massKg: null, brickCount: null, steps, errors: ["Quantity cannot be negative."] };
  }

  switch (entry.unit) {
    case "kg":
      steps.push({ label: "Total mass", formula: "Total mass = quantity (kg)", substitution: `${fmt(q)} kg`, value: q, unit: "kg" });
      return { massKg: q, brickCount: null, steps, errors };
    case "t": {
      const m = q * 1000;
      steps.push({ label: "Total mass", formula: "Total mass = quantity (t) × 1,000", substitution: `${fmt(q)} × 1,000`, value: m, unit: "kg" });
      return { massKg: m, brickCount: null, steps, errors };
    }
    case "m3": {
      const d = entry.densityKgPerM3;
      if (!isPositiveFinite(d)) {
        errors.push("A density greater than zero is needed to convert a volume to mass.");
        return { massKg: null, brickCount: null, steps, errors };
      }
      const m = q * d;
      steps.push({ label: "Total mass", formula: "Total mass = volume × density", substitution: `${fmt(q)} m³ × ${fmt(d)} kg/m³`, value: m, unit: "kg" });
      return { massKg: m, brickCount: null, steps, errors };
    }
    case "bricks": {
      const bm = entry.brickMassKg;
      if (!isPositiveFinite(bm)) {
        errors.push("The mass of one brick (greater than zero) is needed.");
        return { massKg: null, brickCount: q, steps, errors };
      }
      const m = q * bm;
      steps.push({ label: "Total mass", formula: "Total mass = number of bricks × mass per brick", substitution: `${fmt(q)} × ${fmt(bm)} kg`, value: m, unit: "kg" });
      return { massKg: m, brickCount: q, steps, errors };
    }
    case "m3_brickwork": {
      const bpm = entry.bricksPerM3;
      const bm = entry.brickMassKg;
      if (!isPositiveFinite(bpm)) errors.push("Bricks per m³ (greater than zero) is needed.");
      if (!isPositiveFinite(bm)) errors.push("The mass of one brick (greater than zero) is needed.");
      if (errors.length) return { massKg: null, brickCount: null, steps, errors };
      const bricks = q * bpm!;
      const m = bricks * bm!;
      steps.push({ label: "Number of bricks", formula: "Bricks = brickwork volume × bricks per m³", substitution: `${fmt(q)} m³ × ${fmt(bpm!)}`, value: bricks, unit: "bricks" });
      steps.push({ label: "Total mass", formula: "Total mass = bricks × mass per brick", substitution: `${fmt(bricks)} × ${fmt(bm!)} kg`, value: m, unit: "kg" });
      return { massKg: m, brickCount: bricks, steps, errors };
    }
    default:
      return { massKg: null, brickCount: null, steps, errors: [`Unsupported unit "${String(entry.unit)}".`] };
  }
}

function calculateMaterial(entry: MaterialEntry, ctx: Context): Draft[] {
  const stageName = ctx.stageNames.get(entry.stageId) ?? entry.stageId;
  const draft = baseDraft({
    entryId: entry.id,
    kind: "material",
    emissionCategory: "material_waste",
    name: entry.name,
    specification: entry.specification,
    stageId: entry.stageId,
    stageName,
    materialCategory: entry.category,
    inputQuantity: entry.quantity,
    inputUnit: QUANTITY_UNIT_LABELS[entry.unit] ?? entry.unit,
    wastePercent: entry.wastePercent,
    dataStatus: entry.dataStatus,
    wasteSource: entry.wasteSource,
  });
  const errors: string[] = [];

  const mass = computeMaterialMass(entry);
  draft.steps.push(...mass.steps);
  errors.push(...mass.errors);
  draft.totalMassKg = mass.massKg;
  draft.brickCount = mass.brickCount;

  const w = entry.wastePercent;
  let wasted: number | null = null;
  if (w === null || w === undefined || Number.isNaN(w)) {
    errors.push("Waste percentage is missing.");
  } else if (!Number.isFinite(w) || w < 0 || w > 100) {
    errors.push("Waste percentage must be between 0 and 100.");
  } else if (mass.massKg !== null) {
    wasted = (mass.massKg * w) / 100;
    draft.wastedMassKg = wasted;
    draft.steps.push({
      label: "Wasted mass",
      formula: "Wasted mass = total mass × waste % ÷ 100",
      substitution: `${fmt(mass.massKg)} kg × ${fmt(w)} ÷ 100`,
      value: wasted,
      unit: "kg",
    });
    if (mass.brickCount !== null) {
      draft.wastedBricks = (mass.brickCount * w) / 100;
    }
  }

  // Factors applied to the wasted mass.
  const components: ResolvedFactor[] = [];
  if (!entry.factors || entry.factors.length === 0) {
    errors.push("No emission factor selected.");
  } else {
    for (const ref of entry.factors) {
      const r = resolveFactor(ref, ctx.factors, ctx.defaultLevel, "mass");
      if (r.error) errors.push(r.error);
      if (r.factor) components.push(r.factor);
    }
    const overlap = checkComponentBoundaries(components);
    if (overlap) errors.push(overlap);
  }
  draft.factorComponents = components;
  draft.flags.push(...factorFlags(components, entry.id));

  if (errors.length === 0 && wasted !== null) {
    const effective = components.reduce((s, c) => s + c.value, 0);
    draft.effectiveFactor = effective;
    if (components.length > 1) {
      for (const c of components) {
        draft.steps.push({
          label: `Emissions, ${c.name}`,
          formula: "Component emissions = wasted mass × factor",
          substitution: `${fmt(wasted)} kg × ${factorLabel(c)}`,
          value: wasted * c.value,
          unit: "kg CO₂e",
        });
      }
      const total = components.reduce((s, c) => s + wasted! * c.value, 0);
      draft.steps.push({
        label: "Waste emissions",
        formula: "Waste emissions = sum of components",
        substitution: components.map((c) => fmt(wasted! * c.value)).join(" + "),
        value: total,
        unit: "kg CO₂e",
      });
      draft.emissionsPerBuildingKg = total;
    } else {
      const c = components[0];
      const total = wasted * c.value;
      draft.steps.push({
        label: "Waste emissions",
        formula: "Waste emissions = wasted mass × emission factor",
        substitution: `${fmt(wasted)} kg × ${factorLabel(c)}`,
        value: total,
        unit: "kg CO₂e",
      });
      draft.emissionsPerBuildingKg = total;
    }
  }

  if (errors.length === 0 && wasted !== null) {
    const split: WasteSplit = { production: 0, treatment: 0, combined: 0, unclassified: 0 };
    for (const c of components) split[classifyComponent(c)] += wasted * c.value;
    draft.wasteSplit = split;
  }

  if (entry.category === "cement" && entry.cementScope === "in_concrete") {
    draft.scopeExclusion =
      "Cement marked as contained in a concrete entry. The concrete factor already covers it, so it is shown for information only.";
  }

  for (const e of errors) draft.flags.push({ code: "invalid_input", severity: "error", message: e, entryId: entry.id });
  draft.valid = errors.length === 0;
  if (!draft.valid) {
    draft.emissionsPerBuildingKg = 0;
    draft.effectiveFactor = null;
    draft.wasteSplit = null;
  }

  const drafts: Draft[] = [draft];

  if (ctx.boundary === "expanded") {
    if (!entry.installedFactor) {
      draft.flags.push({
        code: "installed_factor_missing",
        severity: "warning",
        message: `Expanded boundary: no production (A1–A3) factor selected for the installed quantity of "${entry.name}", so its installed embodied carbon is not included.`,
        entryId: entry.id,
      });
    } else {
      drafts.push(calculateInstalled(entry, ctx, mass.massKg, mass.steps, stageName, draft.scopeExclusion));
    }
  }

  return drafts;
}

function calculateInstalled(
  entry: MaterialEntry,
  ctx: Context,
  massKg: number | null,
  massSteps: CalcStep[],
  stageName: string,
  scopeExclusion: string | null,
): Draft {
  const draft = baseDraft({
    entryId: entry.id,
    kind: "installed",
    emissionCategory: "installed_embodied",
    name: `${entry.name} (installed)`,
    specification: entry.specification,
    stageId: entry.stageId,
    stageName,
    materialCategory: entry.category,
    inputQuantity: entry.quantity,
    inputUnit: QUANTITY_UNIT_LABELS[entry.unit] ?? entry.unit,
    totalMassKg: massKg,
    dataStatus: entry.dataStatus,
    scopeExclusion,
  });
  draft.steps.push(...massSteps);
  const errors: string[] = [];
  if (massKg === null) errors.push("Installed mass could not be calculated.");
  const r = resolveFactor(entry.installedFactor, ctx.factors, ctx.defaultLevel, "mass");
  if (r.error) errors.push(r.error);
  if (r.factor) {
    draft.factorComponents = [r.factor];
    draft.flags.push(...factorFlags([r.factor], entry.id));
    const mods = r.factor.lifecycleModules;
    if (!(mods.length === 1 && mods[0] === "A1-A3")) {
      draft.flags.push({
        code: "installed_factor_boundary",
        severity: "warning",
        message: `"${r.factor.name}" is not a production-only (A1–A3) factor. Installed material should use an A1–A3 factor.`,
        entryId: entry.id,
      });
    }
  }
  if (errors.length === 0 && r.factor && massKg !== null) {
    draft.effectiveFactor = r.factor.value;
    draft.emissionsPerBuildingKg = massKg * r.factor.value;
    draft.steps.push({
      label: "Installed embodied carbon (A1–A3)",
      formula: "Emissions = installed mass × production factor",
      substitution: `${fmt(massKg)} kg × ${factorLabel(r.factor)}`,
      value: draft.emissionsPerBuildingKg,
      unit: "kg CO₂e",
    });
  }
  for (const e of errors) draft.flags.push({ code: "invalid_input", severity: "error", message: e, entryId: entry.id });
  draft.valid = errors.length === 0;
  if (!draft.valid) draft.emissionsPerBuildingKg = 0;
  return draft;
}

// ---------------------------------------------------------------------------
// Fuel activities
// ---------------------------------------------------------------------------

function applyDiesel(draft: Draft, litres: number | null, ref: FactorRef, ctx: Context, errors: string[]) {
  const r = resolveFactor(ref, ctx.factors, ctx.defaultLevel, "fuel");
  if (r.error) errors.push(r.error);
  if (r.factor) {
    draft.factorComponents = [r.factor];
    draft.flags.push(...factorFlags([r.factor], draft.entryId));
  }
  draft.dieselLitres = litres;
  if (errors.length === 0 && r.factor && litres !== null) {
    draft.effectiveFactor = r.factor.value;
    draft.emissionsPerBuildingKg = litres * r.factor.value;
    draft.steps.push({
      label: "Fuel emissions",
      formula: "Emissions = diesel litres × diesel factor",
      substitution: `${fmt(litres)} L × ${factorLabel(r.factor)}`,
      value: draft.emissionsPerBuildingKg,
      unit: "kg CO₂e",
    });
  }
  for (const e of errors) draft.flags.push({ code: "invalid_input", severity: "error", message: e, entryId: draft.entryId });
  draft.valid = errors.length === 0;
  if (!draft.valid) {
    draft.emissionsPerBuildingKg = 0;
    draft.effectiveFactor = null;
  }
}

export function transportLitres(t: TransportEntry): { litres: number | null; distanceKm: number | null; steps: CalcStep[]; errors: string[]; notes: string[] } {
  const steps: CalcStep[] = [];
  const errors: string[] = [];
  const notes: string[] = [];

  if (t.method === "measured_fuel") {
    if (!isNonNegativeFinite(t.measuredFuelL)) {
      errors.push(t.measuredFuelL === null ? "Measured fuel is missing." : "Measured fuel cannot be negative.");
      return { litres: null, distanceKm: null, steps, errors, notes };
    }
    steps.push({ label: "Diesel consumed (measured)", formula: "Diesel = measured fuel", substitution: `${fmt(t.measuredFuelL)} L`, value: t.measuredFuelL, unit: "L" });
    if (t.trips !== null || t.distanceKm !== null) {
      notes.push("Measured fuel is used; the distance-based estimate is not calculated, so the trip is not counted twice.");
    }
    return { litres: t.measuredFuelL, distanceKm: null, steps, errors, notes };
  }

  if (t.trips === null) errors.push("Number of trips is missing.");
  else if (!isNonNegativeFinite(t.trips)) errors.push("Number of trips cannot be negative.");
  if (t.distanceKm === null) errors.push("Distance per trip is missing.");
  else if (!isNonNegativeFinite(t.distanceKm)) errors.push("Distance cannot be negative.");
  if (t.distanceConvention === null) errors.push("State whether the distance is one-way or round-trip.");
  if (t.fuelEconomyKmPerL === null) errors.push("Fuel economy (km per litre) is missing.");
  else if (!isPositiveFinite(t.fuelEconomyKmPerL)) errors.push("Fuel economy must be greater than zero.");
  if (errors.length) return { litres: null, distanceKm: null, steps, errors, notes };

  const trips = t.trips!;
  const d = t.distanceKm!;
  const perTrip = t.distanceConvention === "one_way" ? d * 2 : d;
  const total = trips * perTrip;
  const litres = total / t.fuelEconomyKmPerL!;
  steps.push(
    t.distanceConvention === "one_way"
      ? { label: "Total distance", formula: "Total distance = trips × one-way distance × 2", substitution: `${fmt(trips)} × ${fmt(d)} km × 2`, value: total, unit: "km" }
      : { label: "Total distance", formula: "Total distance = trips × round-trip distance", substitution: `${fmt(trips)} × ${fmt(d)} km`, value: total, unit: "km" },
  );
  steps.push({ label: "Diesel consumed (estimated)", formula: "Diesel = total distance ÷ fuel economy", substitution: `${fmt(total)} km ÷ ${fmt(t.fuelEconomyKmPerL!)} km/L`, value: litres, unit: "L" });
  return { litres, distanceKm: total, steps, errors, notes };
}

export function transportTonneKm(t: TransportEntry): { tonneKm: number | null; steps: CalcStep[]; errors: string[] } {
  const steps: CalcStep[] = [];
  const errors: string[] = [];
  const m = t.massTonnes ?? null;
  if (m === null) errors.push("Transported mass (tonnes) is missing.");
  else if (!isNonNegativeFinite(m)) errors.push("Transported mass cannot be negative.");
  if (t.distanceKm === null) errors.push("Transport distance is missing.");
  else if (!isNonNegativeFinite(t.distanceKm)) errors.push("Distance cannot be negative.");
  if (errors.length) return { tonneKm: null, steps, errors };
  const tkm = m! * t.distanceKm!;
  steps.push({
    label: "Transport activity",
    formula: "Tonne-km = transported mass (t) × distance (km)",
    substitution: `${fmt(m!)} t × ${fmt(t.distanceKm!)} km`,
    value: tkm,
    unit: "t·km",
  });
  return { tonneKm: tkm, steps, errors };
}

function calculateTonneKm(t: TransportEntry, ctx: Context): Draft {
  const draft = baseDraft({
    entryId: t.id,
    kind: "transport",
    emissionCategory: "transport",
    name: t.name,
    specification: [t.cargo, t.supplier].filter(Boolean).join(" · "),
    stageName: "Transport to site (A4)",
    effectiveFactorUnit: "kgCO2e/tkm",
    dataStatus: t.dataStatus,
    inputQuantity: t.massTonnes ?? null,
    inputUnit: "t transported",
  });
  const r = transportTonneKm(t);
  draft.steps.push(...r.steps);
  draft.tonneKm = r.tonneKm;
  draft.distanceKm = t.distanceKm;
  const errors = [...r.errors];
  const f = resolveFactor(t.factor, ctx.factors, ctx.defaultLevel, "tkm");
  if (f.error) {
    errors.push(f.error === "No emission factor selected." ? "Select an emission factor in kg CO₂e per tonne-km (add one under Emission Factors if none exists)." : f.error);
  }
  if (f.factor) {
    draft.factorComponents = [f.factor];
    draft.flags.push(...factorFlags([f.factor], t.id));
  }
  if (errors.length === 0 && f.factor && r.tonneKm !== null) {
    draft.effectiveFactor = f.factor.value;
    draft.emissionsPerBuildingKg = r.tonneKm * f.factor.value;
    draft.steps.push({
      label: "Transport emissions",
      formula: "Emissions = tonne-km × factor per tonne-km",
      substitution: `${fmt(r.tonneKm)} t·km × ${factorLabel(f.factor)}`,
      value: draft.emissionsPerBuildingKg,
      unit: "kg CO₂e",
    });
  }
  for (const e of errors) draft.flags.push({ code: "invalid_input", severity: "error", message: e, entryId: t.id });
  draft.valid = errors.length === 0;
  if (!draft.valid) {
    draft.emissionsPerBuildingKg = 0;
    draft.effectiveFactor = null;
  }
  return draft;
}

function calculateTransport(t: TransportEntry, ctx: Context): Draft {
  if (t.method === "tonne_km") return calculateTonneKm(t, ctx);
  const draft = baseDraft({
    entryId: t.id,
    kind: "transport",
    emissionCategory: "transport",
    name: t.name,
    specification: t.supplier,
    stageName: "Transport to site (A4)",
    effectiveFactorUnit: "kgCO2e/L",
    dataStatus: t.dataStatus,
  });
  const r = transportLitres(t);
  draft.steps.push(...r.steps);
  draft.distanceKm = r.distanceKm;
  if (t.method === "measured_fuel") {
    draft.inputQuantity = t.measuredFuelL;
    draft.inputUnit = "L (measured)";
  } else {
    draft.inputQuantity = t.trips;
    draft.inputUnit = "trips";
  }
  for (const n of r.notes) draft.flags.push({ code: "measured_fuel_used", severity: "info", message: n, entryId: t.id });
  applyDiesel(draft, r.litres, t.factor, ctx, r.errors);
  return draft;
}

export function machineryLitres(m: MachineryEntry): { litres: number | null; steps: CalcStep[]; errors: string[]; notes: string[] } {
  const steps: CalcStep[] = [];
  const errors: string[] = [];
  const notes: string[] = [];
  if (m.method === "measured_fuel") {
    if (!isNonNegativeFinite(m.measuredFuelL)) {
      errors.push(m.measuredFuelL === null ? "Measured fuel is missing." : "Measured fuel cannot be negative.");
      return { litres: null, steps, errors, notes };
    }
    steps.push({ label: "Diesel consumed (measured)", formula: "Diesel = measured fuel", substitution: `${fmt(m.measuredFuelL)} L`, value: m.measuredFuelL, unit: "L" });
    if (m.hours !== null || m.litresPerHour !== null) {
      notes.push("Measured fuel is used; the hours-based estimate is not calculated.");
    }
    return { litres: m.measuredFuelL, steps, errors, notes };
  }
  if (m.hours === null) errors.push("Operating hours are missing.");
  else if (!isNonNegativeFinite(m.hours)) errors.push("Operating hours cannot be negative.");
  if (m.litresPerHour === null) errors.push("Fuel consumption per hour is missing.");
  else if (!isNonNegativeFinite(m.litresPerHour)) errors.push("Fuel consumption per hour cannot be negative.");
  if (errors.length) return { litres: null, steps, errors, notes };
  const litres = m.hours! * m.litresPerHour!;
  steps.push({ label: "Diesel consumed (estimated)", formula: "Diesel = operating hours × litres per hour", substitution: `${fmt(m.hours!)} h × ${fmt(m.litresPerHour!)} L/h`, value: litres, unit: "L" });
  return { litres, steps, errors, notes };
}

function calculateMachinery(m: MachineryEntry, ctx: Context): Draft {
  const draft = baseDraft({
    entryId: m.id,
    kind: "machinery",
    emissionCategory: "machinery",
    name: m.name,
    specification: m.machineryType,
    stageName: "Construction process (A5)",
    effectiveFactorUnit: "kgCO2e/L",
    dataStatus: m.dataStatus,
  });
  const r = machineryLitres(m);
  draft.steps.push(...r.steps);
  if (m.method === "measured_fuel") {
    draft.inputQuantity = m.measuredFuelL;
    draft.inputUnit = "L (measured)";
  } else {
    draft.inputQuantity = m.hours;
    draft.inputUnit = "hours";
  }
  for (const n of r.notes) draft.flags.push({ code: "measured_fuel_used", severity: "info", message: n, entryId: m.id });
  applyDiesel(draft, r.litres, m.factor, ctx, r.errors);
  return draft;
}

// ---------------------------------------------------------------------------
// Overlap checks within a building
// ---------------------------------------------------------------------------

function duplicateFlags(materials: MaterialEntry[], buildingId: string): Flag[] {
  const flags: Flag[] = [];
  const seen = new Map<string, MaterialEntry>();
  for (const m of materials) {
    const key = JSON.stringify([
      m.stageId,
      m.category,
      m.name.trim().toLowerCase(),
      m.quantity,
      m.unit,
      m.wastePercent,
      m.factors.map((f) => f.factorId).sort(),
    ]);
    const first = seen.get(key);
    if (first) {
      flags.push({
        code: "possible_duplicate",
        severity: "warning",
        message: `"${m.name}" has the same stage, quantity, waste and factor as another entry. Check that it is not entered twice.`,
        entryId: m.id,
        buildingId,
      });
    } else {
      seen.set(key, m);
    }
  }
  return flags;
}

function cementOverlapFlags(materials: MaterialEntry[], buildingId: string, stageNames: Map<string, string>): Flag[] {
  const flags: Flag[] = [];
  for (const c of materials) {
    if (c.category !== "cement" || c.cementScope === "in_concrete") continue;
    const concreteInStage = materials.some((m) => m.category === "concrete" && m.stageId === c.stageId);
    if (concreteInStage) {
      flags.push({
        code: "cement_concrete_overlap",
        severity: "warning",
        message: `Stage "${stageNames.get(c.stageId) ?? c.stageId}" has both a concrete mix and standalone cement "${c.name}". Concrete factors already include their cement. If this cement went into that concrete, mark it as contained in concrete.`,
        entryId: c.id,
        buildingId,
      });
    }
  }
  return flags;
}

// ---------------------------------------------------------------------------
// Project
// ---------------------------------------------------------------------------

export function profileExclusion(line: Pick<LineResult, "stageId" | "kind">, profile: CalculationProfile): string | null {
  if (profile === "report_master" && line.stageId === "foundation" && (line.kind === "material" || line.kind === "installed")) {
    return "Left out by the report master-schedule profile. The reference report's consolidated total does not include the foundation stage. Switch to the foundation-inclusive profile to include it.";
  }
  return null;
}

export function buildingMultiplier(b: BuildingGroup): { multiplier: number; flag: Flag | null } {
  if (!Number.isInteger(b.count) || b.count < 1) {
    return {
      multiplier: 1,
      flag: { code: "invalid_building_count", severity: "error", message: `"${b.name}": the number of buildings must be a whole number of at least 1. Calculated for one building.`, buildingId: b.id },
    };
  }
  if (b.count > 1 && !b.identicalConfirmed) {
    return {
      multiplier: 1,
      flag: {
        code: "buildings_not_confirmed_identical",
        severity: "error",
        message: `"${b.name}" has ${b.count} buildings, but they are not confirmed as identical. The total covers ONE building only. Confirm that they are identical, or enter each different building as its own group.`,
        buildingId: b.id,
      },
    };
  }
  return { multiplier: b.count, flag: null };
}

export function buildingArea(b: BuildingGroup): number | null {
  if (isPositiveFinite(b.floors) && isPositiveFinite(b.areaPerFloorM2)) return b.floors * b.areaPerFloorM2;
  return null;
}

const emptyByMaterial = (): Record<MaterialCategory, number> => ({ concrete: 0, cement: 0, steel: 0, masonry: 0, other: 0 });
const emptyByCategory = (): Record<EmissionCategory, number> => ({ material_waste: 0, transport: 0, machinery: 0, installed_embodied: 0 });
const emptyByStatus = (): Record<DataStatus, number> => ({ measured: 0, user_provided: 0, estimated: 0, assumed: 0 });

export function calculateProject(project: Project): ProjectResult {
  const ctx: Context = {
    factors: new Map(project.factors.map((f) => [f.id, f])),
    defaultLevel: project.defaultFactorLevel,
    stageNames: new Map(project.stages.map((s) => [s.id, s.name])),
    boundary: project.boundary,
  };
  const flags: Flag[] = [];
  const lines: LineResult[] = [];
  const byBuilding: BuildingBreakdown[] = [];
  const scopeExcluded = new Set<string>();
  const sections = { transport: project.sections?.transport ?? true, machinery: project.sections?.machinery ?? true };
  const excludedSections = (["transport", "machinery"] as const).filter((k) => !sections[k]);
  const sectionExcludedLines = new Set<string>();
  let builtUpArea = 0;
  let areaKnown = project.buildings.length > 0;

  for (const b of project.buildings) {
    const { multiplier, flag } = buildingMultiplier(b);
    if (flag) flags.push(flag);
    const area = buildingArea(b);
    if (area === null) areaKnown = false;
    else builtUpArea += area * multiplier;

    flags.push(...duplicateFlags(b.materials, b.id), ...cementOverlapFlags(b.materials, b.id, ctx.stageNames));

    const drafts: Draft[] = [
      ...b.materials.flatMap((m) => calculateMaterial(m, ctx)),
      ...b.transport.map((t) => calculateTransport(t, ctx)),
      ...b.machinery.map((m) => calculateMachinery(m, ctx)),
    ];

    for (const d of drafts) {
      const { scopeExclusion, ...rest } = d;
      const id = `${b.id}:${d.entryId}:${d.kind}`;
      let exclusionReason: string | null = null;
      const sectionOff = (d.kind === "transport" && !sections.transport) || (d.kind === "machinery" && !sections.machinery);
      if (sectionOff) {
        exclusionReason = `Not included: the ${d.kind === "transport" ? "transportation" : "site machinery"} section is switched off for this assessment.`;
        scopeExcluded.add(id);
        sectionExcludedLines.add(id);
      } else if (!d.valid) exclusionReason = "Not included: the entry has invalid or missing inputs.";
      else if (scopeExclusion) {
        exclusionReason = scopeExclusion;
        scopeExcluded.add(id);
      }
      else exclusionReason = profileExclusion(d, project.profile);
      lines.push({
        ...rest,
        id,
        buildingId: b.id,
        buildingName: b.name,
        multiplier,
        emissionsKg: d.emissionsPerBuildingKg * multiplier,
        included: exclusionReason === null,
        exclusionReason,
        share: 0,
        flags: d.flags.map((f) => ({ ...f, buildingId: b.id })),
      });
    }

    const own = lines.filter((l) => l.buildingId === b.id && l.included);
    const byCat = emptyByCategory();
    for (const l of own) byCat[l.emissionCategory] += l.emissionsKg;
    const total = own.reduce((s, l) => s + l.emissionsKg, 0);
    byBuilding.push({
      buildingId: b.id,
      name: b.name,
      count: b.count,
      multiplier,
      perBuildingKg: multiplier > 0 ? total / multiplier : 0,
      totalKg: total,
      areaM2: area === null ? null : area * multiplier,
      byCategory: byCat,
    });
  }

  const included = lines.filter((l) => l.included);
  const sum = (ls: LineResult[]) => ls.reduce((s, l) => s + l.emissionsKg, 0);
  const totalKg = sum(included);
  for (const l of included) l.share = totalKg > 0 ? l.emissionsKg / totalKg : 0;

  const byCategory = emptyByCategory();
  for (const l of included) byCategory[l.emissionCategory] += l.emissionsKg;
  const constructionStageKg = byCategory.material_waste + byCategory.transport + byCategory.machinery;

  // Totals under each profile, from the same valid lines.
  const eligible = lines.filter((l) => l.valid && !scopeExcluded.has(l.id));
  const profileTotals: Record<CalculationProfile, number> = {
    report_master: sum(eligible.filter((l) => profileExclusion(l, "report_master") === null)),
    foundation_inclusive: sum(eligible.filter((l) => profileExclusion(l, "foundation_inclusive") === null)),
  };
  const excludedByProfileKg = sum(eligible.filter((l) => profileExclusion(l, project.profile) !== null));

  // Stage breakdown (material wastage only).
  const stageMap = new Map<string, StageBreakdown>();
  for (const s of project.stages) stageMap.set(s.id, { stageId: s.id, stageName: s.name, kg: 0, byMaterial: emptyByMaterial() });
  for (const l of included) {
    if (l.kind !== "material" || !l.stageId) continue;
    let s = stageMap.get(l.stageId);
    if (!s) {
      s = { stageId: l.stageId, stageName: l.stageName, kg: 0, byMaterial: emptyByMaterial() };
      stageMap.set(l.stageId, s);
    }
    s.kg += l.emissionsKg;
    if (l.materialCategory !== "fuel") s.byMaterial[l.materialCategory] += l.emissionsKg;
  }

  // Material breakdown, with diesel shown as its own material (as in BIM report Fig. 9.4).
  const matTotals = new Map<string, { label: string; kg: number }>();
  for (const l of included) {
    const key = l.materialCategory === "fuel" ? "fuel" : l.kind === "installed" ? `installed_${l.materialCategory}` : l.materialCategory;
    const label =
      l.materialCategory === "fuel"
        ? FUEL_CATEGORY_LABEL
        : l.kind === "installed"
          ? `${MATERIAL_CATEGORY_LABELS[l.materialCategory]} (installed)`
          : MATERIAL_CATEGORY_LABELS[l.materialCategory];
    const cur = matTotals.get(key) ?? { label, kg: 0 };
    cur.kg += l.emissionsKg;
    matTotals.set(key, cur);
  }

  // Report-style sources: material wastage per stage, each fuel activity on its own.
  const multiGroup = project.buildings.length > 1;
  const sources = new Map<string, { key: string; label: string; kg: number; emissionCategory: EmissionCategory }>();
  for (const l of included) {
    let key: string;
    let label: string;
    if (l.kind === "material") {
      key = `stage:${l.stageId}`;
      label = l.stageName;
    } else if (l.kind === "installed") {
      key = `installed:${l.stageId}`;
      label = `${l.stageName} (installed)`;
    } else {
      key = multiGroup ? `entry:${l.buildingId}:${l.entryId}` : `entry:${l.entryId}`;
      label = multiGroup ? `${l.name} (${l.buildingName})` : l.name;
    }
    const cur = sources.get(key) ?? { key, label, kg: 0, emissionCategory: l.emissionCategory };
    cur.kg += l.emissionsKg;
    sources.set(key, cur);
  }

  // Data quality.
  const inputCounts = emptyByStatus();
  const emissionsByStatus = emptyByStatus();
  const factorStatusCounts: Record<FactorStatus, number> = { reference: 0, user: 0, verified_external: 0, illustrative: 0 };
  const wasteSourceCounts = { reference: 0, user: 0, measured: 0 };
  for (const b of project.buildings) {
    for (const m of b.materials) {
      inputCounts[m.dataStatus] += 1;
      wasteSourceCounts[m.wasteSource] += 1;
    }
    for (const t of b.transport) inputCounts[t.dataStatus] += 1;
    for (const m of b.machinery) inputCounts[m.dataStatus] += 1;
  }
  const usedFactors = new Map<string, FactorStatus>();
  let genericFactorKg = 0;
  let boundaryUncertainKg = 0;
  for (const l of included) {
    emissionsByStatus[l.dataStatus] += l.emissionsKg;
    for (const c of l.factorComponents) usedFactors.set(c.factorId, c.status);
    if (l.factorComponents.some((c) => c.generic)) genericFactorKg += l.emissionsKg;
    if (l.factorComponents.some((c) => !c.boundaryStated)) boundaryUncertainKg += l.emissionsKg;
  }
  for (const s of usedFactors.values()) factorStatusCounts[s] += 1;

  // Project-level flags.
  const entryCount = project.buildings.reduce((s, b) => s + b.materials.length + b.transport.length + b.machinery.length, 0);
  if (entryCount === 0) {
    flags.push({ code: "no_inputs", severity: "warning", message: "No materials or activities have been entered yet." });
  }
  if (!areaKnown || builtUpArea <= 0) {
    flags.push({ code: "area_missing", severity: "warning", message: "Built-up area is missing for at least one building group, so emissions intensity (kg CO₂e/m²) cannot be calculated." });
  }
  if (project.boundary === "construction_stage") {
    flags.push({
      code: "boundary_construction_stage",
      severity: "info",
      message:
        "Construction-stage boundary: covers the embodied carbon of wasted material (A1–A3 plus disposal where the factor includes it) and diesel for transport (A4) and site machinery (A5). Not included: embodied carbon of installed material, operational energy (B), end of life (C) and module D.",
    });
  } else {
    flags.push({
      code: "boundary_expanded",
      severity: "info",
      message:
        "Expanded boundary: adds the production (A1–A3) emissions of installed material where a production-only factor is selected. Use stage (B), end of life (C) and module D are still not included, so this is not a whole-life assessment.",
    });
  }
  if (excludedByProfileKg > 0) {
    flags.push({
      code: "foundation_excluded",
      severity: "info",
      message: `The report master-schedule profile leaves out the foundation stage. The foundation-inclusive total would be ${fmt(profileTotals.foundation_inclusive)} kg CO₂e.`,
    });
  }
  if (totalKg > 0 && emissionsByStatus.assumed / totalKg > 0.5) {
    flags.push({ code: "mostly_assumed", severity: "warning", message: "More than half of the result comes from assumed quantities. Replace them with measured or project-specific values where possible." });
  }
  if (usedFactors.size > 0 && factorStatusCounts.verified_external === 0) {
    flags.push({
      code: "secondary_factors",
      severity: "info",
      message: "Every factor used is a secondary reference or user value. None is a verified supplier-specific declaration (EPD).",
    });
  }
  for (const k of excludedSections) {
    flags.push({
      code: `section_excluded_${k}`,
      severity: "warning",
      message: `${k === "transport" ? "Transportation (A4)" : "Site machinery fuel (A5)"} is EXCLUDED from this assessment. Its emissions are not in the total.`,
    });
  }
  for (const k of ["transport", "machinery"] as const) {
    if (sections[k] && project.buildings.every((b) => (k === "transport" ? b.transport : b.machinery).length === 0)) {
      flags.push({
        code: `section_empty_${k}`,
        severity: "warning",
        message: `No ${k === "transport" ? "transportation" : "site machinery"} entries. These emissions are not assessed, so the total is incomplete. Add entries, or switch the section off to record that it is excluded.`,
      });
    }
  }
  for (const l of lines) if (!sectionExcludedLines.has(l.id)) flags.push(...l.flags);

  const dieselLitres = included.reduce((s, l) => s + (l.dieselLitres ?? 0) * l.multiplier, 0);
  const tonneKm = included.reduce((s, l) => s + (l.tonneKm ?? 0) * l.multiplier, 0);
  const waste: WasteSplit = { production: 0, treatment: 0, combined: 0, unclassified: 0 };
  for (const l of included) {
    if (!l.wasteSplit) continue;
    for (const k of Object.keys(waste) as (keyof WasteSplit)[]) waste[k] += l.wasteSplit[k] * l.multiplier;
  }
  const buildingsCounted = byBuilding.reduce((s, b) => s + b.multiplier, 0);
  const area = areaKnown && builtUpArea > 0 ? builtUpArea : null;

  return {
    engineVersion: ENGINE_VERSION,
    factorDatasetVersion: project.factorDatasetVersion,
    profile: project.profile,
    boundary: project.boundary,
    defaultFactorLevel: project.defaultFactorLevel,
    lines,
    totals: {
      totalKg,
      totalTonnes: totalKg / 1000,
      constructionStageKg,
      installedEmbodiedKg: byCategory.installed_embodied,
      materialWasteKg: byCategory.material_waste,
      transportKg: byCategory.transport,
      machineryKg: byCategory.machinery,
      excludedByProfileKg,
      dieselLitres,
      tonneKm,
      waste,
      buildingsCounted,
      perBuildingKg: buildingsCounted > 0 ? totalKg / buildingsCounted : null,
      builtUpAreaM2: area,
      intensityKgPerM2: area ? totalKg / area : null,
      constructionIntensityKgPerM2: area ? constructionStageKg / area : null,
    },
    profileTotals,
    byStage: [...stageMap.values()],
    byMaterialCategory: [...matTotals.entries()].map(([key, v]) => ({ key, label: v.label, kg: v.kg })).sort((a, b) => b.kg - a.kg),
    byEmissionCategory: (Object.keys(byCategory) as EmissionCategory[])
      .filter((k) => k !== "installed_embodied" || project.boundary === "expanded")
      .map((k) => ({ key: k, label: EMISSION_CATEGORY_LABELS[k], kg: byCategory[k] })),
    bySource: [...sources.values()].sort((a, b) => b.kg - a.kg),
    byBuilding,
    dataQuality: { inputCounts, emissionsByStatus, factorStatusCounts, wasteSourceCounts, genericFactorKg, boundaryUncertainKg },
    coverage: lifecycleCoverage(included, sections, waste),
    excludedSections: [...excludedSections],
    flags,
    hasErrors: flags.some((f) => f.severity === "error"),
  };
}

/** Which EN 15978 modules the included lines actually cover. */
export function lifecycleCoverage(included: LineResult[], sections: { transport: boolean; machinery: boolean }, waste: WasteSplit): CoverageRow[] {
  const has = (k: LineResult["kind"]) => included.some((l) => l.kind === k);
  const installed = has("installed");
  const wasteLines = has("material");
  const machinery = sections.machinery && has("machinery");
  const transport = sections.transport && has("transport");
  const disposal = waste.treatment + waste.combined > 0;
  return [
    {
      module: "A1–A3",
      label: "Product stage (material production)",
      status: installed ? "included" : wasteLines ? "partial" : "excluded",
      note: installed
        ? "Installed material where a production factor is selected, plus the production of wasted material."
        : wasteLines
          ? "Only the production of material wasted on site. Installed material is outside this boundary (choose the expanded boundary to include it)."
          : "No material entries.",
    },
    {
      module: "A4",
      label: "Transport to site",
      status: transport ? "included" : "excluded",
      note: !sections.transport ? "Section switched off for this assessment." : transport ? "Transport entries (fuel-based or tonne-km)." : "No valid transport entries.",
    },
    {
      module: "A5",
      label: "Construction process",
      status: machinery && wasteLines ? "included" : machinery || wasteLines ? "partial" : "excluded",
      note: [machinery ? "Site machinery fuel" : !sections.machinery ? "Machinery switched off" : "No machinery entries", wasteLines ? "construction waste" : "no waste entries"].join("; ") + ".",
    },
    { module: "B1–B7", label: "Use stage (operation, maintenance, energy)", status: "excluded", note: "Not assessed by CarbonBuild." },
    {
      module: "C1–C4",
      label: "End of life",
      status: disposal ? "partial" : "excluded",
      note: disposal ? "Only the processing and disposal of construction waste, where a factor covers it. Demolition of the building is not assessed." : "Not assessed.",
    },
    { module: "D", label: "Beyond the system boundary (reuse, recycling)", status: "excluded", note: "Not assessed." },
  ];
}
