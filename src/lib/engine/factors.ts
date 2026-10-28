import type { EmissionFactor } from "./types";

/**
 * Reference emission-factor dataset, transcribed from the two project reports:
 *  - "Carbon Footprint Assessment of Construction Projects", B.Tech Project 2026,
 *    Sarvajanik University, Surat (referred to as the B.Tech report).
 *  - Chapters 7–14, "Carbon Footprint Assessment using BIM" (referred to as the BIM report).
 *
 * Two kinds of values are kept apart:
 *  - Generic literature ranges from the materials table of Chapter 3 (generic: true).
 *  - Study-specific factors from the BIM material library, Table 9.3, which the
 *    reference template uses stage by stage.
 * They have different system boundaries and are not interchangeable.
 */
export const FACTOR_DATASET_VERSION = "CB-REF-2026.2";

const BTECH = "B.Tech report (Sarvajanik University, 2026)";
const BIM = "BIM report, Chapters 7–14 (Sarvajanik University, 2026)";
const VERSION = "2026-10";

export const REFERENCE_FACTORS: EmissionFactor[] = [
  // --- Generic ranges, B.Tech report Chapter 3 -----------------------------
  {
    id: "opc_ch3",
    name: "Ordinary Portland cement (OPC)",
    category: "cement",
    unit: "kgCO2e/kg",
    value: 0.885,
    range: { low: 0.82, high: 0.95 },
    specification: "Grade 43/53",
    geography: "General literature value; not specific to an Indian supplier",
    source: BTECH,
    sourceLocation: "Ch. 3, Materials and their base carbon factor",
    version: VERSION,
    lifecycleModules: ["A1-A3"],
    boundaryStated: false,
    boundaryNotes:
      "Listed as a 'base carbon factor'. The report does not state the boundary; treated as cradle-to-gate (A1–A3). Central value is the midpoint of the range.",
    intendedUse: "Cement entered as a standalone material (site batching), never in addition to a concrete mix that already contains it.",
    status: "reference",
    generic: true,
  },
  {
    id: "ppc_ch3",
    name: "Portland pozzolana cement (PPC)",
    category: "cement",
    unit: "kgCO2e/kg",
    value: 0.615,
    range: { low: 0.58, high: 0.65 },
    specification: "Fly ash blend (25–30% fly ash)",
    geography: "General literature value; not specific to an Indian supplier",
    source: BTECH,
    sourceLocation: "Ch. 3, Materials and their base carbon factor",
    version: VERSION,
    lifecycleModules: ["A1-A3"],
    boundaryStated: false,
    boundaryNotes:
      "Boundary not stated in the report; treated as cradle-to-gate (A1–A3). Central value is the midpoint of the range.",
    intendedUse: "Standalone cement only.",
    status: "reference",
    generic: true,
  },
  {
    id: "rmc_m25_m30_ch3",
    name: "Ready-mix concrete M25/M30",
    category: "concrete",
    unit: "kgCO2e/kg",
    value: 0.13,
    range: { low: 0.12, high: 0.14 },
    specification: "Standard M25/M30 grade",
    geography: "General literature value; not specific to an Indian supplier",
    source: BTECH,
    sourceLocation: "Ch. 3, Materials and their base carbon factor",
    version: VERSION,
    lifecycleModules: ["A1-A3"],
    boundaryStated: false,
    boundaryNotes:
      "Boundary not stated; treated as cradle-to-gate (A1–A3) and excluding waste disposal. Central value is the midpoint of the range.",
    intendedUse: "Finished concrete mix. Already includes the cement it contains.",
    status: "reference",
    generic: true,
  },
  {
    id: "hsc_m50_m60_ch3",
    name: "High-strength concrete M50/M60",
    category: "concrete",
    unit: "kgCO2e/kg",
    value: 0.2,
    range: { low: 0.18, high: 0.22 },
    specification: "M50/M60 grade",
    geography: "General literature value; not specific to an Indian supplier",
    source: BTECH,
    sourceLocation: "Ch. 3, Materials and their base carbon factor",
    version: VERSION,
    lifecycleModules: ["A1-A3"],
    boundaryStated: false,
    boundaryNotes:
      "Boundary not stated; treated as cradle-to-gate (A1–A3). Central value is the midpoint of the range.",
    intendedUse: "Finished high-strength concrete mix.",
    status: "reference",
    generic: true,
  },
  {
    id: "rebar_ch3",
    name: "Reinforcement steel (rebar), generic range",
    category: "steel",
    unit: "kgCO2e/kg",
    value: 2.1,
    range: { low: 1.8, high: 2.4 },
    specification: "Primary blast furnace / recycled scrap",
    geography: "General literature value; not specific to an Indian supplier",
    source: BTECH,
    sourceLocation: "Ch. 3, Materials and their base carbon factor; BIM report §13.3",
    version: VERSION,
    lifecycleModules: ["A1-A3"],
    boundaryStated: false,
    boundaryNotes:
      "Range depends on production route and recycled content. Boundary not stated; treated as A1–A3. Central value is the midpoint of the range.",
    intendedUse: "Reinforcement bars where a supplier-specific factor is not available.",
    status: "reference",
    generic: true,
  },
  {
    id: "structural_steel_ch3",
    name: "Structural steel sections",
    category: "steel",
    unit: "kgCO2e/kg",
    value: 2.2,
    range: { low: 1.9, high: 2.5 },
    specification: "Universal beams / I-beams",
    geography: "General literature value; not specific to an Indian supplier",
    source: BTECH,
    sourceLocation: "Ch. 3, Materials and their base carbon factor",
    version: VERSION,
    lifecycleModules: ["A1-A3"],
    boundaryStated: false,
    boundaryNotes:
      "Boundary not stated; treated as A1–A3. Central value is the midpoint of the range.",
    intendedUse: "Rolled structural sections.",
    status: "reference",
    generic: true,
  },

  // --- Study-specific factors, BIM report Table 9.3 -------------------------
  {
    id: "concrete_a1a3_bim",
    name: "Concrete production, A1–A3 (~30 MPa mix)",
    category: "concrete",
    unit: "kgCO2e/kg",
    value: 0.13,
    specification: "Institutional structural mix, about 30 MPa",
    geography: "Reference project, Surat, Gujarat",
    source: BIM,
    sourceLocation: "Table 9.3; B.Tech report Ch. 4, foundation stage",
    version: VERSION,
    lifecycleModules: ["A1-A3"],
    boundaryStated: true,
    boundaryNotes: "Production stage only (A1–A3). Combined with the C2–C4 disposal factor for the foundation stage.",
    intendedUse: "Foundation stage, together with concrete waste processing and disposal (C2–C4).",
    status: "reference",
    generic: false,
  },
  {
    id: "concrete_disposal_bim",
    name: "Concrete waste processing and disposal, C2–C4",
    category: "concrete",
    unit: "kgCO2e/kg",
    value: 0.012,
    specification: "On-site waste processing, transport and disposal",
    geography: "Reference project, Surat, Gujarat",
    source: BIM,
    sourceLocation: "Table 9.3; B.Tech report Ch. 4, foundation stage",
    version: VERSION,
    lifecycleModules: ["C2-C4"],
    boundaryStated: true,
    boundaryNotes: "End-of-life modules for the wasted material only. Must be added to a production-only factor, never to one that already includes disposal.",
    intendedUse: "Foundation stage, added to concrete production A1–A3.",
    status: "reference",
    generic: false,
  },
  {
    id: "structural_concrete_bim",
    name: "Structural concrete, production + site waste disposal",
    category: "concrete",
    unit: "kgCO2e/kg",
    value: 0.142,
    specification: "Dense structural RCC mix",
    geography: "Reference project, Surat, Gujarat",
    source: BIM,
    sourceLocation: "Table 9.3; B.Tech report Ch. 4, plinth and columns & beams",
    version: VERSION,
    lifecycleModules: ["A1-A3", "C2-C4"],
    boundaryStated: true,
    boundaryNotes: "Already includes production and site waste disposal. Do not add a separate disposal factor.",
    intendedUse: "Plinth level, columns and beams.",
    status: "reference",
    generic: false,
  },
  {
    id: "slab_concrete_bim",
    name: "Slab concrete mix",
    category: "concrete",
    unit: "kgCO2e/kg",
    value: 0.138,
    specification: "Slab casting mix",
    geography: "Reference project, Surat, Gujarat",
    source: BIM,
    sourceLocation: "Table 9.3; B.Tech report Ch. 4, slabs",
    version: VERSION,
    lifecycleModules: [],
    boundaryStated: false,
    boundaryNotes:
      "The report does not state whether this factor includes waste disposal. Its boundary is flagged as uncertain.",
    intendedUse: "Suspended slabs.",
    status: "reference",
    generic: false,
  },
  {
    id: "rebar_bim",
    name: "Reinforcement steel (BIM study value)",
    category: "steel",
    unit: "kgCO2e/kg",
    value: 1.92,
    specification: "Recycled/sectional production + trim waste",
    geography: "Reference project, Surat, Gujarat",
    source: BIM,
    sourceLocation: "Table 9.3; B.Tech report Ch. 4",
    version: VERSION,
    lifecycleModules: ["A1-A3"],
    boundaryStated: true,
    boundaryNotes: "Described as production of recycled/sectional steel including trim waste. Falls within the generic 1.80–2.40 range but is a single study value.",
    intendedUse: "Reinforcement in plinth, columns, beams and slabs.",
    status: "reference",
    generic: false,
  },
  {
    id: "clay_brick_bim",
    name: "Burnt clay brick",
    category: "masonry",
    unit: "kgCO2e/kg",
    value: 0.24,
    specification: "Kiln-fired clay brick, about 3 kg each",
    geography: "Reference project, Surat, Gujarat",
    source: BIM,
    sourceLocation: "Table 9.3; B.Tech report Ch. 4, walls",
    version: VERSION,
    lifecycleModules: ["A1-A3"],
    boundaryStated: true,
    boundaryNotes: "Typical production factor (A1–A3). The study applies no separate disposal factor to brick waste.",
    intendedUse: "Wall masonry.",
    status: "reference",
    generic: false,
  },
  {
    id: "diesel_bim",
    name: "Diesel fuel",
    category: "fuel",
    unit: "kgCO2e/L",
    value: 2.68,
    specification: "Diesel burnt in trucks and site machinery",
    geography: "Reference project, Surat, Gujarat",
    source: BIM,
    sourceLocation: "Table 9.3; B.Tech report Ch. 5",
    version: VERSION,
    lifecycleModules: ["A4", "A5"],
    boundaryStated: true,
    boundaryNotes: "Combustion factor per litre as used in the study. Upstream fuel production (well-to-tank) is not stated as included.",
    intendedUse: "Transport to site (A4) and site machinery (A5).",
    status: "reference",
    generic: false,
  },

  // --- Illustrative placeholders ---------------------------------------------
  // The project reports give no factors for these materials. The values below are
  // order-of-magnitude placeholders so the materials can be tried out. They are NOT
  // taken from a cited source, are flagged on every result that uses them, and must
  // be replaced with a sourced value (EPD or database) before results are relied on.
  ...(
    [
      ["sand_aggregate_illustrative", "Sand and aggregates", 0.005, "Natural sand, crushed stone aggregate", "Low-energy quarry products; varies with crushing and haulage."],
      ["aluminium_illustrative", "Aluminium (sections, sheet)", 9, "Extruded or rolled aluminium", "Varies several-fold with recycled content and smelter electricity."],
      ["glass_illustrative", "Flat glass", 1, "Float glass, uncoated", "Coatings, toughening and laminating add to this."],
      ["timber_illustrative", "Sawn timber", 0.3, "Sawn softwood, kiln dried", "Fossil emissions only; biogenic carbon storage is not counted."],
    ] as const
  ).map(
    ([id, name, value, specification, note]): EmissionFactor => ({
      id,
      name,
      category: "other",
      unit: "kgCO2e/kg",
      value,
      specification,
      geography: "Not specific to any region",
      source: "Illustrative placeholder: no cited source",
      sourceLocation: "Not from the project reports",
      version: "illustrative",
      lifecycleModules: ["A1-A3"],
      boundaryStated: false,
      boundaryNotes: `Assumed cradle-to-gate (A1–A3). ${note} Replace with a verified value.`,
      intendedUse: "Trying out the calculator only, until a sourced factor is added.",
      status: "illustrative",
      generic: true,
    }),
  ),
];

/** Non-factor reference parameters used by the template and the estimator. */
export const REFERENCE_PARAMETERS = [
  { key: "rcc_density", label: "Reinforced concrete density", value: 2400, unit: "kg/m³", source: "BIM report Table 8.1 / 9.1" },
  { key: "bricks_per_m3", label: "Bricks per m³ of masonry (10 mm joints)", value: 500, unit: "bricks/m³", source: "B.Tech report Ch. 4, walls" },
  { key: "brick_mass", label: "Mass of one brick", value: 3, unit: "kg", source: "B.Tech report Ch. 4, walls" },
  { key: "openings", label: "Openings deduction (doors and windows)", value: 25, unit: "% of gross wall volume", source: "BIM report Table 9.8" },
  { key: "rmc_capacity", label: "Transit-mixer capacity", value: 7, unit: "m³ per trip", source: "B.Tech report Ch. 5" },
  { key: "rmc_trip", label: "RMC round trip", value: 30, unit: "km", source: "B.Tech report Ch. 5" },
  { key: "rmc_economy", label: "RMC fuel economy under load", value: 2.5, unit: "km/L", source: "BIM report Table 9.9" },
  { key: "delivery_trip", label: "Delivery-truck round trip", value: 40, unit: "km", source: "B.Tech report Ch. 5" },
  { key: "delivery_economy", label: "Delivery-truck fuel economy", value: 3.5, unit: "km/L", source: "BIM report Table 9.9" },
  { key: "machinery_rate", label: "Site machinery fuel use", value: 4.5, unit: "L/h", source: "B.Tech report Ch. 5" },
] as const;

export const DEFAULT_DIESEL_FACTOR_ID = "diesel_bim";

/** Stage-specific study factors used by the default project template (BIM report Table 9.3). */
export const TEMPLATE_FACTORS_BY_STAGE: Record<string, { concrete: string[]; steel: string[]; masonry: string[] }> = {
  foundation: { concrete: ["concrete_a1a3_bim", "concrete_disposal_bim"], steel: ["rebar_bim"], masonry: ["clay_brick_bim"] },
  plinth: { concrete: ["structural_concrete_bim"], steel: ["rebar_bim"], masonry: ["clay_brick_bim"] },
  columns_beams: { concrete: ["structural_concrete_bim"], steel: ["rebar_bim"], masonry: ["clay_brick_bim"] },
  slabs: { concrete: ["slab_concrete_bim"], steel: ["rebar_bim"], masonry: ["clay_brick_bim"] },
  walls: { concrete: ["structural_concrete_bim"], steel: ["rebar_bim"], masonry: ["clay_brick_bim"] },
};

/** Default factor components for a material in a stage. Custom stages use the structural factors. */
export function templateFactorIds(stageId: string, category: "concrete" | "steel" | "masonry"): string[] {
  const row = TEMPLATE_FACTORS_BY_STAGE[stageId] ?? TEMPLATE_FACTORS_BY_STAGE.plinth;
  return row[category];
}

export function cloneReferenceFactors(): EmissionFactor[] {
  return REFERENCE_FACTORS.map((f) => ({
    ...f,
    range: f.range ? { ...f.range } : undefined,
    lifecycleModules: [...f.lifecycleModules],
  }));
}
