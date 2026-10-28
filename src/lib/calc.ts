/**
 * CarbonBuild calculation module. Pure functions, no UI code.
 *
 * Model (all quantities are per building, then multiplied by the number of buildings):
 *   Material waste emissions = quantity × waste % ÷ 100 × (production factor + waste-treatment factor)
 *   Transport (fuel)         = trips × distance ÷ fuel economy × fuel factor
 *   Transport (tonne-km)     = trips × distance × load × factor per tonne-km
 *   Equipment                = hours × litres per hour × fuel factor
 *   Operation (separate)     = consumption per year × factor, for electricity, fuel and water,
 *                              × years of operation × number of buildings
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

export type Period = "month" | "quarter" | "year";
export type EnergyUnit = "kWh" | "MWh";
export type FuelUnit = "litre" | "kg" | "m³";
export type WaterUnit = "m³" | "litre";
export type Supply = "grid" | "renewable" | "custom";

/** Consumption entered per building for one period (month, quarter or year). */
interface OperationalBase {
  id: string;
  name: string;
  amount: string;
  period: Period;
  /** kg CO₂e per unit of consumption (same unit as the amount, after the unit is chosen). */
  factor: string;
  source: string;
}

export interface ElectricityRecord extends OperationalBase {
  supply: Supply;
  unit: EnergyUnit;
  year: string;
  region: string;
  /** Optional month-by-month bills, in the selected electricity unit. */
  monthlyMode: boolean;
  monthlyAmounts: string[];
}

export interface FuelRecord extends OperationalBase {
  fuel: string;
  unit: FuelUnit;
  factorYear: string;
  factorRegion: string;
  /** Optional upstream production and supply factor, kept separate from combustion. */
  upstreamFactor: string;
  upstreamSource: string;
  upstreamYear: string;
  upstreamRegion: string;
}

export interface WaterRecord extends OperationalBase {
  activity: string;
  unit: WaterUnit;
  factorYear: string;
  factorRegion: string;
  /** Wastewater is entered separately in m³ per selected period. */
  wastewaterAmount: string;
  wastewaterFactor: string;
  wastewaterSource: string;
  wastewaterYear: string;
  wastewaterRegion: string;
}

export interface Operational {
  /** quick hides the source, year and region columns; the values are still stored and listed. */
  mode: "quick" | "detailed";
  /** Years of operation to total over. Consumption is assumed constant. */
  years: string;
  /** Optional, per building. */
  occupants: string;
  use: string;
  electricity: ElectricityRecord[];
  fuel: FuelRecord[];
  water: WaterRecord[];
}

export interface State {
  project: { name: string; location: string; count: string; area: string };
  materials: Material[];
  transport: Transport[];
  equipment: { hours: string; rate: string; factor: string; other: string };
  scenario: { transportReduction: string; equipmentReduction: string; costChange: string };
  operational: Operational;
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

/** The only operational factors the report gives (B.Tech report Ch. 4; BIM report Table 9.3). */
export const GRID_DEFAULT = { factor: "", source: "CEA CO₂ Baseline Database v22.0: https://cea.nic.in/cdm-co2-baseline-database/ (enter year-matched weighted-average factor)", region: "India" };
export const DIESEL_DEFAULT = { factor: "2.68", source: "BIM report Table 9.3: diesel combustion" };

export const FUEL_TYPES = ["Diesel", "Petrol", "LPG", "Natural gas", "Other fuel"] as const;

export function newElectricity(): ElectricityRecord {
  return { id: newId("e"), name: "Grid electricity", supply: "grid", amount: "", unit: "kWh", period: "year", factor: GRID_DEFAULT.factor, source: GRID_DEFAULT.source, year: "", region: GRID_DEFAULT.region, monthlyMode: false, monthlyAmounts: Array(12).fill("") };
}

export function newFuel(): FuelRecord {
  return { id: newId("f"), name: "Diesel (generator)", fuel: "Diesel", amount: "", unit: "litre", period: "year", factor: DIESEL_DEFAULT.factor, source: `${DIESEL_DEFAULT.source} (direct combustion only)`, factorYear: "", factorRegion: "", upstreamFactor: "", upstreamSource: "", upstreamYear: "", upstreamRegion: "" };
}

export function newWater(): WaterRecord {
  return { id: newId("w"), name: "Water supply", activity: "Water supply", amount: "", unit: "m³", period: "year", factor: "", source: "", factorYear: "", factorRegion: "", wastewaterAmount: "", wastewaterFactor: "", wastewaterSource: "", wastewaterYear: "", wastewaterRegion: "" };
}

export function defaultOperational(): Operational {
  return { mode: "quick", years: "1", occupants: "", use: "", electricity: [newElectricity()], fuel: [], water: [] };
}

export function referenceState(): State {
  return {
    project: { name: "Reference project: 10 bungalows", location: "Surat, Gujarat, India", count: "10", area: "330" },
    materials: referenceMaterials(),
    transport: referenceTransport(),
    equipment: { hours: "120", rate: "4.5", factor: "2.68", other: "0" },
    scenario: { transportReduction: "0", equipmentReduction: "0", costChange: "0" },
    operational: defaultOperational(),
  };
}

export function blankState(): State {
  return {
    project: { name: "My project", location: "", count: "1", area: "" },
    materials: [newMaterial()],
    transport: [],
    equipment: { hours: "", rate: "", factor: "2.68", other: "0" },
    scenario: { transportReduction: "0", equipmentReduction: "0", costChange: "0" },
    operational: defaultOperational(),
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

export interface OperationalRecordResult {
  id: string;
  /** Per building, per year: kWh, litres/kg/m³ for fuel, m³ for water. */
  annualAmount: number;
  /** kg CO₂e per building per year. */
  annualCarbon: number;
  annualDirectCarbon: number;
  annualUpstreamCarbon: number;
  annualWastewaterCarbon: number;
}

export interface OperationalResults {
  years: number;
  electricity: OperationalRecordResult[];
  fuel: OperationalRecordResult[];
  water: OperationalRecordResult[];
  /** kg CO₂e per building per year. */
  electricityPerYear: number;
  fuelPerYear: number;
  fuelDirectPerYear: number;
  fuelUpstreamPerYear: number;
  waterPerYear: number;
  waterSupplyPerYear: number;
  wastewaterPerYear: number;
  perYearBuilding: number;
  /** All buildings, one year. */
  perYearAll: number;
  /** All buildings, over the assessment years. */
  totalAll: number;
  /** kWh per m² per year, or null without floor area. */
  electricityKWhPerM2Year: number | null;
  /** kg CO₂e per m² of floor area per year, or null without floor area. */
  perM2Year: number | null;
  perOccupantYear: number | null;
  /** Construction-stage total plus operation over the assessment years (all buildings). */
  withConstructionAll: number;
  hasData: boolean;
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
  operational: OperationalResults;
  warnings: string[];
}

const PERIODS_PER_YEAR: Record<Period, number> = { month: 12, quarter: 4, year: 1 };
export const toKWh = (amount: number, unit: EnergyUnit) => (unit === "MWh" ? amount * 1000 : amount);
export const toM3 = (amount: number, unit: WaterUnit) => (unit === "litre" ? amount / 1000 : amount);
const perYear = (amount: number, period: Period) => amount * PERIODS_PER_YEAR[period];

function calculateOperational(s: State, count: number, area: number, constructionTotal: number, warnings: string[]): OperationalResults {
  const op = s.operational;
  const years = num(op.years) > 0 ? num(op.years) : 1;
  if (num(op.years) === 0) warnings.push("Years of operation is blank or 0, so one year is shown.");

  const sum = (xs: number[]) => xs.reduce((a, b) => a + b, 0);
  // Annual amount in the base unit (kWh, fuel unit, m³); annual carbon = annual amount × factor.
  const electricity = op.electricity.map((e) => {
    const monthlyAmount = e.monthlyAmounts.reduce((total, amount) => total + num(amount), 0);
    const annualAmount = e.monthlyMode ? toKWh(monthlyAmount, e.unit) : perYear(toKWh(num(e.amount), e.unit), e.period);
    const annualCarbon = annualAmount * num(e.factor);
    return { id: e.id, annualAmount, annualCarbon, annualDirectCarbon: annualCarbon, annualUpstreamCarbon: 0, annualWastewaterCarbon: 0 };
  });
  const fuel = op.fuel.map((f) => {
    const annualAmount = perYear(num(f.amount), f.period);
    const annualDirectCarbon = annualAmount * num(f.factor);
    const annualUpstreamCarbon = annualAmount * num(f.upstreamFactor);
    return { id: f.id, annualAmount, annualCarbon: annualDirectCarbon + annualUpstreamCarbon, annualDirectCarbon, annualUpstreamCarbon, annualWastewaterCarbon: 0 };
  });
  const water = op.water.map((w) => {
    const annualAmount = perYear(toM3(num(w.amount), w.unit), w.period);
    const annualWastewaterAmount = perYear(num(w.wastewaterAmount), w.period);
    const annualDirectCarbon = annualAmount * num(w.factor);
    const annualWastewaterCarbon = annualWastewaterAmount * num(w.wastewaterFactor);
    return { id: w.id, annualAmount, annualCarbon: annualDirectCarbon + annualWastewaterCarbon, annualDirectCarbon, annualUpstreamCarbon: 0, annualWastewaterCarbon };
  });

  const electricityPerYear = sum(electricity.map((r) => r.annualCarbon));
  const fuelPerYear = sum(fuel.map((r) => r.annualCarbon));
  const fuelDirectPerYear = sum(fuel.map((r) => r.annualDirectCarbon));
  const fuelUpstreamPerYear = sum(fuel.map((r) => r.annualUpstreamCarbon));
  const waterSupplyPerYear = sum(water.map((r) => r.annualDirectCarbon));
  const wastewaterPerYear = sum(water.map((r) => r.annualWastewaterCarbon));
  const waterPerYear = waterSupplyPerYear + wastewaterPerYear;
  const perYearBuilding = electricityPerYear + fuelPerYear + waterPerYear;
  const perYearAll = perYearBuilding * count;
  const totalAll = perYearAll * years;
  const floorArea = area * count;
  const occupants = num(op.occupants) * count;

  // Warnings: only records that have a consumption entered
  const used = {
    electricity: op.electricity.filter((e) => (e.monthlyMode ? e.monthlyAmounts.some((amount) => num(amount) > 0) : num(e.amount) > 0)),
    fuel: op.fuel.filter((f) => num(f.amount) > 0),
    water: op.water.filter((w) => num(w.amount) > 0 || num(w.wastewaterAmount) > 0),
  };
  const label = (kind: string, name: string) => `${kind} "${name || "unnamed"}"`;
  for (const e of used.electricity) {
    if (e.monthlyMode && e.monthlyAmounts.some((amount) => amount.trim() === "")) warnings.push(`${label("Electricity", e.name)}: one or more monthly values are blank and count as 0.`);
    if (num(e.factor) === 0 && !(e.supply === "renewable" && e.source.trim())) {
      warnings.push(`${label("Electricity", e.name)}: no emission factor entered, so it adds 0. A zero factor is only accepted for a documented renewable source with its source written down.`);
    }
  }
  for (const f of used.fuel) {
    if (num(f.factor) === 0) warnings.push(`${label("Fuel", f.name)}: no direct combustion factor entered, so direct emissions add 0. Enter a sourced value for ${f.fuel.toLowerCase()}.`);
    if (num(f.upstreamFactor) === 0 && num(f.amount) > 0) warnings.push(`${label("Fuel", f.name)}: no upstream production and supply factor entered; upstream emissions add 0.`);
  }
  for (const w of used.water) {
    if (num(w.amount) > 0 && num(w.factor) === 0) warnings.push(`${label("Water", w.name)}: no water supply factor (kg CO₂e per m³) entered, so supply emissions add 0.`);
    if (num(w.wastewaterAmount) > 0 && num(w.wastewaterFactor) === 0) warnings.push(`${label("Wastewater", w.name)}: no treatment factor (kg CO₂e per m³) entered, so treatment emissions add 0.`);
  }
  const noSource = [
    ...used.electricity.filter((e) => num(e.factor) > 0 && !e.source.trim()).map((e) => label("electricity", e.name)),
    ...used.fuel.filter((f) => num(f.factor) > 0 && !f.source.trim()).map((f) => label("fuel", f.name)),
    ...used.fuel.filter((f) => num(f.upstreamFactor) > 0 && !f.upstreamSource.trim()).map((f) => label("fuel upstream", f.name)),
    ...used.water.filter((w) => num(w.factor) > 0 && !w.source.trim()).map((w) => label("water", w.name)),
    ...used.water.filter((w) => num(w.wastewaterFactor) > 0 && !w.wastewaterSource.trim()).map((w) => label("wastewater", w.name)),
  ];
  if (noSource.length) warnings.push(`No source recorded for the emission factor of: ${noSource.join(", ")}.`);
  const hasData = used.electricity.length + used.fuel.length + used.water.length > 0;
  if (hasData && area === 0) warnings.push("Enter the built-up area per building to get operational kg CO₂e per m² per year.");

  return {
    years,
    electricity,
    fuel,
    water,
    electricityPerYear,
    fuelPerYear,
    fuelDirectPerYear,
    fuelUpstreamPerYear,
    waterPerYear,
    waterSupplyPerYear,
    wastewaterPerYear,
    perYearBuilding,
    perYearAll,
    totalAll,
    electricityKWhPerM2Year: floorArea > 0 ? (sum(electricity.map((r) => r.annualAmount)) * count) / floorArea : null,
    perM2Year: floorArea > 0 ? perYearAll / floorArea : null,
    perOccupantYear: occupants > 0 ? perYearAll / occupants : null,
    withConstructionAll: constructionTotal + totalAll,
    hasData,
  };
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

  const operational = calculateOperational(s, count, areaPerBuilding, total, warnings);

  // Warnings
  const all = [
    ...s.materials.flatMap((m) => [m.qty, m.waste, m.ef, m.disposal, m.cost, m.scenWaste]),
    ...s.transport.flatMap((t) => [t.trips, t.distance, t.param, t.factor]),
    ...Object.values(s.equipment),
    s.project.count,
    s.project.area,
    s.operational.years,
    s.operational.occupants,
    ...s.operational.electricity.flatMap((e) => [e.amount, e.factor, ...e.monthlyAmounts]),
    ...s.operational.fuel.flatMap((f) => [f.amount, f.factor, f.upstreamFactor]),
    ...s.operational.water.flatMap((w) => [w.amount, w.factor, w.wastewaterAmount, w.wastewaterFactor]),
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
    operational,
    warnings,
  };
}

// ---------------------------------------------------------------------------
// Export
// ---------------------------------------------------------------------------

const csvCell = (v: unknown) => `"${String(v ?? "").replaceAll('"', '""')}"`;

function operationalCsvRows(s: State, r: Results, d: (n: number) => number): unknown[][] {
  const op = s.operational;
  const o = r.operational;
  if (!o.hasData) return [];
  const per = (p: Period) => ({ month: "month", quarter: "quarter", year: "year" })[p];
  return [
    [],
    ["Operational carbon (per building, normalised to one year; assumes constant use)"],
    ["Years of operation", o.years],
    ["Electricity", "Supply", "Consumption", "Unit", "Per", "Factor kgCO2/kWh (CEA)", "Source", "Year", "Region", "Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec", "kWh/year", "kgCO2/year"],
    ...op.electricity.map((e, i) => [e.name, e.supply, e.monthlyMode ? "12 monthly values" : e.amount, e.unit, e.monthlyMode ? "month-by-month" : per(e.period), e.factor, e.source, e.year, e.region, ...e.monthlyAmounts, d(o.electricity[i].annualAmount), d(o.electricity[i].annualCarbon)]),
    ["Fuel", "Fuel type", "Consumption", "Unit", "Per", "Direct factor", "Direct source", "Direct year", "Direct region", "Upstream factor", "Upstream source", "Upstream year", "Upstream region", "", "", "", "", "", "", "", "", "Units/year", "kgCO2e/year"],
    ...op.fuel.map((f, i) => [f.name, f.fuel, f.amount, f.unit, per(f.period), f.factor, f.source, f.factorYear, f.factorRegion, f.upstreamFactor, f.upstreamSource, f.upstreamYear, f.upstreamRegion, "", "", "", "", "", "", "", "", d(o.fuel[i].annualAmount), d(o.fuel[i].annualCarbon)]),
    ["Water supply and wastewater", "Activity", "Supply consumption", "Unit", "Per", "Supply factor", "Supply source", "Supply year", "Supply region", "Wastewater m3", "Wastewater factor", "Wastewater source", "Wastewater year", "Wastewater region", "", "", "", "", "", "", "", "m3/year", "kgCO2e/year"],
    ...op.water.map((w, i) => [w.name, w.activity, w.amount, w.unit, per(w.period), w.factor, w.source, w.factorYear, w.factorRegion, w.wastewaterAmount, w.wastewaterFactor, w.wastewaterSource, w.wastewaterYear, w.wastewaterRegion, "", "", "", "", "", "", "", d(o.water[i].annualAmount), d(o.water[i].annualCarbon)]),
    [],
    ["Operational emissions", "kg CO2 or CO2e/building/year (mixed basis)", "kg CO2 or CO2e/all buildings/year (mixed basis)", "kg CO2 or CO2e/all buildings over the years (mixed basis)"],
    ["Electricity (CEA CO2-only basis)", d(o.electricityPerYear), d(o.electricityPerYear * r.count), d(o.electricityPerYear * r.count * o.years)],
    ["Fuel direct combustion", d(o.fuelDirectPerYear), d(o.fuelDirectPerYear * r.count), d(o.fuelDirectPerYear * r.count * o.years)],
    ["Fuel upstream production and supply", d(o.fuelUpstreamPerYear), d(o.fuelUpstreamPerYear * r.count), d(o.fuelUpstreamPerYear * r.count * o.years)],
    ["Water supply", d(o.waterSupplyPerYear), d(o.waterSupplyPerYear * r.count), d(o.waterSupplyPerYear * r.count * o.years)],
    ["Wastewater treatment", d(o.wastewaterPerYear), d(o.wastewaterPerYear * r.count), d(o.wastewaterPerYear * r.count * o.years)],
    ["Operational total", d(o.perYearBuilding), d(o.perYearAll), d(o.totalAll)],
    ["kg CO2 or CO2e per m2 per year (mixed basis)", "", o.perM2Year === null ? "" : d(o.perM2Year), ""],
    ["Construction + operation (mixed CO2e / CO2 basis, all buildings)", "", "", d(o.withConstructionAll)],
  ];
}

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
    ...operationalCsvRows(s, r, d),
  ];
  return "﻿" + rows.map((row) => row.map(csvCell).join(",")).join("\r\n");
}

// ---------------------------------------------------------------------------
// Stored data
// ---------------------------------------------------------------------------

const str = (v: unknown, fallback = "") => (typeof v === "string" ? v : typeof v === "number" && Number.isFinite(v) ? String(v) : fallback);
const obj = (v: unknown): Record<string, unknown> => (v && typeof v === "object" ? (v as Record<string, unknown>) : {});
const GROUPS: Group[] = ["concrete", "steel", "masonry", "other"];

const oneOf = <T extends string>(v: unknown, options: readonly T[], fallback: T): T => (options.includes(v as T) ? (v as T) : fallback);
const PERIODS: Period[] = ["month", "quarter", "year"];

/** Restores operational data. Data saved before this module existed gets the defaults. */
export function sanitizeOperational(raw: unknown): Operational {
  if (!raw || typeof raw !== "object") return defaultOperational();
  const o = obj(raw);
  const list = (v: unknown) => (Array.isArray(v) ? v : []);
  const base = (x: Record<string, unknown>, prefix: string) => ({
    id: str(x.id) || newId(prefix),
    name: str(x.name),
    amount: str(x.amount),
    period: oneOf(x.period, PERIODS, "year"),
    factor: str(x.factor),
    source: str(x.source),
  });
  return {
    mode: o.mode === "detailed" ? "detailed" : "quick",
    years: str(o.years, "1"),
    occupants: str(o.occupants),
    use: str(o.use),
    electricity: list(o.electricity).map((x) => {
      const e = obj(x);
      const monthlyAmounts = Array.isArray(e.monthlyAmounts) ? e.monthlyAmounts.slice(0, 12).map((v) => str(v)) : [];
      while (monthlyAmounts.length < 12) monthlyAmounts.push("");
      return { ...base(e, "e"), supply: oneOf(e.supply, ["grid", "renewable", "custom"] as const, "grid"), unit: oneOf(e.unit, ["kWh", "MWh"] as const, "kWh"), year: str(e.year), region: str(e.region), monthlyMode: e.monthlyMode === true, monthlyAmounts };
    }),
    fuel: list(o.fuel).map((x) => {
      const f = obj(x);
      return { ...base(f, "f"), fuel: str(f.fuel, "Other fuel"), unit: oneOf(f.unit, ["litre", "kg", "m³"] as const, "litre"), factorYear: str(f.factorYear), factorRegion: str(f.factorRegion), upstreamFactor: str(f.upstreamFactor), upstreamSource: str(f.upstreamSource), upstreamYear: str(f.upstreamYear), upstreamRegion: str(f.upstreamRegion) };
    }),
    water: list(o.water).map((x) => {
      const w = obj(x);
      return { ...base(w, "w"), activity: str(w.activity, "Water supply"), unit: oneOf(w.unit, ["m³", "litre"] as const, "m³"), factorYear: str(w.factorYear), factorRegion: str(w.factorRegion), wastewaterAmount: str(w.wastewaterAmount), wastewaterFactor: str(w.wastewaterFactor), wastewaterSource: str(w.wastewaterSource), wastewaterYear: str(w.wastewaterYear), wastewaterRegion: str(w.wastewaterRegion) };
    }),
  };
}

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
    operational: sanitizeOperational(r.operational),
  };
}
