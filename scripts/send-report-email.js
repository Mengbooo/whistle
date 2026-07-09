import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { Resend } from "resend";
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
  const apiKey = process.env.RESEND_API_KEY;
  const to = process.env.REPORT_TO;
  const from = process.env.REPORT_FROM;
  if (!apiKey || !to || !from) {
    console.log("Skipping email: RESEND_API_KEY, REPORT_TO, or REPORT_FROM is missing.");
    return;
  }

  const date = process.env.WHISTLE_DATE || todayInShanghai();
  const baseUrl = (process.env.REPORT_BASE_URL || "https://daily.bolaxious.cn").replace(/\/+$/, "");
  const reportUrl = `${baseUrl}/reports/${date}.html`;
  const pdfUrl = `${baseUrl}/assets/report-${date}.pdf`;
  const outDir = path.join(root, "outputs", date);
  const pdfPath = path.join(outDir, "report.pdf");
  const jsonPath = path.join(outDir, "report.json");
  const [pdf, rawJson] = await Promise.all([
    fs.readFile(pdfPath),
    fs.readFile(jsonPath, "utf8"),
  ]);
  const report = JSON.parse(rawJson);
  const emailHtml = buildEmailHtml(report, { pdfUrl, reportUrl });

  const resend = new Resend(apiKey);
  const result = await resend.emails.send({
    from,
    to,
    subject: `Whistle 互联网日报｜${date}`,
    html: emailHtml,
    attachments: [
      {
        filename: `whistle-${date}.pdf`,
        content: pdf.toString("base64"),
      },
    ],
  });

  if (result.error) {
    throw new Error(result.error.message);
  }
  console.log(`Sent report email for ${date}.`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
