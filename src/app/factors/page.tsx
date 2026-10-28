import type { Metadata } from "next";
import { FactorLibrary } from "@/components/factor-library";

export const metadata: Metadata = { title: "Emission-factor library" };

export default function FactorsPage() {
  return <FactorLibrary />;
}
