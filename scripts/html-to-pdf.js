import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { chromium } from "playwright";

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
  const htmlPath = path.join(root, "outputs", date, "report.html");
  const pdfPath = path.join(root, "outputs", date, "report.pdf");
  await fs.access(htmlPath);

  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1280, height: 1600 } });
  await page.goto(pathToFileURL(htmlPath).href, { waitUntil: "networkidle" });
  await page.pdf({
    path: pdfPath,
    format: "A4",
    printBackground: true,
    margin: {
      top: "12mm",
      right: "12mm",
      bottom: "14mm",
      left: "12mm",
    },
  });
  await browser.close();
  console.log(`Generated PDF: ${pdfPath}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
