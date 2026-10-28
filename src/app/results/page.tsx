import type { Metadata } from "next";
import { ResultsApp } from "@/components/results/results-app";

export const metadata: Metadata = { title: "Results" };

export default function ResultsPage() {
  return <ResultsApp />;
}
