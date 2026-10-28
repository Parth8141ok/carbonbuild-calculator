import { calculateProject } from "./calculate";
import type { FactorRef, MaterialCategory, Project, ProjectResult } from "./types";

export type WasteAdjustment = { mode: "relative"; changePercent: number } | { mode: "absolute"; valuePercent: number };

export interface ScenarioSettings {
  masonryWaste: WasteAdjustment | null;
  concreteWaste: WasteAdjustment | null;
  steelWaste: WasteAdjustment | null;
  /** Change in material quantity by category, in percent (e.g. -10). */
  quantityChangePercent: Partial<Record<MaterialCategory, number>>;
  /** Change in transport fuel use (fuel-based entries), e.g. -20 for a 20% reduction. */
  transportFuelChangePercent: number;
  /** Change in site machinery fuel use. */
  machineryFuelChangePercent: number;
  /** Change in distance per trip (fuel-distance and tonne-km entries). */
  transportDistanceChangePercent: number;
  /** Replaces the waste-emission factors of every entry in a category. */
  factorSwaps: Partial<Record<MaterialCategory, FactorRef>>;
}

export const EMPTY_SCENARIO: ScenarioSettings = {
  masonryWaste: null,
  concreteWaste: null,
  steelWaste: null,
  quantityChangePercent: {},
  transportFuelChangePercent: 0,
  machineryFuelChangePercent: 0,
  transportDistanceChangePercent: 0,
  factorSwaps: {},
};

/** The three illustrative measures of BIM report §11.3 (diesel −20% applies to trucks and machinery). */
export const REPORT_SCENARIO: ScenarioSettings = {
  masonryWaste: { mode: "absolute", valuePercent: 4 },
  concreteWaste: { mode: "relative", changePercent: -25 },
  steelWaste: { mode: "relative", changePercent: -25 },
  quantityChangePercent: {},
  transportFuelChangePercent: -20,
  machineryFuelChangePercent: -20,
  transportDistanceChangePercent: 0,
  factorSwaps: {},
};

/** Fills defaults, and migrates settings saved before fuel changes were split (dieselChangePercent). */
export function normaliseScenario(s: Partial<ScenarioSettings> & { dieselChangePercent?: number } | null | undefined): ScenarioSettings {
  const legacy = s?.dieselChangePercent ?? 0;
  return {
    masonryWaste: s?.masonryWaste ?? null,
    concreteWaste: s?.concreteWaste ?? null,
    steelWaste: s?.steelWaste ?? null,
    quantityChangePercent: { ...(s?.quantityChangePercent ?? {}) },
    transportFuelChangePercent: s?.transportFuelChangePercent ?? legacy,
    machineryFuelChangePercent: s?.machineryFuelChangePercent ?? legacy,
    transportDistanceChangePercent: s?.transportDistanceChangePercent ?? 0,
    factorSwaps: { ...(s?.factorSwaps ?? {}) },
  };
}

const clampPercent = (v: number) => Math.min(100, Math.max(0, v));
const mul = (pct: number) => Math.max(0, 1 + pct / 100);

function adjustWaste(current: number | null, adj: WasteAdjustment): number | null {
  if (current === null) return null;
  return adj.mode === "absolute" ? clampPercent(adj.valuePercent) : clampPercent(current * (1 + adj.changePercent / 100));
}

/** Returns a modified copy of the project. The input is never mutated. */
export function applyScenario(project: Project, input: ScenarioSettings): Project {
  const s = normaliseScenario(input);
  const p: Project = structuredClone(project);
  const tFuel = mul(s.transportFuelChangePercent);
  const mFuel = mul(s.machineryFuelChangePercent);
  const dist = mul(s.transportDistanceChangePercent);
  for (const b of p.buildings) {
    for (const m of b.materials) {
      const q = s.quantityChangePercent[m.category];
      if (q && m.quantity !== null) m.quantity *= mul(q);
      const adj = m.category === "masonry" ? s.masonryWaste : m.category === "concrete" ? s.concreteWaste : m.category === "steel" ? s.steelWaste : null;
      if (adj) m.wastePercent = adjustWaste(m.wastePercent, adj);
      const swap = s.factorSwaps[m.category];
      if (swap) m.factors = [{ ...swap }];
    }
    for (const t of b.transport) {
      if (t.method === "distance") {
        if (t.distanceKm !== null) t.distanceKm *= dist;
        // Lower consumption means more km per litre, so litres scale by tFuel.
        if (t.fuelEconomyKmPerL !== null) t.fuelEconomyKmPerL = tFuel > 0 ? t.fuelEconomyKmPerL / tFuel : null;
      } else if (t.method === "tonne_km") {
        if (t.distanceKm !== null) t.distanceKm *= dist;
      } else if (t.measuredFuelL !== null) {
        t.measuredFuelL *= tFuel;
      }
    }
    for (const m of b.machinery) {
      if (m.method === "hours") {
        if (m.litresPerHour !== null) m.litresPerHour *= mFuel;
      } else if (m.measuredFuelL !== null) {
        m.measuredFuelL *= mFuel;
      }
    }
  }
  return p;
}

export interface ScenarioMeasure {
  key: string;
  label: string;
  /** Saving when this measure is applied on its own. */
  savingsKg: number;
}

export interface ComponentChange {
  key: string;
  label: string;
  baselineKg: number;
  scenarioKg: number;
  deltaKg: number;
}

export interface ScenarioComparison {
  baseline: ProjectResult;
  scenario: ProjectResult;
  /** Reduction = baseline − scenario. Negative when the scenario is higher. */
  savingsKg: number;
  /** Reduction ÷ baseline; 0 when the baseline is zero. */
  reductionFraction: number;
  componentChanges: ComponentChange[];
  measures: ScenarioMeasure[];
  sumOfIndividualSavingsKg: number;
  /** Combined saving minus the sum of single-measure savings. Non-zero when measures overlap. */
  interactionKg: number;
  warnings: string[];
}

const signed = (n: number) => `${n > 0 ? "+" : ""}${n}%`;

function activeMeasures(s: ScenarioSettings): { key: string; label: string; only: ScenarioSettings }[] {
  const out: { key: string; label: string; only: ScenarioSettings }[] = [];
  const base = (): ScenarioSettings => normaliseScenario(null);
  const wasteLabel = (name: string, a: WasteAdjustment) => (a.mode === "absolute" ? `${name} waste set to ${a.valuePercent}%` : `${name} waste ${signed(a.changePercent)}`);
  const isNoop = (a: WasteAdjustment | null) => !a || (a.mode === "relative" && a.changePercent === 0);
  if (!isNoop(s.masonryWaste)) out.push({ key: "masonryWaste", label: wasteLabel("Brick", s.masonryWaste!), only: { ...base(), masonryWaste: s.masonryWaste } });
  if (!isNoop(s.concreteWaste)) out.push({ key: "concreteWaste", label: wasteLabel("Concrete", s.concreteWaste!), only: { ...base(), concreteWaste: s.concreteWaste } });
  if (!isNoop(s.steelWaste)) out.push({ key: "steelWaste", label: wasteLabel("Steel", s.steelWaste!), only: { ...base(), steelWaste: s.steelWaste } });
  for (const [cat, pct] of Object.entries(s.quantityChangePercent)) {
    if (pct) out.push({ key: `qty:${cat}`, label: `${cat[0].toUpperCase()}${cat.slice(1)} quantity ${signed(pct)}`, only: { ...base(), quantityChangePercent: { [cat]: pct } } });
  }
  if (s.transportFuelChangePercent) out.push({ key: "transportFuel", label: `Transport fuel ${signed(s.transportFuelChangePercent)}`, only: { ...base(), transportFuelChangePercent: s.transportFuelChangePercent } });
  if (s.machineryFuelChangePercent) out.push({ key: "machineryFuel", label: `Machinery fuel ${signed(s.machineryFuelChangePercent)}`, only: { ...base(), machineryFuelChangePercent: s.machineryFuelChangePercent } });
  if (s.transportDistanceChangePercent) out.push({ key: "distance", label: `Transport distance ${signed(s.transportDistanceChangePercent)}`, only: { ...base(), transportDistanceChangePercent: s.transportDistanceChangePercent } });
  for (const [cat, ref] of Object.entries(s.factorSwaps)) {
    if (ref) out.push({ key: `swap:${cat}`, label: `Alternative ${cat} factor`, only: { ...base(), factorSwaps: { [cat]: ref } } });
  }
  return out;
}

export function compareScenario(project: Project, input: ScenarioSettings, baseline?: ProjectResult): ScenarioComparison {
  const settings = normaliseScenario(input);
  const base = baseline ?? calculateProject(project);
  const scen = calculateProject(applyScenario(project, settings));
  const savingsKg = base.totals.totalKg - scen.totals.totalKg;

  const measures = activeMeasures(settings).map((m) => ({
    key: m.key,
    label: m.label,
    savingsKg: base.totals.totalKg - calculateProject(applyScenario(project, m.only)).totals.totalKg,
  }));
  const sumOfIndividualSavingsKg = measures.reduce((s, m) => s + m.savingsKg, 0);
  const interactionKg = savingsKg - sumOfIndividualSavingsKg;

  const keys = new Map<string, ComponentChange>();
  for (const b of base.bySource) keys.set(b.key, { key: b.key, label: b.label, baselineKg: b.kg, scenarioKg: 0, deltaKg: 0 });
  for (const s of scen.bySource) {
    const cur = keys.get(s.key) ?? { key: s.key, label: s.label, baselineKg: 0, scenarioKg: 0, deltaKg: 0 };
    cur.scenarioKg = s.kg;
    keys.set(s.key, cur);
  }
  const componentChanges = [...keys.values()].map((c) => ({ ...c, deltaKg: c.scenarioKg - c.baselineKg })).sort((a, b) => b.baselineKg - a.baselineKg);

  const warnings: string[] = [];
  if (Math.abs(interactionKg) > 1e-6) {
    warnings.push(
      `The measures overlap. Applied together they save ${interactionKg > 0 ? "more" : "less"} than the sum of their separate savings (difference ${interactionKg.toFixed(2)} kg CO₂e); for example, a quantity cut and a waste-rate cut act on the same wasted mass. The combined figure is calculated once from the modified inputs, so it is not double-counted.`,
    );
  }
  const transport = project.buildings.flatMap((b) => b.transport);
  const measured = transport.filter((t) => t.method === "measured_fuel").length;
  const tkm = transport.filter((t) => t.method === "tonne_km").length;
  if (settings.transportDistanceChangePercent !== 0 && measured > 0) {
    warnings.push(`${measured} transport entr${measured === 1 ? "y uses" : "ies use"} measured fuel, so the distance change does not apply to ${measured === 1 ? "it" : "them"}. Adjust transport fuel instead.`);
  }
  if (settings.transportFuelChangePercent !== 0 && tkm > 0) {
    warnings.push(`${tkm} transport entr${tkm === 1 ? "y uses" : "ies use"} the tonne-km method, which has no fuel input, so the fuel change does not apply to ${tkm === 1 ? "it" : "them"}.`);
  }
  for (const [cat, ref] of Object.entries(settings.factorSwaps)) {
    if (!ref) continue;
    const alt = project.factors.find((f) => f.id === ref.factorId);
    if (!alt) continue;
    const originals = new Set<string>();
    for (const b of project.buildings) for (const m of b.materials) if (m.category === cat) originals.add(m.factors.map((f) => f.factorId).join("+"));
    for (const o of originals) {
      const mods = o
        .split("+")
        .flatMap((id) => project.factors.find((f) => f.id === id)?.lifecycleModules ?? [])
        .sort()
        .join(", ");
      const altMods = [...alt.lifecycleModules].sort().join(", ");
      if (mods !== altMods) {
        warnings.push(
          `The alternative ${cat} factor "${alt.name}" covers ${altMods || "an unstated boundary"}, but the baseline covers ${mods || "an unstated boundary"}. Part of the difference comes from the boundary, not from a real reduction.`,
        );
        break;
      }
    }
    if (alt.status === "illustrative") warnings.push(`"${alt.name}" is an illustrative placeholder, not a verified factor.`);
  }
  if (scen.hasErrors && !base.hasErrors) warnings.push("The scenario introduces invalid inputs. Check the settings.");

  return {
    baseline: base,
    scenario: scen,
    savingsKg,
    reductionFraction: base.totals.totalKg > 0 ? savingsKg / base.totals.totalKg : 0,
    componentChanges,
    measures,
    sumOfIndividualSavingsKg,
    interactionKg,
    warnings,
  };
}

/** Factors that can stand in for a category's waste factor: same category (or "other") and per-kg basis. */
export function alternativeFactors(project: Project, category: MaterialCategory) {
  return project.factors.filter((f) => (f.category === category || (category === "other" && f.category === "other")) && (f.unit === "kgCO2e/kg" || f.unit === "kgCO2e/t"));
}
