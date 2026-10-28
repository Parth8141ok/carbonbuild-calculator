import type { NextConfig } from "next";

/**
 * CarbonBuild runs entirely in the browser (calculations, charts, exports and
 * storage), so it is built as a static site that any file host can serve,
 * including GitHub Pages.
 *
 * PAGES_BASE_PATH is set by the GitHub Pages workflow to the repository path
 * (e.g. "/carbonbuild-calculator"), because a project site is served from
 * https://<user>.github.io/<repository>/. Locally it is empty.
 */
const basePath = process.env.PAGES_BASE_PATH ?? "";

const nextConfig: NextConfig = {
  output: "export",
  basePath,
  // Each route is written as <route>/index.html, which every static host serves.
  trailingSlash: true,
  images: { unoptimized: true },
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
