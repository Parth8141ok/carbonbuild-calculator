"use client";

import Link from "next/link";
import { FlagList, summariseFlags } from "@/components/flags";
import { Button, Card, CardHeader } from "@/components/ui/primitives";
import { PROFILE_LABELS, type Project, type ProjectResult } from "@/lib/engine";
import { formatFixed, formatKg } from "@/lib/format";
import { locationLabel } from "@/lib/labels";
import { useStore } from "@/lib/store";

export function StepReview({ project, result }: { project: Project; result: ProjectResult }) {
  const setTab = useStore((s) => s.setResultsTab);
  const flags = summariseFlags(result);
  const counts = { error: flags.filter((f) => f.severity === "error").length, warning: flags.filter((f) => f.severity === "warning").length };
  return (
    <div className="space-y-6">
      <Card>
        <CardHeader title="Review inputs" description={`${project.name} · ${locationLabel(project)}`} />
        <div className="overflow-x-auto p-5">
          <table className="w-full min-w-[560px] text-sm">
            <thead>
              <tr className="border-b border-line text-left text-xs text-ink-muted">
                <th className="py-2 font-medium">Building group</th>
                <th className="py-2 text-right font-medium">Count used</th>
                <th className="py-2 text-right font-medium">Materials</th>
                <th className="py-2 text-right font-medium">Transport</th>
                <th className="py-2 text-right font-medium">Machinery</th>
                <th className="py-2 text-right font-medium">Per building</th>
                <th className="py-2 text-right font-medium">Group total</th>
              </tr>
            </thead>
            <tbody>
              {project.buildings.map((b) => {
                const r = result.byBuilding.find((x) => x.buildingId === b.id)!;
                return (
                  <tr key={b.id} className="border-b border-line last:border-0">
                    <td className="py-2">{b.name}</td>
                    <td className="num py-2 text-right">
                      {r.multiplier} of {b.count}
                    </td>
                    <td className="num py-2 text-right">{b.materials.length}</td>
                    <td className="num py-2 text-right">{b.transport.length}</td>
                    <td className="num py-2 text-right">{b.machinery.length}</td>
                    <td className="num py-2 text-right">{formatFixed(r.perBuildingKg)}</td>
                    <td className="num py-2 text-right font-medium">{formatFixed(r.totalKg)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          <dl className="mt-5 grid gap-4 text-sm sm:grid-cols-3">
            <div>
              <dt className="text-ink-muted">Calculation profile</dt>
              <dd className="font-medium">{PROFILE_LABELS[project.profile]}</dd>
            </div>
            <div>
              <dt className="text-ink-muted">Report master total</dt>
              <dd className="num font-medium">{formatKg(result.profileTotals.report_master)}</dd>
            </div>
            <div>
              <dt className="text-ink-muted">Foundation-inclusive total</dt>
              <dd className="num font-medium">{formatKg(result.profileTotals.foundation_inclusive)}</dd>
            </div>
          </dl>
        </div>
      </Card>
      <Card>
        <CardHeader title="Checks" description={`${counts.error} error${counts.error === 1 ? "" : "s"}, ${counts.warning} warning${counts.warning === 1 ? "" : "s"}. Entries with errors are left out of the total until they are fixed.`} />
        <div className="p-5">
          <FlagList flags={flags} />
        </div>
      </Card>
      <div className="flex justify-end">
        <Button asChild size="lg" onClick={() => setTab("overview")}>
          <Link href="/results">View results dashboard</Link>
        </Button>
      </div>
    </div>
  );
}
