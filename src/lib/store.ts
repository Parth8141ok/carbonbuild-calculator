"use client";

import { useEffect, useMemo, useSyncExternalStore } from "react";
import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import {
  REFERENCE_FACTORS,
  cloneReferenceFactors,
  normaliseScenario,
  createSampleProject,
  emissionFactorSchema,
  newProject,
  projectSchema,
  type AssessmentBoundary,
  type CalculationProfile,
  type EmissionFactor,
  type FactorLevel,
  type Project,
  type ScenarioSettings,
} from "@/lib/engine";
import { duplicateProject, snapshotProject, touch, type AssessmentVersion } from "@/lib/projects";

export type ResultsTab = "overview" | "calculations" | "quality" | "scenarios" | "export";

/** Defaults applied to newly created projects. Existing projects are never changed by them. */
export interface Preferences {
  defaultFactorLevel: FactorLevel;
  defaultBoundary: AssessmentBoundary;
  defaultProfile: CalculationProfile;
  country: string;
}

export const DEFAULT_PREFERENCES: Preferences = {
  defaultFactorLevel: "central",
  defaultBoundary: "construction_stage",
  defaultProfile: "report_master",
  country: "India",
};

/** Everything kept in local storage, for a full backup file. */
export interface BackupData {
  format: "carbonbuild-backup";
  exportedAt: string;
  projects: Project[];
  library: EmissionFactor[];
  versions: AssessmentVersion[];
  preferences: Preferences;
}

interface State {
  projects: Project[];
  activeProjectId: string | null;
  /** Global factor library: copied into new projects; editing it never changes existing projects. */
  library: EmissionFactor[];
  versions: AssessmentVersion[];
  wizardStep: Record<string, number>;
  scenarios: Record<string, ScenarioSettings>;
  resultsTab: ResultsTab;
  preferences: Preferences;
}

interface Actions {
  createProject: (partial?: Partial<Project>) => string;
  loadSample: () => string;
  setActive: (id: string | null) => void;
  updateProject: (id: string, recipe: (draft: Project) => void) => void;
  replaceProject: (p: Project) => void;
  addProject: (p: Project) => void;
  deleteProject: (id: string) => void;
  duplicate: (id: string) => string | null;
  setArchived: (id: string, archived: boolean) => void;
  saveVersion: (id: string, label: string) => void;
  deleteVersion: (versionId: string) => void;
  restoreVersion: (versionId: string) => string | null;
  addLibraryFactor: (f: EmissionFactor) => void;
  updateLibraryFactor: (f: EmissionFactor) => void;
  removeLibraryFactor: (id: string) => void;
  resetLibrary: () => void;
  setWizardStep: (projectId: string, step: number) => void;
  setScenario: (projectId: string, s: ScenarioSettings) => void;
  setResultsTab: (t: ResultsTab) => void;
  setPreferences: (p: Partial<Preferences>) => void;
  exportBackup: () => BackupData;
  importBackup: (data: unknown) => { ok: true; projects: number } | { ok: false; error: string };
  clearAll: () => void;
}

export const useStore = create<State & Actions>()(
  persist(
    (set, get) => ({
      projects: [],
      activeProjectId: null,
      library: cloneReferenceFactors(),
      versions: [],
      wizardStep: {},
      scenarios: {},
      resultsTab: "overview",
      preferences: DEFAULT_PREFERENCES,

      createProject: (partial) => {
        const pref = get().preferences;
        const p = newProject(
          {
            defaultFactorLevel: pref.defaultFactorLevel,
            boundary: pref.defaultBoundary,
            profile: pref.defaultProfile,
            location: { country: pref.country, state: "", city: "" },
            ...partial,
          },
          get().library,
        );
        set((s) => ({ projects: [p, ...s.projects], activeProjectId: p.id, wizardStep: { ...s.wizardStep, [p.id]: 0 } }));
        return p.id;
      },
      loadSample: () => {
        const sample = createSampleProject();
        set((s) => ({
          projects: [sample, ...s.projects.filter((p) => p.id !== sample.id)],
          activeProjectId: sample.id,
          wizardStep: { ...s.wizardStep, [sample.id]: 0 },
        }));
        return sample.id;
      },
      setActive: (id) => set({ activeProjectId: id }),
      updateProject: (id, recipe) =>
        set((s) => ({
          projects: s.projects.map((p) => {
            if (p.id !== id) return p;
            const draft = structuredClone(p);
            recipe(draft);
            return touch(draft);
          }),
        })),
      replaceProject: (np) => set((s) => ({ projects: s.projects.map((p) => (p.id === np.id ? touch(np) : p)) })),
      addProject: (p) => set((s) => ({ projects: [p, ...s.projects], activeProjectId: p.id })),
      deleteProject: (id) =>
        set((s) => ({
          projects: s.projects.filter((p) => p.id !== id),
          versions: s.versions.filter((v) => v.projectId !== id),
          activeProjectId: s.activeProjectId === id ? null : s.activeProjectId,
        })),
      duplicate: (id) => {
        const src = get().projects.find((p) => p.id === id);
        if (!src) return null;
        const copy = duplicateProject(src);
        set((s) => ({ projects: [copy, ...s.projects] }));
        return copy.id;
      },
      setArchived: (id, archived) => set((s) => ({ projects: s.projects.map((p) => (p.id === id ? touch({ ...p, archived }) : p)) })),
      saveVersion: (id, label) => {
        const p = get().projects.find((x) => x.id === id);
        if (!p) return;
        set((s) => ({ versions: [snapshotProject(p, label), ...s.versions] }));
      },
      deleteVersion: (versionId) => set((s) => ({ versions: s.versions.filter((v) => v.id !== versionId) })),
      restoreVersion: (versionId) => {
        const v = get().versions.find((x) => x.id === versionId);
        if (!v) return null;
        const copy = duplicateProject(v.project);
        copy.name = `${v.project.name} (${v.label})`;
        set((s) => ({ projects: [copy, ...s.projects], activeProjectId: copy.id }));
        return copy.id;
      },
      addLibraryFactor: (f) => set((s) => ({ library: [...s.library, f] })),
      updateLibraryFactor: (f) => set((s) => ({ library: s.library.map((x) => (x.id === f.id ? f : x)) })),
      removeLibraryFactor: (id) => set((s) => ({ library: s.library.filter((x) => x.id !== id || x.status === "reference") })),
      resetLibrary: () => set((s) => ({ library: [...cloneReferenceFactors(), ...s.library.filter((f) => f.status !== "reference")] })),
      setWizardStep: (projectId, step) => set((s) => ({ wizardStep: { ...s.wizardStep, [projectId]: step } })),
      setScenario: (projectId, sc) => set((s) => ({ scenarios: { ...s.scenarios, [projectId]: sc } })),
      setResultsTab: (t) => set({ resultsTab: t }),
      setPreferences: (p) => set((s) => ({ preferences: { ...s.preferences, ...p } })),
      exportBackup: () => {
        const s = get();
        return { format: "carbonbuild-backup", exportedAt: new Date().toISOString(), projects: s.projects, library: s.library, versions: s.versions, preferences: s.preferences };
      },
      importBackup: (data) => {
        const d = data as Partial<BackupData> | null;
        if (!d || d.format !== "carbonbuild-backup" || !Array.isArray(d.projects)) return { ok: false, error: "This is not a CarbonBuild backup file." };
        const projects = d.projects.filter((x) => projectSchema.safeParse(x).success);
        if (projects.length !== d.projects.length) return { ok: false, error: `${d.projects.length - projects.length} project(s) in the file are not valid. Nothing was imported.` };
        const library = (d.library ?? []).filter((x) => emissionFactorSchema.safeParse(x).success);
        const versions = (d.versions ?? []).filter((v) => v && projectSchema.safeParse(v.project).success);
        set((s) => {
          const ids = new Set(projects.map((x) => x.id));
          const libIds = new Set(s.library.map((f) => f.id));
          return {
            projects: [...projects, ...s.projects.filter((x) => !ids.has(x.id))],
            library: [...s.library, ...library.filter((f) => !libIds.has(f.id))],
            versions: [...versions, ...s.versions.filter((v) => !versions.some((n) => n.id === v.id))],
            preferences: { ...s.preferences, ...(d.preferences ?? {}) },
          };
        });
        return { ok: true, projects: projects.length };
      },
      clearAll: () =>
        set({ projects: [], activeProjectId: null, library: cloneReferenceFactors(), versions: [], wizardStep: {}, scenarios: {}, preferences: DEFAULT_PREFERENCES }),
    }),
    {
      name: "carbonbuild-v1",
      version: 1,
      storage: createJSONStorage(() => localStorage),
      skipHydration: true,
      partialize: (s) => ({
        projects: s.projects,
        activeProjectId: s.activeProjectId,
        library: s.library,
        versions: s.versions,
        wizardStep: s.wizardStep,
        scenarios: s.scenarios,
        preferences: s.preferences,
      }),
      // Drop anything in storage that no longer matches the schema rather than crash.
      merge: (persisted, current) => {
        const p = (persisted ?? {}) as Partial<State>;
        const projects = (p.projects ?? []).filter((x) => projectSchema.safeParse(x).success) as Project[];
        const library = (p.library ?? []).filter((x) => emissionFactorSchema.safeParse(x).success) as EmissionFactor[];
        const versions = (p.versions ?? []).filter((v) => v && projectSchema.safeParse(v.project).success);
        return {
          ...current,
          ...p,
          projects,
          // Reference factors added in a newer dataset version are added to an older saved library.
          library: library.length ? [...library, ...REFERENCE_FACTORS.filter((f) => !library.some((x) => x.id === f.id)).map((f) => structuredClone(f))] : current.library,
          preferences: { ...DEFAULT_PREFERENCES, ...(p.preferences ?? {}) },
          versions,
          activeProjectId: projects.some((x) => x.id === p.activeProjectId) ? (p.activeProjectId ?? null) : null,
        };
      },
    },
  ),
);

/** True once local storage has been read. Pages render a placeholder until then. */
export function useHydrated(): boolean {
  const hydrated = useSyncExternalStore(
    (onChange) => useStore.persist.onFinishHydration(onChange),
    () => useStore.persist.hasHydrated(),
    () => false,
  );
  useEffect(() => {
    if (!useStore.persist.hasHydrated()) void useStore.persist.rehydrate();
  }, []);
  return hydrated;
}

export function useActiveProject(): Project | null {
  return useStore((s) => s.projects.find((p) => p.id === s.activeProjectId) ?? null);
}

export function useScenario(projectId: string | undefined): ScenarioSettings {
  // Select the stored object itself (stable reference) and normalise outside the selector.
  const raw = useStore((s) => (projectId ? s.scenarios[projectId] : undefined));
  return useMemo(() => normaliseScenario(raw), [raw]);
}
