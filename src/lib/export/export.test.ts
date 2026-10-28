import { describe, expect, it } from "vitest";
import { REPORT_SCENARIO, analyseUncertainty, calculateProject, compareScenario, createSampleProject, newBuilding, newMaterial, newProject } from "@/lib/engine";
import { importMaterialCsv } from "@/lib/import-csv";
import { duplicateProject, exportProjectFile, parseProjectFile, refreshProjectFactors, snapshotProject } from "@/lib/projects";
import { buildPdf, pdfText } from "./pdf";
import { CALCULATION_HEADERS, calculationCsv, toCsv } from "./tables";
import { buildWorkbook } from "./xlsx";

const sample = createSampleProject();
const result = calculateProject(sample);

describe("14. exports", () => {
  it("CSV contains every calculated line at full precision and escapes text", () => {
    const csv = calculationCsv(result);
    const lines = csv.trim().split("\r\n");
    expect(lines).toHaveLength(result.lines.length + 1);
    expect(lines[0]).toContain("Emissions (kg CO2e)");
    expect(csv).toContain(",59472,"); // walls: 5,947.2 × 10
    expect(csv).toContain(",13782.857143,"); // delivery trucks keep the untruncated diesel
    expect(csv).not.toMatch(/\d\.\d{7,}/);
    expect(toCsv(["a"], [['x,"y"']])).toBe('a\r\n"x,""y"""\r\n');
  });
  it("CSV follows input changes", () => {
    const p = structuredClone(sample);
    p.buildings[0].materials.find((m) => m.category === "masonry")!.wastePercent = 4;
    expect(calculationCsv(calculateProject(p))).toContain("29736");
  });
  it("PDF contains the project's own calculated figures", () => {
    const doc = buildPdf(sample, result, { generatedAt: "2026-10-28T00:00:00Z", scenario: compareScenario(sample, REPORT_SCENARIO), uncertainty: analyseUncertainty(sample) });
    const raw = doc.output();
    expect(raw.startsWith("%PDF")).toBe(true);
    expect(doc.getNumberOfPages()).toBeGreaterThan(3);
    expect(raw).toContain("131,370.38 kg CO2e");
    expect(raw).toContain("Reference reconciliation");
    expect(raw).toContain("Reduction scenario");
  });
  it("PDF text is restricted to the standard font encoding", () => {
    expect(pdfText("kg CO₂e → ⌈x⌉")).toBe("kg CO2e -> ceil(x)");
  });
  it("Excel workbook builds with all sheets", async () => {
    const buf = await buildWorkbook(sample, result, "2026-10-28T00:00:00Z");
    const ExcelJS = (await import("exceljs")).default;
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(buf);
    expect(wb.worksheets.map((w) => w.name)).toEqual(["Summary", "Calculations", "Emission factors", "Assumptions & warnings", "Recommendations"]);
    expect(wb.getWorksheet("Calculations")!.rowCount).toBe(result.lines.length + 1);
    expect(wb.getWorksheet("Calculations")!.getRow(1).values).toContain(CALCULATION_HEADERS[0]);
  }, 30_000);
});

describe("15. local persistence and project management", () => {
  it("round-trips a project file and rejects invalid files", () => {
    const back = parseProjectFile(exportProjectFile(sample));
    expect(back.ok).toBe(true);
    if (back.ok) {
      expect(back.project.id).not.toBe(sample.id);
      expect(calculateProject(back.project).totals.totalKg).toBeCloseTo(result.totals.totalKg, 9);
    }
    expect(parseProjectFile("{").ok).toBe(false);
    expect(parseProjectFile(JSON.stringify({ project: { ...sample, buildings: [] } })).ok).toBe(false);
  });
  it("duplicates without sharing state", () => {
    const copy = duplicateProject(sample);
    copy.buildings[0].materials[0].quantity = 1;
    expect(sample.buildings[0].materials[0].quantity).toBe(45);
    expect(copy.isSample).toBe(false);
  });
  it("saved versions keep their factor snapshot when the library changes later", () => {
    const v = snapshotProject(sample, "Baseline");
    const library = structuredClone(sample.factors);
    library.find((f) => f.id === "clay_brick_bim")!.value = 0.5;
    const refreshed = refreshProjectFactors(structuredClone(sample), library);
    expect(calculateProject(refreshed).totals.totalKg).toBeGreaterThan(v.summary.totalKg);
    expect(calculateProject(v.project).totals.totalKg).toBeCloseTo(v.summary.totalKg, 9);
  });
});

describe("CSV take-off import", () => {
  const p = newProject({ buildings: [newBuilding({ materials: [newMaterial()] })] });
  const ids = new Set(p.factors.map((f) => f.id));
  it("maps rows to entries and reports bad rows", () => {
    const csv = "Stage,Material,Category,Qty,Unit,Waste %,Density\nPlinth,Plinth RCC,concrete,14,m3,6,2400\nSlabs,Rebar,steel,-5,kg,4,\nWalls,Bricks,,1000,nos,,\nRoof,X,steel,1,kg,,";
    const r = importMaterialCsv(csv, p.stages, ids);
    expect(r.headerError).toBeNull();
    expect(r.rows[0].entry?.factors).toEqual([{ factorId: "structural_concrete_bim" }]);
    expect(r.rows[1].entry).toBeNull();
    expect(r.rows[2].entry?.unit).toBe("bricks");
    expect(r.rows[2].entry?.wastePercent).toBe(8);
    expect(r.rows[3].errors.join()).toMatch(/Unknown stage/);
  });
  it("requires the core columns", () => {
    expect(importMaterialCsv("a,b\n1,2", p.stages, ids).headerError).toMatch(/Missing column/);
  });
});
