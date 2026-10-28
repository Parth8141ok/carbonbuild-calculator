# CarbonBuild: Construction Carbon Footprint Calculator

**B.Tech Civil Engineering Project 2026 · SCET, Sarvajanik University, Surat · college assignment**

**Live website:** https://parth8141ok.github.io/carbonbuild-calculator/

CarbonBuild is the software part of the B.Tech project *Carbon Footprint Assessment of Construction Projects*. It estimates the construction-stage carbon footprint of a building from material quantities, waste allowances, transport and site machinery, and shows the formula and numbers behind every result. Its method and reference data come from the project report and its BIM chapters (Chapters 7–14).

It was built for learning and academic evaluation, not for professional, commercial or compliance use.

## Project team

- Parth Vasava, Tulsi Patel, Viraj Lad, Gaurang Parmar
- Guide: Prof. Mitali Shah
- Department of Civil Engineering, Sarvajanik College of Engineering & Technology (SCET), Sarvajanik University, Surat

## Quick tour for examiners

1. Open the live website and go to **Dashboard → Load sample project** (ten three-storey RCC bungalows at Surat, from the report).
2. The results page shows **131,370.38 kg CO₂e** for the ten bungalows, calculated from the report's quantities and factors.
3. **Calculation table**: select any row to see its formula, substitution and result.
4. **What-if scenarios → Report measures** recalculates the report's illustrative reductions (about **35%**).
5. **Methodology → Reference reconciliation** compares every component with the report's master schedule.
6. **Reports & export** downloads a PDF report, an Excel workbook or a CSV of the calculation.

## Where each part of the report appears

| Report | Topic | In the website |
|---|---|---|
| Ch. 1 | Project data (10 bungalows, Surat) | Sample project |
| Ch. 3 | Materials and base carbon factors | Emission factors page |
| Ch. 4 | Material waste by construction stage | Assessment → step 3 (Materials) |
| Ch. 5 | Transportation and machinery fuel | Assessment → step 4 |
| Ch. 6 | Cumulative footprint and shares | Results → Overview |
| Ch. 7–9 | BIM parameters and schedules | Results → Calculation table; CSV take-off import |
| Ch. 9.11 | Validation and foundation sensitivity | Methodology → Reference reconciliation; calculation profiles |
| Ch. 11 | Results and what-if scenarios | Results → What-if scenarios |
| Ch. 13 | Limitations and assumptions | Methodology → Limitations; Results → Data quality |
| Ch. 14 | Recommendations | Results → Where to act first |

## Features

- **Dashboard** with each project's total, intensity and warnings.
- **Assessment wizard** (5 steps, saved automatically): project details, three input modes (quick estimate, material-based, detailed), materials by construction stage, transport and machinery, review.
- **Calculation engine** (`src/lib/engine`), separate from the user interface:
  - Converts volume to mass with density, and brickwork through bricks per m³ and mass per brick.
  - Wasted mass = total mass × waste %; waste emissions = wasted mass × emission factor. These are split into production of wasted material (A1–A3) and waste treatment and disposal (C2–C4).
  - Optional production of installed material (the "expanded boundary").
  - Transport by fuel (trips × distance ÷ km/L, or measured litres) or by tonne-km. Machinery by hours × litres per hour, or measured litres.
  - Guards against double counting: overlapping factor boundaries are rejected, cement inside concrete is not counted twice, and duplicate entries are flagged.
- **Quantity estimator** that derives quantities from building dimensions and labels anything taken from the reference bungalow as *assumed*.
- **Material library** and **emission-factor library** recording each factor's source, boundary and status.
- **Results**: totals in kg and tonnes CO₂e, per m² and per building; charts with table views; data quality and sensitivity.
- **What-if scenarios** for waste rates, quantities, fuel, distances and alternative factors.
- **Reports**: PDF, Excel, CSV and a project file.
- **Projects and settings**: duplicate, archive, saved versions, backup and restore.

## Reference reconciliation

The sample is calculated by the same engine as any other project. At full precision it gives **13,137.04 kg CO₂e per bungalow** (131,370.38 for ten), against the report's 13,137.02 (131,370.20). The 0.02 kg difference comes from the report rounding the delivery-truck diesel down to 514.28 L (1,800 ÷ 3.5 = 514.2857). The report's foundation-inclusive sensitivity (13,903.82) has a different scope, so it is a separate calculation profile. Neither published total is hard-coded. Other inconsistencies found in the report (typing errors, rounding, the excluded foundation stage) are listed on the Methodology page and in `docs/reference-extraction.md`.

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

73 automated tests (`src/lib/engine/*.test.ts`, `src/lib/export/export.test.ts`) check the following:
- the formulas, unit conversions and waste calculations;
- transport (fuel and tonne-km) and machinery;
- totals per m² and per building;
- missing, zero and negative inputs;
- double counting;
- scenarios;
- the reconciliation with the report;
- the CSV, Excel and PDF exports.

## Project structure

```
src/
  app/                 Pages: / dashboard assess results projects materials factors reports methodology settings about privacy disclaimer
  components/          User interface (assess/ wizard steps, results/ dashboard tabs, charts, ui/ building blocks)
  lib/
    engine/            Calculation engine, factor dataset, estimator, scenarios, reference sample, tests
    export/            CSV, Excel and PDF builders (+ tests)
    store.ts           Saved projects (browser local storage)
docs/reference-extraction.md         Values taken from the project report, with table references
scripts/preview-static.mjs           Local server for the built site
.github/workflows/deploy-pages.yml   Builds and publishes the site to GitHub Pages
```

## Hosting

The website runs entirely in the browser, so it is built as a static site and hosted free on GitHub Pages. Every push to `main` runs lint, type check and tests, then republishes the site; it can also be run by hand from the repository's **Actions** tab. Projects are saved only in each visitor's browser (local storage), so nothing is shared between visitors.

## Limitations and future scope

- The default boundary is the construction stage only (wasted material, transport, machinery), as in the report. It is not a whole-life carbon assessment.
- Emission factors are secondary values from the report, not supplier-specific EPDs. Illustrative factors (sand and aggregates, aluminium, glass, timber) have no cited source and are flagged wherever they are used.
- The report gives no factor per tonne-km, so the tonne-km transport method needs a sourced factor to be added.
- Revit and IFC models are not read directly; a take-off schedule can be imported as CSV.
- Possible future work, following Chapter 14 of the report: direct BIM model integration, local EPD data for Surat suppliers, measured site fuel data, and whole-life (operational and end-of-life) assessment.
