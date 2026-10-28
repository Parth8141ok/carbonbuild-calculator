import { ArrowRight, BarChart3, Calculator, ClipboardList, Fuel, Recycle, SlidersHorizontal } from "lucide-react";
import Link from "next/link";
import { LandingPreview } from "@/components/landing-preview";
import { Button } from "@/components/ui/primitives";
import { getSampleResult } from "@/lib/sample-result";
import { formatFixed } from "@/lib/format";

export default async function Home() {
  const sample = await getSampleResult();
  const t = sample.totals;
  const perBungalowWaste = t.materialWasteKg / 10;
  const perBungalowFuel = (t.transportKg + t.machineryKg) / 10;

  return (
    <>
      <section className="border-b border-line">
        <div className="mx-auto grid max-w-7xl gap-12 px-4 py-14 sm:px-6 xl:grid-cols-[1fr_1.15fr] lg:py-20">
          <div className="flex flex-col justify-center">
            <p className="text-sm font-semibold text-leaf">Measure. Understand. Reduce.</p>
            <h1 className="mt-3 text-4xl font-semibold tracking-tight text-ink sm:text-5xl">The carbon footprint of building construction, calculated transparently.</h1>
            <p className="mt-5 max-w-xl text-lg text-ink-muted">
              Enter material quantities, waste allowances, deliveries and machine hours. CarbonBuild calculates construction-stage emissions,
              shows where they come from and lets you test reductions, with every number traceable to its formula and source.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Button asChild size="lg">
                <Link href="/assess">
                  Start assessment <ArrowRight />
                </Link>
              </Button>
              <Button asChild size="lg" variant="secondary">
                <Link href="/methodology">Explore methodology</Link>
              </Button>
            </div>
            <p className="mt-6 text-sm text-ink-subtle">
              No account needed. Projects are saved in this browser only.{" "}
              <Link href="/dashboard" className="font-medium text-primary underline-offset-2 hover:underline">
                Go to your dashboard
              </Link>
            </p>
          </div>
          <LandingPreview result={sample} />
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-4 py-16 sm:px-6">
        <h2 className="text-2xl font-semibold tracking-tight">From site data to a reduction plan</h2>
        <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Feature icon={<ClipboardList />} title="Simple project data entry">
            A guided wizard covers concrete, steel and brick quantities by stage, plus deliveries and machinery. A quantity estimator helps when only dimensions are known.
          </Feature>
          <Feature icon={<Calculator />} title="Automatic emission calculations">
            Activity data × emission factor, with unit conversion, waste allowances and diesel use. Every result carries its formula and numerical substitution.
          </Feature>
          <Feature icon={<BarChart3 />} title="Material and activity breakdown">
            Ranked sources, stage-wise wastage, and a split between material wastage, transport and machinery, all drawn from the calculation itself.
          </Feature>
          <Feature icon={<SlidersHorizontal />} title="Reduction scenario analysis">
            Change waste rates, diesel use, distances or factors and see the saving. Overlapping measures are recalculated together, never simply added.
          </Feature>
        </div>
      </section>

      <section className="border-y border-line bg-surface">
        <div className="mx-auto grid max-w-7xl gap-10 px-4 py-16 sm:px-6 lg:grid-cols-2">
          <div>
            <h2 className="text-2xl font-semibold tracking-tight">Two different sources of construction emissions</h2>
            <p className="mt-3 text-ink-muted">
              The reference study separates emissions from material that is wasted on site from emissions of diesel burnt during construction. They are calculated differently and reduced in different ways.
            </p>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="rounded-xl border border-line bg-page p-5">
              <Recycle className="size-5 text-leaf" aria-hidden />
              <h3 className="mt-3 font-semibold">Material wastage</h3>
              <p className="mt-2 text-sm text-ink-muted">
                Concrete, steel and bricks that are bought but never built in carry the carbon of their production, and sometimes their disposal.
              </p>
              <p className="num mt-3 rounded-md bg-surface-muted px-2 py-1.5 font-mono text-xs">wasted mass × embodied carbon factor</p>
              <p className="mt-3 text-xs text-ink-subtle">Reference bungalow: {formatFixed(perBungalowWaste)} kg CO₂e</p>
            </div>
            <div className="rounded-xl border border-line bg-page p-5">
              <Fuel className="size-5 text-leaf" aria-hidden />
              <h3 className="mt-3 font-semibold">Construction-stage fuel</h3>
              <p className="mt-2 text-sm text-ink-muted">Diesel burnt by transit mixers, delivery trucks and site machinery (excavators, mixers, cranes).</p>
              <p className="num mt-3 rounded-md bg-surface-muted px-2 py-1.5 font-mono text-xs">litres × 2.68 kg CO₂e/L</p>
              <p className="mt-3 text-xs text-ink-subtle">Reference bungalow: {formatFixed(perBungalowFuel)} kg CO₂e</p>
            </div>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-4 py-16 sm:px-6">
        <div className="grid gap-10 lg:grid-cols-2">
          <div>
            <h2 className="text-2xl font-semibold tracking-tight">Methodology</h2>
            <ul className="mt-4 space-y-3 text-ink-muted">
              <li>Emission-factor method: E = Σ (activity data × emission factor), following the GHG Protocol and EN 15978 module names.</li>
              <li>Reference factors from the B.Tech and BIM project reports, each with its source, boundary and version. Edit them, or add your own with a documented source.</li>
              <li>Two calculation profiles: the report&apos;s master schedule, and a foundation-inclusive sensitivity case. Both totals are always shown.</li>
              <li>The reference sample is reconciled line by line against the report. Differences, such as a 0.02 kg diesel truncation, are shown rather than hidden.</li>
            </ul>
            <Button asChild variant="secondary" className="mt-6">
              <Link href="/methodology">Read the full methodology</Link>
            </Button>
          </div>
          <div id="limitations" className="rounded-xl border border-amber-line bg-amber-soft p-6">
            <h2 className="text-lg font-semibold">Limitations</h2>
            <ul className="mt-3 list-disc space-y-2 pl-5 text-sm text-ink-muted">
              <li>
                The default boundary is the <strong className="text-ink">construction stage only</strong>: wasted material plus transport and machinery fuel. It is not a whole-life carbon assessment, and it leaves out the embodied carbon of the material that remains in the building.
              </li>
              <li>Reference factors are secondary literature values, not supplier-specific declarations (EPDs).</li>
              <li>Reference waste allowances and reference-bungalow ratios are assumptions, and are labelled as such.</li>
              <li>BIM models (Revit, IFC) are not read directly. Material take-off schedules can be imported as CSV.</li>
            </ul>
          </div>
        </div>
      </section>
    </>
  );
}

function Feature({ icon, title, children }: { icon: React.ReactNode; title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-line bg-surface p-5">
      <span className="inline-flex size-9 items-center justify-center rounded-lg bg-primary-soft text-primary [&_svg]:size-4.5">{icon}</span>
      <h3 className="mt-4 font-semibold">{title}</h3>
      <p className="mt-2 text-sm text-ink-muted">{children}</p>
    </div>
  );
}
