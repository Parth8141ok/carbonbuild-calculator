# CarbonBuild: Construction Carbon Footprint Calculator

**Measure. Understand. Reduce.** CarbonBuild estimates the carbon footprint of building construction from material quantities, waste allowances, transport and site machinery, with a full audit trail for every number. Its reference data and method come from the B.Tech project report *Carbon Footprint Assessment of Construction Projects* and its BIM chapters (Sarvajanik University, Surat, 2026).

It is an estimation tool, not a substitute for a verified EPD, a professional life-cycle assessment, a structural assessment or regulatory certification.

## Features

- **Dashboard**: projects at a glance, with each project's total, intensity, status and top warnings.
- **Project wizard** (5 steps, auto-saved): project details, three input modes (quick estimate, material-based, detailed), materials by construction stage, transport and machinery, review.
- **Calculation engine** (`src/lib/engine`): pure TypeScript with no UI code.
  - Volume → mass by density; brickwork by bricks per m³ and mass per brick; kg/tonne factors converted.
  - Waste emissions split into production of wasted material (A1–A3), waste treatment and disposal (C2–C4), combined, or boundary not stated.
  - Optional production of installed material (A1–A3, "expanded boundary").
  - Transport by fuel (trips × distance ÷ km/L, or measured litres) or by **tonne-km** (mass × distance × factor per t·km).
  - Machinery by hours × documented L/h, or measured litres. No default rate is assumed.
  - Overlap protection: factor components with overlapping life-cycle modules are rejected; cement inside concrete is not counted twice; duplicates are flagged; one transport method per delivery.
  - Multi-building groups are multiplied only when confirmed identical.
  - Transport and machinery sections can be switched off; exclusions are flagged.
  - Life-cycle coverage (EN 15978 module names) is reported for every result.
- **Quantity estimator**: derives slab and brickwork quantities from dimensions; anything underivable uses disclosed reference-bungalow ratios (marked *assumed*) or is left missing.
- **Material library** and **editable emission-factor library** with value, unit, source, geography, version, boundary, notes and status (source-derived, user-provided, verified external, illustrative). Projects keep a factor snapshot, so editing the library never silently changes an existing assessment.
- **Results**: totals in kg and t CO₂e, per m², per building; production/waste split; donut, ranking, stacked and stage charts with table views; a sortable, filterable calculation table with formula and substitution per row; data quality and sensitivity analysis.
- **What-if scenarios**: waste rates, material quantities, transport fuel, machinery fuel, distances and alternative factors. Each measure is also run alone, and overlaps (interaction) are shown rather than double-counted.
- **Reports**: PDF (jsPDF), Excel (ExcelJS), CSV and a JSON project file, all generated from the current calculation.
- **Reference sample** (10 bungalows, Surat), reconciled line by line against the report. Discrepancies in the source documents are listed on the Methodology page.
- **Projects and settings**: duplicate, archive, delete, saved versions and comparison, full backup and restore, defaults for new projects.

## Reference reconciliation

The sample is calculated by the same engine as any project. At full precision it gives **13,137.04 kg CO₂e per bungalow** (131,370.38 for ten) against the report's 13,137.02 (131,370.20). The 0.02 kg difference comes from the report truncating delivery-truck diesel to 514.28 L (1,800 ÷ 3.5 = 514.2857). The report's foundation-inclusive sensitivity (13,903.82) has a different scope and is a separate calculation profile. Neither published total is hard-coded. See `docs/reference-extraction.md` and the Methodology page.

## Tech stack

Next.js 16 (App Router, TypeScript), Tailwind CSS v4, Radix UI primitives, Recharts, Zustand (local persistence), Zod (validation), jsPDF + jspdf-autotable, ExcelJS, Vitest.

## Getting started

Requires Node.js 20 or later (developed on Node 24).

```bash
npm install
npm run dev
```

Open http://localhost:3000.

| Command | Purpose |
|---|---|
| `npm run dev` | Development server |
| `npm test` | Unit tests (Vitest) |
| `npm run typecheck` | TypeScript check |
| `npm run lint` | ESLint |
| `npm run build` | Static production build into `out/` |
| `npm run preview` | Serve `out/` locally, e.g. `npm run preview -- --base=/carbonbuild-calculator` |

**Environment variables:** none. The app needs no API keys, database or paid service, so there is no `.env.example`.

## Tests

73 automated tests in `src/lib/engine/*.test.ts` and `src/lib/export/export.test.ts` cover the following:

- Units and quantities: material emissions, m³→kg by density, kg↔t, kgCO₂e/t→kg.
- Waste: waste mass, and waste-treatment (C2–C4) emissions separated from production.
- Factors and units: steel, diesel, transport tonne-km, incompatible units, missing factors, illustrative-factor flags.
- Totals: project totals, per m², per building.
- Inputs: zero vs missing vs negative quantities.
- Double counting: overlapping boundaries, cement in concrete, duplicate entries.
- Projects: multi-building groups, section exclusion, life-cycle coverage.
- Scenarios: reduction and percentage, overlap detection, migration of older saved settings.
- Reference: line-by-line reconciliation with the report and the discrepancy explanations.
- Files: CSV, Excel and PDF content; project-file import/export; version snapshots; CSV take-off import.

## Project structure

```
src/
  app/                 Routes: / dashboard assess results projects materials factors reports methodology settings about privacy disclaimer
  components/          UI (assess/ wizard steps, results/ dashboard tabs, charts, ui/ primitives)
  lib/
    engine/            Calculation engine, factor dataset, estimator, scenarios, reference sample, schema, tests
    export/            CSV, Excel and PDF builders (+ tests)
    store.ts           Zustand store persisted to localStorage
    projects.ts        Duplicate, snapshot, import/export helpers
docs/reference-extraction.md   Values taken from the source PDFs, with table references
scripts/preview-static.mjs     Local static server for the exported site
.github/workflows/deploy-pages.yml   Build and deploy to GitHub Pages
```

## Data storage

Projects, saved versions, user factors and settings are stored in the browser's localStorage. There are no accounts and no server database, so data stays on one device and is lost if site data is cleared. Use **Settings → Download backup**, or export project files. The engine has no dependency on storage, so a database (e.g. Supabase with row-level security) can be added later without changing calculations.

## Deployment

CarbonBuild runs entirely in the browser, so it is built as a static site (`output: "export"` in `next.config.ts`). `npm run build` writes plain HTML, CSS and JavaScript to `out/`, which any static host can serve.

### GitHub Pages

The workflow `.github/workflows/deploy-pages.yml` runs lint, type check and tests, builds the site with the repository's base path, and publishes it on every push to `main` (or manually from the Actions tab).

One-time setup:

1. GitHub Pages needs a **public** repository on a free GitHub plan. Private repositories need GitHub Pro, Team or Enterprise. The published site is public either way.
2. In the repository, go to **Settings → Pages → Build and deployment → Source** and choose **GitHub Actions**.
3. Push to `main`, or run the workflow from the **Actions** tab.

The site is then served at `https://<owner>.github.io/<repository>/`, for example `https://parth8141ok.github.io/carbonbuild-calculator/`. The base path comes from `actions/configure-pages`, so a custom domain also works without code changes.

To check a Pages build locally (in PowerShell, or Git Bash with `MSYS_NO_PATHCONV=1` so the path is not rewritten):

```bash
PAGES_BASE_PATH=/carbonbuild-calculator npm run build
npm run preview -- --base=/carbonbuild-calculator
```

Then open http://localhost:4173/carbonbuild-calculator/.

### Vercel or another static host

Import the repository in Vercel; it detects Next.js and serves the static export. No environment variables are needed. Any other static host can serve `out/` from a plain `npm run build`.

## Limitations

- Construction-stage boundary by default. Even the expanded boundary excludes the use stage (B), demolition (C1) and module D, so no result is a whole-life footprint.
- Reference factors are secondary values from the study, not supplier EPDs. Illustrative factors (sand and aggregates, aluminium, glass, timber) have no cited source and are flagged wherever used.
- No per-tonne-km factor is supplied: the reports give none. Add a sourced one to use the tonne-km method.
- Revit and IFC files are not read; detailed mode imports a take-off schedule as CSV.
- Scenario results do not check structural suitability.
