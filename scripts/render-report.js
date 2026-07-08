import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { renderReportHtml, validateReport } from "./report-renderer.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");

function todayInShanghai() {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Shanghai",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

async function main() {
  const date = process.env.WHISTLE_DATE || todayInShanghai();
  const outDir = path.join(root, "outputs", date);
  const jsonPath = path.join(outDir, "report.json");
  const htmlPath = path.join(outDir, "report.html");

  const raw = await fs.readFile(jsonPath, "utf8");
  const input = JSON.parse(raw);
  const { report, errors } = validateReport(input);
  if (errors.length) {
    throw new Error(`Invalid ${jsonPath}:\n${errors.map((error) => `- ${error}`).join("\n")}`);
  }

  await fs.writeFile(jsonPath, `${JSON.stringify(report, null, 2)}\n`);
  await fs.writeFile(htmlPath, renderReportHtml(report));
  console.log(`Rendered structured report HTML: ${htmlPath}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
