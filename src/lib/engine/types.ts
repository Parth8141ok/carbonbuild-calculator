/**
 * Domain types for the CarbonBuild calculation engine.
 *
 * User inputs (Project and its entries), reference data (EmissionFactor) and
 * calculation outputs (ProjectResult) are deliberately kept as separate types.
 */

// ---------------------------------------------------------------------------
// Reference data
// ---------------------------------------------------------------------------

/** EN 15978 life-cycle modules referenced by the study. */
export type LifecycleModule = "A1-A3" | "A4" | "A5" | "C2-C4";

export type FactorUnit = "kgCO2e/kg" | "kgCO2e/t" | "kgCO2e/L" | "kgCO2e/tkm";
export type FactorCategory = "cement" | "concrete" | "steel" | "masonry" | "fuel" | "transport" | "other";
/**
 * reference: derived from the project reports (source-derived);
 * user: entered by a user; verified_external: a verified external value such as a third-party EPD;
 * illustrative: an order-of-magnitude placeholder that must be verified before use.
 */
export type FactorStatus = "reference" | "user" | "verified_external" | "illustrative";
export type FactorLevel = "low" | "central" | "high";

export interface EmissionFactor {
  id: string;
  name: string;
  category: FactorCategory;
  unit: FactorUnit;
  /** Point value, or the central estimate when a range is given. */
  value: number;
  /** Present only when the source gives a range rather than a single value. */
  range?: { low: number; high: number };
  specification: string;
  geography: string;
  source: string;
  sourceDocument?: string;
  sourceLocation?: string;
  /** Version or date of the value. */
  version: string;
  /** Modules covered by the factor. An empty list means the boundary is unknown. */
  lifecycleModules: LifecycleModule[];
  /** Whether the source explicitly states the system boundary. */
  boundaryStated: boolean;
  boundaryNotes: string;
  intendedUse: string;
  status: FactorStatus;
  /** Generic literature value rather than a study-specific or supplier-specific one. */
  generic: boolean;
}

// ---------------------------------------------------------------------------
// User inputs
// ---------------------------------------------------------------------------

export type DataStatus = "measured" | "user_provided" | "estimated" | "assumed";
export type MaterialCategory = "concrete" | "cement" | "steel" | "masonry" | "other";
export type QuantityUnit = "kg" | "t" | "m3" | "bricks" | "m3_brickwork";
export type EntryOrigin = "manual" | "estimator" | "sample" | "import";

export interface Stage {
  id: string;
  name: string;
  builtIn: boolean;
}

export interface FactorRef {
  factorId: string;
  /** Range level; when omitted the project's default level is used. Ignored for point values. */
  level?: FactorLevel;
}

export interface MaterialEntry {
  id: string;
  stageId: string;
  category: MaterialCategory;
  name: string;
  specification: string;
  quantity: number | null;
  unit: QuantityUnit;
  densityKgPerM3: number | null;
  bricksPerM3: number | null;
  brickMassKg: number | null;
  wastePercent: number | null;
  wasteSource: "reference" | "user" | "measured";
  /** Factor components applied to the wasted mass. Multiple components are summed. */
  factors: FactorRef[];
  /** Production (A1–A3) factor for installed material; used only with the expanded boundary. */
  installedFactor: FactorRef | null;
  dataStatus: DataStatus;
  /** Cement only: whether this cement is a standalone material or already contained in a concrete entry. */
  cementScope?: "standalone" | "in_concrete";
  origin: EntryOrigin;
  notes: string;
}

export type VehicleCategory = "rmc_transit_mixer" | "delivery_truck" | "other";
export type TransportMode = "road" | "rail" | "water" | "other";

export interface TransportEntry {
  id: string;
  name: string;
  vehicleCategory: VehicleCategory;
  /**
   * distance: trips × distance ÷ fuel economy → litres × fuel factor.
   * measured_fuel: litres from fuel records × fuel factor.
   * tonne_km: transported mass (t) × distance (km) × factor per tonne-km.
   */
  method: "distance" | "measured_fuel" | "tonne_km";
  transportMode?: TransportMode;
  /** Material or cargo carried. */
  cargo?: string;
  /** Transported mass in tonnes, for the tonne-km method. */
  massTonnes?: number | null;
  trips: number | null;
  distanceKm: number | null;
  distanceConvention: "one_way" | "round_trip" | null;
  fuelEconomyKmPerL: number | null;
  measuredFuelL: number | null;
  factor: FactorRef;
  supplier: string;
  dataStatus: DataStatus;
  origin: EntryOrigin;
  notes: string;
}

export interface MachineryEntry {
  id: string;
  name: string;
  machineryType: string;
  method: "hours" | "measured_fuel";
  hours: number | null;
  litresPerHour: number | null;
  measuredFuelL: number | null;
  factor: FactorRef;
  dataStatus: DataStatus;
  origin: EntryOrigin;
  notes: string;
}

export interface BuildingGroup {
  id: string;
  name: string;
  /** Number of buildings in this group. */
  count: number;
  /** The user confirms that all buildings in the group share the same quantities and activities. */
  identicalConfirmed: boolean;
  floors: number | null;
  areaPerFloorM2: number | null;
  materials: MaterialEntry[];
  transport: TransportEntry[];
  machinery: MachineryEntry[];
}

export type CalculationProfile = "report_master" | "foundation_inclusive";
export type AssessmentBoundary = "construction_stage" | "expanded";
export type InputMode = "quick" | "material" | "detailed";
export type BuildingType =
  | "bungalow"
  | "independent_house"
  | "apartment"
  | "commercial"
  | "industrial"
  | "institutional"
  | "other";

export interface Project {
  schemaVersion: 1;
  id: string;
  name: string;
  createdAt: string;
  updatedAt: string;
  archived: boolean;
  location: { country: string; state: string; city: string };
  buildingType: BuildingType;
  buildingTypeOther: string;
  constructionStatus: "planning" | "ongoing" | "completed";
  inputMode: InputMode;
  boundary: AssessmentBoundary;
  profile: CalculationProfile;
  defaultFactorLevel: FactorLevel;
  stages: Stage[];
  buildings: BuildingGroup[];
  /** Snapshot of the factor library used by this project. */
  factors: EmissionFactor[];
  factorDatasetVersion: string;
  isSample: boolean;
  /** Project description. */
  notes: string;
  /** Optional assessment period, e.g. "Jan 2026 – Dec 2026". */
  assessmentPeriod?: string;
  /** Optional sections that can be left out when no data is available. Missing means included. */
  sections?: { transport: boolean; machinery: boolean };
}

// ---------------------------------------------------------------------------
// Results
// ---------------------------------------------------------------------------

export type FlagSeverity = "error" | "warning" | "info";

export interface Flag {
  code: string;
  severity: FlagSeverity;
  message: string;
  entryId?: string;
  buildingId?: string;
}

/** One step of the audit trail: the formula, the numbers substituted into it and the result. */
export interface CalcStep {
  label: string;
  formula: string;
  substitution: string;
  value: number;
  unit: string;
}

export interface ResolvedFactor {
  factorId: string;
  name: string;
  /** Converted value in kg CO2e per kg (materials) or per litre (fuel). */
  value: number;
  originalValue: number;
  originalUnit: FactorUnit;
  level: FactorLevel | "point";
  source: string;
  sourceLocation?: string;
  lifecycleModules: LifecycleModule[];
  boundaryStated: boolean;
  boundaryNotes: string;
  status: FactorStatus;
  generic: boolean;
}

export type EmissionCategory = "material_waste" | "transport" | "machinery" | "installed_embodied";
export type LineKind = "material" | "installed" | "transport" | "machinery";

export interface LineResult {
  /** Unique within a result: building id, entry id and kind. */
  id: string;
  entryId: string;
  buildingId: string;
  buildingName: string;
  multiplier: number;
  kind: LineKind;
  emissionCategory: EmissionCategory;
  stageId: string | null;
  stageName: string;
  materialCategory: MaterialCategory | "fuel";
  name: string;
  specification: string;
  inputQuantity: number | null;
  inputUnit: string;
  totalMassKg: number | null;
  wastePercent: number | null;
  wastedMassKg: number | null;
  brickCount: number | null;
  wastedBricks: number | null;
  distanceKm: number | null;
  tonneKm: number | null;
  dieselLitres: number | null;
  factorComponents: ResolvedFactor[];
  /** Waste emissions split by the life-cycle modules of each factor component. */
  wasteSplit: WasteSplit | null;
  effectiveFactor: number | null;
  effectiveFactorUnit: "kgCO2e/kg" | "kgCO2e/L" | "kgCO2e/tkm";
  emissionsPerBuildingKg: number;
  emissionsKg: number;
  valid: boolean;
  included: boolean;
  exclusionReason: string | null;
  /** Fraction (0–1) of the included total; 0 for excluded lines. */
  share: number;
  dataStatus: DataStatus;
  wasteSource: MaterialEntry["wasteSource"] | null;
  steps: CalcStep[];
  flags: Flag[];
}

/**
 * production: factor components covering A1–A3 only (production of the wasted material).
 * treatment: components covering C2–C4 only (waste processing and disposal).
 * combined: a single factor covering both, which cannot be separated.
 * unclassified: components whose boundary is not stated.
 */
export interface WasteSplit {
  production: number;
  treatment: number;
  combined: number;
  unclassified: number;
}

export interface Breakdown {
  key: string;
  label: string;
  kg: number;
}

export interface StageBreakdown {
  stageId: string;
  stageName: string;
  kg: number;
  byMaterial: Record<MaterialCategory, number>;
}

export interface BuildingBreakdown {
  buildingId: string;
  name: string;
  count: number;
  multiplier: number;
  perBuildingKg: number;
  totalKg: number;
  areaM2: number | null;
  byCategory: Record<EmissionCategory, number>;
}

export interface ProjectTotals {
  totalKg: number;
  totalTonnes: number;
  constructionStageKg: number;
  installedEmbodiedKg: number;
  materialWasteKg: number;
  transportKg: number;
  machineryKg: number;
  /** Valid emissions left out by the selected profile. */
  excludedByProfileKg: number;
  dieselLitres: number;
  tonneKm: number;
  /** Waste emissions by life-cycle split (sums to materialWasteKg). */
  waste: WasteSplit;
  /** Buildings actually counted (sum of group multipliers). */
  buildingsCounted: number;
  perBuildingKg: number | null;
  builtUpAreaM2: number | null;
  intensityKgPerM2: number | null;
  constructionIntensityKgPerM2: number | null;
}

export interface DataQualitySummary {
  inputCounts: Record<DataStatus, number>;
  emissionsByStatus: Record<DataStatus, number>;
  factorStatusCounts: Record<FactorStatus, number>;
  wasteSourceCounts: Record<"reference" | "user" | "measured", number>;
  genericFactorKg: number;
  boundaryUncertainKg: number;
}

export interface ProjectResult {
  engineVersion: string;
  factorDatasetVersion: string;
  profile: CalculationProfile;
  boundary: AssessmentBoundary;
  defaultFactorLevel: FactorLevel;
  lines: LineResult[];
  totals: ProjectTotals;
  /** Included total under each profile, so the alternative can always be shown. */
  profileTotals: Record<CalculationProfile, number>;
  byStage: StageBreakdown[];
  byMaterialCategory: Breakdown[];
  byEmissionCategory: Breakdown[];
  /** Report-style components: one per material stage plus each fuel activity. */
  bySource: (Breakdown & { emissionCategory: EmissionCategory })[];
  byBuilding: BuildingBreakdown[];
  dataQuality: DataQualitySummary;
  /** Which EN 15978 modules this result covers. */
  coverage: CoverageRow[];
  excludedSections: ("transport" | "machinery")[];
  flags: Flag[];
  hasErrors: boolean;
}

export interface CoverageRow {
  module: string;
  label: string;
  status: "included" | "partial" | "excluded";
  note: string;
}
