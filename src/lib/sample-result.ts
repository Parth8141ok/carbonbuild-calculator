import { calculateProject, createSampleProject, type ProjectResult } from "@/lib/engine";

/**
 * The reference sample's result, for pages rendered at build time. The result is
 * deterministic, so one calculation per build is enough; it is memoised for the
 * build process because two pages use it.
 */
let cached: ProjectResult | null = null;

export function getSampleResult(): ProjectResult {
  cached ??= calculateProject(createSampleProject());
  return cached;
}
