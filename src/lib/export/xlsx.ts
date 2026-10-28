import type { Project, ProjectResult } from "@/lib/engine";
import { buildRecommendations } from "@/lib/engine";
import { summariseFlagsPlain } from "./flags";
import { CALCULATION_HEADERS, FACTOR_HEADERS, calculationRows, factorRows, summaryRows } from "./tables";

/** Builds an Excel workbook: summary, calculations, factors, flags and recommendations. */
export async function buildWorkbook(p: Project, r: ProjectResult, generatedAt: string): Promise<ArrayBuffer> {
  const ExcelJS = (await import("exceljs")).default;
  const wb = new ExcelJS.Workbook();
  wb.creator = "CarbonBuild";
  wb.created = new Date(generatedAt);

  const header = (ws: import("exceljs").Worksheet) => {
    const row = ws.getRow(1);
    row.font = { bold: true, color: { argb: "FFFFFFFF" } };
    row.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF1E4D3A" } };
    ws.views = [{ state: "frozen", ySplit: 1 }];
  };

  const summary = wb.addWorksheet("Summary");
  summary.addRow(["Item", "Value"]);
  summaryRows(p, r, generatedAt).forEach((row) => summary.addRow(row));
  summary.getColumn(1).width = 44;
  summary.getColumn(2).width = 60;
  header(summary);

  const calc = wb.addWorksheet("Calculations");
  calc.addRow([...CALCULATION_HEADERS]);
  calculationRows(r).forEach((row) => calc.addRow(row));
  calc.columns.forEach((c, i) => (c.width = i === CALCULATION_HEADERS.length - 1 ? 120 : i === 12 ? 60 : 18));
  header(calc);

  const factors = wb.addWorksheet("Emission factors");
  factors.addRow(FACTOR_HEADERS);
  factorRows(p, r).forEach((row) => factors.addRow(row));
  factors.columns.forEach((c) => (c.width = 22));
  header(factors);

  const flags = wb.addWorksheet("Assumptions & warnings");
  flags.addRow(["Severity", "Message"]);
  summariseFlagsPlain(r).forEach((f) => flags.addRow([f.severity, f.message]));
  flags.getColumn(1).width = 12;
  flags.getColumn(2).width = 140;
  header(flags);

  const recs = wb.addWorksheet("Recommendations");
  recs.addRow(["Measure", "Addresses (kg CO2e)", "Share of total (%)", "Detail"]);
  buildRecommendations(r).forEach((x) => recs.addRow([x.title, x.addressesKg, x.addressesShare * 100, x.detail]));
  recs.getColumn(1).width = 40;
  recs.getColumn(4).width = 120;
  header(recs);

  return (await wb.xlsx.writeBuffer()) as ArrayBuffer;
}
