import type { Metadata } from "next";
import { AssessApp } from "@/components/assess/wizard";

export const metadata: Metadata = { title: "Assessment" };

export default function AssessPage() {
  return <AssessApp />;
}
