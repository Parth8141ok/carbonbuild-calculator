"use client";

import { useId, useMemo, useState, type ChangeEvent, type ReactNode } from "react";
import {
  applyReportMeasures,
  blankState,
  calculate,
  newMaterial,
  newTransport,
  referenceMaterials,
  referenceState,
  sanitizeState,
  toCsv,
  type Material,
  type State,
  type Transport,
} from "@/lib/calc";
import { useStoredState } from "@/lib/use-stored-state";

const STORAGE_KEY = "carbonbuild-simple-v1";
const DEFAULT_STATE = referenceState();

const nf = new Intl.NumberFormat("en-US");
const fmt = (n: number, dp = 1) => (Number.isFinite(n) ? n.toLocaleString("en-US", { maximumFractionDigits: dp, minimumFractionDigits: 0 }) : "—");
const money = (n: number) => `₹${fmt(n, 0)}`;

function download(name: string, content: string, type: string) {
  const url = URL.createObjectURL(new Blob([content], { type }));
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

const slug = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 50) || "project";

// ---------------------------------------------------------------------------
// Small building blocks
// ---------------------------------------------------------------------------

const inputCls =
  "w-full min-w-0 rounded-lg border border-line-strong bg-surface px-2.5 py-2 text-sm text-ink hover:border-ink-subtle focus-visible:outline-2 focus-visible:outline-leaf";

function Card({ title, children, className = "" }: { title?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <section className={`min-w-0 rounded-2xl border border-line bg-surface p-4 shadow-[0_1px_3px_rgba(31,35,40,0.05)] sm:p-5 ${className}`}>
      {title ? <h2 className="mb-3 text-lg font-semibold">{title}</h2> : null}
      {children}
    </section>
  );
}

function Field({ label, help, children }: { label: string; help?: string; children: (id: string) => ReactNode }) {
  const id = useId();
  return (
    <div className="min-w-0">
      <label htmlFor={id} className="mb-1 block text-xs font-semibold text-ink-muted">
        {label}
      </label>
      {children(id)}
      {help ? <p className="mt-1 text-xs text-ink-subtle">{help}</p> : null}
    </div>
  );
}

function NumInput({ value, onChange, label, id, step = "any" }: { value: string; onChange: (v: string) => void; label?: string; id?: string; step?: string }) {
  return (
    <input
      id={id}
      aria-label={label}
      type="number"
      inputMode="decimal"
      min="0"
      step={step}
      value={value}
      onChange={(e: ChangeEvent<HTMLInputElement>) => onChange(e.target.value)}
      className={`${inputCls} tabular-nums`}
    />
  );
}

function Btn({ children, onClick, variant = "primary" }: { children: ReactNode; onClick: () => void; variant?: "primary" | "secondary" | "danger" }) {
  const cls = {
    primary: "bg-primary text-primary-ink hover:bg-primary-hover",
    secondary: "border border-line-strong bg-surface-sunken text-ink hover:bg-line",
    danger: "border border-danger-line bg-danger-soft text-danger hover:bg-[#f8dad6]",
  }[variant];
  return (
    <button type="button" onClick={onClick} className={`rounded-lg px-3.5 py-2 text-sm font-semibold transition-colors ${cls}`}>
      {children}
    </button>
  );
}

function Metric({ label, value, sub }: { label: string; value: ReactNode; sub?: ReactNode }) {
  return (
    <div className="rounded-xl border border-line bg-page p-3.5">
      <div className="text-xs text-ink-muted">{label}</div>
      <div className="my-1 text-2xl font-extrabold tracking-tight tabular-nums sm:text-[1.7rem]">{value}</div>
      {sub ? <div className="text-xs text-ink-muted">{sub}</div> : null}
    </div>
  );
}

function BarRow({ label, value, max, color, suffix = "kg" }: { label: string; value: number; max: number; color: string; suffix?: string }) {
  return (
    <div className="my-2.5 grid grid-cols-[110px_1fr_90px] items-center gap-2.5 text-sm sm:grid-cols-[150px_1fr_100px]">
      <span className="truncate" title={label}>
        {label}
      </span>
      <div className="h-3 overflow-hidden rounded-full bg-line" role="img" aria-label={`${label}: ${fmt(value, 0)} ${suffix}`}>
        <div className="h-full rounded-full" style={{ width: `${max > 0 ? (value / max) * 100 : 0}%`, background: color }} />
      </div>
      <strong className="text-right tabular-nums">
        {fmt(value, 0)} {suffix}
      </strong>
    </div>
  );
}

const TH = "whitespace-nowrap bg-surface-sunken px-2 py-2 text-left text-xs font-semibold text-ink-muted";
const TD = "px-1.5 py-1.5 align-middle";

// ---------------------------------------------------------------------------
// The calculator
// ---------------------------------------------------------------------------

export function Calculator() {
  const [state, setState] = useStoredState<State>(STORAGE_KEY, DEFAULT_STATE, sanitizeState);
  const [confirmClear, setConfirmClear] = useState(false);
  const r = useMemo(() => calculate(state), [state]);

  const update = (recipe: (draft: State) => void) =>
    setState((prev) => {
      const next = structuredClone(prev);
      recipe(next);
      return next;
    });
  const setMaterial = (i: number, patch: Partial<Material>) => update((d) => void Object.assign(d.materials[i], patch));
  const setTransport = (i: number, patch: Partial<Transport>) => update((d) => void Object.assign(d.transport[i], patch));

  const sources = [
    { label: "Material waste", value: r.materialCarbon, color: "var(--series-3)" },
    { label: "Transport", value: r.transportCarbon, color: "var(--series-1)" },
    { label: "Equipment fuel", value: r.equipmentCarbon, color: "var(--series-4)" },
    { label: "Other", value: r.other, color: "var(--series-5)" },
  ];
  const sourceMax = Math.max(...sources.map((s) => s.value), 1);
  const byMaterial = r.materials.filter((m) => m.include && m.carbon > 0).sort((a, b) => b.carbon - a.carbon);
  const materialMax = Math.max(...byMaterial.map((m) => m.carbon), 1);
  const hasCosts = state.materials.some((m) => Number(m.cost) > 0);

  return (
    <>
      <header className="bg-[#173a2b] px-4 py-6 text-white sm:px-6">
        <div className="mx-auto max-w-[1200px]">
          <p className="text-xs font-bold uppercase tracking-[0.12em] text-[#a9d9bd]">B.Tech Civil Engineering Project 2026 · SCET, Sarvajanik University, Surat</p>
          <div className="mt-1 flex items-center gap-3">
            <svg viewBox="0 0 32 32" className="size-9 shrink-0" aria-hidden>
              <rect x="1" y="1" width="30" height="30" rx="8" fill="#fff" />
              <path d="M8 25V13.5l6-3.5v15M14 25V10l6 3.5V25" fill="none" stroke="#173a2b" strokeWidth="1.8" strokeLinejoin="round" />
              <path d="M6.5 25h19" stroke="#173a2b" strokeWidth="1.8" strokeLinecap="round" />
              <path d="M21.5 15c0-4.4 2.6-7.4 6.5-8-.2 4.5-2.6 7.6-6.5 8z" fill="#3f8a5f" />
            </svg>
            <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">CarbonBuild</h1>
          </div>
          <p className="mt-2 max-w-3xl text-[#d4e6db]">
            A simple construction carbon-footprint calculator. Enter project quantities, waste, emission factors, transport and equipment use to estimate kg CO₂e, then compare a waste-reduction scenario. It opens with the report&apos;s example of ten bungalows at Surat.
          </p>
        </div>
      </header>

      <div className="mx-auto max-w-[1200px] px-4 pb-10 pt-5 sm:px-6">
        <div role="note" className="mb-4 rounded-xl border border-amber-line bg-amber-soft px-4 py-3 text-sm text-[#5c3d00]">
          <strong>College project:</strong> the starting factors come from the project report and are example values, not verified supplier data. Results are estimates for learning, not a certified carbon assessment. Only material waste, transport and equipment fuel are counted, not all the material that stays in the building or its use.
        </div>

        <div className="grid grid-cols-1 gap-4 lg:grid-cols-12">
          {/* 1 */}
          <Card title="1. Project details" className="lg:col-span-12">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <Field label="Project name">{(id) => <input id={id} className={inputCls} value={state.project.name} onChange={(e) => update((d) => void (d.project.name = e.target.value))} />}</Field>
              <Field label="Location">{(id) => <input id={id} className={inputCls} value={state.project.location} onChange={(e) => update((d) => void (d.project.location = e.target.value))} />}</Field>
              <Field label="Number of buildings" help="Identical buildings, whole number">{(id) => <NumInput id={id} step="1" value={state.project.count} onChange={(v) => update((d) => void (d.project.count = v))} />}</Field>
              <Field label="Built-up area per building (m²)" help="All floors added together">{(id) => <NumInput id={id} value={state.project.area} onChange={(v) => update((d) => void (d.project.area = v))} />}</Field>
            </div>
            <div className="no-print mt-3 flex flex-wrap items-center gap-2">
              <Btn variant="secondary" onClick={() => setState(referenceState())}>
                Load the report example
              </Btn>
              <Btn variant="secondary" onClick={() => setState(blankState())}>
                Start a blank project
              </Btn>
              <span className="text-xs text-ink-subtle">Your entries are saved in this browser automatically.</span>
            </div>
          </Card>

          {/* 2 */}
          <Card title="2. Materials and waste" className="lg:col-span-12">
            <p className="mb-3 text-sm text-ink-muted">
              Enter the quantity per building. Waste quantity = quantity × waste %. Emissions = waste quantity × (production factor + waste-treatment factor). Each factor is per <em>one unit of the quantity</em>, so the units must match. Example: concrete in m³ uses kg CO₂e per m³ (0.142 kg per kg × 2,400 kg/m³ = 340.8).
            </p>
            <div className="overflow-x-auto rounded-xl border border-line">
              <table className="w-full min-w-[1180px] border-collapse text-sm">
                <thead>
                  <tr>
                    <th className={TH} title="Untick to leave a row out of the totals">
                      Count
                    </th>
                    <th className={TH}>Material</th>
                    <th className={TH}>Quantity / building</th>
                    <th className={TH}>Unit</th>
                    <th className={TH}>Waste %</th>
                    <th className={TH}>
                      Production factor
                      <br />
                      <span className="font-normal">(kg CO₂e / unit)</span>
                    </th>
                    <th className={TH}>
                      Waste-treatment factor
                      <br />
                      <span className="font-normal">(kg CO₂e / unit wasted)</span>
                    </th>
                    <th className={TH}>
                      Unit cost
                      <br />
                      <span className="font-normal">(₹, optional)</span>
                    </th>
                    <th className={TH}>What-if waste %</th>
                    <th className={`${TH} text-right`}>Waste qty</th>
                    <th className={`${TH} text-right`}>kg CO₂e / building</th>
                    <th className={TH} />
                  </tr>
                </thead>
                <tbody>
                  {state.materials.map((m, i) => (
                    <tr key={m.id} className={`border-t border-line ${m.include ? "" : "bg-surface-sunken text-ink-muted"}`}>
                      <td className={`${TD} text-center`}>
                        <input type="checkbox" aria-label={`Count ${m.name} in the totals`} checked={m.include} onChange={(e) => setMaterial(i, { include: e.target.checked })} className="size-4 accent-[var(--primary)]" />
                      </td>
                      <td className={`${TD} min-w-[190px]`}>
                        <input aria-label="Material name" className={inputCls} value={m.name} onChange={(e) => setMaterial(i, { name: e.target.value })} />
                      </td>
                      <td className={`${TD} min-w-[100px]`}>
                        <NumInput label={`${m.name} quantity`} value={m.qty} onChange={(v) => setMaterial(i, { qty: v })} />
                      </td>
                      <td className={`${TD} min-w-[84px]`}>
                        <input aria-label={`${m.name} unit`} className={inputCls} value={m.unit} onChange={(e) => setMaterial(i, { unit: e.target.value })} />
                      </td>
                      <td className={`${TD} min-w-[84px]`}>
                        <NumInput label={`${m.name} waste percent`} value={m.waste} onChange={(v) => setMaterial(i, { waste: v })} />
                      </td>
                      <td className={`${TD} min-w-[100px]`}>
                        <NumInput label={`${m.name} production factor`} value={m.ef} onChange={(v) => setMaterial(i, { ef: v })} />
                      </td>
                      <td className={`${TD} min-w-[100px]`}>
                        <NumInput label={`${m.name} waste-treatment factor`} value={m.disposal} onChange={(v) => setMaterial(i, { disposal: v })} />
                      </td>
                      <td className={`${TD} w-[96px]`}>
                        <NumInput label={`${m.name} unit cost`} value={m.cost} onChange={(v) => setMaterial(i, { cost: v })} />
                      </td>
                      <td className={`${TD} w-[96px]`}>
                        <input
                          aria-label={`${m.name} what-if waste percent`}
                          type="number"
                          min="0"
                          step="any"
                          placeholder={m.waste || "same"}
                          value={m.scenWaste}
                          onChange={(e) => setMaterial(i, { scenWaste: e.target.value })}
                          className={`${inputCls} tabular-nums`}
                        />
                      </td>
                      <td className={`${TD} whitespace-nowrap text-right tabular-nums`}>
                        {fmt(r.materials[i].wasteQty, 2)} <span className="text-xs text-ink-subtle">{m.unit}</span>
                      </td>
                      <td className={`${TD} whitespace-nowrap text-right font-semibold tabular-nums`}>{m.include ? fmt(r.materials[i].carbon, 2) : <span className="font-normal">not counted</span>}</td>
                      <td className={TD}>
                        <button type="button" aria-label={`Remove ${m.name}`} onClick={() => update((d) => void d.materials.splice(i, 1))} className="rounded-md border border-danger-line bg-danger-soft px-2 py-1 text-xs font-semibold text-danger hover:bg-[#f8dad6]">
                          Remove
                        </button>
                      </td>
                    </tr>
                  ))}
                  {state.materials.length === 0 ? (
                    <tr>
                      <td colSpan={12} className="px-4 py-6 text-center text-sm text-ink-subtle">
                        No materials yet. Add one below.
                      </td>
                    </tr>
                  ) : null}
                </tbody>
              </table>
            </div>
            <div className="no-print mt-3 flex flex-wrap items-center gap-2">
              <Btn variant="secondary" onClick={() => update((d) => void d.materials.push(newMaterial()))}>
                + Add material
              </Btn>
              <Btn variant="secondary" onClick={() => update((d) => void (d.materials = referenceMaterials()))}>
                Restore the report&apos;s materials
              </Btn>
            </div>
            <p className="mt-3 text-xs text-ink-subtle">
              The foundation row is unticked because the report&apos;s master total leaves it out. Tick it to include it. Clay bricks: 103,250 bricks = 206.5 m³ of brickwork at 500 bricks/m³, 3 kg each, so 0.24 kg per kg × 3 kg = 0.72 kg CO₂e per brick. Enter either bricks or m³, never both.
            </p>
          </Card>

          {/* 3 */}
          <Card title="3. Transport" className="lg:col-span-7">
            <div className="overflow-x-auto rounded-xl border border-line">
              <table className="w-full min-w-[640px] border-collapse text-sm">
                <thead>
                  <tr>
                    <th className={TH}>Delivery</th>
                    <th className={TH}>Method</th>
                    <th className={TH}>Trips / building</th>
                    <th className={TH}>Distance / trip (km)</th>
                    <th className={TH}>Km per litre / load (t)</th>
                    <th className={TH}>Factor</th>
                    <th className={`${TH} text-right`}>kg CO₂e</th>
                    <th className={TH} />
                  </tr>
                </thead>
                <tbody>
                  {state.transport.map((t, i) => (
                    <tr key={t.id} className="border-t border-line">
                      <td className={`${TD} min-w-[150px]`}>
                        <input aria-label="Delivery name" className={inputCls} value={t.name} onChange={(e) => setTransport(i, { name: e.target.value })} />
                      </td>
                      <td className={`${TD} w-[130px]`}>
                        <select aria-label={`${t.name} method`} className={inputCls} value={t.method} onChange={(e) => setTransport(i, { method: e.target.value as Transport["method"], factor: e.target.value === "fuel" ? "2.68" : "" })}>
                          <option value="fuel">Fuel (km/L)</option>
                          <option value="tkm">Tonne-km</option>
                        </select>
                      </td>
                      <td className={`${TD} w-[84px]`}>
                        <NumInput label={`${t.name} trips`} step="1" value={t.trips} onChange={(v) => setTransport(i, { trips: v })} />
                      </td>
                      <td className={`${TD} w-[96px]`}>
                        <NumInput label={`${t.name} distance per trip`} value={t.distance} onChange={(v) => setTransport(i, { distance: v })} />
                      </td>
                      <td className={`${TD} w-[110px]`}>
                        <NumInput label={`${t.name} ${t.method === "fuel" ? "kilometres per litre" : "load in tonnes"}`} value={t.param} onChange={(v) => setTransport(i, { param: v })} />
                        <span className="text-[11px] text-ink-subtle">{t.method === "fuel" ? "km per litre" : "tonnes"}</span>
                      </td>
                      <td className={`${TD} w-[100px]`}>
                        <NumInput label={`${t.name} factor`} value={t.factor} onChange={(v) => setTransport(i, { factor: v })} />
                        <span className="text-[11px] text-ink-subtle">{t.method === "fuel" ? "kg CO₂e/L" : "kg CO₂e/t·km"}</span>
                      </td>
                      <td className={`${TD} whitespace-nowrap text-right font-semibold tabular-nums`}>{fmt(r.transport[i].carbon, 2)}</td>
                      <td className={TD}>
                        <button type="button" aria-label={`Remove ${t.name}`} onClick={() => update((d) => void d.transport.splice(i, 1))} className="rounded-md border border-danger-line bg-danger-soft px-2 py-1 text-xs font-semibold text-danger hover:bg-[#f8dad6]">
                          Remove
                        </button>
                      </td>
                    </tr>
                  ))}
                  {state.transport.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="px-4 py-5 text-center text-sm text-ink-subtle">
                        No transport entered, so it adds 0 to the total.
                      </td>
                    </tr>
                  ) : null}
                </tbody>
              </table>
            </div>
            <div className="no-print mt-3">
              <Btn variant="secondary" onClick={() => update((d) => void d.transport.push(newTransport()))}>
                + Add delivery
              </Btn>
            </div>
            <p className="mt-3 text-xs text-ink-subtle">
              <strong>Fuel:</strong> litres = trips × distance ÷ km per litre; emissions = litres × fuel factor. Enter the full distance driven per trip (the report uses round trips: 30 km and 40 km). <strong>Tonne-km:</strong> trips × distance × load × factor; use a loaded one-way distance, and pick one method per delivery so it is never counted twice.
            </p>
          </Card>

          {/* 4 */}
          <Card title="4. Site equipment" className="lg:col-span-5">
            <div className="grid grid-cols-2 gap-3">
              <Field label="Equipment hours / building">{(id) => <NumInput id={id} value={state.equipment.hours} onChange={(v) => update((d) => void (d.equipment.hours = v))} />}</Field>
              <Field label="Fuel use (litres per hour)" help="From the machine or fuel logs">{(id) => <NumInput id={id} value={state.equipment.rate} onChange={(v) => update((d) => void (d.equipment.rate = v))} />}</Field>
              <Field label="Fuel factor (kg CO₂e per litre)" help="Diesel: 2.68, from the report">{(id) => <NumInput id={id} value={state.equipment.factor} onChange={(v) => update((d) => void (d.equipment.factor = v))} />}</Field>
              <Field label="Other emissions (kg CO₂e / building)" help="Only if not counted elsewhere">{(id) => <NumInput id={id} value={state.equipment.other} onChange={(v) => update((d) => void (d.equipment.other = v))} />}</Field>
            </div>
            <p className="mt-3 text-xs text-ink-subtle">
              Equipment emissions = hours × litres per hour × fuel factor = {fmt(r.equipmentLitres, 1)} litres → {fmt(r.equipmentCarbon, 1)} kg CO₂e per building. Include only machines inside your project boundary, and avoid counting the same fuel twice.
            </p>
          </Card>

          {/* 5 */}
          <Card title="5. Results" className="lg:col-span-12">
            <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
              <Metric label="Baseline total" value={fmt(r.total, 0)} sub={`kg CO₂e · ${fmt(r.total / 1000, 2)} t · all ${nf.format(r.count)} building${r.count === 1 ? "" : "s"}`} />
              <Metric label="Per building" value={fmt(r.perBuilding, 0)} sub="kg CO₂e / building" />
              <Metric label="Per floor area" value={r.perArea === null ? "—" : fmt(r.perArea, 2)} sub="kg CO₂e / m²" />
              <Metric label="Material waste cost" value={hasCosts ? money(r.wasteCost) : "—"} sub={hasCosts ? "₹, all buildings (estimate)" : "enter unit costs (optional)"} />
            </div>
            <div className="mt-4 grid gap-4 lg:grid-cols-2">
              <div className="rounded-xl border border-line p-4">
                <h3 className="mb-1 font-semibold">Carbon by source</h3>
                {sources.map((s) => (
                  <BarRow key={s.label} {...s} max={sourceMax} />
                ))}
                <p className="text-xs text-ink-subtle">
                  Per building. Material waste is {r.perBuilding > 0 ? fmt((r.materialCarbon / r.perBuilding) * 100, 1) : "0"}% and fuel (transport and equipment) is {r.perBuilding > 0 ? fmt(((r.transportCarbon + r.equipmentCarbon) / r.perBuilding) * 100, 1) : "0"}%. All-building total: {fmt(r.total, 0)} kg CO₂e.
                </p>
              </div>
              <div className="rounded-xl border border-line p-4">
                <h3 className="mb-1 font-semibold">Carbon by material (waste)</h3>
                {byMaterial.length ? byMaterial.map((m) => <BarRow key={m.id} label={m.name} value={m.carbon} max={materialMax} color="var(--primary)" />) : <p className="py-6 text-sm text-ink-subtle">Enter quantities and factors to see this chart.</p>}
                <p className="text-xs text-ink-subtle">Per building. Transport and equipment are shown separately on the left.</p>
              </div>
            </div>
            {r.excludedTotal > 0 ? (
              <p className="mt-3 rounded-lg bg-info-soft px-3 py-2 text-sm text-ink-muted">
                Rows that are not ticked in section 2 would add <strong className="text-ink">{fmt(r.excludedTotal, 0)} kg CO₂e</strong> for all buildings. In the report this is the foundation stage, which its master total of 13,137.02 kg per bungalow leaves out; with it the report gives 13,903.82.
              </p>
            ) : null}
          </Card>

          {/* 6 */}
          <Card title="6. Waste-reduction scenario" className="lg:col-span-7">
            <p className="mb-3 text-sm text-ink-muted">
              Type a target in the <strong>What-if waste %</strong> column of section 2 (blank means unchanged), or use a preset. Then set the other reductions here.
            </p>
            <div className="no-print mb-3 flex flex-wrap gap-2">
              <Btn variant="secondary" onClick={() => setState((prev) => applyReportMeasures(prev))}>
                Use the report&apos;s three measures
              </Btn>
              <Btn variant="secondary" onClick={() => update((d) => void d.materials.forEach((m) => (m.scenWaste = String(Math.round(Number(m.waste) * 0.75 * 100) / 100 || ""))))}>
                Cut all waste by 25%
              </Btn>
              <Btn variant="secondary" onClick={() => update((d) => { d.materials.forEach((m) => (m.scenWaste = "")); d.scenario = { transportReduction: "0", equipmentReduction: "0", costChange: "0" }; })}>
                Clear the scenario
              </Btn>
            </div>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              <Field label="Transport reduction (%)">{(id) => <NumInput id={id} value={state.scenario.transportReduction} onChange={(v) => update((d) => void (d.scenario.transportReduction = v))} />}</Field>
              <Field label="Equipment reduction (%)">{(id) => <NumInput id={id} value={state.scenario.equipmentReduction} onChange={(v) => update((d) => void (d.scenario.equipmentReduction = v))} />}</Field>
              <Field label="Material cost change (%)">
                {(id) => <input id={id} type="number" step="any" className={`${inputCls} tabular-nums`} value={state.scenario.costChange} onChange={(e) => update((d) => void (d.scenario.costChange = e.target.value))} />}
              </Field>
            </div>
            <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
              <Metric label="Scenario total" value={fmt(r.scenarioTotal, 0)} sub="kg CO₂e, all buildings" />
              <Metric label="Carbon saved" value={fmt(r.saved, 0)} sub={`${fmt(r.savedFraction * 100, 1)}% vs baseline`} />
              <Metric label="Estimated cost saved" value={hasCosts ? money(r.costSaved) : "—"} sub={hasCosts ? "₹ across all buildings" : "needs unit costs"} />
            </div>
            <p className="mt-3 text-xs text-ink-subtle">
              A what-if model, not a forecast: saving = baseline − scenario. The report&apos;s own illustrative case (brick waste 8% → 4%, concrete and steel waste −25%, diesel −20%) comes to about 35%. It does not check that a change is structurally suitable or safe.
            </p>
          </Card>

          {/* 7 */}
          <Card title="7. Checks and export" className="lg:col-span-5">
            <ul className="space-y-1.5 text-sm">
              {r.warnings.map((w) => (
                <li key={w} className="flex gap-2 text-[#7a4b00]">
                  <span aria-hidden>⚠</span>
                  <span>{w}</span>
                </li>
              ))}
              <li className="flex gap-2 text-ink-muted">
                <span aria-hidden>ℹ</span>
                <span>Make sure each factor&apos;s unit matches its quantity&apos;s unit (a per-kg factor needs kg).</span>
              </li>
              <li className="flex gap-2 text-ink-muted">
                <span aria-hidden>ℹ</span>
                <span>Avoid double counting: do not add cement separately if the concrete factor already includes it.</span>
              </li>
              <li className="flex gap-2 text-ink-muted">
                <span aria-hidden>ℹ</span>
                <span>Boundary: material waste, transport, equipment and &quot;other&quot; only. Not the material that stays in the building, nor its use.</span>
              </li>
            </ul>
            <div className="no-print mt-4 flex flex-wrap gap-2">
              <Btn onClick={() => download(`carbonbuild-${slug(state.project.name)}.csv`, toCsv(state, r), "text/csv;charset=utf-8")}>Export results CSV</Btn>
              <Btn variant="secondary" onClick={() => download(`carbonbuild-${slug(state.project.name)}-inputs.json`, JSON.stringify({ inputs: state, results: r }, null, 2), "application/json")}>
                Export inputs JSON
              </Btn>
              <Btn variant="secondary" onClick={() => window.print()}>
                Print / Save PDF
              </Btn>
            </div>
            <div className="no-print mt-3 border-t border-line pt-3">
              {confirmClear ? (
                <div className="flex flex-wrap items-center gap-2 text-sm">
                  <span>Delete everything and return to the report example?</span>
                  <Btn
                    variant="danger"
                    onClick={() => {
                      setState(referenceState());
                      setConfirmClear(false);
                    }}
                  >
                    Yes, reset
                  </Btn>
                  <Btn variant="secondary" onClick={() => setConfirmClear(false)}>
                    Cancel
                  </Btn>
                </div>
              ) : (
                <button type="button" onClick={() => setConfirmClear(true)} className="text-xs text-ink-muted underline underline-offset-2 hover:text-ink">
                  Reset all data
                </button>
              )}
            </div>
          </Card>
        </div>

        {/* About */}
        <Card title="About this project" className="mt-4">
          <p className="text-sm text-ink-muted">
            CarbonBuild is the software part of the B.Tech project <strong className="text-ink">&ldquo;Carbon Footprint Assessment of Construction Projects&rdquo;</strong>, Department of Civil Engineering, SCET, Sarvajanik University, Surat (2026). It repeats the report&apos;s method as a calculator, so the numbers can be checked and changed. Team: Parth Vasava, Tulsi Patel, Viraj Lad, Gaurang Parmar. Guide: Prof. Mitali Shah.
          </p>
          <div className="mt-3 space-y-2">
            <details className="rounded-lg border border-line px-3 py-2 text-sm">
              <summary className="cursor-pointer font-semibold">How the numbers are calculated</summary>
              <div className="mt-2 space-y-2 text-ink-muted">
                <p>Every emission is <em>activity data × emission factor</em> (kg CO₂e). All quantities are per building and are multiplied by the number of buildings at the end.</p>
                <ul className="list-disc space-y-1 pl-5">
                  <li><strong>Material waste</strong> = quantity × waste % ÷ 100 × (production factor + waste-treatment factor).</li>
                  <li><strong>Transport (fuel)</strong> = trips × distance ÷ km per litre × kg CO₂e per litre. <strong>Tonne-km</strong> = trips × distance × load × factor.</li>
                  <li><strong>Equipment</strong> = hours × litres per hour × kg CO₂e per litre.</li>
                  <li><strong>Per m²</strong> = total ÷ (built-up area per building × number of buildings). 1,000 kg = 1 tonne.</li>
                </ul>
                <p>Calculations keep full precision; numbers are rounded only on screen. Blank, invalid or negative entries count as 0 and are listed in the checks.</p>
              </div>
            </details>
            <details className="rounded-lg border border-line px-3 py-2 text-sm">
              <summary className="cursor-pointer font-semibold">Where the report example comes from, and where this differs</summary>
              <div className="mt-2 space-y-2 text-ink-muted">
                <p>Quantities, waste rates, factors and fuel data are from the report (BIM chapters, Tables 9.2, 9.3 and 9.9): ten three-storey bungalows, 110 m² per floor, RCC density 2,400 kg/m³, 3 kg per brick. The report&apos;s per-kg factors were turned into per-unit factors (for example concrete 0.142 × 2,400 = 340.8 kg CO₂e per m³).</p>
                <ul className="list-disc space-y-1 pl-5">
                  <li>This calculator gives <strong>13,137.04 kg CO₂e</strong> per bungalow (131,370.38 for ten); the report prints 13,137.02 (131,370.20). The report rounds the delivery-truck diesel down to 514.28 L (1,800 ÷ 3.5 = 514.2857), which accounts for the 0.02 kg. The totals are calculated from the inputs, not copied.</li>
                  <li>The report&apos;s master total leaves out the foundation stage (766.80 kg per bungalow). It is listed here but not counted; ticking it gives 13,903.84 (report: 13,903.82).</li>
                  <li>The report&apos;s text has typing slips that its own summary corrects (168 kg should read 468 kg of wasted steel in columns and beams; 286.27 should read 105.60 for plinth steel). The calculator uses the quantities, so it gets the corrected values.</li>
                </ul>
              </div>
            </details>
          </div>
          <p className="mt-3 text-xs text-ink-subtle">Runs entirely in your browser. Nothing is sent anywhere; entries stay on this device unless you export them. The site is hosted on GitHub Pages, which keeps its usual server logs.</p>
        </Card>
      </div>
    </>
  );
}
