import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

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
  const publicReport = path.join(root, "public", "reports", `${date}.html`);
  const publicPdf = path.join(root, "public", "assets", `report-${date}.pdf`);
  const publicAssets = path.join(root, "public", "assets");

  await fs.access(reportHtml);
  let html = await fs.readFile(reportHtml, "utf8");
  html = html
    .replace(/href=["'](?:\.\.\/)?(?:\.\.\/)?skills\/kami\/styles\.css["']/g, 'href="/assets/kami.css"')
    .replace(/href=["'](?:\.\.\/)?assets\/kami\.css["']/g, 'href="/assets/kami.css"')
    .replace(/href=["'](?:\.\.\/)?(?:\.\.\/)?outputs\/\d{4}-\d{2}-\d{2}\/report\.pdf["']/g, `href="/assets/report-${date}.pdf"`);

  await fs.mkdir(path.dirname(publicReport), { recursive: true });
  await fs.mkdir(publicAssets, { recursive: true });
  await fs.writeFile(publicReport, html);
  await copyIfExists(reportPdf, publicPdf);
  await copyIfExists(path.join(root, "skills", "kami", "styles.css"), path.join(publicAssets, "kami.css"));
  await copyIfExists(path.join(root, "skills", "kami", "styles.css"), path.join(publicAssets, "report.css"));

  console.log(`Archived Kami report HTML: ${publicReport}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
