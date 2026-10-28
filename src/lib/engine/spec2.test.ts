import { describe, expect, it } from "vitest";
import {
  REPORT_SCENARIO,
  SAMPLE_ENTRY_IDS,
  calculateProject,
  compareScenario,
  createSampleProject,
  materialFromPreset,
  newBuilding,
  newMachinery,
  newMaterial,
  newProject,
  newTransport,
  normaliseScenario,
  transportTonneKm,
  type EmissionFactor,
  type Project,
} from "./index";

const tkmFactor: EmissionFactor = {
  id: "usr_road_tkm",
  name: "Road freight (test value)",
  category: "transport",
  unit: "kgCO2e/tkm",
  value: 0.1,
  specification: "",
  geography: "",
  source: "Unit test value",
  version: "test",
  lifecycleModules: ["A4"],
  boundaryStated: true,
  boundaryNotes: "",
  intendedUse: "",
  status: "user",
  generic: false,
};

function withTransport(t: Parameters<typeof newTransport>[0], extraFactors: EmissionFactor[] = [tkmFactor]): Project {
  const p = newProject({ buildings: [newBuilding({ id: "b", floors: 1, areaPerFloorM2: 100, transport: [newTransport({ id: "t", ...t })] })] });
  p.factors.push(...extraFactors);
  return p;
}

describe("tonne-km transportation", () => {
  it("tonne-km = mass (t) × distance (km); emissions = tkm × factor", () => {
    expect(transportTonneKm(newTransport({ method: "tonne_km", massTonnes: 30, distanceKm: 40 })).tonneKm).toBe(1200);
    const r = calculateProject(withTransport({ method: "tonne_km", massTonnes: 30, distanceKm: 40, factor: { factorId: "usr_road_tkm" } }));
    const l = r.lines.find((x) => x.entryId === "t")!;
    expect(l.valid).toBe(true);
    expect(l.tonneKm).toBe(1200);
    expect(l.emissionsKg).toBeCloseTo(120, 10);
    expect(r.totals.tonneKm).toBe(1200);
  });
  it("rejects a per-litre factor for the tonne-km method (incompatible units)", () => {
    const r = calculateProject(withTransport({ method: "tonne_km", massTonnes: 30, distanceKm: 40, factor: { factorId: "diesel_bim" } }));
    expect(r.lines[0].valid).toBe(false);
    expect(r.lines[0].flags.some((f) => /per tonne-km/.test(f.message))).toBe(true);
  });
  it("rejects a per-tonne-km factor for a fuel-based entry", () => {
    const r = calculateProject(withTransport({ method: "measured_fuel", measuredFuelL: 10, factor: { factorId: "usr_road_tkm" } }));
    expect(r.lines[0].valid).toBe(false);
  });
  it("requires a factor and the transported mass", () => {
    const r = calculateProject(withTransport({ method: "tonne_km", massTonnes: null, distanceKm: 40, factor: { factorId: "" } }));
    const msgs = r.lines[0].flags.map((f) => f.message).join(" ");
    expect(msgs).toMatch(/mass/);
    expect(msgs).toMatch(/tonne-km/);
  });
});

describe("waste production vs waste treatment", () => {
  it("splits foundation waste into production (A1–A3) and treatment (C2–C4)", () => {
    const s = createSampleProject();
    s.profile = "foundation_inclusive";
    const r = calculateProject(s);
    const f = r.lines.find((l) => l.entryId === SAMPLE_ENTRY_IDS.foundationConcrete && l.kind === "material")!;
    expect(f.wasteSplit!.production).toBeCloseTo(702, 9);
    expect(f.wasteSplit!.treatment).toBeCloseTo(64.8, 9);
    const plinth = r.lines.find((l) => l.entryId === SAMPLE_ENTRY_IDS.plinthConcrete)!;
    expect(plinth.wasteSplit!.combined).toBeCloseTo(286.272, 9);
    const w = r.totals.waste;
    expect(w.production + w.treatment + w.combined + w.unclassified).toBeCloseTo(r.totals.materialWasteKg, 6);
    expect(w.treatment).toBeCloseTo(648, 6);
  });
  it("material production of installed material is separate and does not change waste emissions", () => {
    const s = createSampleProject();
    s.boundary = "expanded";
    const r = calculateProject(s);
    expect(r.totals.materialWasteKg).toBeCloseTo(calculateProject(createSampleProject()).totals.materialWasteKg, 6);
    expect(r.totals.installedEmbodiedKg).toBeGreaterThan(r.totals.materialWasteKg);
  });
});

describe("per building, per m², tonnes", () => {
  it("divides by buildings counted and built-up area", () => {
    const r = calculateProject(createSampleProject());
    expect(r.totals.buildingsCounted).toBe(10);
    expect(r.totals.perBuildingKg).toBeCloseTo(13137.0377, 3);
    expect(r.totals.intensityKgPerM2).toBeCloseTo(r.totals.totalKg / 3300, 12);
    expect(r.totals.totalTonnes).toBeCloseTo(r.totals.totalKg / 1000, 12);
  });
});

describe("optional sections", () => {
  it("excluded sections are left out of the total and flagged prominently", () => {
    const s = createSampleProject();
    s.sections = { transport: false, machinery: true };
    const r = calculateProject(s);
    expect(r.totals.transportKg).toBe(0);
    expect(r.excludedSections).toEqual(["transport"]);
    expect(r.flags.some((f) => f.code === "section_excluded_transport" && f.severity === "warning")).toBe(true);
    expect(r.coverage.find((c) => c.module === "A4")!.status).toBe("excluded");
    expect(r.totals.totalKg).toBeCloseTo(131370.377 - 20214.857, 2);
  });
  it("an included section with no entries is reported as not assessed", () => {
    const p = newProject({ buildings: [newBuilding({ materials: [newMaterial({ quantity: 1, unit: "kg", wastePercent: 1, factors: [{ factorId: "rebar_bim" }] })] })] });
    const r = calculateProject(p);
    expect(r.flags.some((f) => f.code === "section_empty_transport")).toBe(true);
    expect(r.flags.some((f) => f.code === "section_empty_machinery")).toBe(true);
  });
  it("machinery hours without a fuel rate are not estimated", () => {
    const p = newProject({ buildings: [newBuilding({ machinery: [newMachinery({ id: "m", hours: 100, litresPerHour: null })] })] });
    const l = calculateProject(p).lines[0];
    expect(l.valid).toBe(false);
    expect(l.emissionsKg).toBe(0);
  });
});

describe("factor library and coverage", () => {
  it("flags illustrative factors on every line that uses them", () => {
    const p = newProject({ buildings: [newBuilding({ materials: [materialFromPreset("aluminium", "walls", { id: "al", quantity: 100, wastePercent: 5 })] })] });
    const r = calculateProject(p);
    expect(r.lines[0].valid).toBe(true);
    expect(r.lines[0].emissionsKg).toBeCloseTo(100 * 0.05 * 9, 9);
    expect(r.flags.some((f) => f.code === "illustrative_factor")).toBe(true);
  });
  it("a custom material is not counted until a factor is chosen", () => {
    const p = newProject({ buildings: [newBuilding({ materials: [materialFromPreset("custom", "walls", { quantity: 10, wastePercent: 5 })] })] });
    expect(calculateProject(p).lines[0].valid).toBe(false);
  });
  it("reports partial A1–A3 coverage for the construction-stage boundary", () => {
    const r = calculateProject(createSampleProject());
    expect(r.coverage.find((c) => c.module === "A1–A3")!.status).toBe("partial");
    expect(r.coverage.find((c) => c.module === "B1–B7")!.status).toBe("excluded");
    expect(r.coverage.find((c) => c.module === "C1–C4")!.status).toBe("partial");
  });
});

describe("scenario quantities and migration", () => {
  it("changes material quantities and reports reduction = baseline − scenario", () => {
    const s = createSampleProject();
    const c = compareScenario(s, { ...normaliseScenario(null), quantityChangePercent: { steel: -10 } });
    const steelKg = c.baseline.lines.filter((l) => l.included && l.materialCategory === "steel").reduce((a, l) => a + l.emissionsKg, 0);
    expect(c.savingsKg).toBeCloseTo(steelKg * 0.1, 6);
    expect(c.reductionFraction).toBeCloseTo(c.savingsKg / c.baseline.totals.totalKg, 12);
  });
  it("migrates the old single diesel setting", () => {
    const n = normaliseScenario({ dieselChangePercent: -20 } as never);
    expect(n.transportFuelChangePercent).toBe(-20);
    expect(n.machineryFuelChangePercent).toBe(-20);
  });
  it("reports zero reduction fraction when the baseline is zero", () => {
    const c = compareScenario(newProject(), REPORT_SCENARIO);
    expect(c.reductionFraction).toBe(0);
  });
});
