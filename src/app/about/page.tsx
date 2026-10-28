import type { Metadata } from "next";
import { ProsePage } from "@/components/prose-page";

export const metadata: Metadata = { title: "About and contact" };

export default function AboutPage() {
  return (
    <ProsePage eyebrow="About" title="About CarbonBuild">
      <p>
        CarbonBuild turns the method of a B.Tech civil engineering project into a working calculator. The project, &ldquo;Carbon Footprint Assessment of Construction Projects&rdquo;, studied the construction-stage emissions of ten three-storey RCC bungalows at Surat, Gujarat, using a manual emission-factor method and a BIM-based method.
      </p>
      <h2>Project</h2>
      <ul>
        <li>B.Tech Project 2026, Department of Civil Engineering, Sarvajanik College of Engineering &amp; Technology (SCET), Sarvajanik University, Surat</li>
        <li>Project team: Parth Vasava, Tulsi Patel, Viraj Lad, Gaurang Parmar</li>
        <li>Guide: Prof. Mitali Shah</li>
      </ul>
      <h2>Contact</h2>
      <p>For questions about the study or this calculator, contact the project team through the Department of Civil Engineering, SCET, Sarvajanik University, Surat.</p>
      <h2>What it is not</h2>
      <p>CarbonBuild is not a certification, verification or rating service, and it is not affiliated with any green-building rating system. Its results are estimates for comparison and decision support.</p>
    </ProsePage>
  );
}
