import type { Metadata } from "next";
import { ProjectsManager } from "@/components/projects-manager";

export const metadata: Metadata = { title: "Projects" };

export default function ProjectsPage() {
  return <ProjectsManager />;
}
