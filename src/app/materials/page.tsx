import type { Metadata } from "next";
import Link from "next/link";
import { Badge, Button, Callout } from "@/components/ui/primitives";
import { DEFAULT_STAGES, MATERIAL_CATEGORY_LABELS, MATERIAL_PRESETS, QUANTITY_UNIT_LABELS, REFERENCE_FACTORS, REFERENCE_PARAMETERS, REFERENCE_WASTE } from "@/lib/engine";
import { fmt } from "@/lib/format";
import { FACTOR_STATUS_LABELS, FACTOR_STATUS_TONE } from "@/lib/labels";

export const metadata: Metadata = { title: "Material library" };

const factorById = new Map(REFERENCE_FACTORS.map((f) => [f.id, f]));

export default function MaterialsPage() {
  return (
    <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6">
      <p className="text-xs font-semibold uppercase tracking-wider text-leaf">Material library</p>
      <h1 className="mt-1 text-3xl font-semibold tracking-tight">Materials in the calculator</h1>
      <p className="mt-2 max-w-3xl text-ink-muted">
        Each material sets a default unit, any conversion parameters, and a default emission factor. Every value can be changed per entry in a project. Factors are managed under Emission factors.
      </p>
      <Callout tone="warning" className="mt-6" title="Concrete already contains its cement">
        Ready-mix and RCC factors cover the finished mix. Add standalone cement only for cement that is not part of a concrete entry (for example site-mixed mortar), or it will be counted twice.
      </Callout>

      <div className="mt-6 overflow-x-auto rounded-xl border border-line bg-surface">
        <table className="w-full min-w-[960px] text-sm">
          <thead className="bg-surface-sunken text-left text-xs text-ink-muted">
            <tr>
              <th className="px-4 py-2 font-medium">Material</th>
              <th className="px-4 py-2 font-medium">Category</th>
              <th className="px-4 py-2 font-medium">Default unit and conversion</th>
              <th className="px-4 py-2 font-medium">Default waste-emission factor</th>
              <th className="px-4 py-2 font-medium">Production factor (expanded boundary)</th>
            </tr>
          </thead>
          <tbody>
            {MATERIAL_PRESETS.map((p) => {
              const ids = p.key === "rcc" ? ["concrete_a1a3_bim", "concrete_disposal_bim", "structural_concrete_bim", "slab_concrete_bim"] : p.factorIds("plinth");
              const installed = p.installedFactorId ? factorById.get(p.installedFactorId) : null;
              return (
                <tr key={p.key} className="border-t border-line align-top">
                  <td className="px-4 py-3">
                    <p className="font-medium">{p.label}</p>
                    <p className="mt-0.5 max-w-sm text-xs text-ink-muted">{p.description}</p>
                  </td>
                  <td className="px-4 py-3">{MATERIAL_CATEGORY_LABELS[p.category]}</td>
                  <td className="px-4 py-3 text-ink-muted">
                    {QUANTITY_UNIT_LABELS[p.unit]}
                    {p.densityKgPerM3 ? <span className="block text-xs">density {fmt(p.densityKgPerM3)} kg/m³</span> : null}
                    {p.bricksPerM3 ? <span className="block text-xs">{p.bricksPerM3} bricks/m³</span> : null}
                    {p.brickMassKg ? <span className="block text-xs">{p.brickMassKg} kg per brick</span> : null}
                  </td>
                  <td className="px-4 py-3">
                    {ids.length === 0 ? (
                      <span className="text-ink-subtle">Chosen by the user</span>
                    ) : (
                      <ul className="space-y-1">
                        {ids.map((id) => {
                          const f = factorById.get(id)!;
                          return (
                            <li key={id} className="flex flex-wrap items-center gap-1.5">
                              <span>{f.name}</span>
                              <span className="num text-xs text-ink-muted">{f.range ? `${fmt(f.range.low)}–${fmt(f.range.high)}` : fmt(f.value)} kg CO₂e/kg</span>
                              <Badge tone={FACTOR_STATUS_TONE[f.status]}>{FACTOR_STATUS_LABELS[f.status]}</Badge>
                            </li>
                          );
                        })}
                        {p.key === "rcc" ? <li className="text-xs text-ink-subtle">The factor depends on the stage: foundation 0.13 + 0.012; plinth, columns and beams 0.142; slabs 0.138.</li> : null}
                      </ul>
                    )}
                  </td>
                  <td className="px-4 py-3 text-ink-muted">{installed ? `${installed.name}` : "—"}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="mt-8 grid gap-6 lg:grid-cols-2">
        <section className="rounded-xl border border-line bg-surface p-5">
          <h2 className="font-semibold">Reference waste allowances</h2>
          <p className="mt-1 text-sm text-ink-muted">Industry averages adopted by the reference study (BIM report Table 9.2 and 13.1). They are assumptions, not standards; replace them with site data where available.</p>
          <table className="mt-3 w-full text-sm">
            <thead className="text-left text-xs text-ink-muted">
              <tr className="border-b border-line">
                <th className="py-2 font-medium">Stage</th>
                <th className="py-2 text-right font-medium">Concrete</th>
                <th className="py-2 text-right font-medium">Steel</th>
                <th className="py-2 text-right font-medium">Masonry</th>
              </tr>
            </thead>
            <tbody>
              {DEFAULT_STAGES.map((s) => (
                <tr key={s.id} className="border-b border-line last:border-0">
                  <td className="py-2">{s.name}</td>
                  <td className="num py-2 text-right">{REFERENCE_WASTE[s.id].concrete}%</td>
                  <td className="num py-2 text-right">{s.id === "walls" ? "—" : `${REFERENCE_WASTE[s.id].steel}%`}</td>
                  <td className="num py-2 text-right">{s.id === "walls" ? `${REFERENCE_WASTE[s.id].masonry}%` : "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
        <section className="rounded-xl border border-line bg-surface p-5">
          <h2 className="font-semibold">Conversion parameters</h2>
          <p className="mt-1 text-sm text-ink-muted">Not emission factors: they convert quantities before a factor is applied.</p>
          <table className="mt-3 w-full text-sm">
            <tbody>
              {REFERENCE_PARAMETERS.map((p) => (
                <tr key={p.key} className="border-b border-line last:border-0">
                  <td className="py-2">{p.label}</td>
                  <td className="num py-2 text-right font-medium">
                    {fmt(p.value)} {p.unit}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      </div>
      <div className="mt-6 flex flex-wrap gap-3">
        <Button asChild>
          <Link href="/factors">Manage emission factors</Link>
        </Button>
        <Button asChild variant="secondary">
          <Link href="/assess">Use materials in a project</Link>
        </Button>
      </div>
    </div>
  );
}
