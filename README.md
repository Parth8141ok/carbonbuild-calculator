# CarbonBuild: Construction Carbon Calculator

**B.Tech Civil Engineering Project 2026 · SCET, Sarvajanik University, Surat · college assignment**

**Live website:** https://parth8141ok.github.io/carbonbuild-calculator/

CarbonBuild is the software part of the B.Tech project *Carbon Footprint Assessment of Construction Projects*. It is one page: enter materials, waste, transport and site equipment, assess operational electricity, fuel and water, and explore a waste-reduction scenario. Construction emissions are expressed in kg CO₂e. Operational results show the factor basis explicitly; where the CEA CO₂-only electricity factor is combined with CO₂e categories, totals are marked mixed basis. The page opens with the report's example (ten three-storey bungalows at Surat), so the construction result can be compared with the report straight away.

It was built for learning and academic evaluation, not for professional, commercial or compliance use.

## Project team

- Parth Vasava, Tulsi Patel, Viraj Lad, Gaurang Parmar
- Guide: Prof. Mitali Shah
- Department of Civil Engineering, Sarvajanik College of Engineering & Technology (SCET), Sarvajanik University, Surat

## How to use it

The page has eight working sections, top to bottom:

1. **Project details**: name, location, number of identical buildings, built-up area per building.
2. **Materials and waste**: quantity, waste %, production factor and waste-treatment factor per material. A **What-if waste %** column feeds the scenario. Untick *Count* to leave a row out of the totals.
3. **Transport**: deliveries by fuel (trips × distance ÷ km per litre) or by tonne-km.
4. **Site equipment**: hours × litres per hour × fuel factor, plus any other emissions.
5. **Results**: total, per building, per m², and bar charts by source and by material.
6. **Operational carbon assessment**: building service life, optional occupants and building use, and independent electricity, fuel and water records. Electricity can use a single period amount or 12 monthly values. Fuel factors separate direct combustion from optional upstream production and supply. Water supply and wastewater treatment use separate volumes and factors. The section reports annual and lifetime results, category totals, a source breakdown, and intensity per floor area or occupant.
7. **Waste-reduction scenario**: what-if waste, transport and equipment reductions, with the saving. *Use the report's three measures* recalculates the report's illustrative case (about 35%).
8. **Checks and export**: warnings about missing or odd inputs; CSV, JSON and Print / Save PDF.

Entries are saved in the browser automatically. *Load the report example* and *Start a blank project* reset the page.

## Formulas

All quantities are per building and are multiplied by the number of buildings at the end.

- Material waste = quantity × waste % ÷ 100 × (production factor + waste-treatment factor)
- Transport (fuel) = trips × distance ÷ km per litre × kg CO₂e per litre; (tonne-km) = trips × distance × load × factor
- Equipment = hours × litres per hour × kg CO₂e per litre
- Operational emissions = annual activity × factor × service life × building count, with constant annual use and factors assumed. Monthly and quarterly amounts are annualised; yearly amounts are used once. Twelve electricity values are summed. Electricity MWh is converted to kWh and water litres to m³ before applying the factors.
- Fuel emissions show direct combustion and upstream production/supply separately. Water supply and wastewater treatment also remain separate. Wastewater volume must be entered independently and is never assumed equal to supplied water.
- Per m² = total ÷ (area per building × number of buildings); 1,000 kg = 1 tonne

Each factor is per unit of the quantity, so the units must match (a per-m³ factor for a quantity in m³). Blank, invalid and negative entries count as 0 and are listed under Checks. Nothing is rounded during the calculation.

## Operational carbon assumptions

The operational module is independent from the construction-stage results and can be used with electricity, fuel or water alone. Consumption is entered per building for a month, quarter or year, then normalised to one year. Electricity can also be entered month by month and the 12 values are summed. A selected annual amount is not multiplied again. Lifetime results assume constant annual consumption and factors, multiplied by service life and building count.

New grid electricity records leave the factor blank. Select and record the applicable value from the CEA CO₂ Baseline Database for the electricity consumption year. CEA reports CO₂ only, so the electricity component excludes CH₄ and N₂O. Record the CEA version, year, India grid region, and source with the value. The earlier project report's **0.43 kg CO₂e/kWh** is a historical example, not a current grid default.

New diesel records use **2.68 kg CO₂e/litre** from BIM report Table 9.3 for direct combustion only. It does not include upstream production or supply. Fuel type changes clear the previous fuel's factors; petrol, LPG, natural gas, other fuels, and upstream factors start blank until a sourced, unit-matched value is entered. Water supply and wastewater treatment factors also start blank. The supply factor is per m³, and litres are converted to m³. Wastewater volume is an optional independent input and is not assumed equal to supplied water.

The module reports electricity, direct fuel combustion, upstream fuel, water supply and wastewater emissions separately, with annual totals in kg and lifetime totals in tonnes. Electricity uses the CEA CO₂-only basis, while other categories may use CO₂e factors. The operational and construction-plus-operation totals are labelled as mixed-basis estimates; the app does not convert CEA CO₂ into CO₂e. Combining these values is useful for screening but is not a harmonized whole-life CO₂e result. The construction result itself is unchanged. This is not a complete lifecycle assessment.

## Reference example and reconciliation

The page opens with the report's quantities, waste rates, factors and fuel data (BIM chapters, Tables 9.2, 9.3 and 9.9). It gives **13,137.04 kg CO₂e per bungalow** (131,370.38 for ten, 39.81 kg/m²), against the report's 13,137.02 (131,370.20). The 0.02 kg difference comes from the report rounding the delivery-truck diesel down to 514.28 L (1,800 ÷ 3.5 = 514.2857). The report's master total leaves out the foundation stage, so that row is unticked; with it the result is 13,903.84 (report: 13,903.82). The totals are calculated from the inputs, never copied. `docs/reference-extraction.md` lists every value with its table and the inconsistencies found in the report.

## Running it locally

Requires Node.js 20 or later (developed on Node 24).

```bash
npm install
npm run dev
```

Open http://localhost:3000.

| Command | Purpose |
|---|---|
| `npm run dev` | Development server |
| `npm test` | Automated tests (Vitest) |
| `npm run typecheck` | TypeScript check |
| `npm run lint` | ESLint |
| `npm run build` | Static build into `out/` |
| `npm run preview` | Serve `out/` locally |

No environment variables, API keys, database or paid services are needed.

## Tests

41 automated tests in `src/lib/calc.test.ts` check:
- every element of the report's master schedule, the wastage subtotal, the totals and the 73.6% / 26.4% split;
- the foundation row (left out, then counted);
- the report's three reduction measures (about 35%) and the cost saving;
- blank, negative and over-100% inputs, and missing fuel economy or equipment rate (not guessed);
- fuel and tonne-km transport, and the number of buildings;
- operational monthly electricity totals, fuel combustion/upstream separation, water/wastewater separation, unit conversions, lifetime totals, missing-factor handling and CSV export;
- the CSV export and restoring saved data.

## Project structure

```
src/
  app/page.tsx                  The page
  components/calculator.tsx     The calculator (all sections)
  lib/calc.ts                   Calculation module: formulas, report example, CSV, no user-interface code
  lib/calc.test.ts              Tests
  lib/use-stored-state.ts       Saves entries in the browser
docs/reference-extraction.md    Values taken from the report, with table references
scripts/preview-static.mjs      Local server for the built site
.github/workflows/deploy-pages.yml   Builds and publishes the site to GitHub Pages
```

## Hosting

The page runs entirely in the browser, so it is built as a static site and hosted free on GitHub Pages. Every push to `main` runs lint, type check and tests, then republishes the site; it can also be run by hand from the repository's **Actions** tab. Entries are saved only in each visitor's browser, so nothing is shared between visitors. To check a Pages build locally: `MSYS_NO_PATHCONV=1 PAGES_BASE_PATH=/carbonbuild-calculator npm run build`, then `npm run preview -- --base=/carbonbuild-calculator`.

## Limitations and future scope

- The construction-stage boundary is material waste, transport and equipment fuel. The separate operational module estimates electricity, fuel and water use over a stated period. Neither section includes all embodied impacts of materials that stay in the building or demolition, so this is not a whole-life assessment.
- The factors are secondary values from the report, not supplier-specific data. Check any factor you add against its source and unit.
- Possible future work, following Chapter 14 of the report: reading BIM take-off schedules directly, local EPD data for Surat suppliers, measured site fuel data, and whole-life assessment.
