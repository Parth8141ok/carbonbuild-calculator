import type { Metadata } from "next";
import { ProsePage } from "@/components/prose-page";

export const metadata: Metadata = { title: "Privacy" };

export default function PrivacyPage() {
  return (
    <ProsePage eyebrow="Privacy" title="Privacy">
      <p>CarbonBuild does not need an account and does not collect personal data.</p>
      <ul>
        <li>Project data, saved versions and your factor library are stored only in your browser&apos;s local storage on this device. They are not sent to a server.</li>
        <li>All calculations, charts and exports (PDF, Excel, CSV, JSON) run in your browser.</li>
        <li>No analytics, advertising or tracking cookies are used.</li>
        <li>Clearing your browser&apos;s site data deletes your projects. Export a project file to keep a copy.</li>
      </ul>
    </ProsePage>
  );
}
