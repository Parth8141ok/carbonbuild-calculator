"use client";

import { useMemo } from "react";
import { calculateProject, type Project, type ProjectResult } from "@/lib/engine";
import { useStore } from "@/lib/store";

export function useProjectResult(project: Project | null): ProjectResult | null {
  return useMemo(() => (project ? calculateProject(project) : null), [project]);
}

export function useUpdate(projectId: string) {
  const updateProject = useStore((s) => s.updateProject);
  return (recipe: (draft: Project) => void) => updateProject(projectId, recipe);
}

export function PageShell({ children }: { children: React.ReactNode }) {
  return <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 sm:py-10">{children}</div>;
}

export function LoadingState() {
  return (
    <PageShell>
      <div className="h-8 w-64 animate-pulse rounded bg-surface-sunken" />
      <div className="mt-6 h-64 animate-pulse rounded-xl bg-surface-sunken" />
    </PageShell>
  );
}
