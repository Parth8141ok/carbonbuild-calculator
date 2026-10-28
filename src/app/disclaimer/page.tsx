import type { Metadata } from "next";
import { ProsePage } from "@/components/prose-page";

export const metadata: Metadata = { title: "Disclaimer" };

export default function DisclaimerPage() {
  return (
    <ProsePage eyebrow="Disclaimer" title="Disclaimer">
      <p>
        CarbonBuild produces <strong>estimates</strong> from the quantities, waste allowances and emission factors that you enter, and from reference values taken from a student research project. Results depend entirely on those inputs.
      </p>
      <ul>
        <li>Results are not a certified or third-party-verified carbon assessment, an environmental product declaration, or a whole-life carbon assessment.</li>
        <li>The default boundary is the construction stage only. It leaves out the embodied carbon of installed material, operational energy and end of life.</li>
        <li>Reference factors are generic or study-specific secondary values and may not represent your suppliers.</li>
        <li>Reduction scenarios show potential effects calculated from your inputs. They are not guaranteed savings.</li>
        <li>Check inputs against site records and use project-specific data before relying on the results for design, procurement, reporting or compliance.</li>
      </ul>
    </ProsePage>
  );
}
