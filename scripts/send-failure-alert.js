import process from "node:process";

function todayInShanghai() {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Shanghai",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

function escapeHtml(value = "") {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function buildRunUrl() {
  const serverUrl = process.env.GITHUB_SERVER_URL;
  const repository = process.env.GITHUB_REPOSITORY;
  const runId = process.env.GITHUB_RUN_ID;
  if (!serverUrl || !repository || !runId) return "";
  return `${serverUrl}/${repository}/actions/runs/${runId}`;
}

function buildEmailHtml({ stage, date, runUrl }) {
  const workflow = process.env.GITHUB_WORKFLOW || "Whistle workflow";
  const job = process.env.GITHUB_JOB || "unknown-job";
  const repository = process.env.GITHUB_REPOSITORY || "unknown-repo";
  const branch = process.env.GITHUB_REF_NAME || "unknown-branch";
  const attempt = process.env.GITHUB_RUN_ATTEMPT || "1";

  return `<!doctype html>
<html lang="zh-CN">
  <body style="margin:0;padding:0;background:#f5f4ed;color:#141413;font-family:Georgia,'Songti SC',serif;">
    <main style="max-width:640px;margin:0 auto;padding:32px 24px;">
      <p style="margin:0 0 10px;color:#6b6a64;font-size:12px;letter-spacing:1px;text-transform:uppercase;">Whistle Alert</p>
      <h1 style="margin:0 0 16px;font-size:24px;line-height:1.25;font-weight:500;color:#141413;">日报任务执行失败</h1>
      <p style="margin:0 0 18px;font-size:15px;line-height:1.7;color:#3d3d3a;">
        阶段：${escapeHtml(stage)}<br />
        日期：${escapeHtml(date)}<br />
        Workflow：${escapeHtml(workflow)}<br />
        Job：${escapeHtml(job)}<br />
        仓库：${escapeHtml(repository)}<br />
        分支：${escapeHtml(branch)}<br />
        Attempt：${escapeHtml(attempt)}
      </p>
      ${
        runUrl
          ? `<p style="margin:0;"><a href="${runUrl}" style="display:inline-block;padding:10px 16px;border-radius:999px;background:#1B365D;color:#fff;text-decoration:none;font-size:14px;">查看 GitHub Actions 日志</a></p>`
          : ""
      }
    </main>
  </body>
</html>`;
}

async function main() {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.ALERT_FROM || process.env.REPORT_FROM;
  const to = process.env.ALERT_TO || process.env.REPORT_TO;
  const stage = process.argv[2] || "report-generation";

  if (!apiKey || !from || !to) {
    console.log("Skipping failure email alert: RESEND_API_KEY, ALERT_FROM/REPORT_FROM, or ALERT_TO/REPORT_TO is missing.");
    return;
  }

  const date = process.env.WHISTLE_DATE || todayInShanghai();
  const runUrl = buildRunUrl();
  const payload = {
    from,
    to: [to],
    subject: `Whistle alert: ${stage} failed (${date})`,
    html: buildEmailHtml({ stage, date, runUrl }),
  };

  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  const result = await response.text();
  if (!response.ok) {
    throw new Error(`Resend alert failed (${response.status}): ${result}`);
  }

  console.log(`Sent failure alert email for stage: ${stage}.`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
