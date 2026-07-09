import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { buildEmailHtml } from "./report-renderer.js";

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
  const baseUrl = (process.env.REPORT_BASE_URL || "http://localhost:5173").replace(/\/+$/, "");
  const reportUrl = `${baseUrl}/reports/${date}.html`;
  const pdfUrl = `${baseUrl}/assets/report-${date}.pdf`;
  const report = JSON.parse(
    await fs.readFile(path.join(root, "outputs", date, "report.json"), "utf8"),
  );
  const html = buildEmailHtml(report, { pdfUrl, reportUrl });
  const targets = [
    path.join(root, "outputs", date, "email-preview.html"),
    path.join(root, "public", "reports", `${date}-email-preview.html`),
    path.join(root, "site", "reports", `${date}-email-preview.html`),
  ];

  for (const target of targets) {
    await fs.mkdir(path.dirname(target), { recursive: true });
    await fs.writeFile(target, html);
  }

  console.log(`Generated email preview: ${baseUrl}/reports/${date}-email-preview.html`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
