"use client";

import { CategoryDonut, RankingChart } from "@/components/charts";
import type { ProjectResult } from "@/lib/engine";
import { formatFixed, formatShare } from "@/lib/format";

export function LandingPreview({ result }: { result: ProjectResult }) {
  const t = result.totals;
  return (
    <div className="rounded-2xl border border-line bg-surface-sunken p-3 shadow-[0_20px_50px_-24px_rgba(30,77,58,0.35)] sm:p-4">
      <div className="flex flex-wrap items-center justify-between gap-2 px-1 pb-3">
        <p className="text-xs font-medium text-ink-muted">Reference project · 10 bungalows, Surat · report master schedule</p>
        <span className="rounded-md bg-primary-soft px-1.5 py-0.5 text-xs font-medium text-primary">Calculated by the engine from the sample inputs</span>
      </div>
      <div className="grid gap-3 sm:grid-cols-3">
        <PreviewStat label="Construction-stage total" value={`${formatFixed(t.totalTonnes)} t CO₂e`} />
        <PreviewStat label="Intensity" value={`${formatFixed(t.intensityKgPerM2)} kg/m²`} />
        <PreviewStat label="Material wastage share" value={formatShare(t.materialWasteKg / t.totalKg)} />
      </div>
      <div className="mt-3 grid gap-3 md:grid-cols-2">
        <CategoryDonut result={result} />
        <RankingChart result={result} />
      </div>
    </div>
  );
}

function PreviewStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-line bg-surface p-3">
      <p className="text-xs text-ink-muted">{label}</p>
      <p className="num mt-1 text-lg font-semibold">{value}</p>
    </div>
  );
}
