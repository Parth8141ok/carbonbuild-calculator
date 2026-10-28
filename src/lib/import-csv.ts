import { createId, referenceWaste, templateFactorIds, type MaterialCategory, type MaterialEntry, type QuantityUnit, type Stage } from "@/lib/engine";

/**
 * Imports a material take-off schedule exported as CSV (for example from a Revit
 * schedule or a spreadsheet). This does not read Revit or IFC files directly.
 *
 * Expected columns (header names are matched loosely):
 *   stage, material, quantity, unit, [category], [waste_percent], [density], [factor_id], [specification]
 */
export const CSV_TEMPLATE = `stage,material,category,quantity,unit,waste_percent,density,specification
Plinth,Plinth concrete,concrete,14,m3,6,2400,M25
Plinth,Plinth reinforcement,steel,1100,kg,5,,Fe500
Walls,Clay brick masonry,masonry,103250,bricks,8,,3 kg per brick
`;

export interface CsvRowResult {
  row: number;
  entry: MaterialEntry | null;
  errors: string[];
  raw: Record<string, string>;
}

export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let cur: string[] = [];
  let field = "";
  let quoted = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (quoted) {
      if (ch === '"' && text[i + 1] === '"') {
        field += '"';
        i++;
      } else if (ch === '"') quoted = false;
      else field += ch;
    } else if (ch === '"') quoted = true;
    else if (ch === "," || ch === ";" || ch === "\t") {
      cur.push(field);
      field = "";
    } else if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && text[i + 1] === "\n") i++;
      cur.push(field);
      if (cur.some((c) => c.trim() !== "")) rows.push(cur);
      cur = [];
      field = "";
    } else field += ch;
  }
  cur.push(field);
  if (cur.some((c) => c.trim() !== "")) rows.push(cur);
  return rows;
}

const norm = (s: string) => s.trim().toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "");

const HEADER_ALIASES: Record<string, string[]> = {
  stage: ["stage", "construction_stage", "phase", "level"],
  material: ["material", "name", "material_name", "element", "description"],
  category: ["category", "material_category", "type"],
  quantity: ["quantity", "qty", "volume", "mass", "count"],
  unit: ["unit", "units", "uom"],
  waste: ["waste_percent", "waste", "waste_factor", "waste_pct", "wastage"],
  density: ["density", "density_kg_m3"],
  factor: ["factor_id", "emission_factor_id", "factor"],
  specification: ["specification", "spec", "grade"],
};

function matchStage(value: string, stages: Stage[]): string | null {
  const v = norm(value);
  if (!v) return null;
  const exact = stages.find((s) => norm(s.name) === v || s.id === v);
  if (exact) return exact.id;
  if (v.includes("found") || v.includes("footing")) return "foundation";
  if (v.includes("plinth")) return "plinth";
  if (v.includes("column") || v.includes("beam") || v.includes("frame")) return "columns_beams";
  if (v.includes("slab")) return "slabs";
  if (v.includes("wall") || v.includes("mason")) return "walls";
  return null;
}

function matchUnit(value: string): QuantityUnit | null {
  const v = norm(value);
  if (["kg", "kgs", "kilogram", "kilograms"].includes(v)) return "kg";
  if (["t", "tonne", "tonnes", "ton", "tons", "mt"].includes(v)) return "t";
  if (["m3", "cum", "cu_m", "m_3", "cubic_metre", "cubic_meter"].includes(v) || value.trim() === "m³") return "m3";
  if (["bricks", "brick", "nos", "no", "count", "number"].includes(v)) return "bricks";
  if (["m3_brickwork", "brickwork_m3"].includes(v)) return "m3_brickwork";
  return null;
}

function matchCategory(value: string, name: string): MaterialCategory | null {
  const v = norm(value || name);
  if (v.includes("cement")) return "cement";
  if (v.includes("steel") || v.includes("rebar") || v.includes("reinforce")) return "steel";
  if (v.includes("brick") || v.includes("mason") || v.includes("block")) return "masonry";
  if (v.includes("concrete") || v.includes("rcc") || v.includes("pcc") || v.includes("rmc")) return "concrete";
  return null;
}

export function importMaterialCsv(text: string, stages: Stage[], factorIds: Set<string>): { rows: CsvRowResult[]; headerError: string | null } {
  const table = parseCsv(text.replace(/^﻿/, ""));
  if (table.length < 2) return { rows: [], headerError: "The file needs a header row and at least one data row." };
  const header = table[0].map(norm);
  const col: Record<string, number> = {};
  for (const [key, aliases] of Object.entries(HEADER_ALIASES)) {
    const idx = header.findIndex((h) => aliases.includes(h));
    if (idx >= 0) col[key] = idx;
  }
  const missing = ["stage", "material", "quantity", "unit"].filter((k) => col[k] === undefined);
  if (missing.length) return { rows: [], headerError: `Missing column(s): ${missing.join(", ")}.` };

  const rows: CsvRowResult[] = table.slice(1).map((cells, i) => {
    const get = (k: string) => (col[k] === undefined ? "" : (cells[col[k]] ?? "").trim());
    const raw = Object.fromEntries(Object.keys(col).map((k) => [k, get(k)]));
    const errors: string[] = [];
    const name = get("material");
    const stageId = matchStage(get("stage"), stages);
    if (!stageId) errors.push(`Unknown stage "${get("stage")}".`);
    const unit = matchUnit(get("unit"));
    if (!unit) errors.push(`Unknown unit "${get("unit")}". Use kg, t, m3 or bricks.`);
    const category = matchCategory(get("category"), name);
    if (!category) errors.push("Cannot tell the material category. Add a category column (concrete, steel, masonry or cement).");
    const qText = get("quantity").replace(/,/g, "");
    const quantity = qText === "" ? null : Number(qText);
    if (quantity === null || !Number.isFinite(quantity)) errors.push("Quantity is missing or not a number.");
    else if (quantity < 0) errors.push("Quantity cannot be negative.");
    const wText = get("waste");
    let waste: number | null = wText === "" ? null : Number(wText.replace("%", ""));
    if (waste !== null && (!Number.isFinite(waste) || waste < 0 || waste > 100)) errors.push("Waste % must be between 0 and 100.");
    const dText = get("density");
    const density = dText === "" ? null : Number(dText);
    if (unit === "m3" && density !== null && (!Number.isFinite(density) || density <= 0)) errors.push("Density must be greater than zero.");
    const factorId = get("factor");
    if (factorId && !factorIds.has(factorId)) errors.push(`Factor "${factorId}" is not in the factor library.`);
    if (category === "masonry" && unit === "m3") errors.push("For brickwork volume use unit m3_brickwork, or give the brick count.");

    if (errors.length || !stageId || !unit || !category || quantity === null) return { row: i + 2, entry: null, errors, raw };

    let wasteSource: MaterialEntry["wasteSource"] = "user";
    if (waste === null) {
      waste = referenceWaste(stageId, category);
      wasteSource = "reference";
    }
    const tplCat = category === "cement" ? null : category === "other" ? null : category;
    const factors = factorId ? [{ factorId }] : tplCat ? templateFactorIds(stageId, tplCat).map((id) => ({ factorId: id })) : [{ factorId: "opc_ch3" }];
    const entry: MaterialEntry = {
      id: createId("imp"),
      stageId,
      category,
      name: name || "Imported material",
      specification: get("specification"),
      quantity,
      unit,
      densityKgPerM3: unit === "m3" ? (density ?? 2400) : null,
      bricksPerM3: unit === "m3_brickwork" ? 500 : null,
      brickMassKg: unit === "bricks" || unit === "m3_brickwork" ? 3 : null,
      wastePercent: waste,
      wasteSource,
      factors,
      installedFactor: null,
      dataStatus: "user_provided",
      cementScope: category === "cement" ? "standalone" : undefined,
      origin: "import",
      notes: `Imported from a take-off schedule (CSV row ${i + 2}).${unit === "m3" && density === null ? " Density not given; 2,400 kg/m³ assumed." : ""}${wasteSource === "reference" ? " Waste % not given; reference value used." : ""}`,
    };
    return { row: i + 2, entry, errors, raw };
  });
  return { rows, headerError: null };
}
