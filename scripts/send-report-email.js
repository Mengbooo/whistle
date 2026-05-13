import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { Resend } from "resend";

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
  const outDir = path.join(root, "outputs", date);
  const pdfPath = path.join(outDir, "report.pdf");
  const htmlPath = path.join(outDir, "report.html");
  const [pdf, html] = await Promise.all([
    fs.readFile(pdfPath),
    fs.readFile(htmlPath, "utf8"),
  ]);

  const resend = new Resend(apiKey);
  const result = await resend.emails.send({
    from,
    to,
    subject: `Whistle 互联网日报｜${date}`,
    html,
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
