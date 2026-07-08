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

async function copyIfExists(from, to) {
  try {
    await fs.mkdir(path.dirname(to), { recursive: true });
    await fs.copyFile(from, to);
  } catch (error) {
    if (error.code !== "ENOENT") throw error;
  }
}

async function main() {
  const date = process.env.WHISTLE_DATE || todayInShanghai();
  const reportHtml = path.join(root, "outputs", date, "report.html");
  const reportPdf = path.join(root, "outputs", date, "report.pdf");
  const reportJson = path.join(root, "outputs", date, "report.json");
  const publicReport = path.join(root, "public", "reports", `${date}.html`);
  const publicPdf = path.join(root, "public", "assets", `report-${date}.pdf`);
  const publicJson = path.join(root, "public", "reports", `${date}.json`);
  const publicAssets = path.join(root, "public", "assets");

  await fs.access(reportHtml);
  const rawJson = await fs.readFile(reportJson, "utf8");
  const { report, errors } = validateReport(JSON.parse(rawJson));
  if (errors.length) {
    throw new Error(`Invalid ${reportJson}:\n${errors.map((error) => `- ${error}`).join("\n")}`);
  }
  let html = await fs.readFile(reportHtml, "utf8");
  html = html.replace(new RegExp(`href=["']\\.\\.\\/assets\\/report-${date}\\.pdf["']`, "g"), `href="/assets/report-${date}.pdf"`);

  await fs.mkdir(path.dirname(publicReport), { recursive: true });
  await fs.mkdir(publicAssets, { recursive: true });
  await fs.writeFile(publicReport, html);
  await fs.writeFile(publicJson, `${JSON.stringify(report, null, 2)}\n`);
  await copyIfExists(reportPdf, publicPdf);

  console.log(`Archived structured report: ${publicReport}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
