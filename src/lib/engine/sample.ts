import { FACTOR_DATASET_VERSION, cloneReferenceFactors } from "./factors";
import { newProject } from "./factories";
import { cloneDefaultStages } from "./stages";
import type { MaterialEntry, Project, ProjectResult } from "./types";

/**
 * Reference project: ten identical three-storey RCC-framed bungalows with brick
 * infill at Surat (BIM report Tables 8.1, 9.2 and 9.9). Every quantity can be edited.
 */
export const SAMPLE_BUILDING_ID = "ref_bungalow";

export const SAMPLE_ENTRY_IDS = {
  foundationConcrete: "ref_foundation_concrete",
  plinthConcrete: "ref_plinth_concrete",
  plinthSteel: "ref_plinth_steel",
  frameConcrete: "ref_frame_concrete",
  frameSteel: "ref_frame_steel",
  slabConcrete: "ref_slab_concrete",
  slabSteel: "ref_slab_steel",
  bricks: "ref_bricks",
  rmc: "ref_rmc",
  delivery: "ref_delivery",
  machinery: "ref_machinery",
} as const;

function m(partial: Partial<MaterialEntry> & Pick<MaterialEntry, "id" | "stageId" | "category" | "name" | "quantity" | "unit" | "wastePercent" | "factors">): MaterialEntry {
  return {
    specification: "",
    densityKgPerM3: null,
    bricksPerM3: null,
    brickMassKg: null,
    wasteSource: "reference",
    installedFactor: null,
    dataStatus: "estimated",
    origin: "sample",
    notes: "",
    ...partial,
  };
}

export function createSampleProject(): Project {
  const ids = SAMPLE_ENTRY_IDS;
  return newProject({
    id: "prj_reference_sample",
    name: "Reference project: 10 bungalows, Surat",
    location: { country: "India", state: "Gujarat", city: "Surat" },
    buildingType: "bungalow",
    constructionStatus: "ongoing",
    inputMode: "detailed",
    boundary: "construction_stage",
    profile: "report_master",
    defaultFactorLevel: "central",
    stages: cloneDefaultStages(),
    factors: cloneReferenceFactors(),
    factorDatasetVersion: FACTOR_DATASET_VERSION,
    isSample: true,
    notes:
      "Quantities, waste factors and emission factors are taken from the B.Tech and BIM reports (Tables 9.2, 9.3 and 9.9). Concrete and steel quantities are estimated from the typical layout; fuel data are assumed.",
    buildings: [
      {
        id: SAMPLE_BUILDING_ID,
        name: "Bungalow (RCC frame, brick infill)",
        count: 10,
        identicalConfirmed: true,
        floors: 3,
        areaPerFloorM2: 110,
        materials: [
          m({
            id: ids.foundationConcrete,
            stageId: "foundation",
            category: "concrete",
            name: "Foundation concrete (RCC)",
            specification: "~30 MPa structural mix",
            quantity: 45,
            unit: "m3",
            densityKgPerM3: 2400,
            wastePercent: 5,
            factors: [{ factorId: "concrete_a1a3_bim" }, { factorId: "concrete_disposal_bim" }],
            installedFactor: { factorId: "concrete_a1a3_bim" },
            notes: "B.Tech report Ch. 4 / BIM Table 9.4. The report describes this 45 m³ as the 'slab/beam/column zone' of the foundation stage.",
          }),
          m({
            id: ids.plinthConcrete,
            stageId: "plinth",
            category: "concrete",
            name: "Plinth concrete (RCC)",
            specification: "Plinth beams, tie beams, 100 mm PCC/soling slab",
            quantity: 14,
            unit: "m3",
            densityKgPerM3: 2400,
            wastePercent: 6,
            factors: [{ factorId: "structural_concrete_bim" }],
            installedFactor: { factorId: "concrete_a1a3_bim" },
            notes: "BIM Table 9.5",
          }),
          m({
            id: ids.plinthSteel,
            stageId: "plinth",
            category: "steel",
            name: "Plinth reinforcement steel",
            specification: "High-tensile bars",
            quantity: 1100,
            unit: "kg",
            wastePercent: 5,
            factors: [{ factorId: "rebar_bim" }],
            installedFactor: { factorId: "rebar_ch3" },
            notes: "BIM Table 9.5",
          }),
          m({
            id: ids.frameConcrete,
            stageId: "columns_beams",
            category: "concrete",
            name: "Columns and beams concrete (RCC)",
            specification: "24 m³ per floor × 3 floors",
            quantity: 72,
            unit: "m3",
            densityKgPerM3: 2400,
            wastePercent: 6,
            factors: [{ factorId: "structural_concrete_bim" }],
            installedFactor: { factorId: "concrete_a1a3_bim" },
            notes: "BIM Table 9.6",
          }),
          m({
            id: ids.frameSteel,
            stageId: "columns_beams",
            category: "steel",
            name: "Columns and beams reinforcement steel",
            specification: "2,600 kg per floor × 3 floors",
            quantity: 7800,
            unit: "kg",
            wastePercent: 6,
            factors: [{ factorId: "rebar_bim" }],
            installedFactor: { factorId: "rebar_ch3" },
            notes: "BIM Table 9.6",
          }),
          m({
            id: ids.slabConcrete,
            stageId: "slabs",
            category: "concrete",
            name: "Slab concrete (RCC)",
            specification: "(110 m² × 0.125 m + 2.25 m³) × 3 floors",
            quantity: 48,
            unit: "m3",
            densityKgPerM3: 2400,
            wastePercent: 4,
            factors: [{ factorId: "slab_concrete_bim" }],
            installedFactor: { factorId: "concrete_a1a3_bim" },
            notes: "BIM Table 9.7",
          }),
          m({
            id: ids.slabSteel,
            stageId: "slabs",
            category: "steel",
            name: "Slab reinforcement steel",
            specification: "High-tensile bars",
            quantity: 4200,
            unit: "kg",
            wastePercent: 4,
            factors: [{ factorId: "rebar_bim" }],
            installedFactor: { factorId: "rebar_ch3" },
            notes: "BIM Table 9.7",
          }),
          m({
            id: ids.bricks,
            stageId: "walls",
            category: "masonry",
            name: "Burnt clay brick masonry",
            specification: "0.23 m walls, 2.85 m clear height, 140 m per floor, 25% openings",
            quantity: 206.5,
            unit: "m3_brickwork",
            bricksPerM3: 500,
            brickMassKg: 3,
            wastePercent: 8,
            factors: [{ factorId: "clay_brick_bim" }],
            installedFactor: { factorId: "clay_brick_bim" },
            notes: "BIM Table 9.8. Volume as reported (206.50 m³, about 103,250 bricks).",
          }),
        ],
        transport: [
          {
            id: ids.rmc,
            name: "RMC transit mixers",
            vehicleCategory: "rmc_transit_mixer",
            method: "distance",
            trips: 20,
            distanceKm: 30,
            distanceConvention: "round_trip",
            fuelEconomyKmPerL: 2.5,
            measuredFuelL: null,
            factor: { factorId: "diesel_bim" },
            supplier: "RMC plant",
            dataStatus: "assumed",
            origin: "sample",
            notes: "134 m³ (plinth + slabs + columns/beams) ÷ 7 m³ per mixer = 19.14, rounded up to 20 trips. BIM Table 9.9.",
          },
          {
            id: ids.delivery,
            name: "Material delivery trucks",
            vehicleCategory: "delivery_truck",
            method: "distance",
            trips: 45,
            distanceKm: 40,
            distanceConvention: "round_trip",
            fuelEconomyKmPerL: 3.5,
            measuredFuelL: null,
            factor: { factorId: "diesel_bim" },
            supplier: "Steel, bricks, sand",
            dataStatus: "assumed",
            origin: "sample",
            notes: "BIM Table 9.9",
          },
        ],
        machinery: [
          {
            id: ids.machinery,
            name: "On-site machinery",
            machineryType: "Excavators, mixers, cranes",
            method: "hours",
            hours: 120,
            litresPerHour: 4.5,
            measuredFuelL: null,
            factor: { factorId: "diesel_bim" },
            dataStatus: "assumed",
            origin: "sample",
            notes: "BIM Table 9.9",
          },
        ],
      },
    ],
  });
}

// ---------------------------------------------------------------------------
// Reported values (per bungalow unless stated) and reconciliation
// ---------------------------------------------------------------------------

export interface ReferenceRow {
  key: string;
  label: string;
  reported: number;
  unit: "kg CO₂e" | "L" | "kg CO₂e/m²";
  source: string;
  /** Calculates the comparable value from an engine result. */
  pick: (r: ProjectResult) => number;
  /** Shown when the engine value does not round to the reported value. */
  explanation?: string;
  level: "component" | "item" | "total";
}

const ids = SAMPLE_ENTRY_IDS;
const lineKg = (r: ProjectResult, entryId: string) =>
  r.lines.filter((l) => l.entryId === entryId && l.kind !== "installed" && l.valid).reduce((s, l) => s + l.emissionsPerBuildingKg, 0);
const lineL = (r: ProjectResult, entryId: string) =>
  r.lines.filter((l) => l.entryId === entryId && l.valid).reduce((s, l) => s + (l.dieselLitres ?? 0), 0);
const sumKg = (r: ProjectResult, entryIds: string[]) => entryIds.reduce((s, id) => s + lineKg(r, id), 0);

const MATERIAL_IDS = [ids.plinthConcrete, ids.plinthSteel, ids.frameConcrete, ids.frameSteel, ids.slabConcrete, ids.slabSteel, ids.bricks];
const FUEL_IDS = [ids.rmc, ids.delivery, ids.machinery];

const TRUNCATION_NOTE =
  "The report truncates delivery-truck diesel to 514.28 L. 1,800 km ÷ 3.5 km/L is 514.2857 L, and the engine keeps full precision.";

export const REFERENCE_ROWS: ReferenceRow[] = [
  { key: "plinth_concrete", label: "Plinth: concrete waste", reported: 286.27, unit: "kg CO₂e", source: "BIM Table 9.5", pick: (r) => lineKg(r, ids.plinthConcrete), level: "item" },
  {
    key: "plinth_steel",
    label: "Plinth: steel waste",
    reported: 105.6,
    unit: "kg CO₂e",
    source: "BIM Table 9.5 (B.Tech p.23 prints 286.27 in error, see BIM §9.11)",
    pick: (r) => lineKg(r, ids.plinthSteel),
    level: "item",
  },
  { key: "plinth", label: "Plinth level", reported: 391.87, unit: "kg CO₂e", source: "BIM Table 9.10", pick: (r) => sumKg(r, [ids.plinthConcrete, ids.plinthSteel]), level: "component" },
  { key: "frame_concrete", label: "Columns & beams: concrete waste", reported: 1472.26, unit: "kg CO₂e", source: "BIM Table 9.6", pick: (r) => lineKg(r, ids.frameConcrete), level: "item" },
  {
    key: "frame_steel",
    label: "Columns & beams: steel waste",
    reported: 898.56,
    unit: "kg CO₂e",
    source: "BIM Table 9.6 (B.Tech p.26 prints '168 kg', which should read 468 kg)",
    pick: (r) => lineKg(r, ids.frameSteel),
    level: "item",
  },
  { key: "frame", label: "Columns & beams", reported: 2370.82, unit: "kg CO₂e", source: "BIM Table 9.10", pick: (r) => sumKg(r, [ids.frameConcrete, ids.frameSteel]), level: "component" },
  { key: "slab_concrete", label: "Slabs: concrete waste", reported: 635.9, unit: "kg CO₂e", source: "BIM Table 9.7", pick: (r) => lineKg(r, ids.slabConcrete), level: "item" },
  { key: "slab_steel", label: "Slabs: steel waste", reported: 322.56, unit: "kg CO₂e", source: "BIM Table 9.7", pick: (r) => lineKg(r, ids.slabSteel), level: "item" },
  { key: "slabs", label: "Slabs", reported: 958.46, unit: "kg CO₂e", source: "BIM Table 9.10", pick: (r) => sumKg(r, [ids.slabConcrete, ids.slabSteel]), level: "component" },
  { key: "walls", label: "Wall masonry (clay bricks)", reported: 5947.2, unit: "kg CO₂e", source: "BIM Table 9.8 / 9.10", pick: (r) => lineKg(r, ids.bricks), level: "component" },
  { key: "rmc_l", label: "RMC transit mixers: diesel", reported: 240, unit: "L", source: "BIM Table 9.9", pick: (r) => lineL(r, ids.rmc), level: "item" },
  { key: "rmc", label: "RMC transit mixers", reported: 643.2, unit: "kg CO₂e", source: "BIM Table 9.9 / 9.10", pick: (r) => lineKg(r, ids.rmc), level: "component" },
  { key: "delivery_l", label: "Delivery trucks: diesel", reported: 514.28, unit: "L", source: "BIM Table 9.9", pick: (r) => lineL(r, ids.delivery), explanation: TRUNCATION_NOTE, level: "item" },
  {
    key: "delivery",
    label: "Material delivery trucks",
    reported: 1378.27,
    unit: "kg CO₂e",
    source: "BIM Table 9.9 / 9.10",
    pick: (r) => lineKg(r, ids.delivery),
    explanation: `${TRUNCATION_NOTE} 514.2857 L × 2.68 = 1,378.29 kg CO₂e.`,
    level: "component",
  },
  { key: "machinery", label: "On-site machinery", reported: 1447.2, unit: "kg CO₂e", source: "BIM Table 9.9 / 9.10", pick: (r) => lineKg(r, ids.machinery), level: "component" },
  { key: "waste_subtotal", label: "Material wastage subtotal", reported: 9668.35, unit: "kg CO₂e", source: "BIM §9.8", pick: (r) => sumKg(r, MATERIAL_IDS), level: "total" },
  {
    key: "diesel_total",
    label: "Diesel, trucks + machinery",
    reported: 1294.28,
    unit: "L",
    source: "BIM Table 8.3 / 9.9",
    pick: (r) => FUEL_IDS.reduce((s, id) => s + lineL(r, id), 0),
    explanation: "Carries the delivery-truck truncation: 240 + 514.2857 + 540 = 1,294.2857 L.",
    level: "total",
  },
  {
    key: "fuel_subtotal",
    label: "Logistics & machinery subtotal",
    reported: 3468.67,
    unit: "kg CO₂e",
    source: "BIM Table 9.9",
    pick: (r) => sumKg(r, FUEL_IDS),
    explanation: "Carries the delivery-truck truncation (+0.0157 kg CO₂e).",
    level: "total",
  },
  {
    key: "total",
    label: "Total per bungalow (master schedule)",
    reported: 13137.02,
    unit: "kg CO₂e",
    source: "BIM Table 9.10",
    pick: (r) => sumKg(r, [...MATERIAL_IDS, ...FUEL_IDS]),
    explanation:
      "The report adds its rounded components. At full precision the difference is the delivery-truck truncation (+0.0157) plus sub-cent rounding (+0.002), together +0.0177 kg CO₂e.",
    level: "total",
  },
  {
    key: "foundation",
    label: "Foundation stage (sensitivity only)",
    reported: 766.8,
    unit: "kg CO₂e",
    source: "BIM Table 9.4",
    pick: (r) => lineKg(r, ids.foundationConcrete),
    level: "component",
  },
  {
    key: "total_foundation",
    label: "Total per bungalow incl. foundation",
    reported: 13903.82,
    unit: "kg CO₂e",
    source: "BIM §9.11",
    pick: (r) => sumKg(r, [ids.foundationConcrete, ...MATERIAL_IDS, ...FUEL_IDS]),
    explanation: "Same +0.0177 kg CO₂e difference as the master total.",
    level: "total",
  },
];

export const REFERENCE_PROJECT_TOTALS = {
  masterProject: 131370.2,
  foundationInclusiveProject: 139038.2,
  intensityPerM2: 39.81,
  builtUpAreaPerBungalow: 330,
  bungalows: 10,
};

export interface ReconciliationRow {
  key: string;
  label: string;
  unit: string;
  reported: number;
  calculated: number;
  delta: number;
  matches: boolean;
  source: string;
  explanation?: string;
  level: ReferenceRow["level"];
}

/** A value matches when the engine's full-precision result rounds to the reported 2-decimal value. */
export function matchesReported(calculated: number, reported: number): boolean {
  return Math.abs(Math.round(calculated * 100) / 100 - reported) < 1e-9;
}

export function reconcileSample(result: ProjectResult): ReconciliationRow[] {
  return REFERENCE_ROWS.map((row) => {
    const calculated = row.pick(result);
    const matches = matchesReported(calculated, row.reported);
    return {
      key: row.key,
      label: row.label,
      unit: row.unit,
      reported: row.reported,
      calculated,
      delta: calculated - row.reported,
      matches,
      source: row.source,
      explanation: matches ? undefined : row.explanation,
      level: row.level,
    };
  });
}

/** Known inconsistencies in the source documents, shown on the methodology page. */
export const SOURCE_DISCREPANCIES: { title: string; detail: string; handling: string }[] = [
  {
    title: "Foundation stage left out of the master total",
    detail:
      "The foundation calculation (766.80 kg CO₂e per bungalow, BIM Table 9.4) is not part of the master compilation in Chapter 4 or Table 9.10. BIM §9.11 gives 13,903.82 kg CO₂e per bungalow as a sensitivity case that includes it.",
    handling:
      "The default 'report master schedule' profile follows Table 9.10. The 'foundation-inclusive sensitivity' profile adds the foundation, and both totals are always shown.",
  },
  {
    title: "Ambiguous description of the 45 m³ foundation volume",
    detail:
      "The B.Tech report (p.19) describes the foundation-stage volume as 'the highlighted slab/beam/column zone'. If that volume overlaps the column, beam or slab volumes, adding it would count concrete twice. The reports do not say why the foundation was left out of the master total.",
    handling: "Flagged here and kept as a separate, optional profile. Check the drawings before including it.",
  },
  {
    title: "Typing errors in Chapter 4",
    detail:
      "Columns and beams: '168 kg' of wasted steel is printed, but 7,800 kg × 6% = 468 kg, which gives the 898.56 kg CO₂e carried forward. Plinth steel: the emission is printed as 286.27 kg, but 55 kg × 1.92 = 105.60 kg CO₂e, the value carried into the total. Both are noted in BIM §9.11.",
    handling: "The engine calculates from the quantities, so it produces 468 kg and 105.60 kg CO₂e.",
  },
  {
    title: "Mislabelled fuel step in Chapter 5",
    detail:
      "The B.Tech report's 'RMC transit mixers' step shows 1,800 km ÷ 3.5 = 514.28 L, which belongs to the delivery trucks. The RMC step should read 600 km ÷ 2.5 km/L = 240 L and 643.20 kg CO₂e (BIM Table 9.9).",
    handling: "The sample uses the corrected vehicle groups from BIM Table 9.9.",
  },
  {
    title: "Truncated delivery-truck diesel",
    detail:
      "1,800 km ÷ 3.5 km/L = 514.2857 L. The report uses 514.28 L, which gives 1,378.27 instead of 1,378.29 kg CO₂e. The difference carries into the logistics subtotal and the totals.",
    handling: "The engine keeps full precision, so its per-bungalow total is 13,137.04 rather than 13,137.02 kg CO₂e. The difference is shown, not hidden.",
  },
  {
    title: "Rounded brickwork volume",
    detail:
      "140 m × 2.85 m × 0.23 m × 75% gives 68.8275 m³ per floor, or 206.4825 m³ for three floors. The report rounds this to 68.83 m³ per floor and reports 206.50 m³ (68.83 × 3 is in fact 206.49).",
    handling:
      "The sample uses the reported 206.50 m³ (103,250 bricks). The dimension-based estimator gives 206.4825 m³ and 5,946.70 kg CO₂e, a difference of 0.50 kg CO₂e.",
  },
  {
    title: "RMC trips exclude foundation concrete",
    detail:
      "RMC trips are based on 134 m³ (plinth + slabs + columns/beams), leaving out the 45 m³ foundation volume. 134 ÷ 7 = 19.14 is rounded up to 20 trips. The foundation-inclusive sensitivity in §9.11 adds only the foundation waste emissions, not the extra deliveries.",
    handling: "Reproduced as reported. The estimator has an option to count foundation concrete in RMC trips.",
  },
];
