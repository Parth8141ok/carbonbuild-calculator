import { z } from "zod";

/**
 * Structural validation for projects loaded from storage or imported from a file.
 * Semantic checks (negative quantities, missing densities, overlapping factors)
 * are made by the engine, which reports them per entry instead of rejecting the project.
 */
const num = z.number().finite().nullable();
const dataStatus = z.enum(["measured", "user_provided", "estimated", "assumed"]);
const origin = z.enum(["manual", "estimator", "sample", "import"]);
const level = z.enum(["low", "central", "high"]);
const factorRef = z.object({ factorId: z.string().min(1), level: level.optional() });

export const emissionFactorSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  category: z.enum(["cement", "concrete", "steel", "masonry", "fuel", "transport", "other"]),
  unit: z.enum(["kgCO2e/kg", "kgCO2e/t", "kgCO2e/L", "kgCO2e/tkm"]),
  value: z.number().finite().nonnegative(),
  range: z
    .object({ low: z.number().finite().nonnegative(), high: z.number().finite().nonnegative() })
    .refine((r) => r.low <= r.high, "Range low must not exceed high")
    .optional(),
  specification: z.string(),
  geography: z.string(),
  source: z.string(),
  sourceDocument: z.string().optional(),
  sourceLocation: z.string().optional(),
  version: z.string(),
  lifecycleModules: z.array(z.enum(["A1-A3", "A4", "A5", "C2-C4"])),
  boundaryStated: z.boolean(),
  boundaryNotes: z.string(),
  intendedUse: z.string(),
  status: z.enum(["reference", "user", "verified_external", "illustrative"]),
  generic: z.boolean(),
});

export const materialEntrySchema = z.object({
  id: z.string().min(1),
  stageId: z.string().min(1),
  category: z.enum(["concrete", "cement", "steel", "masonry", "other"]),
  name: z.string(),
  specification: z.string(),
  quantity: num,
  unit: z.enum(["kg", "t", "m3", "bricks", "m3_brickwork"]),
  densityKgPerM3: num,
  bricksPerM3: num,
  brickMassKg: num,
  wastePercent: num,
  wasteSource: z.enum(["reference", "user", "measured"]),
  factors: z.array(factorRef),
  installedFactor: factorRef.nullable(),
  dataStatus,
  cementScope: z.enum(["standalone", "in_concrete"]).optional(),
  origin,
  notes: z.string(),
});

export const transportEntrySchema = z.object({
  id: z.string().min(1),
  name: z.string(),
  vehicleCategory: z.enum(["rmc_transit_mixer", "delivery_truck", "other"]),
  method: z.enum(["distance", "measured_fuel", "tonne_km"]),
  transportMode: z.enum(["road", "rail", "water", "other"]).optional(),
  cargo: z.string().optional(),
  massTonnes: num.optional(),
  trips: num,
  distanceKm: num,
  distanceConvention: z.enum(["one_way", "round_trip"]).nullable(),
  fuelEconomyKmPerL: num,
  measuredFuelL: num,
  factor: factorRef,
  supplier: z.string(),
  dataStatus,
  origin,
  notes: z.string(),
});

export const machineryEntrySchema = z.object({
  id: z.string().min(1),
  name: z.string(),
  machineryType: z.string(),
  method: z.enum(["hours", "measured_fuel"]),
  hours: num,
  litresPerHour: num,
  measuredFuelL: num,
  factor: factorRef,
  dataStatus,
  origin,
  notes: z.string(),
});

export const buildingSchema = z.object({
  id: z.string().min(1),
  name: z.string(),
  count: z.number().int().min(1),
  identicalConfirmed: z.boolean(),
  floors: num,
  areaPerFloorM2: num,
  materials: z.array(materialEntrySchema),
  transport: z.array(transportEntrySchema),
  machinery: z.array(machineryEntrySchema),
});

export const projectSchema = z.object({
  schemaVersion: z.literal(1),
  id: z.string().min(1),
  name: z.string(),
  createdAt: z.string(),
  updatedAt: z.string(),
  archived: z.boolean(),
  location: z.object({ country: z.string(), state: z.string(), city: z.string() }),
  buildingType: z.enum(["bungalow", "independent_house", "apartment", "commercial", "industrial", "institutional", "other"]),
  buildingTypeOther: z.string(),
  constructionStatus: z.enum(["planning", "ongoing", "completed"]),
  inputMode: z.enum(["quick", "material", "detailed"]),
  boundary: z.enum(["construction_stage", "expanded"]),
  profile: z.enum(["report_master", "foundation_inclusive"]),
  defaultFactorLevel: level,
  stages: z.array(z.object({ id: z.string().min(1), name: z.string(), builtIn: z.boolean() })),
  buildings: z.array(buildingSchema).min(1),
  factors: z.array(emissionFactorSchema),
  factorDatasetVersion: z.string(),
  isSample: z.boolean(),
  notes: z.string(),
  assessmentPeriod: z.string().optional(),
  sections: z.object({ transport: z.boolean(), machinery: z.boolean() }).optional(),
});

/** Validates a factor entered by a user. A source and a boundary statement are required. */
export const userFactorInputSchema = z
  .object({
    name: z.string().trim().min(1, "Name is required"),
    category: emissionFactorSchema.shape.category,
    unit: emissionFactorSchema.shape.unit,
    value: z.number({ error: "Enter a number" }).finite().nonnegative("Factors cannot be negative"),
    low: z.number().finite().nonnegative().nullable(),
    high: z.number().finite().nonnegative().nullable(),
    specification: z.string(),
    geography: z.string(),
    source: z.string().trim().min(1, "Record where the value comes from"),
    sourceDocument: z.string(),
    version: z.string(),
    lifecycleModules: emissionFactorSchema.shape.lifecycleModules,
    boundaryNotes: z.string(),
    status: z.enum(["user", "verified_external"]),
  })
  .superRefine((v, ctx) => {
    if ((v.low === null) !== (v.high === null)) ctx.addIssue({ code: "custom", message: "Give both low and high, or neither", path: ["low"] });
    if (v.low !== null && v.high !== null) {
      if (v.low > v.high) ctx.addIssue({ code: "custom", message: "Low must not exceed high", path: ["low"] });
      if (v.value < v.low || v.value > v.high) ctx.addIssue({ code: "custom", message: "Central value must lie within the range", path: ["value"] });
    }
    if (v.category === "fuel" && v.unit !== "kgCO2e/L") ctx.addIssue({ code: "custom", message: "Fuel factors must be per litre", path: ["unit"] });
    if (v.category === "transport" && v.unit !== "kgCO2e/tkm") ctx.addIssue({ code: "custom", message: "Transport factors must be per tonne-km", path: ["unit"] });
    if (v.category !== "fuel" && v.category !== "transport" && (v.unit === "kgCO2e/L" || v.unit === "kgCO2e/tkm"))
      ctx.addIssue({ code: "custom", message: "Material factors must be per kg or per tonne", path: ["unit"] });
  });

export type UserFactorInput = z.infer<typeof userFactorInputSchema>;
