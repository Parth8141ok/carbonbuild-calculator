import {
  ENGINE_VERSION,
  FACTOR_DATASET_VERSION,
  calculateProject,
  createId,
  projectSchema,
  type EmissionFactor,
  type Project,
} from "@/lib/engine";

/** A saved, immutable copy of a project's inputs (including its factor snapshot) and headline results. */
export interface AssessmentVersion {
  id: string;
  projectId: string;
  label: string;
  savedAt: string;
  engineVersion: string;
  factorDatasetVersion: string;
  project: Project;
  summary: {
    totalKg: number;
    constructionStageKg: number;
    intensityKgPerM2: number | null;
    profile: Project["profile"];
    boundary: Project["boundary"];
    hasErrors: boolean;
  };
}

export function touch(p: Project, now = new Date().toISOString()): Project {
  return { ...p, updatedAt: now };
}

export function duplicateProject(p: Project, now = new Date().toISOString()): Project {
  const copy = structuredClone(p);
  copy.id = createId("prj");
  copy.name = `Copy of ${p.name}`;
  copy.createdAt = now;
  copy.updatedAt = now;
  copy.archived = false;
  copy.isSample = false;
  return copy;
}

export function snapshotProject(p: Project, label: string, now = new Date().toISOString()): AssessmentVersion {
  const project = structuredClone(p);
  const r = calculateProject(project);
  return {
    id: createId("ver"),
    projectId: p.id,
    label: label.trim() || `Version saved ${now.slice(0, 10)}`,
    savedAt: now,
    engineVersion: ENGINE_VERSION,
    factorDatasetVersion: p.factorDatasetVersion,
    project,
    summary: {
      totalKg: r.totals.totalKg,
      constructionStageKg: r.totals.constructionStageKg,
      intensityKgPerM2: r.totals.intensityKgPerM2,
      profile: p.profile,
      boundary: p.boundary,
      hasErrors: r.hasErrors,
    },
  };
}

/**
 * Replaces a project's factor snapshot with the current library. Factors still
 * referenced by the project but missing from the library are kept, so no entry loses its factor.
 */
export function refreshProjectFactors(p: Project, library: EmissionFactor[]): Project {
  const ids = new Set(library.map((f) => f.id));
  const referenced = new Set<string>();
  for (const b of p.buildings) {
    for (const m of b.materials) {
      m.factors.forEach((f) => referenced.add(f.factorId));
      if (m.installedFactor) referenced.add(m.installedFactor.factorId);
    }
    b.transport.forEach((t) => referenced.add(t.factor.factorId));
    b.machinery.forEach((m) => referenced.add(m.factor.factorId));
  }
  const kept = p.factors.filter((f) => referenced.has(f.id) && !ids.has(f.id));
  return { ...p, factors: [...structuredClone(library), ...kept], factorDatasetVersion: FACTOR_DATASET_VERSION };
}

export type ImportResult = { ok: true; project: Project } | { ok: false; error: string };

export function parseProjectFile(text: string): ImportResult {
  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch {
    return { ok: false, error: "The file is not valid JSON." };
  }
  const candidate = (data && typeof data === "object" && "project" in data ? (data as { project: unknown }).project : data) as unknown;
  const parsed = projectSchema.safeParse(candidate);
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    return { ok: false, error: `Not a valid CarbonBuild project: ${issue.path.join(".") || "root"}: ${issue.message}` };
  }
  const project = parsed.data as Project;
  project.id = createId("prj");
  project.isSample = false;
  for (const b of project.buildings) for (const m of b.materials) if (m.origin === "sample") m.origin = "import";
  return { ok: true, project };
}

export function exportProjectFile(p: Project): string {
  return JSON.stringify({ format: "carbonbuild-project", engineVersion: ENGINE_VERSION, exportedAt: new Date().toISOString(), project: p }, null, 2);
}
