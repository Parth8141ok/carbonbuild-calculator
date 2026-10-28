import type { BuildingType, DataStatus, EmissionFactor, FactorRef, FactorStatus, Project } from "@/lib/engine";
import { FACTOR_UNIT_LABELS } from "@/lib/engine";
import { fmt } from "@/lib/format";

export const BUILDING_TYPES: { value: BuildingType; label: string }[] = [
  { value: "bungalow", label: "Residential: bungalow" },
  { value: "independent_house", label: "Residential: independent house" },
  { value: "apartment", label: "Residential: apartment building" },
  { value: "commercial", label: "Commercial" },
  { value: "industrial", label: "Industrial" },
  { value: "institutional", label: "Institutional (school, hospital, public building)" },
  { value: "other", label: "Other" },
];

export const FACTOR_STATUS_LABELS: Record<FactorStatus, string> = {
  reference: "Source-derived (project reports)",
  user: "User-provided",
  verified_external: "Verified external value",
  illustrative: "Illustrative: verify before use",
};

export const FACTOR_STATUS_TONE: Record<FactorStatus, "neutral" | "green" | "amber" | "red"> = {
  reference: "neutral",
  user: "amber",
  verified_external: "green",
  illustrative: "red",
};

/** Plain-language explanations of engineering terms, shown in tooltips. */
export const TERMS = {
  kgco2e: "Kilograms of carbon dioxide equivalent: all greenhouse gases converted to the amount of CO₂ with the same warming effect. 1,000 kg CO₂e = 1 tonne.",
  emissionFactor: "How much CO₂e is released per unit of an activity, e.g. kg CO₂e per kg of steel or per litre of diesel. Emissions = activity data × emission factor.",
  waste: "The share of material bought but not built in (cutting, breakage, spillage, over-ordering). Wasted mass = total mass × waste % ÷ 100.",
  density: "Mass per cubic metre, used to convert a volume (m³) into a mass (kg) before a per-kg factor is applied. Reinforced concrete: about 2,400 kg/m³.",
  intensity: "Total emissions divided by built-up floor area (kg CO₂e/m²). Useful for comparing buildings of different sizes.",
  tonneKm: "One tonne carried one kilometre. Tonne-km = transported mass (t) × distance (km). Used with a factor in kg CO₂e per tonne-km.",
  boundary: "Which life-cycle stages are counted. A1–A3 = material production, A4 = transport to site, A5 = construction, B = use, C = end of life, D = reuse benefits.",
  profile: "The reference report's consolidated total leaves out its foundation stage. The profile chooses whether the foundation stage counts in the total.",
  builtUp: "Total floor area of all floors, measured to the outside of walls. Built-up area = floors × area per floor.",
  productionVsWaste: "Material production: making the material that is built in (A1–A3). Waste emissions: the production of material that is wasted plus, where the factor covers it, its treatment and disposal (C2–C4).",
} as const;

export const DATA_STATUS_OPTIONS: { value: DataStatus; label: string; description: string }[] = [
  { value: "measured", label: "Measured", description: "From actual site records: fuel bills, delivery manifests, take-off." },
  { value: "user_provided", label: "User-provided", description: "Entered by you, not independently verified." },
  { value: "estimated", label: "Estimated", description: "Derived from dimensions or other quantities." },
  { value: "assumed", label: "Assumed", description: "Taken from the reference profile." },
];

export const STATUS_TONE: Record<DataStatus, "green" | "neutral" | "amber" | "outline"> = {
  measured: "green",
  user_provided: "neutral",
  estimated: "outline",
  assumed: "amber",
};

export function factorOptionLabel(f: EmissionFactor): string {
  const unit = FACTOR_UNIT_LABELS[f.unit];
  const val = f.range ? `${fmt(f.range.low)}–${fmt(f.range.high)}` : fmt(f.value);
  return `${f.name}: ${val} ${unit}${f.status === "user" ? " · user" : f.status === "verified_external" ? " · verified" : ""}`;
}

export function factorRefLabel(project: Project, ref: FactorRef | null | undefined): string {
  if (!ref) return "No factor";
  const f = project.factors.find((x) => x.id === ref.factorId);
  if (!f) return `Missing factor (${ref.factorId})`;
  if (!f.range) return `${fmt(f.value)} ${FACTOR_UNIT_LABELS[f.unit]}`;
  const level = ref.level ?? project.defaultFactorLevel;
  const v = level === "low" ? f.range.low : level === "high" ? f.range.high : f.value;
  return `${fmt(v)} ${FACTOR_UNIT_LABELS[f.unit]} (${level})`;
}

export function locationLabel(p: Project): string {
  return [p.location.city, p.location.state, p.location.country].filter(Boolean).join(", ") || "Location not set";
}
