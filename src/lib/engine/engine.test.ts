import { describe, expect, it } from "vitest";
import {
  REPORT_SCENARIO,
  SAMPLE_ENTRY_IDS,
  analyseUncertainty,
  buildRecommendations,
  calculateProject,
  checkComponentBoundaries,
  compareScenario,
  computeMaterialMass,
  createSampleProject,
  defaultEstimatorInput,
  estimateQuantities,
  kgToTonnes,
  machineryLitres,
  newBuilding,
  newMachinery,
  newMaterial,
  newProject,
  normaliseFactorValue,
  projectSchema,
  reconcileSample,
  resolveFactor,
  tonnesToKg,
  transportLitres,
  userFactorInputSchema,
  volumeToMassKg,
  type MaterialEntry,
  type Project,
} from "./index";

function projectWith(materials: MaterialEntry[], extra: Partial<Project> = {}): Project {
  return newProject({ buildings: [newBuilding({ id: "b1", floors: 1, areaPerFloorM2: 100, materials })], ...extra });
}

const line = (p: Project, entryId: string, kind = "material") => calculateProject(p).lines.find((l) => l.entryId === entryId && l.kind === kind)!;

describe("1. kg / tonne conversion", () => {
  it("converts both ways", () => {
    expect(tonnesToKg(1.1)).toBeCloseTo(1100, 10);
    expect(kgToTonnes(131370.2)).toBeCloseTo(131.3702, 10);
  });
  it("converts a factor per tonne to per kg", () => {
    expect(normaliseFactorValue(1920, "kgCO2e/t")).toBeCloseTo(1.92, 12);
    expect(normaliseFactorValue(1.92, "kgCO2e/kg")).toBe(1.92);
  });
  it("treats a quantity in tonnes as 1,000 kg each", () => {
    const r = computeMaterialMass(newMaterial({ quantity: 7.8, unit: "t" }));
    expect(r.massKg).toBeCloseTo(7800, 9);
  });
});

describe("2. volume to mass", () => {
  it("multiplies volume by density", () => {
    expect(volumeToMassKg(45, 2400)).toBe(108000);
    expect(computeMaterialMass(newMaterial({ quantity: 14, unit: "m3", densityKgPerM3: 2400 })).massKg).toBe(33600);
  });
  it("requires a positive density", () => {
    const r = computeMaterialMass(newMaterial({ quantity: 14, unit: "m3", densityKgPerM3: null }));
    expect(r.massKg).toBeNull();
    expect(r.errors.join()).toMatch(/density/i);
  });
  it("converts brickwork volume through bricks per m³ and brick mass", () => {
    const r = computeMaterialMass(newMaterial({ quantity: 206.5, unit: "m3_brickwork", bricksPerM3: 500, brickMassKg: 3 }));
    expect(r.brickCount).toBeCloseTo(103250, 9);
    expect(r.massKg).toBeCloseTo(309750, 9);
  });
});

describe("3. material waste", () => {
  it("wasted mass = total mass × waste %", () => {
    const p = projectWith([newMaterial({ id: "c", stageId: "plinth", quantity: 14, unit: "m3", densityKgPerM3: 2400, wastePercent: 6, factors: [{ factorId: "structural_concrete_bim" }] })]);
    const l = line(p, "c");
    expect(l.wastedMassKg).toBeCloseTo(2016, 9);
    expect(l.emissionsKg).toBeCloseTo(286.272, 9);
    expect(l.steps.map((s) => s.label)).toEqual(["Total mass", "Wasted mass", "Waste emissions"]);
  });
  it("rejects waste outside 0–100%", () => {
    const p = projectWith([newMaterial({ id: "c", quantity: 1, unit: "kg", wastePercent: 120, factors: [{ factorId: "rebar_bim" }] })]);
    expect(line(p, "c").valid).toBe(false);
  });
});

describe("4. separate production and disposal factors", () => {
  it("sums compatible components (A1–A3 + C2–C4)", () => {
    const p = projectWith(
      [newMaterial({ id: "f", stageId: "foundation", quantity: 45, unit: "m3", densityKgPerM3: 2400, wastePercent: 5, factors: [{ factorId: "concrete_a1a3_bim" }, { factorId: "concrete_disposal_bim" }] })],
      { profile: "foundation_inclusive" },
    );
    const l = line(p, "f");
    expect(l.valid).toBe(true);
    expect(l.steps.find((s) => s.label.includes("A1–A3"))!.value).toBeCloseTo(702, 9);
    expect(l.steps.find((s) => s.label.includes("disposal"))!.value).toBeCloseTo(64.8, 9);
    expect(l.emissionsKg).toBeCloseTo(766.8, 9);
  });
  it("rejects a disposal factor added to one that already includes disposal", () => {
    const p = projectWith([newMaterial({ id: "x", stageId: "plinth", quantity: 1, unit: "m3", densityKgPerM3: 2400, wastePercent: 5, factors: [{ factorId: "structural_concrete_bim" }, { factorId: "concrete_disposal_bim" }] })]);
    const l = line(p, "x");
    expect(l.valid).toBe(false);
    expect(l.included).toBe(false);
    expect(l.flags.some((f) => /Double counting/.test(f.message))).toBe(true);
  });
  it("refuses to combine factors whose boundary is unknown", () => {
    const f = new Map(newProject().factors.map((x) => [x.id, x]));
    const a = resolveFactor({ factorId: "slab_concrete_bim" }, f, "central", "mass").factor!;
    const b = resolveFactor({ factorId: "concrete_disposal_bim" }, f, "central", "mass").factor!;
    expect(checkComponentBoundaries([a, b])).toMatch(/unknown/);
  });
});

describe("5–7. diesel, transport and machinery", () => {
  it("diesel emissions = litres × 2.68", () => {
    const p = newProject({ buildings: [newBuilding({ id: "b", machinery: [newMachinery({ id: "m", method: "measured_fuel", measuredFuelL: 100 })] })] });
    expect(line(p, "m", "machinery").emissionsKg).toBeCloseTo(268, 9);
  });
  it("estimates transport fuel from distance and economy (round trip)", () => {
    const r = transportLitres({ ...baseTransport(), trips: 20, distanceKm: 30, distanceConvention: "round_trip", fuelEconomyKmPerL: 2.5 });
    expect(r.distanceKm).toBe(600);
    expect(r.litres).toBeCloseTo(240, 12);
  });
  it("doubles a one-way distance", () => {
    const r = transportLitres({ ...baseTransport(), trips: 20, distanceKm: 15, distanceConvention: "one_way", fuelEconomyKmPerL: 2.5 });
    expect(r.distanceKm).toBe(600);
  });
  it("prefers measured fuel over a distance estimate", () => {
    const r = transportLitres({ ...baseTransport(), method: "measured_fuel", measuredFuelL: 300, trips: 20, distanceKm: 30, distanceConvention: "round_trip", fuelEconomyKmPerL: 2.5 });
    expect(r.litres).toBe(300);
    expect(r.notes.length).toBe(1);
  });
  it("requires a distance convention", () => {
    const r = transportLitres({ ...baseTransport(), trips: 1, distanceKm: 1, distanceConvention: null, fuelEconomyKmPerL: 1 });
    expect(r.litres).toBeNull();
    expect(r.errors.join()).toMatch(/one-way or round-trip/);
  });
  it("prevents division by zero fuel economy", () => {
    const r = transportLitres({ ...baseTransport(), trips: 1, distanceKm: 1, distanceConvention: "round_trip", fuelEconomyKmPerL: 0 });
    expect(r.litres).toBeNull();
    expect(r.errors.join()).toMatch(/greater than zero/);
  });
  it("machinery litres = hours × L/h", () => {
    const r = machineryLitres(newMachinery({ hours: 120, litresPerHour: 4.5 }));
    expect(r.litres).toBeCloseTo(540, 12);
  });
});

describe("8–9. missing, invalid and negative inputs", () => {
  it("distinguishes missing quantity from zero", () => {
    const missing = projectWith([newMaterial({ id: "a", quantity: null, unit: "kg", wastePercent: 5, factors: [{ factorId: "rebar_bim" }] })]);
    const zero = projectWith([newMaterial({ id: "a", quantity: 0, unit: "kg", wastePercent: 5, factors: [{ factorId: "rebar_bim" }] })]);
    expect(line(missing, "a").valid).toBe(false);
    expect(line(missing, "a").flags[0].message).toMatch(/missing/i);
    expect(line(zero, "a").valid).toBe(true);
    expect(line(zero, "a").emissionsKg).toBe(0);
  });
  it("rejects negative quantities and keeps them out of the total", () => {
    const p = projectWith([
      newMaterial({ id: "neg", quantity: -10, unit: "kg", wastePercent: 5, factors: [{ factorId: "rebar_bim" }] }),
      newMaterial({ id: "ok", stageId: "plinth", quantity: 1000, unit: "kg", wastePercent: 5, factors: [{ factorId: "rebar_bim" }] }),
    ]);
    const r = calculateProject(p);
    expect(r.lines.find((l) => l.entryId === "neg")!.valid).toBe(false);
    expect(r.totals.totalKg).toBeCloseTo(96, 9);
    expect(r.hasErrors).toBe(true);
  });
  it("rejects a fuel factor used for a material, and unknown factors", () => {
    const p = projectWith([
      newMaterial({ id: "a", quantity: 1, unit: "kg", wastePercent: 5, factors: [{ factorId: "diesel_bim" }] }),
      newMaterial({ id: "b", quantity: 1, unit: "kg", wastePercent: 5, factors: [{ factorId: "nope" }] }),
    ]);
    expect(line(p, "a").valid).toBe(false);
    expect(line(p, "b").valid).toBe(false);
  });
  it("returns no intensity when the area is missing", () => {
    const p = newProject();
    expect(calculateProject(p).totals.intensityKgPerM2).toBeNull();
  });
  it("validates user factors: source required, range consistent, units match category", () => {
    const ok = { name: "X", category: "steel" as const, unit: "kgCO2e/t" as const, value: 1900, low: null, high: null, specification: "", geography: "", source: "EPD 123", sourceDocument: "", version: "2026", lifecycleModules: ["A1-A3" as const], boundaryNotes: "", status: "user" as const };
    expect(userFactorInputSchema.safeParse(ok).success).toBe(true);
    expect(userFactorInputSchema.safeParse({ ...ok, source: " " }).success).toBe(false);
    expect(userFactorInputSchema.safeParse({ ...ok, value: -1 }).success).toBe(false);
    expect(userFactorInputSchema.safeParse({ ...ok, unit: "kgCO2e/L" }).success).toBe(false);
    expect(userFactorInputSchema.safeParse({ ...ok, low: 1000, high: 1500 }).success).toBe(false);
  });
});

describe("10. duplicate and overlapping emissions", () => {
  it("excludes cement marked as contained in concrete", () => {
    const p = projectWith([
      newMaterial({ id: "rmc", stageId: "slabs", category: "concrete", quantity: 10, unit: "m3", densityKgPerM3: 2400, wastePercent: 4, factors: [{ factorId: "rmc_m25_m30_ch3" }] }),
      newMaterial({ id: "cem", stageId: "slabs", category: "cement", quantity: 3000, unit: "kg", wastePercent: 4, factors: [{ factorId: "opc_ch3" }], cementScope: "in_concrete" }),
    ]);
    const r = calculateProject(p);
    const cem = r.lines.find((l) => l.entryId === "cem")!;
    expect(cem.valid).toBe(true);
    expect(cem.included).toBe(false);
    expect(r.totals.totalKg).toBeCloseTo(10 * 2400 * 0.04 * 0.13, 9);
  });
  it("warns about standalone cement next to a concrete mix in the same stage", () => {
    const p = projectWith([
      newMaterial({ id: "rmc", stageId: "slabs", category: "concrete", quantity: 10, unit: "m3", densityKgPerM3: 2400, wastePercent: 4, factors: [{ factorId: "rmc_m25_m30_ch3" }] }),
      newMaterial({ id: "cem", stageId: "slabs", category: "cement", quantity: 3000, unit: "kg", wastePercent: 4, factors: [{ factorId: "opc_ch3" }], cementScope: "standalone" }),
    ]);
    expect(calculateProject(p).flags.some((f) => f.code === "cement_concrete_overlap")).toBe(true);
  });
  it("flags possible duplicate entries", () => {
    const a = newMaterial({ id: "a", stageId: "plinth", category: "steel", name: "Rebar", quantity: 100, unit: "kg", wastePercent: 5, factors: [{ factorId: "rebar_bim" }] });
    const p = projectWith([a, { ...a, id: "b" }]);
    expect(calculateProject(p).flags.filter((f) => f.code === "possible_duplicate")).toHaveLength(1);
  });
  it("profile excludes foundation without dropping it from the audit trail", () => {
    const s = createSampleProject();
    const r = calculateProject(s);
    const f = r.lines.find((l) => l.entryId === SAMPLE_ENTRY_IDS.foundationConcrete)!;
    expect(f.valid).toBe(true);
    expect(f.included).toBe(false);
    expect(f.exclusionReason).toMatch(/master-schedule/);
    expect(r.totals.excludedByProfileKg).toBeCloseTo(7668, 6);
  });
});

describe("11. multiple buildings", () => {
  it("multiplies only when the buildings are confirmed identical", () => {
    const s = createSampleProject();
    s.buildings[0].identicalConfirmed = false;
    const r = calculateProject(s);
    expect(r.byBuilding[0].multiplier).toBe(1);
    expect(r.flags.some((f) => f.code === "buildings_not_confirmed_identical" && f.severity === "error")).toBe(true);
    expect(r.totals.builtUpAreaM2).toBe(330);
  });
  it("calculates different building groups separately and sums them", () => {
    const steel = (id: string, q: number) => newMaterial({ id, stageId: "plinth", category: "steel", quantity: q, unit: "kg", wastePercent: 5, factors: [{ factorId: "rebar_bim" }] });
    const p = newProject({
      buildings: [
        newBuilding({ id: "a", name: "A", count: 2, identicalConfirmed: true, floors: 2, areaPerFloorM2: 100, materials: [steel("s1", 1000)] }),
        newBuilding({ id: "b", name: "B", count: 1, floors: 4, areaPerFloorM2: 50, materials: [steel("s2", 500)] }),
      ],
    });
    const r = calculateProject(p);
    expect(r.byBuilding.map((b) => b.totalKg)).toEqual([expect.closeTo(192, 9), expect.closeTo(48, 9)]);
    expect(r.totals.totalKg).toBeCloseTo(240, 9);
    expect(r.totals.builtUpAreaM2).toBe(600);
    expect(r.totals.intensityKgPerM2).toBeCloseTo(0.4, 12);
  });
});

describe("12. reference sample reconciliation", () => {
  const r = calculateProject(createSampleProject());
  const rows = reconcileSample(r);
  const row = (k: string) => rows.find((x) => x.key === k)!;

  it("matches every element schedule that the report computes exactly", () => {
    for (const k of ["plinth_concrete", "plinth_steel", "plinth", "frame_concrete", "frame_steel", "frame", "slab_concrete", "slab_steel", "slabs", "walls", "rmc_l", "rmc", "machinery", "waste_subtotal", "foundation"]) {
      expect(row(k).matches, k).toBe(true);
    }
  });
  it("shows the delivery-truck truncation instead of hiding it", () => {
    expect(row("delivery_l").matches).toBe(false);
    expect(row("delivery_l").calculated).toBeCloseTo(514.285714, 5);
    expect(row("delivery").calculated).toBeCloseTo(1378.2857, 4);
    expect(row("delivery").explanation).toMatch(/truncat/);
    expect(row("total").calculated).toBeCloseTo(13137.0377, 4);
    expect(row("total").delta).toBeCloseTo(0.0177, 4);
    expect(row("total_foundation").calculated).toBeCloseTo(13903.8377, 4);
  });
  it("reports project totals for both profiles", () => {
    expect(r.totals.totalKg).toBeCloseTo(131370.377, 3);
    expect(r.profileTotals.report_master).toBeCloseTo(131370.377, 3);
    expect(r.profileTotals.foundation_inclusive).toBeCloseTo(139038.377, 3);
    expect(r.totals.builtUpAreaM2).toBe(3300);
    expect(Math.round(r.totals.intensityKgPerM2! * 100) / 100).toBe(39.81);
  });
  it("splits wastage and fuel as the report does (73.60% / 26.40%)", () => {
    expect(Math.round((r.totals.materialWasteKg / r.totals.totalKg) * 10000) / 100).toBe(73.6);
    expect(Math.round(((r.totals.transportKg + r.totals.machineryKg) / r.totals.totalKg) * 10000) / 100).toBe(26.4);
    expect(r.bySource[0].label).toBe("Walls and masonry");
    expect(Math.round(r.bySource[0].kg / r.totals.totalKg * 10000) / 100).toBe(45.27);
  });
  it("uses an itemised result, not a hard-coded total", () => {
    const s = createSampleProject();
    s.buildings[0].materials.find((m) => m.id === SAMPLE_ENTRY_IDS.bricks)!.wastePercent = 4;
    expect(calculateProject(s).totals.totalKg).toBeCloseTo(131370.377 - 29736, 3);
  });
  it("passes structural schema validation", () => {
    expect(projectSchema.safeParse(createSampleProject()).success).toBe(true);
  });
});

describe("13. reduction scenarios", () => {
  const s = createSampleProject();
  const cmp = compareScenario(s, REPORT_SCENARIO);
  it("recalculates the report's illustrative measures from the inputs", () => {
    const perBungalow = (k: string) => cmp.measures.find((m) => m.key === k)!.savingsKg / 10;
    expect(perBungalow("masonryWaste")).toBeCloseTo(2973.6, 6);
    expect(perBungalow("concreteWaste") + perBungalow("steelWaste")).toBeCloseTo(930.288, 6);
    expect(perBungalow("transportFuel") + perBungalow("machineryFuel")).toBeCloseTo(693.737, 3);
    expect(cmp.savingsKg / 10).toBeCloseTo(4597.625, 3);
    expect(Math.round(cmp.reductionFraction * 1000) / 10).toBe(35);
  });
  it("finds no interaction between measures on separate components", () => {
    expect(Math.abs(cmp.interactionKg)).toBeLessThan(1e-6);
  });
  it("detects interaction between diesel and distance reductions", () => {
    const c = compareScenario(s, { ...REPORT_SCENARIO, masonryWaste: null, concreteWaste: null, steelWaste: null, machineryFuelChangePercent: 0, transportFuelChangePercent: -20, transportDistanceChangePercent: -20 });
    expect(c.interactionKg).toBeLessThan(0);
    expect(c.warnings.some((w) => /overlap/.test(w))).toBe(true);
  });
  it("does not mutate the baseline project", () => {
    expect(s.buildings[0].materials.find((m) => m.id === SAMPLE_ENTRY_IDS.bricks)!.wastePercent).toBe(8);
  });
  it("warns when an alternative factor has a different boundary", () => {
    const c = compareScenario(s, { ...REPORT_SCENARIO, factorSwaps: { concrete: { factorId: "rmc_m25_m30_ch3" } } });
    expect(c.warnings.some((w) => /boundary/.test(w))).toBe(true);
  });
});

describe("estimator", () => {
  it("reproduces the reference quantities from the reference geometry, except the rounded brickwork", () => {
    const out = estimateQuantities(defaultEstimatorInput(110, 3));
    const v = (k: string) => out.quantities.find((q) => q.key === k)!.value!;
    expect(v("foundationConcrete")).toBeCloseTo(45, 9);
    expect(v("plinthConcrete")).toBeCloseTo(14, 9);
    expect(v("frameConcrete")).toBeCloseTo(72, 9);
    expect(v("slabConcrete")).toBeCloseTo(48, 9);
    expect(v("frameSteel")).toBeCloseTo(7800, 9);
    expect(v("slabSteel")).toBeCloseTo(4200, 9);
    expect(v("brickwork")).toBeCloseTo(206.4825, 9);
    expect(out.transport.find((t) => t.vehicleCategory === "rmc_transit_mixer")!.trips).toBe(20);
    expect(out.transport.find((t) => t.vehicleCategory === "delivery_truck")!.trips).toBe(45);
    expect(out.machinery[0].hours).toBeCloseTo(120, 9);
  });
  it("marks derived quantities as estimated and ratio-based ones as assumed", () => {
    const input = defaultEstimatorInput(100, 2);
    input.wallLengthPerFloorM = 120;
    input.beamAllowancePerFloorM3 = 2;
    const out = estimateQuantities(input);
    expect(out.quantities.find((q) => q.key === "slabConcrete")!.status).toBe("estimated");
    expect(out.quantities.find((q) => q.key === "brickwork")!.status).toBe("estimated");
    expect(out.quantities.find((q) => q.key === "frameSteel")!.status).toBe("assumed");
  });
  it("never invents quantities when reference ratios are disabled", () => {
    const input = defaultEstimatorInput(100, 2);
    input.useReferenceRatios = false;
    const out = estimateQuantities(input);
    expect(out.quantities.find((q) => q.key === "frameSteel")!.status).toBe("missing");
    expect(out.quantities.find((q) => q.key === "bricks")!.status).toBe("missing");
    expect(out.materials.some((m) => m.name.includes("Columns and beams reinforcement"))).toBe(false);
  });
});

describe("expanded boundary", () => {
  it("adds installed A1–A3 emissions as separate lines without changing waste lines", () => {
    const s = createSampleProject();
    const base = calculateProject(s);
    s.boundary = "expanded";
    const r = calculateProject(s);
    expect(r.totals.constructionStageKg).toBeCloseTo(base.totals.totalKg, 6);
    expect(r.totals.installedEmbodiedKg).toBeGreaterThan(0);
    const bricks = r.lines.find((l) => l.entryId === SAMPLE_ENTRY_IDS.bricks && l.kind === "installed")!;
    expect(bricks.emissionsPerBuildingKg).toBeCloseTo(309750 * 0.24, 6);
  });
});

describe("insights", () => {
  it("ranks recommendations by the user's own hotspots", () => {
    const recs = buildRecommendations(calculateProject(createSampleProject()));
    expect(recs[0].id).toMatch(/brick/);
  });
  it("computes linear sensitivities from the data", () => {
    const u = analyseUncertainty(createSampleProject());
    const brick = u.sensitivities.find((x) => x.key === "waste_masonry")!;
    expect(brick.deltaKg).toBeCloseTo((5947.2 / 8) * 10, 6);
    expect(u.rangeFactorLow).toBeNull();
  });
  it("produces low/high totals when range factors are used", () => {
    const p = projectWith([newMaterial({ id: "s", stageId: "plinth", category: "steel", quantity: 1000, unit: "kg", wastePercent: 10, factors: [{ factorId: "rebar_ch3" }] })]);
    const u = analyseUncertainty(p);
    expect(u.rangeFactorLow).toBeCloseTo(180, 9);
    expect(u.rangeFactorHigh).toBeCloseTo(240, 9);
    expect(calculateProject(p).totals.totalKg).toBeCloseTo(210, 9);
  });
});

function baseTransport() {
  return {
    id: "t",
    name: "t",
    vehicleCategory: "other" as const,
    method: "distance" as const,
    trips: null,
    distanceKm: null,
    distanceConvention: null,
    fuelEconomyKmPerL: null,
    measuredFuelL: null,
    factor: { factorId: "diesel_bim" },
    supplier: "",
    dataStatus: "user_provided" as const,
    origin: "manual" as const,
    notes: "",
  };
}
