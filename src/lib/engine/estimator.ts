import { fmt } from "../format";
import { DEFAULT_DIESEL_FACTOR_ID, templateFactorIds } from "./factors";
import { REFERENCE_WASTE, createId } from "./factories";
import type { DataStatus, MachineryEntry, MaterialEntry, TransportEntry } from "./types";
import { isNonNegativeFinite, isPositiveFinite } from "./units";

/**
 * Reference-bungalow ratios (BIM report Tables 9.2 and 9.9). They scale the
 * study's quantities linearly with floor area and are only a disclosed
 * assumption for buildings similar to the reference: low-rise RCC frame with
 * brick infill. Built from the reported values so the arithmetic stays exact.
 */
export const REF = {
  footprintM2: 110,
  floors: 3,
  foundationConcreteM3: 45,
  plinthConcreteM3: 14,
  plinthSteelKg: 1100,
  frameConcretePerFloorM3: 24,
  frameSteelPerFloorKg: 2600,
  slabBeamAllowancePerFloorM3: 2.25,
  slabSteelKg: 4200,
  wallLengthPerFloorM: 140,
  deliveryTrips: 45,
  machineryHours: 120,
} as const;

export const REFERENCE_RATIOS = {
  foundationConcretePerFootprint: REF.foundationConcreteM3 / REF.footprintM2,
  plinthConcretePerFootprint: REF.plinthConcreteM3 / REF.footprintM2,
  plinthSteelPerFootprint: REF.plinthSteelKg / REF.footprintM2,
  frameConcretePerFloorArea: REF.frameConcretePerFloorM3 / REF.footprintM2,
  frameSteelPerFloorArea: REF.frameSteelPerFloorKg / REF.footprintM2,
  slabBeamAllowancePerFloorArea: REF.slabBeamAllowancePerFloorM3 / REF.footprintM2,
  slabSteelPerFloorArea: REF.slabSteelKg / (REF.footprintM2 * REF.floors),
  wallLengthPerFootprint: REF.wallLengthPerFloorM / REF.footprintM2,
  deliveryTripsPerBuiltUpArea: REF.deliveryTrips / (REF.footprintM2 * REF.floors),
  machineryHoursPerBuiltUpArea: REF.machineryHours / (REF.footprintM2 * REF.floors),
};

export interface EstimatorInput {
  footprintM2: number | null;
  floors: number | null;
  clearWallHeightM: number | null;
  slabThicknessM: number | null;
  /** Beam projection within the slab zone, per floor. Null uses the reference ratio. */
  beamAllowancePerFloorM3: number | null;
  wallThicknessM: number | null;
  /** Total wall length per floor. Null uses the reference ratio. */
  wallLengthPerFloorM: number | null;
  openingsPercent: number | null;
  bricksPerM3: number | null;
  brickMassKg: number | null;
  densityKgPerM3: number | null;
  /** Quantities the user already knows. Each overrides the estimate. */
  known: {
    foundationConcreteM3: number | null;
    plinthConcreteM3: number | null;
    frameConcreteM3: number | null;
    slabConcreteM3: number | null;
    plinthSteelKg: number | null;
    frameSteelKg: number | null;
    slabSteelKg: number | null;
    brickCount: number | null;
  };
  /** Use reference-bungalow ratios for quantities that cannot be derived from dimensions. */
  useReferenceRatios: boolean;
  includeFoundation: boolean;
  estimateLogistics: boolean;
  includeFoundationInRmc: boolean;
  rmcCapacityM3: number;
  rmcRoundTripKm: number;
  rmcKmPerL: number;
  deliveryRoundTripKm: number;
  deliveryKmPerL: number;
  machineryLPerH: number;
}

export function defaultEstimatorInput(footprintM2: number | null = null, floors: number | null = null): EstimatorInput {
  return {
    footprintM2,
    floors,
    clearWallHeightM: 2.85,
    slabThicknessM: 0.125,
    beamAllowancePerFloorM3: null,
    wallThicknessM: 0.23,
    wallLengthPerFloorM: null,
    openingsPercent: 25,
    bricksPerM3: 500,
    brickMassKg: 3,
    densityKgPerM3: 2400,
    known: {
      foundationConcreteM3: null,
      plinthConcreteM3: null,
      frameConcreteM3: null,
      slabConcreteM3: null,
      plinthSteelKg: null,
      frameSteelKg: null,
      slabSteelKg: null,
      brickCount: null,
    },
    useReferenceRatios: true,
    includeFoundation: true,
    estimateLogistics: true,
    includeFoundationInRmc: false,
    rmcCapacityM3: 7,
    rmcRoundTripKm: 30,
    rmcKmPerL: 2.5,
    deliveryRoundTripKm: 40,
    deliveryKmPerL: 3.5,
    machineryLPerH: 4.5,
  };
}

export type EstimateStatus = Exclude<DataStatus, "measured"> | "missing";

export interface EstimatedQuantity {
  key: string;
  stageId: string;
  label: string;
  value: number | null;
  unit: string;
  status: EstimateStatus;
  /** Formula with the numbers substituted, or the reason the value is missing. */
  basis: string;
}

export interface EstimatorOutput {
  quantities: EstimatedQuantity[];
  materials: MaterialEntry[];
  transport: TransportEntry[];
  machinery: MachineryEntry[];
  warnings: string[];
}

function known(v: number | null): v is number {
  return isNonNegativeFinite(v);
}

export function estimateQuantities(input: EstimatorInput): EstimatorOutput {
  const q: EstimatedQuantity[] = [];
  const warnings: string[] = [];
  const A = isPositiveFinite(input.footprintM2) ? input.footprintM2 : null;
  const N = isPositiveFinite(input.floors) && Number.isInteger(input.floors) ? input.floors : null;
  const R = REFERENCE_RATIOS;
  const ratios = input.useReferenceRatios;

  if (A === null) warnings.push("Enter the footprint area per floor to estimate quantities.");
  if (N === null) warnings.push("Enter the number of floors as a whole number.");

  const missing = (key: string, stageId: string, label: string, unit: string, why: string): EstimatedQuantity => ({ key, stageId, label, value: null, unit, status: "missing", basis: why });
  const user = (key: string, stageId: string, label: string, value: number, unit: string): EstimatedQuantity => ({ key, stageId, label, value, unit, status: "user_provided", basis: "Entered by you" });
  const noRatio = "Cannot be derived from the building dimensions. Enter it, or allow reference ratios.";

  // Foundation
  if (input.includeFoundation) {
    if (known(input.known.foundationConcreteM3)) q.push(user("foundationConcrete", "foundation", "Foundation concrete", input.known.foundationConcreteM3, "m³"));
    else if (ratios && A !== null)
      q.push({ key: "foundationConcrete", stageId: "foundation", label: "Foundation concrete", value: R.foundationConcretePerFootprint * A, unit: "m³", status: "assumed", basis: `Reference ratio 45 m³ per 110 m² footprint = ${fmt(R.foundationConcretePerFootprint)} m³/m² × ${fmt(A)} m²` });
    else q.push(missing("foundationConcrete", "foundation", "Foundation concrete", "m³", noRatio));
  }

  // Plinth
  if (known(input.known.plinthConcreteM3)) q.push(user("plinthConcrete", "plinth", "Plinth concrete", input.known.plinthConcreteM3, "m³"));
  else if (ratios && A !== null)
    q.push({ key: "plinthConcrete", stageId: "plinth", label: "Plinth concrete", value: R.plinthConcretePerFootprint * A, unit: "m³", status: "assumed", basis: `Reference ratio 14 m³ per 110 m² footprint = ${fmt(R.plinthConcretePerFootprint)} m³/m² × ${fmt(A)} m²` });
  else q.push(missing("plinthConcrete", "plinth", "Plinth concrete", "m³", noRatio));

  if (known(input.known.plinthSteelKg)) q.push(user("plinthSteel", "plinth", "Plinth reinforcement steel", input.known.plinthSteelKg, "kg"));
  else if (ratios && A !== null)
    q.push({ key: "plinthSteel", stageId: "plinth", label: "Plinth reinforcement steel", value: R.plinthSteelPerFootprint * A, unit: "kg", status: "assumed", basis: `Reference ratio 1,100 kg per 110 m² footprint = ${fmt(R.plinthSteelPerFootprint)} kg/m² × ${fmt(A)} m²` });
  else q.push(missing("plinthSteel", "plinth", "Plinth reinforcement steel", "kg", noRatio));

  // Columns and beams
  if (known(input.known.frameConcreteM3)) q.push(user("frameConcrete", "columns_beams", "Columns and beams concrete", input.known.frameConcreteM3, "m³"));
  else if (ratios && A !== null && N !== null)
    q.push({ key: "frameConcrete", stageId: "columns_beams", label: "Columns and beams concrete", value: R.frameConcretePerFloorArea * A * N, unit: "m³", status: "assumed", basis: `Reference ratio 24 m³ per 110 m² floor = ${fmt(R.frameConcretePerFloorArea)} m³/m² × ${fmt(A)} m² × ${N} floors` });
  else q.push(missing("frameConcrete", "columns_beams", "Columns and beams concrete", "m³", noRatio));

  if (known(input.known.frameSteelKg)) q.push(user("frameSteel", "columns_beams", "Columns and beams steel", input.known.frameSteelKg, "kg"));
  else if (ratios && A !== null && N !== null)
    q.push({ key: "frameSteel", stageId: "columns_beams", label: "Columns and beams steel", value: R.frameSteelPerFloorArea * A * N, unit: "kg", status: "assumed", basis: `Reference ratio 2,600 kg per 110 m² floor = ${fmt(R.frameSteelPerFloorArea)} kg/m² × ${fmt(A)} m² × ${N} floors` });
  else q.push(missing("frameSteel", "columns_beams", "Columns and beams steel", "kg", noRatio));

  // Slabs: derived from dimensions where possible
  if (known(input.known.slabConcreteM3)) q.push(user("slabConcrete", "slabs", "Slab concrete", input.known.slabConcreteM3, "m³"));
  else if (A !== null && N !== null && isPositiveFinite(input.slabThicknessM)) {
    const t = input.slabThicknessM;
    let allowance: number | null = null;
    let allowanceText = "";
    let status: EstimateStatus = "estimated";
    if (known(input.beamAllowancePerFloorM3)) {
      allowance = input.beamAllowancePerFloorM3;
      allowanceText = `${fmt(allowance)} m³ (entered)`;
    } else if (ratios) {
      allowance = R.slabBeamAllowancePerFloorArea * A;
      allowanceText = `${fmt(allowance)} m³ (reference ratio 2.25 m³ per 110 m²)`;
      status = "assumed";
    } else {
      allowance = 0;
      allowanceText = "0 m³ (no beam projection allowance)";
    }
    const v = (A * t + allowance) * N;
    q.push({
      key: "slabConcrete",
      stageId: "slabs",
      label: "Slab concrete",
      value: v,
      unit: "m³",
      status,
      basis: `Slab volume = (slab area × thickness + beam allowance) × floors = (${fmt(A)} × ${fmt(t)} + ${allowanceText}) × ${N}`,
    });
  } else q.push(missing("slabConcrete", "slabs", "Slab concrete", "m³", "Needs footprint, floors and slab thickness."));

  if (known(input.known.slabSteelKg)) q.push(user("slabSteel", "slabs", "Slab reinforcement steel", input.known.slabSteelKg, "kg"));
  else if (ratios && A !== null && N !== null)
    q.push({ key: "slabSteel", stageId: "slabs", label: "Slab reinforcement steel", value: R.slabSteelPerFloorArea * A * N, unit: "kg", status: "assumed", basis: `Reference ratio 4,200 kg per 330 m² of slab = ${fmt(R.slabSteelPerFloorArea)} kg/m² × ${fmt(A)} m² × ${N} floors` });
  else q.push(missing("slabSteel", "slabs", "Slab reinforcement steel", "kg", noRatio));

  // Walls
  let brickBasis: EstimatedQuantity | null = null;
  if (known(input.known.brickCount)) {
    brickBasis = user("bricks", "walls", "Clay bricks", input.known.brickCount, "bricks");
  } else if (N !== null && isPositiveFinite(input.clearWallHeightM) && isPositiveFinite(input.wallThicknessM) && isNonNegativeFinite(input.openingsPercent) && input.openingsPercent <= 100 && isPositiveFinite(input.bricksPerM3)) {
    let L: number | null = null;
    let lText = "";
    let status: EstimateStatus = "estimated";
    if (known(input.wallLengthPerFloorM)) {
      L = input.wallLengthPerFloorM;
      lText = fmt(L);
    } else if (ratios && A !== null) {
      L = R.wallLengthPerFootprint * A;
      lText = `${fmt(L)} (reference ratio 140 m per 110 m²)`;
      status = "assumed";
    }
    if (L !== null) {
      const h = input.clearWallHeightM;
      const th = input.wallThicknessM;
      const o = input.openingsPercent / 100;
      const gross = L * h * th;
      const net = gross * (1 - o) * N;
      q.push({
        key: "brickwork",
        stageId: "walls",
        label: "Net brickwork volume",
        value: net,
        unit: "m³",
        status,
        basis: `Net brickwork = wall length × height × thickness × (1 − openings) × floors = ${lText} × ${fmt(h)} × ${fmt(th)} × (1 − ${fmt(o)}) × ${N}`,
      });
      brickBasis = {
        key: "bricks",
        stageId: "walls",
        label: "Clay bricks",
        value: net * input.bricksPerM3,
        unit: "bricks",
        status,
        basis: `Bricks = net brickwork × bricks per m³ = ${fmt(net)} × ${fmt(input.bricksPerM3)}`,
      };
    } else {
      brickBasis = missing("bricks", "walls", "Clay bricks", "bricks", "Enter the total wall length per floor, or allow reference ratios.");
    }
  } else {
    brickBasis = missing("bricks", "walls", "Clay bricks", "bricks", "Needs floors, wall height, wall thickness, openings and bricks per m³.");
  }
  q.push(brickBasis);

  // Build material entries
  const density = isPositiveFinite(input.densityKgPerM3) ? input.densityKgPerM3 : 2400;
  const brickMass = isPositiveFinite(input.brickMassKg) ? input.brickMassKg : null;
  if (brickMass === null) warnings.push("Enter the mass of one brick to calculate brick emissions.");

  const materials: MaterialEntry[] = [];
  const add = (key: string, category: "concrete" | "steel" | "masonry", name: string) => {
    const e = q.find((x) => x.key === key);
    if (!e || e.value === null || e.status === "missing") return;
    const waste = REFERENCE_WASTE[e.stageId];
    const wastePercent = category === "concrete" ? waste.concrete : category === "steel" ? waste.steel : waste.masonry;
    const base = {
      id: createId("est"),
      stageId: e.stageId,
      category,
      name,
      specification: "",
      quantity: e.value,
      wastePercent,
      wasteSource: "reference" as const,
      factors: templateFactorIds(e.stageId, category).map((factorId) => ({ factorId })),
      dataStatus: e.status as DataStatus,
      origin: "estimator" as const,
      notes: e.basis,
    };
    if (category === "concrete") {
      materials.push({ ...base, unit: "m3", densityKgPerM3: density, bricksPerM3: null, brickMassKg: null, installedFactor: { factorId: "concrete_a1a3_bim" } });
    } else if (category === "steel") {
      materials.push({ ...base, unit: "kg", densityKgPerM3: null, bricksPerM3: null, brickMassKg: null, installedFactor: { factorId: "rebar_ch3" } });
    } else {
      materials.push({ ...base, unit: "bricks", densityKgPerM3: null, bricksPerM3: null, brickMassKg: brickMass, installedFactor: { factorId: "clay_brick_bim" } });
    }
  };
  add("foundationConcrete", "concrete", "Foundation concrete (RCC)");
  add("plinthConcrete", "concrete", "Plinth concrete (RCC)");
  add("plinthSteel", "steel", "Plinth reinforcement steel");
  add("frameConcrete", "concrete", "Columns and beams concrete (RCC)");
  add("frameSteel", "steel", "Columns and beams reinforcement steel");
  add("slabConcrete", "concrete", "Slab concrete (RCC)");
  add("slabSteel", "steel", "Slab reinforcement steel");
  add("bricks", "masonry", "Burnt clay brick masonry");

  // Logistics and machinery from reference assumptions
  const transport: TransportEntry[] = [];
  const machinery: MachineryEntry[] = [];
  if (input.estimateLogistics) {
    const concreteKeys = ["plinthConcrete", "frameConcrete", "slabConcrete", ...(input.includeFoundationInRmc ? ["foundationConcrete"] : [])];
    const concrete = q.filter((x) => concreteKeys.includes(x.key) && x.value !== null).reduce((s, x) => s + (x.value ?? 0), 0);
    const anyMissing = q.some((x) => concreteKeys.includes(x.key) && x.value === null);
    if (concrete > 0 && isPositiveFinite(input.rmcCapacityM3)) {
      const trips = Math.ceil(concrete / input.rmcCapacityM3 - 1e-9);
      transport.push({
        id: createId("est"),
        name: "RMC transit mixers",
        vehicleCategory: "rmc_transit_mixer",
        method: "distance",
        trips,
        distanceKm: input.rmcRoundTripKm,
        distanceConvention: "round_trip",
        fuelEconomyKmPerL: input.rmcKmPerL,
        measuredFuelL: null,
        factor: { factorId: DEFAULT_DIESEL_FACTOR_ID },
        supplier: "",
        dataStatus: "assumed",
        origin: "estimator",
        notes: `Trips = ⌈concrete ÷ mixer capacity⌉ = ⌈${fmt(concrete)} m³ ÷ ${fmt(input.rmcCapacityM3)} m³⌉ = ${trips}${input.includeFoundationInRmc ? " (includes foundation concrete)" : " (plinth + frame + slabs, as in the reference report)"}${anyMissing ? ". Some concrete quantities are missing, so the trip count may be low." : ""}`,
      });
    }
    if (A !== null && N !== null) {
      const area = A * N;
      const trips = Math.round(R.deliveryTripsPerBuiltUpArea * area);
      transport.push({
        id: createId("est"),
        name: "Material delivery trucks",
        vehicleCategory: "delivery_truck",
        method: "distance",
        trips,
        distanceKm: input.deliveryRoundTripKm,
        distanceConvention: "round_trip",
        fuelEconomyKmPerL: input.deliveryKmPerL,
        measuredFuelL: null,
        factor: { factorId: DEFAULT_DIESEL_FACTOR_ID },
        supplier: "Steel, bricks, sand",
        dataStatus: "assumed",
        origin: "estimator",
        notes: `Reference ratio 45 trips per 330 m² built-up area = ${fmt(R.deliveryTripsPerBuiltUpArea)} trips/m² × ${fmt(area)} m², rounded to ${trips}`,
      });
      const hours = R.machineryHoursPerBuiltUpArea * area;
      machinery.push({
        id: createId("est"),
        name: "On-site machinery",
        machineryType: "Excavators, mixers, cranes",
        method: "hours",
        hours,
        litresPerHour: input.machineryLPerH,
        measuredFuelL: null,
        factor: { factorId: DEFAULT_DIESEL_FACTOR_ID },
        dataStatus: "assumed",
        origin: "estimator",
        notes: `Reference ratio 120 h per 330 m² built-up area = ${fmt(R.machineryHoursPerBuiltUpArea)} h/m² × ${fmt(area)} m²`,
      });
    }
  }

  return { quantities: q, materials, transport, machinery, warnings };
}
