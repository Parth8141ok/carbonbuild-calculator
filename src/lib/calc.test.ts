import { describe, expect, it } from "vitest";
import { applyReportMeasures, blankState, calculate, newMaterial, newTransport, num, referenceState, sanitizeState, toCsv, type State } from "./calc";

const ref = () => referenceState();
const near = (a: number, b: number, dp = 6) => expect(a).toBeCloseTo(b, dp);

describe("reference project (B.Tech report, BIM Tables 9.4–9.10)", () => {
  const r = calculate(ref());

  it("reproduces every element of the master schedule", () => {
    const by = Object.fromEntries(r.materials.map((m) => [m.name, m.carbon]));
    near(by["Foundation concrete"], 766.8); // Table 9.4: 702 + 64.8
    near(by["Plinth concrete"], 286.272); // 2,016 kg × 0.142
    near(by["Plinth reinforcement steel"], 105.6); // 55 kg × 1.92
    near(by["Columns & beams concrete"], 1472.256);
    near(by["Columns & beams steel"], 898.56);
    near(by["Slab concrete"], 635.904);
    near(by["Slab reinforcement steel"], 322.56);
    near(by["Clay bricks (206.5 m³ of brickwork)"], 5947.2); // 24,780 kg × 0.24
  });

  it("matches the report's wastage subtotal and totals", () => {
    near(r.materialCarbon, 9668.352); // report: 9,668.35 (foundation excluded)
    near(r.equipmentCarbon, 1447.2);
    near(r.transport[0].carbon, 643.2); // 240 L × 2.68
    near(r.transport[0].litres, 240);
    near(r.transportCarbon, 2021.485714, 5); // report 2,021.47: it truncates 514.2857 L to 514.28 L
    near(r.perBuilding, 13137.037714, 5); // report: 13,137.02
    near(r.total, 131370.377143, 4); // report: 131,370.20
    near(r.perArea!, 39.8092, 4); // report: 39.81
    expect(r.count).toBe(10);
  });

  it("leaves the foundation out by default and shows what it would add", () => {
    near(r.excludedTotal, 7668); // 766.8 × 10
    const withFoundation = ref();
    withFoundation.materials[0].include = true;
    near(calculate(withFoundation).perBuilding, 13903.837714, 5); // report sensitivity: 13,903.82
  });

  it("splits the report's shares: 73.60% wastage, 26.40% fuel", () => {
    near(r.materialCarbon / r.perBuilding, 0.736, 3);
    near((r.transportCarbon + r.equipmentCarbon) / r.perBuilding, 0.264, 3);
  });
});

describe("what-if scenario", () => {
  it("with no changes the scenario equals the baseline", () => {
    const r = calculate(ref());
    near(r.scenarioTotal, r.total);
    near(r.saved, 0);
  });

  it("the report's three measures save about 35% (4,597.6 kg per bungalow)", () => {
    const s = applyReportMeasures(ref());
    const r = calculate(s);
    near(r.perBuilding - r.scenarioPerBuilding, 4597.625143, 4);
    near(r.savedFraction, 0.34997, 4);
    expect(s.materials.find((m) => m.group === "masonry")!.scenWaste).toBe("4");
    expect(s.materials.find((m) => m.name === "Plinth concrete")!.scenWaste).toBe("4.5");
  });

  it("a blank what-if waste means the baseline waste, and reductions are clamped to 0–100%", () => {
    const s = ref();
    s.scenario.transportReduction = "150";
    const r = calculate(s);
    near(r.scenarioPerBuilding, r.materialCarbon + r.equipmentCarbon);
  });

  it("cost saved = baseline waste cost − scenario waste cost", () => {
    const s: State = {
      ...blankState(),
      materials: [{ ...newMaterial(), qty: "1000", waste: "10", ef: "1", cost: "50", scenWaste: "5" }],
    };
    const r = calculate(s);
    near(r.wasteCost, 5000); // 100 wasted × 50
    near(r.scenarioCost, 2500);
    near(r.costSaved, 2500);
  });
});

describe("inputs", () => {
  it("converts text to non-negative numbers", () => {
    expect([num("12.5"), num(""), num("abc"), num("-3"), num("0")]).toEqual([12.5, 0, 0, 0, 0]);
  });

  it("treats blank and negative values as 0 and warns", () => {
    const s = ref();
    s.materials[1].qty = "-14";
    const r = calculate(s);
    expect(r.materials[1].carbon).toBe(0);
    expect(r.warnings.some((w) => /negative/i.test(w))).toBe(true);
  });

  it("distinguishes a zero total from missing data", () => {
    const r = calculate(blankState());
    expect(r.total).toBe(0);
    expect(r.savedFraction).toBe(0);
    expect(r.perArea).toBeNull();
    expect(r.warnings.some((w) => /built-up area/.test(w))).toBe(true);
    expect(r.warnings.some((w) => /at least one material/.test(w))).toBe(true);
  });

  it("limits waste to 100% and warns", () => {
    const s = ref();
    s.materials[2].waste = "250";
    const r = calculate(s);
    near(r.materials[2].wasteQty, 1100);
    expect(r.warnings.some((w) => /100%/.test(w))).toBe(true);
  });

  it("does not guess fuel economy or equipment rates", () => {
    const s = ref();
    s.transport[0].param = "";
    s.equipment.rate = "";
    const r = calculate(s);
    expect(r.transport[0].carbon).toBe(0);
    expect(r.equipmentCarbon).toBe(0);
    expect(r.warnings.filter((w) => /km per litre|fuel use per hour/.test(w))).toHaveLength(2);
  });

  it("flags materials that have no emission factor", () => {
    const s = ref();
    s.materials.push({ ...newMaterial(), name: "Timber", qty: "100", ef: "" });
    expect(calculate(s).warnings.some((w) => /Timber/.test(w))).toBe(true);
  });
});

describe("transport and equipment", () => {
  it("fuel method: litres = trips × distance ÷ km per litre; emissions = litres × factor", () => {
    const s = blankState();
    s.transport = [{ ...newTransport(), trips: "45", distance: "40", param: "3.5", factor: "2.68" }];
    const r = calculate(s);
    near(r.transport[0].litres, 514.285714);
    near(r.transport[0].carbon, 1378.285714);
  });

  it("tonne-km method: trips × distance × load × factor", () => {
    const s = blankState();
    s.transport = [{ ...newTransport(), method: "tkm", trips: "20", distance: "30", param: "10", factor: "0.12" }];
    const r = calculate(s);
    near(r.transport[0].tonneKm, 6000);
    near(r.transport[0].carbon, 720);
    expect(r.transport[0].litres).toBe(0);
  });

  it("scales results by the number of buildings (whole buildings, at least 1)", () => {
    const s = ref();
    s.project.count = "3.9";
    near(calculate(s).total, calculate(s).perBuilding * 3);
    s.project.count = "0";
    expect(calculate(s).count).toBe(1);
  });
});

describe("export and stored data", () => {
  it("CSV contains every row and the totals", () => {
    const s = ref();
    const csv = toCsv(s, calculate(s));
    expect(csv.split("\r\n").length).toBeGreaterThan(25);
    expect(csv).toContain('"Baseline total","13137.037714","131370.377143"');
    expect(csv).toContain('"Clay bricks (206.5 m³ of brickwork)","yes","103250"');
  });

  it("CSV escapes quotes", () => {
    const s = blankState();
    s.project.name = 'Say "hello"';
    expect(toCsv(s, calculate(s))).toContain('"Say ""hello"""');
  });

  it("restores a saved project, and falls back to the example for broken data", () => {
    const s = ref();
    const back = sanitizeState(JSON.parse(JSON.stringify(s)));
    near(calculate(back).total, calculate(s).total);
    expect(sanitizeState("nonsense").materials).toHaveLength(8);
    expect(sanitizeState({ materials: [{ qty: 5 }], transport: [] }).materials[0].qty).toBe("5");
  });
});
