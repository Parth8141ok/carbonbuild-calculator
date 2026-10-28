/**
 * CarbonBuild calculation module. Pure functions, no UI code.
 *
 * Model (all quantities are per building, then multiplied by the number of buildings):
 *   Material waste emissions = quantity × waste % ÷ 100 × (production factor + waste-treatment factor)
 *   Transport (fuel)         = trips × distance ÷ fuel economy × fuel factor
 *   Transport (tonne-km)     = trips × distance × load × factor per tonne-km
 *   Equipment                = hours × litres per hour × fuel factor
 *
 * Factors are "kg CO₂e per unit of the quantity", so the unit of each factor must match
 * the unit of its quantity. Inputs are kept as text while the user types and are
 * converted here; blank, invalid or negative values count as 0 and are reported as warnings.
 * Nothing is rounded here: rounding is for display only.
 */

export type Group = "concrete" | "steel" | "masonry" | "other";

export interface Material {
  id: string;
  name: string;
  group: Group;
  qty: string;
  unit: string;
  waste: string;
  /** Production factor, kg CO₂e per unit of quantity. */
  ef: string;
  /** Waste-treatment factor, kg CO₂e per unit of wasted quantity. */
  disposal: string;
  /** Optional unit cost, ₹ per unit. */
  cost: string;
  /** What-if waste %. Blank means "same as the baseline waste %". */
  scenWaste: string;
  /** Whether the row counts in the totals. */
  include: boolean;
}

export type TransportMethod = "fuel" | "tkm";

export interface Transport {
  id: string;
  name: string;
  method: TransportMethod;
  trips: string;
  /** Distance per trip, km. For the fuel method this is the full distance driven per trip (round trip). */
  distance: string;
  /** Fuel method: fuel economy in km per litre. Tonne-km method: average load in tonnes. */
  param: string;
  /** Fuel method: kg CO₂e per litre. Tonne-km method: kg CO₂e per tonne-km. */
  factor: string;
}

export interface State {
  project: { name: string; location: string; count: string; area: string };
  materials: Material[];
  transport: Transport[];
  equipment: { hours: string; rate: string; factor: string; other: string };
  scenario: { transportReduction: string; equipmentReduction: string; costChange: string };
}

// ---------------------------------------------------------------------------
// Defaults: the reference project of the B.Tech report (BIM report Tables 9.2, 9.3, 9.9)
// ---------------------------------------------------------------------------

let counter = 0;
export function newId(prefix: string): string {
  counter += 1;
  return `${prefix}${Date.now().toString(36)}${counter.toString(36)}`;
}

const RCC_DENSITY = 2400; // kg/m³
const BRICK_MASS = 3; // kg per brick

/** kg CO₂e per kg × density, rounded to remove floating-point noise (0.142 × 2400 = 340.79999…). */
const perM3 = (perKg: number) => String(Math.round(perKg * RCC_DENSITY * 1e6) / 1e6);

export function referenceMaterials(): Material[] {
  const row = (m: Omit<Material, "id" | "scenWaste" | "cost">): Material => ({ ...m, id: newId("m"), scenWaste: "", cost: "" });
  return [
    // Foundation: production 0.13 + disposal 0.012 kg CO₂e/kg. The report's master total leaves this row out.
    row({ name: "Foundation concrete", group: "concrete", qty: "45", unit: "m³", waste: "5", ef: perM3(0.13), disposal: perM3(0.012), include: false }),
    row({ name: "Plinth concrete", group: "concrete", qty: "14", unit: "m³", waste: "6", ef: perM3(0.142), disposal: "0", include: true }),
    row({ name: "Plinth reinforcement steel", group: "steel", qty: "1100", unit: "kg", waste: "5", ef: "1.92", disposal: "0", include: true }),
    row({ name: "Columns & beams concrete", group: "concrete", qty: "72", unit: "m³", waste: "6", ef: perM3(0.142), disposal: "0", include: true }),
    row({ name: "Columns & beams steel", group: "steel", qty: "7800", unit: "kg", waste: "6", ef: "1.92", disposal: "0", include: true }),
    row({ name: "Slab concrete", group: "concrete", qty: "48", unit: "m³", waste: "4", ef: perM3(0.138), disposal: "0", include: true }),
    row({ name: "Slab reinforcement steel", group: "steel", qty: "4200", unit: "kg", waste: "4", ef: "1.92", disposal: "0", include: true }),
    row({ name: "Clay bricks (206.5 m³ of brickwork)", group: "masonry", qty: "103250", unit: "bricks", waste: "8", ef: String(Math.round(0.24 * BRICK_MASS * 1e6) / 1e6), disposal: "0", include: true }),
  ];
}

export function referenceTransport(): Transport[] {
  return [
    { id: newId("t"), name: "Ready-mix concrete transit mixers", method: "fuel", trips: "20", distance: "30", param: "2.5", factor: "2.68" },
    { id: newId("t"), name: "Material delivery trucks", method: "fuel", trips: "45", distance: "40", param: "3.5", factor: "2.68" },
  ];
}

export function referenceState(): State {
  return {
    project: { name: "Reference project: 10 bungalows", location: "Surat, Gujarat, India", count: "10", area: "330" },
    materials: referenceMaterials(),
    transport: referenceTransport(),
    equipment: { hours: "120", rate: "4.5", factor: "2.68", other: "0" },
    scenario: { transportReduction: "0", equipmentReduction: "0", costChange: "0" },
  };
}

export function blankState(): State {
  return {
    project: { name: "My project", location: "", count: "1", area: "" },
    materials: [newMaterial()],
    transport: [],
    equipment: { hours: "", rate: "", factor: "2.68", other: "0" },
    scenario: { transportReduction: "0", equipmentReduction: "0", costChange: "0" },
  };
}

export function newMaterial(): Material {
  return { id: newId("m"), name: "New material", group: "other", qty: "", unit: "kg", waste: "5", ef: "", disposal: "0", cost: "", scenWaste: "", include: true };
}

export function newTransport(): Transport {
  return { id: newId("t"), name: "Delivery trucks", method: "fuel", trips: "", distance: "", param: "", factor: "2.68" };
}

/**
 * The three illustrative measures of the report (BIM report §11.3): brick waste 8% → 4%,
 * concrete and steel waste reduced by one quarter, diesel use reduced by 20%.
 */
export function applyReportMeasures(s: State): State {
  const fmt = (n: number) => String(Math.round(n * 1e6) / 1e6);
  return {
    ...s,
    materials: s.materials.map((m) => ({
      ...m,
      scenWaste: m.group === "masonry" ? "4" : m.group === "concrete" || m.group === "steel" ? fmt(num(m.waste) * 0.75) : "",
    })),
    scenario: { ...s.scenario, transportReduction: "20", equipmentReduction: "20" },
  };
}

// ---------------------------------------------------------------------------
// Parsing
// ---------------------------------------------------------------------------

/** Text → non-negative number. Blank, invalid and negative values give 0. */
export function num(s: string): number {
  const n = Number(s);
  return Number.isFinite(n) && n > 0 ? n : 0;
}

const isNegative = (s: string) => Number(s) < 0;
const clampPct = (n: number) => Math.min(100, Math.max(0, n));

// ---------------------------------------------------------------------------
// Calculation
// ---------------------------------------------------------------------------

export interface MaterialResult {
  id: string;
  name: string;
  unit: string;
  include: boolean;
  /** Per building. */
  wasteQty: number;
  carbon: number;
  costWaste: number;
  scenWasteQty: number;
  scenCarbon: number;
  scenCost: number;
}

export interface TransportResult {
  id: string;
  /** Per building. */
  litres: number;
  tonneKm: number;
  carbon: number;
}

export interface Results {
  count: number;
  areaPerBuilding: number;
  materials: MaterialResult[];
  transport: TransportResult[];
  /** Per building, counted rows only. */
  materialCarbon: number;
  transportCarbon: number;
  equipmentLitres: number;
  equipmentCarbon: number;
  other: number;
  perBuilding: number;
  total: number;
  /** kg CO₂e per m² of built-up area, or null when the area is missing. */
  perArea: number | null;
  /** Emissions of rows left out of the totals (all buildings). */
  excludedTotal: number;
  wasteCost: number;
  scenarioPerBuilding: number;
  scenarioTotal: number;
  saved: number;
  /** Fraction (0–1) of the baseline saved; 0 when the baseline is zero. */
  savedFraction: number;
  scenarioCost: number;
  costSaved: number;
  warnings: string[];
}

export function calculate(s: State): Results {
  const warnings: string[] = [];
  const count = Math.max(1, Math.floor(num(s.project.count)));
  const areaPerBuilding = num(s.project.area);

  const materials: MaterialResult[] = s.materials.map((m) => {
    const w = clampPct(num(m.waste));
    const sw = m.scenWaste.trim() === "" ? w : clampPct(num(m.scenWaste));
    const factor = num(m.ef) + num(m.disposal);
    const q = num(m.qty);
    const cost = num(m.cost);
    const wasteQty = (q * w) / 100;
    const scenWasteQty = (q * sw) / 100;
    return {
      id: m.id,
      name: m.name,
      unit: m.unit,
      include: m.include,
      wasteQty,
      carbon: wasteQty * factor,
      costWaste: wasteQty * cost,
      scenWasteQty,
      scenCarbon: scenWasteQty * factor,
      scenCost: scenWasteQty * cost,
    };
  });
  const counted = materials.filter((m) => m.include);
  const sum = (xs: number[]) => xs.reduce((a, b) => a + b, 0);

  const transport: TransportResult[] = s.transport.map((t) => {
    const trips = num(t.trips);
    const distance = num(t.distance);
    const param = num(t.param);
    const factor = num(t.factor);
    if (t.method === "fuel") {
      const litres = param > 0 ? (trips * distance) / param : 0;
      return { id: t.id, litres, tonneKm: 0, carbon: litres * factor };
    }
    const tonneKm = trips * distance * param;
    return { id: t.id, litres: 0, tonneKm, carbon: tonneKm * factor };
  });

  const equipmentLitres = num(s.equipment.hours) * num(s.equipment.rate);
  const equipmentCarbon = equipmentLitres * num(s.equipment.factor);
  const other = num(s.equipment.other);

  const materialCarbon = sum(counted.map((m) => m.carbon));
  const transportCarbon = sum(transport.map((t) => t.carbon));
  const perBuilding = materialCarbon + transportCarbon + equipmentCarbon + other;
  const total = perBuilding * count;

  const tRed = clampPct(num(s.scenario.transportReduction)) / 100;
  const eRed = clampPct(num(s.scenario.equipmentReduction)) / 100;
  const scenarioPerBuilding = sum(counted.map((m) => m.scenCarbon)) + transportCarbon * (1 - tRed) + equipmentCarbon * (1 - eRed) + other;
  const scenarioTotal = scenarioPerBuilding * count;

  const costChange = Math.max(-100, Number(s.scenario.costChange) || 0);
  const wasteCost = sum(counted.map((m) => m.costWaste)) * count;
  const scenarioCost = sum(counted.map((m) => m.scenCost)) * (1 + costChange / 100) * count;

  // Warnings
  const all = [
    ...s.materials.flatMap((m) => [m.qty, m.waste, m.ef, m.disposal, m.cost, m.scenWaste]),
    ...s.transport.flatMap((t) => [t.trips, t.distance, t.param, t.factor]),
    ...Object.values(s.equipment),
    s.project.count,
    s.project.area,
  ];
  if (all.some(isNegative)) warnings.push("A negative value was entered. Negative values are treated as 0.");
  if (s.materials.some((m) => num(m.waste) > 100 || num(m.scenWaste) > 100)) warnings.push("A waste rate above 100% was entered and is limited to 100%.");
  if (areaPerBuilding === 0) warnings.push("Enter the built-up area per building to get kg CO₂e per m².");
  if (!s.materials.some((m) => m.include && num(m.qty) > 0)) warnings.push("Add at least one material quantity that is counted in the totals.");
  const noFactor = s.materials.filter((m) => m.include && num(m.qty) > 0 && num(m.ef) + num(m.disposal) === 0);
  if (noFactor.length) warnings.push(`No emission factor entered for: ${noFactor.map((m) => m.name).join(", ")}. They add 0 to the total.`);
  const noEconomy = s.transport.filter((t) => t.method === "fuel" && num(t.trips) * num(t.distance) > 0 && num(t.param) === 0);
  if (noEconomy.length) warnings.push(`Fuel economy (km per litre) is missing for: ${noEconomy.map((t) => t.name).join(", ")}. Fuel cannot be calculated without it, so no value is assumed.`);
  const noLoad = s.transport.filter((t) => t.method === "tkm" && num(t.trips) * num(t.distance) > 0 && num(t.param) === 0);
  if (noLoad.length) warnings.push(`Average load (tonnes) is missing for: ${noLoad.map((t) => t.name).join(", ")}.`);
  if (num(s.equipment.hours) > 0 && num(s.equipment.rate) === 0) warnings.push("Equipment hours were entered without a fuel use per hour. No rate is assumed.");

  return {
    count,
    areaPerBuilding,
    materials,
    transport,
    materialCarbon,
    transportCarbon,
    equipmentLitres,
    equipmentCarbon,
    other,
    perBuilding,
    total,
    perArea: areaPerBuilding > 0 ? total / (areaPerBuilding * count) : null,
    excludedTotal: sum(materials.filter((m) => !m.include).map((m) => m.carbon)) * count,
    wasteCost,
    scenarioPerBuilding,
    scenarioTotal,
    saved: total - scenarioTotal,
    savedFraction: total > 0 ? (total - scenarioTotal) / total : 0,
    scenarioCost,
    costSaved: wasteCost - scenarioCost,
    warnings,
  };
}

// ---------------------------------------------------------------------------
// Export
// ---------------------------------------------------------------------------

const csvCell = (v: unknown) => `"${String(v ?? "").replaceAll('"', '""')}"`;

/** Calculation table as CSV: inputs, per-row results and totals, at full precision (6 decimals). */
export function toCsv(s: State, r: Results): string {
  const d = (n: number) => Math.round(n * 1e6) / 1e6;
  const rows: unknown[][] = [
    ["CarbonBuild results"],
    ["Project", s.project.name],
    ["Location", s.project.location],
    ["Buildings", r.count],
    ["Built-up area per building (m2)", r.areaPerBuilding],
    [],
    ["Material", "Counted", "Quantity/building", "Unit", "Waste %", "Production factor (kgCO2e/unit)", "Waste-treatment factor (kgCO2e/unit wasted)", "Waste quantity/building", "Emissions kgCO2e/building", "What-if waste %", "What-if emissions kgCO2e/building"],
    ...s.materials.map((m, i) => [m.name, m.include ? "yes" : "no", m.qty, m.unit, m.waste, m.ef, m.disposal, d(r.materials[i].wasteQty), d(r.materials[i].carbon), m.scenWaste === "" ? m.waste : m.scenWaste, d(r.materials[i].scenCarbon)]),
    [],
    ["Transport", "Method", "Trips/building", "Distance per trip (km)", "Fuel economy (km/L) or load (t)", "Factor", "Litres or tonne-km", "Emissions kgCO2e/building"],
    ...s.transport.map((t, i) => [t.name, t.method === "fuel" ? "fuel" : "tonne-km", t.trips, t.distance, t.param, t.factor, d(t.method === "fuel" ? r.transport[i].litres : r.transport[i].tonneKm), d(r.transport[i].carbon)]),
    [],
    ["Source", "kg CO2e/building", "kg CO2e/all buildings"],
    ["Material waste", d(r.materialCarbon), d(r.materialCarbon * r.count)],
    ["Transport", d(r.transportCarbon), d(r.transportCarbon * r.count)],
    ["Equipment", d(r.equipmentCarbon), d(r.equipmentCarbon * r.count)],
    ["Other", d(r.other), d(r.other * r.count)],
    ["Baseline total", d(r.perBuilding), d(r.total)],
    ["Scenario total", d(r.scenarioPerBuilding), d(r.scenarioTotal)],
    ["Carbon saved", d(r.perBuilding - r.scenarioPerBuilding), d(r.saved)],
    ["Rows left out of the totals (all buildings)", "", d(r.excludedTotal)],
    ["kg CO2e per m2", "", r.perArea === null ? "" : d(r.perArea)],
  ];
  return "﻿" + rows.map((row) => row.map(csvCell).join(",")).join("\r\n");
}

// ---------------------------------------------------------------------------
// Stored data
// ---------------------------------------------------------------------------

const str = (v: unknown, fallback = "") => (typeof v === "string" ? v : typeof v === "number" && Number.isFinite(v) ? String(v) : fallback);
const obj = (v: unknown): Record<string, unknown> => (v && typeof v === "object" ? (v as Record<string, unknown>) : {});
const GROUPS: Group[] = ["concrete", "steel", "masonry", "other"];

/** Rebuilds a State from stored or imported data, ignoring anything malformed. */
export function sanitizeState(raw: unknown): State {
  const base = referenceState();
  const r = obj(raw);
  const p = obj(r.project);
  const e = obj(r.equipment);
  const sc = obj(r.scenario);
  if (!Array.isArray(r.materials) || !Array.isArray(r.transport)) return base;
  return {
    project: { name: str(p.name, base.project.name), location: str(p.location), count: str(p.count, "1"), area: str(p.area) },
    materials: r.materials.map((x) => {
      const m = obj(x);
      return {
        id: str(m.id) || newId("m"),
        name: str(m.name),
        group: GROUPS.includes(m.group as Group) ? (m.group as Group) : "other",
        qty: str(m.qty),
        unit: str(m.unit),
        waste: str(m.waste),
        ef: str(m.ef),
        disposal: str(m.disposal),
        cost: str(m.cost),
        scenWaste: str(m.scenWaste),
        include: m.include !== false,
      };
    }),
    transport: r.transport.map((x) => {
      const t = obj(x);
      return { id: str(t.id) || newId("t"), name: str(t.name), method: t.method === "tkm" ? "tkm" : "fuel", trips: str(t.trips), distance: str(t.distance), param: str(t.param), factor: str(t.factor) } as Transport;
    }),
    equipment: { hours: str(e.hours), rate: str(e.rate), factor: str(e.factor, "2.68"), other: str(e.other, "0") },
    scenario: { transportReduction: str(sc.transportReduction, "0"), equipmentReduction: str(sc.equipmentReduction, "0"), costChange: str(sc.costChange, "0") },
  };
}
