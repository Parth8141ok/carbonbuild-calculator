import { DEFAULT_DIESEL_FACTOR_ID, FACTOR_DATASET_VERSION, cloneReferenceFactors, templateFactorIds } from "./factors";
import { cloneDefaultStages } from "./stages";
import type {
  BuildingGroup,
  EmissionFactor,
  MachineryEntry,
  MaterialCategory,
  MaterialEntry,
  Project,
  QuantityUnit,
  TransportEntry,
} from "./types";

let counter = 0;
export function createId(prefix = "id"): string {
  const c = globalThis.crypto;
  if (c && typeof c.randomUUID === "function") return `${prefix}_${c.randomUUID().slice(0, 8)}`;
  counter += 1;
  return `${prefix}_${Date.now().toString(36)}${counter.toString(36)}`;
}

/**
 * Reference waste allowances by stage (BIM report Table 9.2 and Table 13.1).
 * These are the study's industry-average assumptions, not universal standards.
 */
export const REFERENCE_WASTE: Record<string, { concrete: number; steel: number; masonry: number }> = {
  foundation: { concrete: 5, steel: 5, masonry: 8 },
  plinth: { concrete: 6, steel: 5, masonry: 8 },
  columns_beams: { concrete: 6, steel: 6, masonry: 8 },
  slabs: { concrete: 4, steel: 4, masonry: 8 },
  walls: { concrete: 6, steel: 6, masonry: 8 },
};

export function referenceWaste(stageId: string, category: MaterialCategory): number | null {
  const row = REFERENCE_WASTE[stageId];
  if (!row) return null;
  if (category === "concrete" || category === "cement") return row.concrete;
  if (category === "steel") return row.steel;
  if (category === "masonry") return row.masonry;
  return null;
}

export interface MaterialPreset {
  key: string;
  label: string;
  category: MaterialCategory;
  unit: QuantityUnit;
  specification: string;
  densityKgPerM3?: number;
  bricksPerM3?: number;
  brickMassKg?: number;
  /** Waste factor ids for a given stage. */
  factorIds: (stageId: string) => string[];
  /** Production-only factor for the expanded boundary. */
  installedFactorId: string | null;
  cementScope?: "standalone" | "in_concrete";
  description: string;
}

export const MATERIAL_PRESETS: MaterialPreset[] = [
  {
    key: "rcc",
    label: "Structural RCC (stage factor from the BIM library)",
    category: "concrete",
    unit: "m3",
    specification: "RCC, about M25/M30",
    densityKgPerM3: 2400,
    factorIds: (s) => templateFactorIds(s, "concrete"),
    installedFactorId: "concrete_a1a3_bim",
    description: "Uses the study factor for the stage: 0.13 + 0.012 for the foundation, 0.142 for plinth, columns and beams, 0.138 for slabs.",
  },
  {
    key: "rmc_m25_m30",
    label: "Ready-mix concrete M25/M30",
    category: "concrete",
    unit: "m3",
    specification: "M25/M30",
    densityKgPerM3: 2400,
    factorIds: () => ["rmc_m25_m30_ch3"],
    installedFactorId: "rmc_m25_m30_ch3",
    description: "Finished mix with a generic 0.12–0.14 range (A1–A3). Includes its cement, so do not add that cement again.",
  },
  {
    key: "hsc_m50_m60",
    label: "High-strength concrete M50/M60",
    category: "concrete",
    unit: "m3",
    specification: "M50/M60",
    densityKgPerM3: 2400,
    factorIds: () => ["hsc_m50_m60_ch3"],
    installedFactorId: "hsc_m50_m60_ch3",
    description: "Finished mix with a generic 0.18–0.22 range (A1–A3).",
  },
  {
    key: "rebar",
    label: "Reinforcement steel",
    category: "steel",
    unit: "kg",
    specification: "High-tensile bars",
    factorIds: () => ["rebar_bim"],
    installedFactorId: "rebar_ch3",
    description: "Uses the BIM study value of 1.92 kg CO₂e/kg. The generic 1.80–2.40 range is available as an alternative.",
  },
  {
    key: "structural_steel",
    label: "Structural steel sections",
    category: "steel",
    unit: "kg",
    specification: "Universal beams / I-beams",
    factorIds: () => ["structural_steel_ch3"],
    installedFactorId: "structural_steel_ch3",
    description: "Generic 1.90–2.50 range.",
  },
  {
    key: "clay_brick",
    label: "Burnt clay bricks (by brickwork volume)",
    category: "masonry",
    unit: "m3_brickwork",
    specification: "Kiln-fired clay brick",
    bricksPerM3: 500,
    brickMassKg: 3,
    factorIds: () => ["clay_brick_bim"],
    installedFactorId: "clay_brick_bim",
    description: "500 bricks per m³ and 3 kg per brick, as in the study.",
  },
  {
    key: "clay_brick_count",
    label: "Burnt clay bricks (by count)",
    category: "masonry",
    unit: "bricks",
    specification: "Kiln-fired clay brick",
    brickMassKg: 3,
    factorIds: () => ["clay_brick_bim"],
    installedFactorId: "clay_brick_bim",
    description: "Enter the number of bricks. Mass per brick is 3 kg by default.",
  },
  ...(
    [
      ["sand_aggregate", "Sand and aggregates", "t", "sand_aggregate_illustrative", "Quantity in tonnes."],
      ["aluminium", "Aluminium (sections, sheet)", "kg", "aluminium_illustrative", "Quantity in kg."],
      ["glass", "Flat glass", "kg", "glass_illustrative", "Quantity in kg (area × thickness × about 2,500 kg/m³)."],
      ["timber", "Sawn timber", "kg", "timber_illustrative", "Quantity in kg. Timber density varies by species, so enter mass."],
    ] as const
  ).map(
    ([key, label, unit, factorId, hint]): MaterialPreset => ({
      key,
      label,
      category: "other",
      unit,
      specification: "",
      factorIds: () => [factorId],
      installedFactorId: factorId,
      description: `${hint} Uses an ILLUSTRATIVE factor that must be replaced with a sourced value.`,
    }),
  ),
  {
    key: "custom",
    label: "Custom material (choose your own factor)",
    category: "other",
    unit: "kg",
    specification: "",
    factorIds: () => [],
    installedFactorId: null,
    description: "Any material. Select or add a documented emission factor before the entry is counted.",
  },
  {
    key: "opc",
    label: "Ordinary Portland cement (standalone)",
    category: "cement",
    unit: "kg",
    specification: "Grade 43/53",
    factorIds: () => ["opc_ch3"],
    installedFactorId: "opc_ch3",
    cementScope: "standalone",
    description: "Only for cement that is not already part of a concrete entry, for example site-batched mortar.",
  },
  {
    key: "ppc",
    label: "Portland pozzolana cement (standalone)",
    category: "cement",
    unit: "kg",
    specification: "Fly ash blend (25–30%)",
    factorIds: () => ["ppc_ch3"],
    installedFactorId: "ppc_ch3",
    cementScope: "standalone",
    description: "Only for cement that is not already part of a concrete entry.",
  },
];

export function newMaterial(partial: Partial<MaterialEntry> = {}): MaterialEntry {
  return {
    id: createId("mat"),
    stageId: "foundation",
    category: "concrete",
    name: "",
    specification: "",
    quantity: null,
    unit: "m3",
    densityKgPerM3: 2400,
    bricksPerM3: null,
    brickMassKg: null,
    wastePercent: null,
    wasteSource: "reference",
    factors: [],
    installedFactor: null,
    dataStatus: "user_provided",
    origin: "manual",
    notes: "",
    ...partial,
  };
}

export function materialFromPreset(presetKey: string, stageId: string, overrides: Partial<MaterialEntry> = {}): MaterialEntry {
  const p = MATERIAL_PRESETS.find((x) => x.key === presetKey);
  if (!p) throw new Error(`Unknown material preset "${presetKey}"`);
  const waste = referenceWaste(stageId, p.category);
  return newMaterial({
    stageId,
    category: p.category,
    name: p.label.replace(/ \(.*\)$/, ""),
    specification: p.specification,
    unit: p.unit,
    densityKgPerM3: p.densityKgPerM3 ?? null,
    bricksPerM3: p.bricksPerM3 ?? null,
    brickMassKg: p.brickMassKg ?? null,
    wastePercent: waste,
    wasteSource: waste === null ? "user" : "reference",
    factors: p.factorIds(stageId).map((factorId) => ({ factorId })),
    installedFactor: p.installedFactorId ? { factorId: p.installedFactorId } : null,
    cementScope: p.cementScope,
    ...overrides,
  });
}

export function newTransport(partial: Partial<TransportEntry> = {}): TransportEntry {
  return {
    id: createId("trn"),
    name: "Material delivery truck",
    vehicleCategory: "delivery_truck",
    method: "distance",
    trips: null,
    distanceKm: null,
    distanceConvention: null,
    fuelEconomyKmPerL: null,
    measuredFuelL: null,
    factor: { factorId: DEFAULT_DIESEL_FACTOR_ID },
    supplier: "",
    dataStatus: "user_provided",
    origin: "manual",
    notes: "",
    ...partial,
  };
}

export function newMachinery(partial: Partial<MachineryEntry> = {}): MachineryEntry {
  return {
    id: createId("mch"),
    name: "Site machinery",
    machineryType: "Excavators, mixers, cranes",
    method: "hours",
    hours: null,
    litresPerHour: null,
    measuredFuelL: null,
    factor: { factorId: DEFAULT_DIESEL_FACTOR_ID },
    dataStatus: "user_provided",
    origin: "manual",
    notes: "",
    ...partial,
  };
}

export function newBuilding(partial: Partial<BuildingGroup> = {}): BuildingGroup {
  return {
    id: createId("bld"),
    name: "Building 1",
    count: 1,
    identicalConfirmed: false,
    floors: null,
    areaPerFloorM2: null,
    materials: [],
    transport: [],
    machinery: [],
    ...partial,
  };
}

export function newProject(partial: Partial<Project> = {}, library?: EmissionFactor[]): Project {
  const now = new Date().toISOString();
  return {
    schemaVersion: 1,
    id: createId("prj"),
    name: "Untitled project",
    createdAt: now,
    updatedAt: now,
    archived: false,
    location: { country: "India", state: "", city: "" },
    buildingType: "bungalow",
    buildingTypeOther: "",
    constructionStatus: "planning",
    inputMode: "material",
    boundary: "construction_stage",
    profile: "report_master",
    defaultFactorLevel: "central",
    stages: cloneDefaultStages(),
    buildings: [newBuilding()],
    factors: library ? structuredClone(library) : cloneReferenceFactors(),
    factorDatasetVersion: FACTOR_DATASET_VERSION,
    isSample: false,
    notes: "",
    ...partial,
  };
}
