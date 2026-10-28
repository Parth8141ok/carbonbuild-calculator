import type { Metadata } from "next";
import { ProsePage } from "@/components/prose-page";

export const metadata: Metadata = { title: "Disclaimer" };

export default function DisclaimerPage() {
  return (
    <ProsePage eyebrow="Disclaimer" title="Disclaimer">
      <p>
        CarbonBuild was developed as a <strong>college assignment</strong> (B.Tech Civil Engineering project, SCET, Sarvajanik University, Surat, 2026) for learning and academic evaluation. It has not been independently reviewed and is not intended for professional, commercial or compliance use.
      </p>
      <p>
        It produces <strong>estimates</strong> from the quantities, waste allowances and emission factors you enter, and from reference values taken from the project report. Results depend entirely on those inputs.
      </p>
      <ul>
        <li>Results are not a certified or third-party-verified carbon assessment, an environmental product declaration or a whole-life carbon assessment.</li>
        <li>The default boundary is the construction stage only. It leaves out the embodied carbon of installed material, operational energy and end of life.</li>
        <li>Reference factors are generic or study-specific secondary values and may not represent real suppliers. Illustrative factors have no cited source.</li>
        <li>Reduction scenarios show potential effects calculated from your inputs. They are not guaranteed savings and do not check structural safety.</li>
      </ul>
    </ProsePage>
  );
}
