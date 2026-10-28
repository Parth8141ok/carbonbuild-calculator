import { cacheLife } from "next/cache";
import { calculateProject, createSampleProject, type ProjectResult } from "@/lib/engine";

/** The reference sample's result. It is deterministic, so it is computed at build time and cached indefinitely. */
export async function getSampleResult(): Promise<ProjectResult> {
  "use cache";
  cacheLife("max");
  return calculateProject(createSampleProject());
}
