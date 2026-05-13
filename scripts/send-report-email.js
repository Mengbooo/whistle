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

function escapeHtml(value) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function extractSummary(html) {
  const match = html.match(/<p class=["']intro["'][^>]*>([\s\S]*?)<\/p>/i);
  if (!match) {
    return "今日 Whistle 互联网日报已生成，聚焦产品、研发、增长、商业化、基础设施与合规判断。";
  }
  return match[1].replace(/<[^>]+>/g, "").replace(/\s+/g, " ").trim();
}

function buildEmailHtml({ date, reportUrl, summary }) {
  return `<!doctype html>
<html lang="zh-CN">
  <body style="margin:0;padding:0;background:#f5f4ed;color:#141413;font-family:Georgia,'Songti SC',serif;">
    <main style="max-width:640px;margin:0 auto;padding:32px 24px;">
      <p style="margin:0 0 10px;color:#6b6a64;font-size:12px;letter-spacing:1px;text-transform:uppercase;">Whistle Daily</p>
      <h1 style="margin:0 0 16px;font-size:26px;line-height:1.25;font-weight:500;color:#141413;">Whistle 互联网日报｜${date}</h1>
      <p style="margin:0 0 22px;font-size:15px;line-height:1.7;color:#3d3d3a;">${escapeHtml(summary)}</p>
      <p style="margin:0;">
        <a href="${reportUrl}" style="display:inline-block;padding:10px 16px;border-radius:999px;background:#1B365D;color:#fff;text-decoration:none;font-size:14px;">在线阅读</a>
      </p>
    </main>
  </body>
</html>`;
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
  const outDir = path.join(root, "outputs", date);
  const pdfPath = path.join(outDir, "report.pdf");
  const htmlPath = path.join(outDir, "report.html");
  const [pdf, html] = await Promise.all([
    fs.readFile(pdfPath),
    fs.readFile(htmlPath, "utf8"),
  ]);
  const summary = extractSummary(html);
  const emailHtml = buildEmailHtml({ date, reportUrl, summary });

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
