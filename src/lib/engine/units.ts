import type { FactorUnit, QuantityUnit } from "./types";

export const KG_PER_TONNE = 1000;

export const QUANTITY_UNIT_LABELS: Record<QuantityUnit, string> = {
  kg: "kg",
  t: "tonnes",
  m3: "m³",
  bricks: "bricks (count)",
  m3_brickwork: "m³ of brickwork",
};

export const FACTOR_UNIT_LABELS: Record<FactorUnit, string> = {
  "kgCO2e/kg": "kg CO₂e/kg",
  "kgCO2e/t": "kg CO₂e/tonne",
  "kgCO2e/L": "kg CO₂e/litre",
  "kgCO2e/tkm": "kg CO₂e/tonne-km",
};

export function tonnesToKg(tonnes: number): number {
  return tonnes * KG_PER_TONNE;
}

export function kgToTonnes(kg: number): number {
  return kg / KG_PER_TONNE;
}

export function volumeToMassKg(volumeM3: number, densityKgPerM3: number): number {
  return volumeM3 * densityKgPerM3;
}

export function isMassBasedFactorUnit(unit: FactorUnit): boolean {
  return unit === "kgCO2e/kg" || unit === "kgCO2e/t";
}

/**
 * Converts a factor to kg CO2e per kg (mass-based) or kg CO2e per litre (fuel).
 * A factor in kg CO2e/tonne is divided by 1,000.
 */
export function normaliseFactorValue(value: number, unit: FactorUnit): number {
  return unit === "kgCO2e/t" ? value / KG_PER_TONNE : value;
}

export function isNonNegativeFinite(value: number | null | undefined): value is number {
  return typeof value === "number" && Number.isFinite(value) && value >= 0;
}

export function isPositiveFinite(value: number | null | undefined): value is number {
  return typeof value === "number" && Number.isFinite(value) && value > 0;
}
