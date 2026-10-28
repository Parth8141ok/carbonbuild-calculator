# CarbonBuild: Construction Carbon Calculator

**B.Tech Civil Engineering Project 2026 · SCET, Sarvajanik University, Surat · college assignment**

**Live website:** https://parth8141ok.github.io/carbonbuild-calculator/

CarbonBuild is the software part of the B.Tech project *Carbon Footprint Assessment of Construction Projects*. It is one simple page: enter your project's materials, waste, transport and site equipment, and it shows the carbon footprint in kg CO₂e, with a waste-reduction scenario. It opens with the report's example (ten three-storey bungalows at Surat), so the result can be compared with the report straight away.

It was built for learning and academic evaluation, not for professional, commercial or compliance use.

## Project team

- Parth Vasava, Tulsi Patel, Viraj Lad, Gaurang Parmar
- Guide: Prof. Mitali Shah
- Department of Civil Engineering, Sarvajanik College of Engineering & Technology (SCET), Sarvajanik University, Surat

## How to use it

The page has seven sections, top to bottom:

1. **Project details**: name, location, number of identical buildings, built-up area per building.
2. **Materials and waste**: quantity, waste %, production factor and waste-treatment factor per material. A **What-if waste %** column feeds the scenario. Untick *Count* to leave a row out of the totals.
3. **Transport**: deliveries by fuel (trips × distance ÷ km per litre) or by tonne-km.
4. **Site equipment**: hours × litres per hour × fuel factor, plus any other emissions.
5. **Results**: total, per building, per m², and bar charts by source and by material.
6. **Waste-reduction scenario**: what-if waste, transport and equipment reductions, with the saving. *Use the report's three measures* recalculates the report's illustrative case (about 35%).
7. **Checks and export**: warnings about missing or odd inputs; CSV, JSON and Print / Save PDF.

Entries are saved in the browser automatically. *Load the report example* and *Start a blank project* reset the page.

## Formulas

All quantities are per building and are multiplied by the number of buildings at the end.

- Material waste = quantity × waste % ÷ 100 × (production factor + waste-treatment factor)
- Transport (fuel) = trips × distance ÷ km per litre × kg CO₂e per litre; (tonne-km) = trips × distance × load × factor
- Equipment = hours × litres per hour × kg CO₂e per litre
- Per m² = total ÷ (area per building × number of buildings); 1,000 kg = 1 tonne

Each factor is per unit of the quantity, so the units must match (a per-m³ factor for a quantity in m³). Blank, invalid and negative entries count as 0 and are listed under Checks. Nothing is rounded during the calculation.

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

20 automated tests in `src/lib/calc.test.ts` check:
- every element of the report's master schedule, the wastage subtotal, the totals and the 73.6% / 26.4% split;
- the foundation row (left out, then counted);
- the report's three reduction measures (about 35%) and the cost saving;
- blank, negative and over-100% inputs, and missing fuel economy or equipment rate (not guessed);
- fuel and tonne-km transport, and the number of buildings;
- the CSV export and restoring saved data.

## Project structure

```
src/
  app/page.tsx                  The page
  components/calculator.tsx     The calculator (all seven sections)
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

- The boundary is material waste, transport and equipment fuel only, as in the report. It does not include the material that stays in the building, nor its use or demolition, so it is not a whole-life assessment.
- The factors are secondary values from the report, not supplier-specific data. Check any factor you add against its source and unit.
- Possible future work, following Chapter 14 of the report: reading BIM take-off schedules directly, local EPD data for Surat suppliers, measured site fuel data, and whole-life assessment.
