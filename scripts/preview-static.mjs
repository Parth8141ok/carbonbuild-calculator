// Serves the static export in ./out the way GitHub Pages does, including the
// repository base path, so the production build can be checked locally.
//
//   PAGES_BASE_PATH=/carbonbuild-calculator npm run build
//   PAGES_BASE_PATH=/carbonbuild-calculator npm run preview   (or: npm run preview -- --base=/carbonbuild-calculator)
//
// No dependencies: Node's http and fs only.
import { createReadStream, existsSync, statSync } from "node:fs";
import { createServer } from "node:http";
import { extname, join, normalize, resolve } from "node:path";

const root = resolve("out");
const baseArg = process.argv.find((a) => a.startsWith("--base="))?.slice("--base=".length);
const base = (baseArg ?? process.env.PAGES_BASE_PATH ?? "").replace(/\/$/, "");
const port = Number(process.env.PORT ?? 4173);

const TYPES = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".ico": "image/x-icon",
  ".txt": "text/plain; charset=utf-8",
  ".woff2": "font/woff2",
};

if (!existsSync(root)) {
  console.error("No ./out folder. Run `npm run build` first.");
  process.exit(1);
}

function send(res, status, file) {
  res.writeHead(status, { "Content-Type": TYPES[extname(file)] ?? "application/octet-stream" });
  createReadStream(file).pipe(res);
}

createServer((req, res) => {
  const url = decodeURIComponent((req.url ?? "/").split("?")[0]);
  if (base && url === "/") {
    res.writeHead(302, { Location: `${base}/` });
    return res.end();
  }
  if (base && !url.startsWith(`${base}/`) && url !== base) {
    return send(res, 404, join(root, "404.html"));
  }
  const rel = normalize(url.slice(base.length) || "/").replace(/^([/\\])+/, "");
  let file = join(root, rel);
  if (!file.startsWith(root)) return send(res, 404, join(root, "404.html"));
  if (existsSync(file) && statSync(file).isDirectory()) file = join(file, "index.html");
  else if (!existsSync(file) && existsSync(`${file}.html`)) file = `${file}.html`;
  if (!existsSync(file)) return send(res, 404, join(root, "404.html"));
  send(res, 200, file);
}).listen(port, () => {
  console.log(`Serving ./out at http://localhost:${port}${base}/`);
});
