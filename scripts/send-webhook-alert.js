import process from "node:process";

function todayInShanghai() {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Shanghai",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

function buildRunUrl() {
  const serverUrl = process.env.GITHUB_SERVER_URL;
  const repository = process.env.GITHUB_REPOSITORY;
  const runId = process.env.GITHUB_RUN_ID;
  if (!serverUrl || !repository || !runId) return "";
  return `${serverUrl}/${repository}/actions/runs/${runId}`;
}

function buildMessage(stage, date, runUrl) {
  const workflow = process.env.GITHUB_WORKFLOW || "Whistle workflow";
  const job = process.env.GITHUB_JOB || "unknown-job";
  const repository = process.env.GITHUB_REPOSITORY || "unknown-repo";
  const branch = process.env.GITHUB_REF_NAME || "unknown-branch";
  const attempt = process.env.GITHUB_RUN_ATTEMPT || "1";

  return [
    "Whistle 任务告警",
    `阶段：${stage}`,
    `日期：${date}`,
    `Workflow：${workflow}`,
    `Job：${job}`,
    `仓库：${repository}`,
    `分支：${branch}`,
    `Attempt：${attempt}`,
    runUrl ? `日志：${runUrl}` : "",
  ]
    .filter(Boolean)
    .join("\n");
}

function buildPayload(type, text) {
  switch (type) {
    case "discord":
      return { content: text };
    case "slack":
      return { text };
    case "feishu":
    case "lark":
      return { msg_type: "text", content: { text } };
    case "wecom":
      return { msgtype: "text", text: { content: text } };
    default:
      return { text };
  }
}

async function main() {
  const webhookUrl = process.env.ALERT_WEBHOOK_URL;
  const webhookType = (process.env.ALERT_WEBHOOK_TYPE || "generic").toLowerCase();
  const stage = process.argv[2] || "email-delivery";

  if (!webhookUrl) {
    console.log("Skipping webhook alert: ALERT_WEBHOOK_URL is missing.");
    return;
  }

  const date = process.env.WHISTLE_DATE || todayInShanghai();
  const runUrl = buildRunUrl();
  const text = buildMessage(stage, date, runUrl);
  const payload = buildPayload(webhookType, text);

  const response = await fetch(webhookUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  const result = await response.text();
  if (!response.ok) {
    throw new Error(`Webhook alert failed (${response.status}): ${result}`);
  }

  console.log(`Sent webhook alert for stage: ${stage}.`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
