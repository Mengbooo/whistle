import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { validateReport } from "./report-renderer.js";

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
  const jsonPath = path.join(root, "outputs", date, "report.json");
  const input = JSON.parse(await fs.readFile(jsonPath, "utf8"));
  const { report, errors } = validateReport(input);
  if (errors.length) {
    throw new Error(`Invalid ${jsonPath}:\n${errors.map((error) => `- ${error}`).join("\n")}`);
  }
  console.log(`Validated structured report: ${report.title}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
