import type { Metadata } from "next";
import Link from "next/link";
import { ProsePage } from "@/components/prose-page";

export const metadata: Metadata = { title: "About the project" };

const CHAPTERS: { chapter: string; topic: string; href: string; where: string }[] = [
  { chapter: "Ch. 1", topic: "Project data: 10 three-storey bungalows, Surat, 110 m² per floor", href: "/dashboard", where: "Sample project (Dashboard → Load sample project)" },
  { chapter: "Ch. 3", topic: "Materials and their base carbon factors", href: "/factors", where: "Emission factors page (generic ranges)" },
  { chapter: "Ch. 4", topic: "Material waste: foundation, plinth, columns & beams, slabs, walls", href: "/assess", where: "Assessment → step 3, Materials by construction stage" },
  { chapter: "Ch. 5", topic: "Transportation and machinery fuel", href: "/assess", where: "Assessment → step 4, Transport & machinery" },
  { chapter: "Ch. 6", topic: "Cumulative carbon footprint and shares", href: "/results", where: "Results → Overview" },
  { chapter: "Ch. 7–9", topic: "BIM parameters and schedules (Wasted_Mass, Emission)", href: "/results", where: "Results → Calculation table; CSV take-off import in detailed mode" },
  { chapter: "Ch. 9.11", topic: "Data validation and foundation sensitivity", href: "/methodology#reconciliation", where: "Methodology → Reference reconciliation; calculation profiles" },
  { chapter: "Ch. 11", topic: "Results and what-if scenarios", href: "/results", where: "Results → What-if scenarios (Report measures preset)" },
  { chapter: "Ch. 13", topic: "Limitations and assumptions", href: "/methodology#limitations", where: "Methodology → Limitations; Results → Data quality" },
  { chapter: "Ch. 14", topic: "Recommendations", href: "/results", where: "Results → Where to act first" },
];

export default function AboutPage() {
  return (
    <ProsePage eyebrow="About" title="About the project">
      <p>
        CarbonBuild is the software part of a B.Tech Civil Engineering project, <strong>&ldquo;Carbon Footprint Assessment of Construction Projects&rdquo;</strong>. The project studied the construction-stage emissions of ten three-storey RCC bungalows at Surat, Gujarat, first with a manual emission-factor method and then with a BIM-based method. This website turns that method into a calculator, so the same calculation can be repeated, checked and changed.
      </p>
      <p>It was developed as a college assignment for academic evaluation and learning. It is not a commercial product.</p>

      <h2>Project details</h2>
      <ul>
        <li>B.Tech Project 2026, Department of Civil Engineering, Sarvajanik College of Engineering &amp; Technology (SCET), Sarvajanik University, Surat</li>
        <li>Project team: Parth Vasava, Tulsi Patel, Viraj Lad, Gaurang Parmar</li>
        <li>Guide: Prof. Mitali Shah</li>
      </ul>

      <h2>Objectives</h2>
      <ul>
        <li>Quantify the construction-phase carbon footprint of a residential project using activity data and emission factors.</li>
        <li>Identify the most carbon-intensive activities (material wastage, transport, site machinery).</li>
        <li>Show how a BIM-style, parameter-based calculation makes every number traceable.</li>
        <li>Evaluate reduction measures such as lower brick wastage and lower diesel use.</li>
      </ul>

      <h2>Where each part of the report appears</h2>
      <div className="overflow-x-auto rounded-lg border border-line">
        <table className="w-full min-w-[560px] text-sm">
          <thead className="bg-surface-sunken text-left text-xs text-ink-muted">
            <tr>
              <th className="px-3 py-2 font-medium">Report</th>
              <th className="px-3 py-2 font-medium">Topic</th>
              <th className="px-3 py-2 font-medium">In this website</th>
            </tr>
          </thead>
          <tbody>
            {CHAPTERS.map((c) => (
              <tr key={c.chapter + c.topic} className="border-t border-line align-top">
                <td className="whitespace-nowrap px-3 py-2 font-medium text-ink">{c.chapter}</td>
                <td className="px-3 py-2">{c.topic}</td>
                <td className="px-3 py-2">
                  <Link href={c.href} className="text-primary underline-offset-2 hover:underline">
                    {c.where}
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <h2>Try it in two minutes</h2>
      <ul>
        <li>
          Open the <Link href="/dashboard" className="text-primary underline-offset-2 hover:underline">Dashboard</Link> and choose <strong>Load sample project</strong>. The results page shows 131,370.38 kg CO₂e for the ten bungalows, calculated from the report&apos;s quantities.
        </li>
        <li>Open <strong>Calculation table</strong> and select any row to see its formula and numbers.</li>
        <li>Open <strong>What-if scenarios</strong> and press <strong>Report measures</strong> to recalculate the report&apos;s 35% reduction case.</li>
        <li>Change a quantity or waste percentage in the assessment and watch every total update.</li>
      </ul>

      <h2>Contact</h2>
      <p>For questions about the study or this website, contact the project team through the Department of Civil Engineering, SCET, Sarvajanik University, Surat.</p>
    </ProsePage>
  );
}
