import type { MaterialCategory, Stage } from "./types";

export const DEFAULT_STAGES: Stage[] = [
  { id: "foundation", name: "Foundation", builtIn: true },
  { id: "plinth", name: "Plinth", builtIn: true },
  { id: "columns_beams", name: "Columns and beams", builtIn: true },
  { id: "slabs", name: "Slabs", builtIn: true },
  { id: "walls", name: "Walls and masonry", builtIn: true },
];

export const MATERIAL_CATEGORY_LABELS: Record<MaterialCategory, string> = {
  concrete: "Concrete",
  cement: "Cement",
  steel: "Steel",
  masonry: "Masonry",
  other: "Other",
};

export function cloneDefaultStages(): Stage[] {
  return DEFAULT_STAGES.map((s) => ({ ...s }));
}
