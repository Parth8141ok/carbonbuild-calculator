import { calculateProject } from "./calculate";
import { applyScenario, EMPTY_SCENARIO } from "./scenarios";
import type { MaterialCategory, Project, ProjectResult } from "./types";

export interface Recommendation {
  id: string;
  title: string;
  detail: string;
  /** Emissions of the components this measure addresses. */
  addressesKg: number;
  addressesShare: number;
}

const CATALOGUE: { id: string; title: string; detail: string; match: (r: ProjectResult) => number }[] = [
  {
    id: "brick_handling",
    title: "Reduce brick wastage on site",
    detail:
      "Stack bricks safely, protect them from breakage, plan wall lengths in whole-brick modules and avoid cutting. Each percentage point of brick waste saved lowers masonry emissions in proportion.",
    match: (r) => wasteKg(r, "masonry"),
  },
  {
    id: "brick_alternative",
    title: "Evaluate lower-carbon masonry units",
    detail:
      "Fly ash bricks, AAC blocks or hollow blocks may have lower factors than burnt clay. Add a documented factor for the alternative to the factor library before you compare it.",
    match: (r) => wasteKg(r, "masonry"),
  },
  {
    id: "steel_cutting",
    title: "Optimise reinforcement cutting",
    detail: "Prepare optimised bar-bending schedules, order standard bar lengths and keep off-cuts for reuse.",
    match: (r) => wasteKg(r, "steel"),
  },
  {
    id: "concrete_pours",
    title: "Plan concrete pours to avoid surplus",
    detail:
      "Order to measured volumes, reduce formwork leakage and over-pouring, and consider RMC with supplementary cementitious materials (fly ash, slag) when a verified factor is available.",
    match: (r) => wasteKg(r, "concrete") + wasteKg(r, "cement"),
  },
  {
    id: "deliveries",
    title: "Consolidate material deliveries",
    detail: "Combine deliveries, choose nearer suppliers and avoid part-load trips. Transport emissions rise directly with trip length.",
    match: (r) => r.totals.transportKg,
  },
  {
    id: "machinery",
    title: "Reduce machinery idling and fuel use",
    detail: "Reduce idle hours, schedule machine use and use efficient, hybrid or electric equipment where available.",
    match: (r) => r.totals.machineryKg,
  },
];

function wasteKg(r: ProjectResult, cat: MaterialCategory) {
  return r.lines.filter((l) => l.included && l.kind === "material" && l.materialCategory === cat).reduce((s, l) => s + l.emissionsKg, 0);
}

/** Measures ranked by the share of the user's own result that they address. */
export function buildRecommendations(r: ProjectResult): Recommendation[] {
  const total = r.totals.totalKg;
  const recs: Recommendation[] = CATALOGUE.map((c) => {
    const kg = c.match(r);
    return { id: c.id, title: c.title, detail: c.detail, addressesKg: kg, addressesShare: total > 0 ? kg / total : 0 };
  }).filter((x) => x.addressesKg > 0);
  recs.sort((a, b) => b.addressesKg - a.addressesKg);
  const assumed = r.dataQuality.emissionsByStatus.assumed + r.dataQuality.emissionsByStatus.estimated;
  if (total > 0 && assumed > 0) {
    recs.push({
      id: "data_quality",
      title: "Replace assumed values with site records",
      detail: "Keep fuel logs, delivery manifests, bar-bending schedules and brick delivery records, so that measured values replace assumed and estimated ones.",
      addressesKg: assumed,
      addressesShare: assumed / total,
    });
  }
  return recs;
}

export interface Sensitivity {
  key: string;
  label: string;
  description: string;
  /** Change in the total for the stated perturbation. */
  deltaKg: number;
  deltaShare: number;
}

export interface UncertaintySummary {
  rangeFactorLow: number | null;
  rangeFactorHigh: number | null;
  rangeFactorsUsed: string[];
  sensitivities: Sensitivity[];
}

/**
 * Low/high totals when range-based factors are set to their bounds, and linear
 * sensitivities to the main assumptions. No arbitrary confidence score is produced.
 */
export function analyseUncertainty(project: Project, base?: ProjectResult): UncertaintySummary {
  const r = base ?? calculateProject(project);
  const total = r.totals.totalKg;
  const rangeIds = new Set<string>();
  for (const l of r.lines) if (l.included) for (const c of l.factorComponents) if (c.level !== "point") rangeIds.add(c.factorId);

  let low: number | null = null;
  let high: number | null = null;
  if (rangeIds.size > 0) {
    const withLevel = (level: "low" | "high") => {
      const p = structuredClone(project);
      p.defaultFactorLevel = level;
      for (const b of p.buildings) {
        for (const m of b.materials) {
          m.factors = m.factors.map((f) => ({ factorId: f.factorId }));
          if (m.installedFactor) m.installedFactor = { factorId: m.installedFactor.factorId };
        }
      }
      return calculateProject(p).totals.totalKg;
    };
    low = withLevel("low");
    high = withLevel("high");
  }

  const sens: Sensitivity[] = [];
  const pp = (cat: MaterialCategory, label: string) => {
    const kg = wasteKg(r, cat);
    if (kg <= 0) return;
    // One percentage point more waste on every entry of the category.
    const p = structuredClone(project);
    for (const b of p.buildings) for (const m of b.materials) if (m.category === cat && m.wastePercent !== null) m.wastePercent = Math.min(100, m.wastePercent + 1);
    const d = calculateProject(p).totals.totalKg - total;
    sens.push({ key: `waste_${cat}`, label: `${label} waste +1 percentage point`, description: `Waste allowances for ${label.toLowerCase()} are reference industry averages.`, deltaKg: d, deltaShare: total > 0 ? d / total : 0 });
  };
  pp("masonry", "Brick");
  pp("concrete", "Concrete");
  pp("steel", "Steel");
  if (r.totals.transportKg + r.totals.machineryKg > 0) {
    const d = calculateProject(applyScenario(project, { ...EMPTY_SCENARIO, transportFuelChangePercent: 10, machineryFuelChangePercent: 10 })).totals.totalKg - total;
    sens.push({ key: "diesel", label: "Diesel consumption +10%", description: "Trip counts, distances, fuel economy and machine hours are often assumed.", deltaKg: d, deltaShare: total > 0 ? d / total : 0 });
  }
  sens.sort((a, b) => Math.abs(b.deltaKg) - Math.abs(a.deltaKg));

  return {
    rangeFactorLow: low,
    rangeFactorHigh: high,
    rangeFactorsUsed: [...rangeIds].map((id) => project.factors.find((f) => f.id === id)?.name ?? id),
    sensitivities: sens,
  };
}
