import type { Metadata } from "next";
import Link from "next/link";
import { ReconciliationTable } from "@/components/results/reconciliation";
import { Badge, Button, Callout } from "@/components/ui/primitives";
import { FACTOR_DATASET_VERSION, PROFILE_DESCRIPTIONS, PROFILE_LABELS, SOURCE_DISCREPANCIES } from "@/lib/engine";
import { getSampleResult } from "@/lib/sample-result";

export const metadata: Metadata = {
  title: "Methodology",
  description: "How CarbonBuild calculates construction-stage carbon emissions: formulas, boundaries, factors, assumptions and limitations.",
};

const STAGES: { code: string; name: string; included: "yes" | "partial" | "expanded" | "no"; note: string }[] = [
  { code: "A1–A3", name: "Product stage: raw material supply, transport to factory, manufacturing", included: "partial", note: "For wasted material only (default). The expanded boundary adds installed material where a production-only factor is selected." },
  { code: "A4", name: "Transport to site", included: "yes", note: "Diesel for ready-mix transit mixers and material delivery trucks." },
  { code: "A5", name: "Construction and installation", included: "yes", note: "Diesel for site machinery, plus the production and disposal impacts of material wasted on site." },
  { code: "B1–B7", name: "Use stage: use, maintenance, repair, replacement, operational energy and water", included: "no", note: "Not assessed. Operational energy usually exceeds construction-stage emissions over a building's life." },
  { code: "C1–C4", name: "End of life: demolition, transport, waste processing, disposal", included: "partial", note: "Only where a factor includes the disposal of construction waste (e.g. C2–C4 for foundation concrete). The building's own demolition is not assessed." },
  { code: "D", name: "Benefits and loads beyond the system boundary (reuse, recycling)", included: "no", note: "Not assessed." },
];

export default function MethodologyPage() {
  const sample = getSampleResult();
  return (
    <div className="mx-auto max-w-4xl px-4 py-10 sm:px-6">
      <p className="text-xs font-semibold uppercase tracking-wider text-leaf">Documentation</p>
      <h1 className="mt-1 text-3xl font-semibold tracking-tight">Methodology</h1>
      <p className="mt-3 text-lg text-ink-muted">
        CarbonBuild estimates the carbon footprint of building construction from activity data (material quantities, waste allowances, transport and machinery fuel) and emission factors. It follows the method of the reference study, &ldquo;Carbon Footprint Assessment of Construction Projects&rdquo; (B.Tech Project 2026, Sarvajanik University, Surat) and its BIM chapters. This page explains it in plain language.
      </p>
      <nav aria-label="On this page" className="mt-6 rounded-xl border border-line bg-surface p-4 text-sm">
        <ul className="grid gap-1 sm:grid-cols-2">
          {[
            ["#basics", "Carbon footprint and kg CO₂e"],
            ["#method", "The emission-factor method"],
            ["#waste", "Material wastage"],
            ["#fuel", "Transport and machinery"],
            ["#boundary", "Boundary and life-cycle stages"],
            ["#profiles", "Calculation profiles"],
            ["#factors", "Emission factors"],
            ["#bim", "The role of BIM"],
            ["#limitations", "Assumptions and limitations"],
            ["#reconciliation", "Reference reconciliation"],
          ].map(([h, l]) => (
            <li key={h}>
              <a href={h} className="text-ink-muted hover:text-ink hover:underline">
                {l}
              </a>
            </li>
          ))}
        </ul>
      </nav>

      <Section id="basics" title="What a carbon footprint is">
        <p>
          A carbon footprint is the total greenhouse-gas emissions caused by an activity. Different gases (carbon dioxide, methane, nitrous oxide) are converted to the amount of CO₂ that would have the same warming effect, and reported as <strong>kilograms of CO₂ equivalent (kg CO₂e)</strong>. 1,000 kg CO₂e is one tonne (t CO₂e).
        </p>
        <p>
          <strong>Direct emissions</strong> (GHG Protocol Scope 1) come from sources on the project itself, such as diesel burnt in excavators and cranes. <strong>Indirect emissions</strong> (Scope 3) occur elsewhere because of the project, such as at the cement kiln, the steel mill and the brick kiln, or in suppliers&apos; delivery trucks.
        </p>
        <p>
          <strong>Embodied carbon</strong> is the carbon released to make, transport, install and finally dispose of building materials. <strong>Operational carbon</strong> comes from running the building: electricity, cooling, water. This tool estimates part of the embodied carbon, related to the construction stage. It does not estimate operational carbon.
        </p>
      </Section>

      <Section id="method" title="The emission-factor method">
        <p>Every emission is an activity quantity multiplied by an emission factor, the kg CO₂e released per unit of that activity:</p>
        <Formula>E_total = Σ ( activity data_i × emission factor_i )</Formula>
        <p>
          Quantities are converted to compatible units first. A factor in kg CO₂e per tonne is divided by 1,000. A volume is multiplied by density. Project emissions in tonnes = kg ÷ 1,000. Emissions intensity = total emissions ÷ total included built-up area (kg CO₂e/m²).
          <strong>Activity data</strong> is what happened or will happen on the project (7,800 kg of steel, 540 litres of diesel). An <strong>emission factor</strong> converts it to emissions (1.92 kg CO₂e per kg of steel, 2.68 kg CO₂e per litre). A factor is only applied to a quantity in its matching unit: a volume is never multiplied by a per-kg factor without first converting it to mass.
        </p>
        <p>
          <strong>Precision and rounding.</strong> Calculations use JavaScript double-precision numbers (about 15–16 significant digits) at every step and are never rounded in between. Values are rounded only when displayed: emissions to 2 decimals, factors to 4. CSV files keep 6 decimals, which removes binary floating-point noise without losing meaningful precision. Each result has an audit trail of every formula and the numbers substituted into it.
        </p>
      </Section>

      <Section id="waste" title="Material wastage">
        <p>Concrete, steel and bricks that are delivered but never become part of the building still carry the carbon of their production, and the impacts of handling and disposing of them.</p>
        <Formula>{`Total mass (kg)  = volume (m³) × density (kg/m³)        e.g. 14 × 2,400 = 33,600
Wasted mass (kg) = total mass × waste % ÷ 100            e.g. 33,600 × 6% = 2,016
Waste emissions  = wasted mass × emission factor         e.g. 2,016 × 0.142 = 286.27 kg CO₂e`}</Formula>
        <p>
          Bricks are converted through bricks per m³ (500) and mass per brick (3 kg). Where production (A1–A3) and disposal (C2–C4) are modelled separately, as for foundation concrete (0.13 + 0.012), both components are applied to the wasted mass and added. They are added only when their life-cycle modules do not overlap. A factor that already includes disposal (0.142) can never receive a second disposal factor; the engine rejects the combination.
        </p>
        <p>
          <strong>Material production vs waste treatment.</strong> Each factor carries its life-cycle modules, so waste emissions are reported in parts: production of the wasted material (A1–A3), waste treatment and disposal (C2–C4), or both where a single factor covers both and cannot be separated. With the expanded boundary, the production of the <em>installed</em> material (installed mass × production factor) is reported separately again. If a factor already includes waste treatment, no further disposal factor can be added to it.
        </p>
        <p>
          The study&apos;s primary boundary covers material <em>wastage</em>, not every material that remains in the completed building. The quantity entered is the net installed quantity; waste is an allowance on top of it.
        </p>
      </Section>

      <Section id="fuel" title="Transport and machinery fuel">
        <Formula>{`Total distance (km)  = trips × distance per trip   (× 2 if the distance is one-way)
Diesel (L)           = total distance ÷ fuel economy (km/L)
Machinery diesel (L) = operating hours × litres per hour
Fuel emissions       = diesel (L) × 2.68 kg CO₂e/L

Tonne-km             = transported mass (t) × distance (km)
Transport emissions  = tonne-km × factor (kg CO₂e per tonne-km)`}</Formula>
        <p>
          Each delivery uses one method only, either fuel-based or tonne-km, so the same trip is never counted twice. The reference reports give no factor per tonne-km, so the tonne-km method needs a sourced factor added to the library. Machinery hours are never converted to fuel without a documented litres-per-hour rate. The diesel factor covers fuel combustion (tank-to-wheel) only. Transport and machinery can be switched off when no data is available; the results then state that they are excluded.
        </p>
        <p>
          When the actual fuel consumed is known from fuel bills or logs, it is used directly and the distance or hours estimate is not calculated, so that the same fuel is never counted twice. Distances must be marked as one-way or round-trip; the reference study uses round-trip distances (30 km for RMC, 40 km for deliveries).
        </p>
      </Section>

      <Section id="boundary" title="Boundary and life-cycle stages (EN 15978)">
        <div className="overflow-x-auto rounded-lg border border-line">
          <table className="w-full min-w-[560px] text-sm">
            <thead className="bg-surface-sunken text-left text-xs text-ink-muted">
              <tr>
                <th className="px-3 py-2 font-medium">Module</th>
                <th className="px-3 py-2 font-medium">Stage</th>
                <th className="px-3 py-2 font-medium">In this calculator</th>
              </tr>
            </thead>
            <tbody>
              {STAGES.map((s) => (
                <tr key={s.code} className="border-t border-line align-top">
                  <td className="px-3 py-2 font-mono text-xs">{s.code}</td>
                  <td className="px-3 py-2">{s.name}</td>
                  <td className="px-3 py-2">
                    <Badge tone={s.included === "yes" ? "green" : s.included === "no" ? "neutral" : "amber"}>{s.included === "yes" ? "Included" : s.included === "no" ? "Not included" : "Partly"}</Badge>
                    <p className="mt-1 text-xs text-ink-muted">{s.note}</p>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <Callout tone="warning" title="Not a whole-life carbon assessment">
          A construction-stage result is a lower bound of the building&apos;s embodied carbon and leaves out its operational carbon entirely. Do not compare it with whole-life or cradle-to-grave figures.
        </Callout>
      </Section>

      <Section id="profiles" title="Calculation profiles">
        <p>The reference report&apos;s consolidated total does not include its own foundation-stage calculation. To keep results reproducible and honest, both totals are always calculated and shown:</p>
        <ul className="list-disc space-y-2 pl-5">
          {(["report_master", "foundation_inclusive"] as const).map((p) => (
            <li key={p}>
              <strong>{PROFILE_LABELS[p]}</strong>: {PROFILE_DESCRIPTIONS[p]}
            </li>
          ))}
        </ul>
        <p>Multi-building projects: each building group is calculated separately. A group is multiplied by its count only after you confirm that the buildings are identical; otherwise one building is counted and an error is shown.</p>
      </Section>

      <Section id="factors" title="Emission factors">
        <p>
          The reference dataset ({FACTOR_DATASET_VERSION}) holds two kinds of value with different system boundaries. Generic ranges from the B.Tech report&apos;s materials table: OPC 0.82–0.95, PPC 0.58–0.65, RMC M25/M30 0.12–0.14, high-strength concrete 0.18–0.22, rebar 1.80–2.40, structural steel 1.90–2.50 kg CO₂e/kg. Study-specific factors from the BIM material library: concrete A1–A3 0.13, disposal 0.012, structural concrete 0.142, slab concrete 0.138, steel 1.92, clay brick 0.24 kg CO₂e/kg, diesel 2.68 kg CO₂e/L.
        </p>
        <p>
          Every factor records its value, unit, source, geography, version, life-cycle boundary, notes and status: <strong>source-derived</strong> (from the project reports), <strong>user-provided</strong>, <strong>verified external</strong> (for example a third-party EPD) or <strong>illustrative</strong>. The illustrative values for sand and aggregates, aluminium, glass and timber are order-of-magnitude placeholders with no cited source. Every result that uses one is flagged, and they must be replaced before the result is relied on. Factors are updated in the Emission factors page. Each project keeps a snapshot, so later library changes never alter an existing assessment until you choose to update it.
        </p>
        <p>
          The default template applies the study factors stage by stage, as the report does. For ranges, the central value is the arithmetic midpoint, and low or high can be selected. Factors with an unstated boundary (such as slab concrete 0.138) are flagged. User factors require a recorded source.
        </p>
        <Button asChild variant="secondary">
          <Link href="/factors">Open the factor library</Link>
        </Button>
      </Section>

      <Section id="bim" title="The role of BIM">
        <p>
          Building Information Modelling (BIM) stores each wall, column, beam and slab as an object with its material and quantity. In a BIM workflow, the material take-off schedule supplies the activity data, an emission-factor library supplies the factors, and calculated parameters (Wasted_Mass = Volume × Density × Waste_Factor; Emission = Wasted_Mass × ECF) produce the carbon schedule automatically. The reference study reproduced its manual calculation exactly in this form.
        </p>
        <p>
          <strong>Current capability:</strong> CarbonBuild does not read Revit or IFC files. In detailed mode you can import a take-off schedule exported as CSV. Direct model integration is a possible future capability.
        </p>
      </Section>

      <Section id="limitations" title="Assumptions and limitations">
        <ul className="list-disc space-y-2 pl-5">
          <li>Waste allowances (5–8%) are industry averages adopted by the study, not universal standards. Use measured values where you have them.</li>
          <li>Reference factors are secondary literature values, not environmental product declarations from Indian suppliers. Factors vary with plant efficiency, fuel mix and recycled content.</li>
          <li>Quick-estimate quantities scale one reference bungalow linearly with floor area. They are labelled as assumed and carry large uncertainty, especially for building types unlike the reference.</li>
          <li>The diesel factor covers combustion; upstream fuel production is not stated as included.</li>
          <li>No overall confidence score is given. The data-quality panel shows how much of the result rests on measured, user-provided, estimated and assumed data, and how sensitive the total is to the main assumptions.</li>
          <li>Projects are stored only in your browser&apos;s local storage. There are no user accounts.</li>
          <li>
            CarbonBuild is an estimation tool developed as a college project for learning and academic evaluation. It is not a substitute for a verified environmental product declaration, a professional life-cycle assessment, a structural engineering assessment or regulatory certification, and it does not claim compliance with any standard. EN 15978 module names are used to describe the boundary only.
          </li>
          <li>Reduction scenarios do not check that a lower-carbon material or a smaller quantity is structurally suitable or safe. That must be confirmed by a qualified engineer.</li>
        </ul>
      </Section>

      <Section id="reconciliation" title="Reference reconciliation">
        <p>
          The sample project is calculated by the same engine as any user project. Each component is then compared with the value printed in the BIM report&apos;s master schedule (Table 9.10). The figures below are computed, not copied.
        </p>
        <ReconciliationTable result={sample} />
        <h3 className="pt-4 text-lg font-semibold">Discrepancies found in the source documents</h3>
        <div className="space-y-3">
          {SOURCE_DISCREPANCIES.map((d) => (
            <div key={d.title} className="rounded-lg border border-line bg-surface p-4">
              <p className="font-medium">{d.title}</p>
              <p className="mt-1 text-sm text-ink-muted">{d.detail}</p>
              <p className="mt-2 text-sm">
                <span className="font-medium text-leaf">How CarbonBuild handles it: </span>
                {d.handling}
              </p>
            </div>
          ))}
        </div>
      </Section>

      <Section id="references" title="References">
        <ul className="list-disc space-y-1 pl-5 text-sm">
          <li>Carbon Footprint Assessment of Construction Projects. B.Tech Project 2026, Department of Civil Engineering, SCET, Sarvajanik University, Surat. Chapters 1–6 and 7–14 (BIM).</li>
          <li>EN 15978:2011, Sustainability of construction works: assessment of environmental performance of buildings.</li>
          <li>WRI/WBCSD, The Greenhouse Gas Protocol (Scope 1, 2 and 3 definitions).</li>
          <li>ISO 19650-1:2018 (BIM information management); ISO 16739-1:2018 (IFC).</li>
          <li>Hammond, G. and Jones, C., Inventory of Carbon and Energy (ICE), University of Bath.</li>
        </ul>
      </Section>
    </div>
  );
}

function Section({ id, title, children }: { id: string; title: string; children: React.ReactNode }) {
  return (
    <section id={id} className="mt-12 scroll-mt-24 space-y-4 leading-relaxed text-ink-muted [&_strong]:text-ink">
      <h2 className="text-xl font-semibold tracking-tight text-ink">{title}</h2>
      {children}
    </section>
  );
}

function Formula({ children }: { children: React.ReactNode }) {
  return <pre className="overflow-x-auto rounded-lg border border-line bg-surface-muted px-4 py-3 font-mono text-[13px] leading-relaxed text-ink">{children}</pre>;
}
