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

// ---------------------------------------------------------------------------
// Operational carbon: electricity, fuel and water
// ---------------------------------------------------------------------------

import { newElectricity, newFuel, newWater, sanitizeOperational, toKWh, toM3, type ElectricityRecord } from "./calc";

/** The report example with operational records filled in. Count 10, 330 m² per building. */
function withOperation(patch: (s: State) => void): State {
  const s = referenceState();
  s.operational.electricity = [];
  patch(s);
  return s;
}
const elec = (over: Partial<ElectricityRecord>): ElectricityRecord => ({ ...newElectricity(), ...over });

describe("operational electricity", () => {
  it("emissions = kWh × factor (12,000 kWh/year × 0.43 = 5,160 kg per building)", () => {
    const s = withOperation((x) => (x.operational.electricity = [elec({ amount: "12000", factor: "0.43" })]));
    const o = calculate(s).operational;
    near(o.electricityPerYear, 5160);
    near(o.perYearAll, 51600); // × 10 buildings
    near(o.totalAll, 51600); // 1 year
  });

  it("converts MWh to kWh", () => {
    expect(toKWh(12, "MWh")).toBe(12000);
    const s = withOperation((x) => (x.operational.electricity = [elec({ amount: "12", unit: "MWh", factor: "0.43" })]));
    near(calculate(s).operational.electricityPerYear, 5160);
  });

  it("normalises month, quarter and year to one year, and never scales an annual value", () => {
    const annual = (amount: string, period: "month" | "quarter" | "year") => calculate(withOperation((x) => (x.operational.electricity = [elec({ amount, period })]))).operational.electricity[0].annualAmount;
    expect(annual("1000", "month")).toBe(12000);
    expect(annual("3000", "quarter")).toBe(12000);
    expect(annual("12000", "year")).toBe(12000);
  });

  it("totals several records, including a documented renewable source with a zero factor", () => {
    const s = withOperation((x) => (x.operational.electricity = [elec({ amount: "10000", factor: "0.43" }), elec({ name: "Rooftop solar", supply: "renewable", amount: "2000", factor: "0", source: "Meter readings, 2026" })]));
    const r = calculate(s);
    near(r.operational.electricityPerYear, 4300);
    expect(r.warnings.some((w) => /Rooftop solar/.test(w))).toBe(false);
  });

  it("warns about a zero or missing factor unless a renewable source is documented", () => {
    const grid = calculate(withOperation((x) => (x.operational.electricity = [elec({ amount: "100", factor: "" })])));
    expect(grid.warnings.some((w) => /Electricity "Grid electricity": no emission factor/.test(w))).toBe(true);
    const renewableNoSource = calculate(withOperation((x) => (x.operational.electricity = [elec({ supply: "renewable", amount: "100", factor: "0", source: "" })])));
    expect(renewableNoSource.warnings.some((w) => /no emission factor/.test(w))).toBe(true);
  });

  it("leaves the CEA value unset until a year-matched factor is entered", () => {
    const e = newElectricity();
    expect(e.factor).toBe("");
    expect(e.source).toMatch(/CEA CO₂ Baseline Database/);
  });

  it("sums twelve individually entered monthly values", () => {
    const s = withOperation((x) => {
      const row = elec({ monthlyMode: true, monthlyAmounts: Array.from({ length: 12 }, () => "1000"), factor: "0.5" });
      x.operational.electricity = [row];
    });
    const result = calculate(s).operational;
    expect(result.electricity[0].annualAmount).toBe(12000);
    expect(result.electricityPerYear).toBe(6000);
  });
});

describe("operational fuel and water", () => {
  it("fuel: litres per year × factor (500 L diesel × 2.68 = 1,340 kg per building)", () => {
    const s = withOperation((x) => (x.operational.fuel = [{ ...newFuel(), amount: "500" }]));
    near(calculate(s).operational.fuelPerYear, 1340);
  });

  it("keeps fuel combustion separate from upstream production and supply", () => {
    const s = withOperation((x) => (x.operational.fuel = [{ ...newFuel(), amount: "100", factor: "2.5", upstreamFactor: "0.4", upstreamSource: "Documented upstream study" }]));
    const result = calculate(s).operational;
    near(result.fuelDirectPerYear, 250);
    near(result.fuelUpstreamPerYear, 40);
    near(result.fuelPerYear, 290);
  });

  it("water: litres convert to m³ before the per-m³ factor", () => {
    expect(toM3(120000, "litre")).toBe(120);
    const s = withOperation((x) => (x.operational.water = [{ ...newWater(), amount: "120000", unit: "litre", factor: "0.5", source: "Test value" }]));
    near(calculate(s).operational.waterPerYear, 60);
  });

  it("calculates wastewater only from its separate entered volume and factor", () => {
    const s = withOperation((x) => (x.operational.water = [{ ...newWater(), amount: "100", factor: "0.2", wastewaterAmount: "60", wastewaterFactor: "0.5", wastewaterSource: "Treatment source" }]));
    const result = calculate(s).operational;
    near(result.waterSupplyPerYear, 20);
    near(result.wastewaterPerYear, 30);
    near(result.waterPerYear, 50);
  });

  it("does not guess a water or non-diesel fuel factor", () => {
    const s = withOperation((x) => {
      x.operational.water = [{ ...newWater(), amount: "100" }];
      x.operational.fuel = [{ ...newFuel(), fuel: "LPG", amount: "50", factor: "", source: "" }];
    });
    const r = calculate(s);
    expect(r.operational.waterPerYear).toBe(0);
    expect(r.operational.fuelPerYear).toBe(0);
    expect(r.warnings.filter((w) => /no (direct combustion|water supply) factor/.test(w))).toHaveLength(2);
  });

  it("each category works on its own", () => {
    const water = withOperation((x) => (x.operational.water = [{ ...newWater(), amount: "10", factor: "0.5", source: "Test" }]));
    const r = calculate(water);
    near(r.operational.perYearBuilding, 5);
    expect(r.operational.electricityPerYear).toBe(0);
    expect(r.operational.fuelPerYear).toBe(0);
    expect(r.warnings.some((w) => /Electricity "|Fuel "/.test(w))).toBe(false);
  });
});

describe("operational totals and intensity", () => {
  const s = withOperation((x) => {
    x.operational.electricity = [elec({ amount: "12000", factor: "0.43" })];
    x.operational.fuel = [{ ...newFuel(), amount: "500" }];
    x.operational.years = "50";
    x.operational.occupants = "4";
  });
  const r = calculate(s);
  const o = r.operational;

  it("adds the three categories and multiplies by buildings and years", () => {
    near(o.perYearBuilding, 5160 + 1340);
    near(o.perYearAll, 65000);
    near(o.totalAll, 65000 * 50);
  });

  it("intensity per m² per year, kWh per m² per year and per occupant", () => {
    near(o.perM2Year!, 65000 / 3300, 6);
    near(o.electricityKWhPerM2Year!, 120000 / 3300, 6);
    near(o.perOccupantYear!, 65000 / 40);
  });

  it("shows construction + operation without changing the construction total", () => {
    near(r.total, 131370.377143, 4);
    near(o.withConstructionAll, r.total + 65000 * 50, 4);
  });

  it("returns null intensities without floor area or occupants, and no data gives zero", () => {
    const noArea = withOperation((x) => {
      x.project.area = "";
      x.operational.electricity = [elec({ amount: "100" })];
    });
    expect(calculate(noArea).operational.perM2Year).toBeNull();
    expect(calculate(noArea).operational.perOccupantYear).toBeNull();
    const none = calculate(referenceState()).operational;
    expect(none.hasData).toBe(false);
    expect(none.totalAll).toBe(0);
  });

  it("treats a blank duration as one year (and says so), negatives as 0", () => {
    const bad = withOperation((x) => {
      x.operational.years = "";
      x.operational.electricity = [elec({ amount: "-5" })];
    });
    const rr = calculate(bad);
    expect(rr.operational.years).toBe(1);
    expect(rr.operational.electricityPerYear).toBe(0);
    expect(rr.warnings.some((w) => /negative/i.test(w))).toBe(true);
    expect(rr.warnings.some((w) => /Years of operation/.test(w))).toBe(true);
  });
});

describe("operational data storage and export", () => {
  it("data saved before this module existed loads with sensible defaults", () => {
    const old = JSON.parse(JSON.stringify(referenceState()));
    delete old.operational;
    const back = sanitizeState(old);
    expect(back.operational.electricity).toHaveLength(1);
    expect(back.operational.years).toBe("1");
    near(calculate(back).total, 131370.377143, 4);
  });

  it("round-trips operational records", () => {
    const s = withOperation((x) => {
      x.operational.electricity = [elec({ amount: "12", unit: "MWh", period: "quarter", factor: "0.43" })];
      x.operational.water = [{ ...newWater(), amount: "5", unit: "litre", factor: "0.4", source: "Test" }];
      x.operational.mode = "detailed";
    });
    const back = sanitizeState(JSON.parse(JSON.stringify(s)));
    expect(back.operational.mode).toBe("detailed");
    expect(back.operational.electricity[0]).toMatchObject({ unit: "MWh", period: "quarter" });
    near(calculate(back).operational.perYearBuilding, calculate(s).operational.perYearBuilding);
    expect(sanitizeOperational({ electricity: [{ unit: "banana", period: "decade" }] }).electricity[0]).toMatchObject({ unit: "kWh", period: "year" });
  });

  it("the CSV includes the operational block only when there is data", () => {
    const withData = withOperation((x) => (x.operational.electricity = [elec({ amount: "12000", factor: "0.43" })]));
    const csv = toCsv(withData, calculate(withData));
    expect(csv).toContain("Operational carbon");
    expect(csv).toContain('"Operational total","5160","51600","51600"');
    expect(toCsv(referenceState(), calculate(referenceState()))).not.toContain("Operational carbon");
  });
});
