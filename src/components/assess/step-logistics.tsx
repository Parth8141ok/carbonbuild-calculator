"use client";

import { Copy, Plus, Trash2, Truck, Wrench } from "lucide-react";
import Link from "next/link";
import { useUpdate } from "@/components/assess/shared";
import { BuildingSwitcher } from "@/components/assess/step-materials";
import { InfoTip } from "@/components/ui/overlays";
import { Badge, Button, Callout, Card, CardHeader, Checkbox, Field, Input, NumberInput, Segmented, Select } from "@/components/ui/primitives";
import { createId, newMachinery, newTransport, type MachineryEntry, type Project, type ProjectResult, type TransportEntry } from "@/lib/engine";
import { formatFixed } from "@/lib/format";
import { DATA_STATUS_OPTIONS, TERMS, factorOptionLabel } from "@/lib/labels";
import { cn } from "@/lib/utils";

type Line = ProjectResult["lines"][number];

function ResultBadge({ line }: { line: Line | undefined }) {
  if (!line?.valid) return <span className="text-danger">Incomplete</span>;
  const activity = line.tonneKm !== null ? `${formatFixed(line.tonneKm)} t·km` : `${formatFixed(line.dieselLitres)} L`;
  return (
    <>
      <span className="text-ink-muted">{activity} → </span>
      <span className="font-semibold">{formatFixed(line.emissionsPerBuildingKg)} kg CO₂e</span>
    </>
  );
}

function ErrorList({ line }: { line: Line | undefined }) {
  const errs = line?.flags.filter((f) => f.severity !== "info" && f.code !== "generic_factor") ?? [];
  if (!errs.length) return null;
  return (
    <ul className="mt-2 space-y-0.5 text-xs">
      {errs.map((f, i) => (
        <li key={i} className={f.severity === "error" ? "text-danger" : "text-amber"}>
          {f.message}
        </li>
      ))}
    </ul>
  );
}

export function StepLogistics({ project, result, buildingIndex, setBuildingIndex }: { project: Project; result: ProjectResult; buildingIndex: number; setBuildingIndex: (i: number) => void }) {
  const update = useUpdate(project.id);
  const b = project.buildings[buildingIndex] ?? project.buildings[0];
  const bi = project.buildings.indexOf(b);
  const fuelFactors = project.factors.filter((f) => f.unit === "kgCO2e/L");
  const tkmFactors = project.factors.filter((f) => f.unit === "kgCO2e/tkm");
  const sections = { transport: project.sections?.transport ?? true, machinery: project.sections?.machinery ?? true };
  const lineFor = (id: string) => result.lines.find((l) => l.buildingId === b.id && l.entryId === id);
  const setSection = (k: "transport" | "machinery", v: boolean) => update((p) => void (p.sections = { ...sections, [k]: v }));

  const patchT = (id: string, patch: Partial<TransportEntry>) => update((p) => void (p.buildings[bi].transport = p.buildings[bi].transport.map((t) => (t.id === id ? { ...t, ...patch } : t))));
  const patchM = (id: string, patch: Partial<MachineryEntry>) => update((p) => void (p.buildings[bi].machinery = p.buildings[bi].machinery.map((t) => (t.id === id ? { ...t, ...patch } : t))));

  const setMethod = (t: TransportEntry, method: TransportEntry["method"]) => {
    // A tonne-km entry needs a per-tonne-km factor; fuel-based methods need a per-litre factor.
    const needsTkm = method === "tonne_km";
    const current = project.factors.find((f) => f.id === t.factor.factorId);
    const ok = current && (needsTkm ? current.unit === "kgCO2e/tkm" : current.unit === "kgCO2e/L");
    patchT(t.id, { method, factor: ok ? t.factor : { factorId: (needsTkm ? tkmFactors[0]?.id : fuelFactors[0]?.id) ?? "" } });
  };

  return (
    <div className="space-y-6">
      <BuildingSwitcher project={project} index={bi} onChange={setBuildingIndex} />

      <Card>
        <CardHeader
          title="Transportation to site (A4)"
          description="Fuel-based: trips × distance ÷ fuel economy × fuel factor, or measured fuel × fuel factor. Tonne-km: transported mass × distance × factor per tonne-km. Use one method per delivery so it is never counted twice."
          actions={
            sections.transport ? (
              <>
                <Button variant="secondary" size="sm" onClick={() => update((p) => void p.buildings[bi].transport.push(newTransport({ name: "RMC transit mixer", vehicleCategory: "rmc_transit_mixer" })))}>
                  <Plus /> RMC transit mixer
                </Button>
                <Button variant="secondary" size="sm" onClick={() => update((p) => void p.buildings[bi].transport.push(newTransport()))}>
                  <Plus /> Delivery truck
                </Button>
              </>
            ) : null
          }
        />
        <div className="space-y-3 p-5">
          <Checkbox
            checked={sections.transport}
            onChange={(e) => setSection("transport", e.target.checked)}
            label="Include transportation in this assessment"
            description="Untick if you have no transport data. The results will then state clearly that transport (A4) is excluded."
          />
          {!sections.transport ? (
            <Callout tone="warning" title="Transportation is excluded">
              Transport emissions are not in the total. {b.transport.length ? `The ${b.transport.length} entr${b.transport.length === 1 ? "y" : "ies"} below are kept but not counted.` : ""}
            </Callout>
          ) : b.transport.length === 0 ? (
            <p className="text-sm text-ink-subtle">No transport activities. Add one, or use the estimator in the previous step.</p>
          ) : null}
          {b.transport.map((t) => {
            const l = lineFor(t.id);
            const hasError = sections.transport && l?.flags.some((f) => f.severity === "error");
            return (
              <div key={t.id} className={cn("rounded-lg border p-4", hasError ? "border-danger-line" : "border-line", !sections.transport && "opacity-60")}>
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <Truck className="size-4 text-ink-subtle" aria-hidden />
                    <Input aria-label="Activity name" value={t.name} onChange={(e) => patchT(t.id, { name: e.target.value })} className="h-9 w-64 max-w-full font-medium" />
                    {t.origin === "estimator" ? <Badge tone="outline">From estimator</Badge> : null}
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="num text-sm">
                      <ResultBadge line={l} />
                    </span>
                    <Button variant="ghost" size="icon" aria-label={`Duplicate ${t.name}`} onClick={() => update((p) => void p.buildings[bi].transport.push({ ...structuredClone(t), id: createId("trn"), origin: "manual" }))}>
                      <Copy />
                    </Button>
                    <Button variant="ghost" size="icon" aria-label={`Remove ${t.name}`} onClick={() => update((p) => void (p.buildings[bi].transport = p.buildings[bi].transport.filter((x) => x.id !== t.id)))}>
                      <Trash2 />
                    </Button>
                  </div>
                </div>
                <div className="mt-3 flex flex-wrap items-center gap-3">
                  <Segmented
                    size="sm"
                    label="Calculation method"
                    value={t.method}
                    onChange={(v) => setMethod(t, v)}
                    options={[
                      { value: "distance", label: "Trips × distance (fuel)" },
                      { value: "measured_fuel", label: "Measured fuel" },
                      { value: "tonne_km", label: "Tonne-km" },
                    ]}
                  />
                  <Select aria-label="Vehicle category" value={t.vehicleCategory} onChange={(e) => patchT(t.id, { vehicleCategory: e.target.value as TransportEntry["vehicleCategory"] })} className="h-8 w-auto text-xs">
                    <option value="rmc_transit_mixer">RMC transit mixer</option>
                    <option value="delivery_truck">Material delivery truck</option>
                    <option value="other">Other vehicle</option>
                  </Select>
                  <Select aria-label="Transport mode" value={t.transportMode ?? "road"} onChange={(e) => patchT(t.id, { transportMode: e.target.value as TransportEntry["transportMode"] })} className="h-8 w-auto text-xs">
                    <option value="road">Road</option>
                    <option value="rail">Rail</option>
                    <option value="water">Water</option>
                    <option value="other">Other mode</option>
                  </Select>
                </div>
                <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-6">
                  {t.method === "distance" ? (
                    <>
                      <Field label="Trips">{(id) => <NumberInput id={id} value={t.trips} min={0} onValueChange={(v) => patchT(t.id, { trips: v })} />}</Field>
                      <Field label="Distance per trip">{(id) => <NumberInput id={id} value={t.distanceKm} suffix="km" min={0} onValueChange={(v) => patchT(t.id, { distanceKm: v })} />}</Field>
                      <Field label="Distance is" error={t.distanceConvention === null ? "Choose one" : undefined}>
                        {(id) => (
                          <Select id={id} value={t.distanceConvention ?? ""} aria-invalid={t.distanceConvention === null} onChange={(e) => patchT(t.id, { distanceConvention: (e.target.value || null) as TransportEntry["distanceConvention"] })}>
                            <option value="">Select…</option>
                            <option value="one_way">One-way (doubled)</option>
                            <option value="round_trip">Round trip</option>
                          </Select>
                        )}
                      </Field>
                      <Field label="Fuel economy">{(id) => <NumberInput id={id} value={t.fuelEconomyKmPerL} suffix="km/L" min={0} onValueChange={(v) => patchT(t.id, { fuelEconomyKmPerL: v })} />}</Field>
                    </>
                  ) : t.method === "measured_fuel" ? (
                    <Field label="Fuel consumed" className="lg:col-span-2">
                      {(id) => <NumberInput id={id} value={t.measuredFuelL} suffix="litres" min={0} onValueChange={(v) => patchT(t.id, { measuredFuelL: v })} />}
                    </Field>
                  ) : (
                    <>
                      <Field label="Material or cargo">{(id) => <Input id={id} value={t.cargo ?? ""} onChange={(e) => patchT(t.id, { cargo: e.target.value })} placeholder="e.g. cement, steel" />}</Field>
                      <Field label={<span className="flex items-center gap-1.5">Transported mass <InfoTip label="tonne-km">{TERMS.tonneKm}</InfoTip></span>}>
                        {(id) => <NumberInput id={id} value={t.massTonnes ?? null} suffix="t" min={0} onValueChange={(v) => patchT(t.id, { massTonnes: v })} />}
                      </Field>
                      <Field label="Distance" hint="Laden delivery distance">
                        {(id) => <NumberInput id={id} value={t.distanceKm} suffix="km" min={0} onValueChange={(v) => patchT(t.id, { distanceKm: v })} />}
                      </Field>
                    </>
                  )}
                  <Field label="Supplier / description" optional>{(id) => <Input id={id} value={t.supplier} onChange={(e) => patchT(t.id, { supplier: e.target.value })} />}</Field>
                  <Field label="Data status">
                    {(id) => (
                      <Select id={id} value={t.dataStatus} onChange={(e) => patchT(t.id, { dataStatus: e.target.value as TransportEntry["dataStatus"] })}>
                        {DATA_STATUS_OPTIONS.map((o) => (
                          <option key={o.value} value={o.value}>
                            {o.label}
                          </option>
                        ))}
                      </Select>
                    )}
                  </Field>
                  <Field label={t.method === "tonne_km" ? "Factor (per tonne-km)" : "Fuel factor"} className="lg:col-span-2">
                    {(id) => (
                      <Select id={id} value={t.factor.factorId} onChange={(e) => patchT(t.id, { factor: { factorId: e.target.value } })}>
                        {(t.method === "tonne_km" ? tkmFactors : fuelFactors).length === 0 ? <option value="">No suitable factor in this project</option> : null}
                        {(t.method === "tonne_km" ? tkmFactors : fuelFactors).map((f) => (
                          <option key={f.id} value={f.id}>
                            {factorOptionLabel(f)}
                          </option>
                        ))}
                      </Select>
                    )}
                  </Field>
                </div>
                {t.method === "tonne_km" && tkmFactors.length === 0 ? (
                  <p className="mt-2 text-xs text-amber">
                    The reference reports give no factor per tonne-km. Add a sourced one under{" "}
                    <Link href="/factors" className="underline">
                      Emission factors
                    </Link>{" "}
                    (category Transport), then update this project to the library.
                  </p>
                ) : null}
                {sections.transport ? <ErrorList line={l} /> : null}
                {t.notes ? <p className="mt-2 text-xs text-ink-subtle">{t.notes}</p> : null}
              </div>
            );
          })}
        </div>
      </Card>

      <Card>
        <CardHeader
          title="Site machinery (A5)"
          description="Fuel = operating hours × documented litres per hour, or measured fuel. Covers fuel combustion only (tank-to-wheel), as in the reference study."
          actions={
            sections.machinery ? (
              <Button variant="secondary" size="sm" onClick={() => update((p) => void p.buildings[bi].machinery.push(newMachinery()))}>
                <Plus /> Add machinery
              </Button>
            ) : null
          }
        />
        <div className="space-y-3 p-5">
          <Checkbox
            checked={sections.machinery}
            onChange={(e) => setSection("machinery", e.target.checked)}
            label="Include site machinery in this assessment"
            description="Untick if you have no machinery data. The results will then state clearly that machinery fuel (A5) is excluded."
          />
          {!sections.machinery ? (
            <Callout tone="warning" title="Site machinery is excluded">
              Machinery fuel emissions are not in the total.
            </Callout>
          ) : b.machinery.length === 0 ? (
            <p className="text-sm text-ink-subtle">No machinery entered.</p>
          ) : null}
          {b.machinery.map((m) => {
            const l = lineFor(m.id);
            const hasError = sections.machinery && l?.flags.some((f) => f.severity === "error");
            return (
              <div key={m.id} className={cn("rounded-lg border p-4", hasError ? "border-danger-line" : "border-line", !sections.machinery && "opacity-60")}>
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <Wrench className="size-4 text-ink-subtle" aria-hidden />
                    <Input aria-label="Machinery name" value={m.name} onChange={(e) => patchM(m.id, { name: e.target.value })} className="h-9 w-64 max-w-full font-medium" />
                    {m.origin === "estimator" ? <Badge tone="outline">From estimator</Badge> : null}
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="num text-sm">
                      <ResultBadge line={l} />
                    </span>
                    <Button variant="ghost" size="icon" aria-label={`Duplicate ${m.name}`} onClick={() => update((p) => void p.buildings[bi].machinery.push({ ...structuredClone(m), id: createId("mch"), origin: "manual" }))}>
                      <Copy />
                    </Button>
                    <Button variant="ghost" size="icon" aria-label={`Remove ${m.name}`} onClick={() => update((p) => void (p.buildings[bi].machinery = p.buildings[bi].machinery.filter((x) => x.id !== m.id)))}>
                      <Trash2 />
                    </Button>
                  </div>
                </div>
                <div className="mt-3">
                  <Segmented
                    size="sm"
                    label="Calculation method"
                    value={m.method}
                    onChange={(v) => patchM(m.id, { method: v })}
                    options={[
                      { value: "hours", label: "Hours × L/h" },
                      { value: "measured_fuel", label: "Measured fuel" },
                    ]}
                  />
                </div>
                <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
                  <Field label="Machinery type">{(id) => <Input id={id} value={m.machineryType} onChange={(e) => patchM(m.id, { machineryType: e.target.value })} />}</Field>
                  {m.method === "hours" ? (
                    <>
                      <Field label="Operating hours">{(id) => <NumberInput id={id} value={m.hours} suffix="h" min={0} onValueChange={(v) => patchM(m.id, { hours: v })} />}</Field>
                      <Field label="Fuel use" hint="From the equipment specification or logs; no default is assumed">
                        {(id) => <NumberInput id={id} value={m.litresPerHour} suffix="L/h" min={0} onValueChange={(v) => patchM(m.id, { litresPerHour: v })} />}
                      </Field>
                    </>
                  ) : (
                    <Field label="Fuel consumed" className="lg:col-span-2">
                      {(id) => <NumberInput id={id} value={m.measuredFuelL} suffix="litres" min={0} onValueChange={(v) => patchM(m.id, { measuredFuelL: v })} />}
                    </Field>
                  )}
                  <Field label="Data status">
                    {(id) => (
                      <Select id={id} value={m.dataStatus} onChange={(e) => patchM(m.id, { dataStatus: e.target.value as MachineryEntry["dataStatus"] })}>
                        {DATA_STATUS_OPTIONS.map((o) => (
                          <option key={o.value} value={o.value}>
                            {o.label}
                          </option>
                        ))}
                      </Select>
                    )}
                  </Field>
                  <Field label="Fuel type and factor">
                    {(id) => (
                      <Select id={id} value={m.factor.factorId} onChange={(e) => patchM(m.id, { factor: { factorId: e.target.value } })}>
                        {fuelFactors.map((f) => (
                          <option key={f.id} value={f.id}>
                            {factorOptionLabel(f)}
                          </option>
                        ))}
                      </Select>
                    )}
                  </Field>
                </div>
                {sections.machinery ? <ErrorList line={l} /> : null}
                {m.notes ? <p className="mt-2 text-xs text-ink-subtle">{m.notes}</p> : null}
              </div>
            );
          })}
        </div>
      </Card>
    </div>
  );
}
