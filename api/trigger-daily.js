export default async function handler(request, response) {
  const cronSecret = process.env.CRON_SECRET;
  const authHeader = request.headers.authorization;

  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return response.status(401).json({ ok: false, error: "Unauthorized" });
  }

  const token = process.env.GITHUB_TRIGGER_TOKEN;
  if (!token) {
    return response.status(500).json({
      ok: false,
      error: "Missing GITHUB_TRIGGER_TOKEN",
    });
  }

  const owner = process.env.GITHUB_REPO_OWNER || "Mengbooo";
  const repo = process.env.GITHUB_REPO_NAME || "whistle";
  const workflow = process.env.GITHUB_WORKFLOW_FILE || "daily.yml";
  const ref = process.env.GITHUB_WORKFLOW_REF || "main";

  const dispatchResponse = await fetch(
    `https://api.github.com/repos/${owner}/${repo}/actions/workflows/${workflow}/dispatches`,
    {
      method: "POST",
      headers: {
        Accept: "application/vnd.github+json",
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
        "X-GitHub-Api-Version": "2026-03-10",
      },
      body: JSON.stringify({ ref }),
    },
  );

  if (!dispatchResponse.ok) {
    const text = await dispatchResponse.text();
    return response.status(dispatchResponse.status).json({
      ok: false,
      error: `GitHub dispatch failed: ${text}`,
    });
  }

  return response.status(200).json({
    ok: true,
    owner,
    repo,
    workflow,
    ref,
    triggeredAt: new Date().toISOString(),
  });
}
