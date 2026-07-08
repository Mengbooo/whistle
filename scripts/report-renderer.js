export const REPORT_SCHEMA_VERSION = 1;

export const SECTION_ORDER = [
  { id: "headline", title: "今日头条" },
  { id: "ai-tools", title: "AI 与新工具" },
  { id: "platforms", title: "大厂与平台动态" },
  { id: "product-growth", title: "产品与增长观察" },
  { id: "engineering", title: "开发者与工程实践" },
  { id: "funding", title: "投融资与行业机会" },
  { id: "policy", title: "政策监管与合规" },
  { id: "social-buzz", title: "社交热度观察" },
];

const SECTION_IDS = new Set(SECTION_ORDER.map((section) => section.id));

export function escapeHtml(value = "") {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export function stripHtml(value = "") {
  return String(value)
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function asArray(value) {
  return Array.isArray(value) ? value : [];
}

function compact(value = "", limit = 180) {
  const text = stripHtml(value);
  if (text.length <= limit) return text;
  return `${text.slice(0, limit - 1)}…`;
}

function normalizeTags(value) {
  return asArray(value)
    .map((tag) => String(tag).trim())
    .filter(Boolean)
    .slice(0, 5);
}

function normalizeItem(item = {}) {
  return {
    title: String(item.title || "").trim(),
    summary: String(item.summary || item.description || "").trim(),
    sourceName: String(item.sourceName || item.source || item.publisher || "来源").trim(),
    sourceUrl: String(item.sourceUrl || item.url || "").trim(),
    publishedAt: String(item.publishedAt || "").trim(),
    tags: normalizeTags(item.tags),
    importance: String(item.importance || "normal").trim(),
  };
}

function normalizeSection(section = {}) {
  return {
    id: String(section.id || "").trim(),
    title: String(section.title || "").trim(),
    summary: String(section.summary || "").trim(),
    items: asArray(section.items).map(normalizeItem).filter((item) => item.title || item.summary),
  };
}

function normalizeActions(actions) {
  return asArray(actions)
    .map((action) => {
      if (typeof action === "string") {
        return { audience: "", text: action.trim() };
      }
      return {
        audience: String(action.audience || "").trim(),
        text: String(action.text || action.summary || "").trim(),
      };
    })
    .filter((action) => action.text);
}

function normalizeFetchErrors(errors) {
  return asArray(errors)
    .map((error) => {
      if (typeof error === "string") {
        return { source: "unknown", message: error.trim() };
      }
      return {
        source: String(error.source || error.sourceName || error.name || "unknown").trim(),
        message: String(error.message || error.status || "").trim(),
      };
    })
    .filter((error) => error.message);
}

function normalizeSourceStatus(status) {
  if (Array.isArray(status)) {
    return status
      .map((item) => ({
        name: String(item.name || item.source || "").trim(),
        status: String(item.status || "").trim(),
        detail: String(item.detail || item.message || "").trim(),
      }))
      .filter((item) => item.name || item.status || item.detail);
  }
  if (status && typeof status === "object") {
    return Object.entries(status).map(([name, value]) => ({
      name,
      status: String(value),
      detail: "",
    }));
  }
  return [];
}

export function normalizeReport(input = {}) {
  const rawSections = asArray(input.sections).map(normalizeSection);
  const byId = new Map(rawSections.filter((section) => section.id).map((section) => [section.id, section]));
  const extras = rawSections.filter((section) => section.id && !SECTION_IDS.has(section.id));
  const sections = [
    ...SECTION_ORDER.map((template) => {
      const section = byId.get(template.id);
      return {
        id: template.id,
        title: section?.title || template.title,
        summary: section?.summary || "",
        items: section?.items || [],
      };
    }),
    ...extras,
  ];

  const date = String(input.date || "").trim();
  return {
    schemaVersion: Number(input.schemaVersion || REPORT_SCHEMA_VERSION),
    date,
    title: String(input.title || (date ? `Whistle 互联网日报｜${date}` : "Whistle 互联网日报")).trim(),
    summary: String(input.summary || input.lead || "").trim(),
    theme: String(input.theme || "").trim(),
    topline: asArray(input.topline || input.topLine)
      .map((item) => String(item).trim())
      .filter(Boolean)
      .slice(0, 5),
    sections,
    actions: normalizeActions(input.actions),
    noiseNote: String(input.noiseNote || input.noise || "").trim(),
    fetchErrors: normalizeFetchErrors(input.fetchErrors || input.errors),
    sourceStatus: normalizeSourceStatus(input.sourceStatus || input.fetchSummary),
    generatedAt: String(input.generatedAt || new Date().toISOString()),
  };
}

export function validateReport(input = {}) {
  const report = normalizeReport(input);
  const errors = [];
  const rawSections = asArray(input.sections);
  const rawSectionIds = rawSections.map((section) => String(section?.id || "").trim());
  const duplicateSectionIds = rawSectionIds.filter(
    (id, index) => id && rawSectionIds.indexOf(id) !== index,
  );
  const unknownSectionIds = rawSectionIds.filter((id) => id && !SECTION_IDS.has(id));
  const missingSectionIds = SECTION_ORDER.map((section) => section.id).filter(
    (id) => !rawSectionIds.includes(id),
  );

  if (report.schemaVersion !== REPORT_SCHEMA_VERSION) {
    errors.push(`schemaVersion must be ${REPORT_SCHEMA_VERSION}`);
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(report.date)) {
    errors.push("date must use YYYY-MM-DD");
  }
  if (!report.title) errors.push("title is required");
  if (!report.summary) errors.push("summary is required");
  if (!report.sections.length) errors.push("sections are required");
  if (unknownSectionIds.length) {
    errors.push(`unknown section id: ${[...new Set(unknownSectionIds)].join(", ")}`);
  }
  if (duplicateSectionIds.length) {
    errors.push(`duplicate section id: ${[...new Set(duplicateSectionIds)].join(", ")}`);
  }
  if (missingSectionIds.length) {
    errors.push(`missing section id: ${missingSectionIds.join(", ")}`);
  }
  for (const section of report.sections) {
    if (!section.id) errors.push("section.id is required");
    if (!section.title) errors.push(`section ${section.id || "(unknown)"} title is required`);
    for (const item of section.items) {
      if (!item.title) errors.push(`item title is required in ${section.id}`);
      if (!item.summary) errors.push(`item summary is required in ${section.id}: ${item.title}`);
      if (!item.sourceUrl) errors.push(`item sourceUrl is required in ${section.id}: ${item.title}`);
    }
  }
  return { report, errors };
}

function sectionAnchor(id) {
  return `section-${id}`;
}

function renderMeta(parts) {
  return parts.filter(Boolean).map(escapeHtml).join(" · ");
}

function renderTags(tags) {
  if (!tags.length) return "";
  return `<div class="tags">${tags.map((tag) => `<span>${escapeHtml(tag)}</span>`).join("")}</div>`;
}

function renderItem(item, index) {
  const source = item.sourceUrl
    ? `<a href="${escapeHtml(item.sourceUrl)}" target="_blank" rel="noreferrer">${escapeHtml(item.sourceName || "来源")}</a>`
    : escapeHtml(item.sourceName || "来源");
  return `<article class="report-item">
    <div class="item-index">${String(index + 1).padStart(2, "0")}</div>
    <div class="item-body">
      ${renderTags(item.tags)}
      <h3>${escapeHtml(item.title)}</h3>
      <p>${escapeHtml(item.summary)}</p>
      <div class="item-meta">${source}${item.publishedAt ? ` · ${escapeHtml(item.publishedAt)}` : ""}</div>
    </div>
  </article>`;
}

function renderSection(section) {
  const items = section.items.length
    ? section.items.map(renderItem).join("\n")
    : `<p class="empty">本期无强信号。</p>`;
  return `<section class="report-section" id="${sectionAnchor(section.id)}">
    <div class="section-heading">
      <p>${escapeHtml(section.id)}</p>
      <h2>${escapeHtml(section.title)}</h2>
      ${section.summary ? `<span>${escapeHtml(section.summary)}</span>` : ""}
    </div>
    <div class="section-items">${items}</div>
  </section>`;
}

function renderActions(actions) {
  if (!actions.length) return "";
  return `<section class="report-section" id="section-actions">
    <div class="section-heading">
      <p>actions</p>
      <h2>今日行动建议</h2>
    </div>
    <div class="action-list">
      ${actions
        .map(
          (action) => `<article class="action-item">
            ${action.audience ? `<strong>${escapeHtml(action.audience)}</strong>` : ""}
            <span>${escapeHtml(action.text)}</span>
          </article>`,
        )
        .join("")}
    </div>
  </section>`;
}

function renderSourceStatus(report) {
  const statuses = report.sourceStatus.length
    ? report.sourceStatus
    : report.fetchErrors.map((error) => ({
        name: error.source,
        status: "failed",
        detail: error.message,
      }));
  if (!statuses.length && !report.noiseNote) return "";
  return `<section class="report-section report-section--muted" id="section-noise">
    <div class="section-heading">
      <p>noise</p>
      <h2>去噪说明</h2>
    </div>
    ${report.noiseNote ? `<p class="note">${escapeHtml(report.noiseNote)}</p>` : ""}
    ${
      statuses.length
        ? `<div class="status-grid">${statuses
            .map(
              (item) => `<div>
                <strong>${escapeHtml(item.name)}</strong>
                <span>${escapeHtml(item.status)}${item.detail ? ` · ${escapeHtml(item.detail)}` : ""}</span>
              </div>`,
            )
            .join("")}</div>`
        : ""
    }
  </section>`;
}

export function renderReportHtml(input) {
  const { report, errors } = validateReport(input);
  if (errors.length) {
    throw new Error(`Invalid report.json:\n${errors.map((error) => `- ${error}`).join("\n")}`);
  }
  const toc = [
    ...report.sections.map((section) => ({
      href: `#${sectionAnchor(section.id)}`,
      label: section.title,
    })),
    ...(report.actions.length ? [{ href: "#section-actions", label: "今日行动建议" }] : []),
    ...(report.noiseNote || report.sourceStatus.length || report.fetchErrors.length
      ? [{ href: "#section-noise", label: "去噪说明" }]
      : []),
  ];
  const itemCount = report.sections.reduce((sum, section) => sum + section.items.length, 0);
  const summary = escapeHtml(report.summary);
  const pdfHref = `../assets/report-${report.date}.pdf`;

  return `<!doctype html>
<html lang="zh-CN">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta name="description" content="${summary}">
  <title>${escapeHtml(report.title)}</title>
  <style>
    :root {
      color-scheme: dark;
      --bg: #000;
      --panel: #0d0d0d;
      --panel-soft: #151515;
      --line: #242424;
      --line-soft: #1a1a1a;
      --text: #f4f4f4;
      --muted: #a5a5a5;
      --faint: #737373;
      --accent: #8ab4ff;
      --max: 1180px;
      --serif: ui-serif, "Songti SC", "Noto Serif CJK SC", Georgia, serif;
      --sans: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
    }
    * { box-sizing: border-box; }
    html, body { margin: 0; min-height: 100%; background: var(--bg); color: var(--text); }
    body { font-family: var(--sans); line-height: 1.72; -webkit-font-smoothing: antialiased; }
    a { color: inherit; text-decoration: none; border-bottom: 1px solid #3a3a3a; }
    a:hover { color: #fff; border-bottom-color: #fff; }
    .site-header {
      position: sticky; top: 0; z-index: 10;
      display: flex; align-items: center; justify-content: space-between;
      max-width: calc(var(--max) + 80px); margin: 0 auto; padding: 22px 40px;
      background: rgba(0,0,0,.82); backdrop-filter: blur(18px);
      border-bottom: 1px solid var(--line-soft);
    }
    .brand { font-weight: 650; letter-spacing: -.02em; }
    .nav { display: flex; gap: 28px; color: var(--muted); font-size: 14px; }
    .nav a { border: 0; }
    .nav a:hover { color: var(--text); }
    .hero {
      max-width: 860px; margin: 0 auto; padding: 86px 28px 58px; text-align: center;
    }
    .kicker { margin: 0 0 18px; color: var(--muted); font-size: 13px; }
    h1 { margin: 0; font-size: clamp(38px, 6vw, 76px); line-height: 1.04; letter-spacing: -.055em; }
    .summary { max-width: 720px; margin: 24px auto 0; color: #cfcfcf; font-size: 18px; line-height: 1.7; }
    .hero-meta { margin-top: 22px; color: var(--faint); font-size: 13px; }
    .hero-actions { display: flex; justify-content: center; gap: 12px; margin-top: 30px; }
    .button {
      display: inline-flex; align-items: center; justify-content: center;
      min-height: 38px; padding: 0 18px; border: 1px solid var(--line); border-radius: 999px;
      background: #fff; color: #000; font-size: 14px; font-weight: 600;
    }
    .button--ghost { background: transparent; color: var(--text); }
    .layout {
      display: grid; grid-template-columns: 190px minmax(0, 760px) 80px;
      gap: 58px; max-width: var(--max); margin: 0 auto; padding: 0 40px 90px;
    }
    .toc { position: sticky; top: 86px; align-self: start; color: var(--muted); font-size: 13px; }
    .toc strong { display: block; margin-bottom: 12px; color: var(--text); font-size: 13px; }
    .toc a { display: block; margin: 0 0 9px; padding: 5px 0; border: 0; color: var(--muted); }
    .toc a:hover { color: var(--text); }
    .share { position: sticky; top: 86px; align-self: start; color: var(--muted); font-size: 13px; }
    .share span { display: block; margin-bottom: 14px; }
    .share a { display: block; width: 30px; height: 30px; margin-bottom: 8px; border: 1px solid var(--line); border-radius: 50%; text-align: center; line-height: 28px; color: var(--text); }
    .topline {
      margin-bottom: 54px; padding: 26px; border: 1px solid var(--line); border-radius: 12px;
      background: linear-gradient(180deg, rgba(255,255,255,.05), rgba(255,255,255,.02));
    }
    .topline h2 { margin: 0 0 16px; font-size: 24px; letter-spacing: -.025em; }
    .topline ul { margin: 0; padding-left: 20px; color: #d8d8d8; }
    .report-section { padding: 46px 0; border-top: 1px solid var(--line); }
    .section-heading { margin-bottom: 28px; }
    .section-heading p { margin: 0 0 7px; color: var(--accent); font-size: 12px; text-transform: uppercase; letter-spacing: .08em; }
    .section-heading h2 { margin: 0; font-size: 30px; line-height: 1.2; letter-spacing: -.035em; }
    .section-heading span { display: block; margin-top: 8px; color: var(--muted); }
    .section-items { display: grid; gap: 26px; }
    .report-item { display: grid; grid-template-columns: 46px 1fr; gap: 18px; }
    .item-index { color: var(--faint); font-size: 13px; padding-top: 4px; }
    .tags { display: flex; flex-wrap: wrap; gap: 8px; margin-bottom: 10px; }
    .tags span { color: var(--accent); font-size: 12px; }
    .report-item h3 { margin: 0; font-size: 22px; line-height: 1.35; letter-spacing: -.025em; }
    .report-item p { margin: 10px 0 0; color: #d0d0d0; font-size: 15px; }
    .item-meta { margin-top: 10px; color: var(--faint); font-size: 13px; }
    .empty, .note { margin: 0; color: var(--muted); }
    .action-list { display: grid; gap: 12px; }
    .action-item { display: grid; grid-template-columns: 120px 1fr; gap: 18px; padding: 16px 0; border-top: 1px solid var(--line-soft); color: #d0d0d0; }
    .action-item strong { color: var(--text); }
    .status-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 12px; margin-top: 20px; }
    .status-grid div { padding: 14px; border: 1px solid var(--line); border-radius: 8px; background: var(--panel); }
    .status-grid strong, .status-grid span { display: block; }
    .status-grid span { margin-top: 4px; color: var(--muted); font-size: 13px; }
    .footer { max-width: var(--max); margin: 0 auto; padding: 30px 40px 44px; border-top: 1px solid var(--line); color: var(--faint); font-size: 13px; }
    @media (max-width: 980px) {
      .site-header { padding: 18px 22px; }
      .nav { gap: 16px; }
      .layout { display: block; padding: 0 24px 72px; }
      .toc, .share { display: none; }
      .hero { padding-top: 66px; text-align: left; }
      .hero-actions { justify-content: flex-start; }
      .report-item { grid-template-columns: 1fr; gap: 8px; }
      .item-index { display: none; }
      .status-grid, .action-item { grid-template-columns: 1fr; }
    }
    @media print {
      :root { color-scheme: light; --bg: #fff; --text: #111; --muted: #555; --faint: #666; --line: #ddd; --line-soft: #eee; --panel: #f7f7f7; --accent: #1B365D; }
      .site-header, .toc, .share, .hero-actions { display: none; }
      .hero { text-align: left; padding: 10mm 0 8mm; }
      .layout { display: block; padding: 0; }
      .report-section { page-break-inside: avoid; }
      a { color: inherit; border: 0; }
    }
  </style>
</head>
<body>
  <header class="site-header">
    <a class="brand" href="/">Whistle 互联网日报</a>
    <nav class="nav" aria-label="站点导航">
      <a href="/">日报</a>
      <a href="/archive/">归档</a>
      <a href="/subscribe/">订阅</a>
      <a href="/subscribe/">RSS</a>
    </nav>
  </header>

  <main>
    <section class="hero">
      <p class="kicker">日报 · ${escapeHtml(report.date)}</p>
      <h1>${escapeHtml(report.title)}</h1>
      <p class="summary">${summary}</p>
      <p class="hero-meta">${renderMeta([
        report.theme,
        `${itemCount} 条信号`,
        `生成于 ${new Date(report.generatedAt).toLocaleString("zh-CN", { timeZone: "Asia/Shanghai" })}`,
      ])}</p>
      <div class="hero-actions">
        <a class="button" href="${pdfHref}">下载 PDF</a>
        <a class="button button--ghost" href="/archive/">查看归档</a>
      </div>
    </section>

    <div class="layout">
      <aside class="toc">
        <strong>目录</strong>
        ${toc.map((item) => `<a href="${item.href}">${escapeHtml(item.label)}</a>`).join("")}
      </aside>
      <article>
        ${
          report.topline.length
            ? `<section class="topline">
                <h2>今日主线</h2>
                <ul>${report.topline.map((item) => `<li>${escapeHtml(item)}</li>`).join("")}</ul>
              </section>`
            : ""
        }
        ${report.sections.map(renderSection).join("\n")}
        ${renderActions(report.actions)}
        ${renderSourceStatus(report)}
      </article>
      <aside class="share">
        <span>分享</span>
        <a href="https://twitter.com/intent/tweet?text=${encodeURIComponent(report.title)}">X</a>
        <a href="mailto:?subject=${encodeURIComponent(report.title)}">↗</a>
      </aside>
    </div>
  </main>

  <footer class="footer">© ${new Date(report.date).getFullYear()} Whistle. 低噪音互联网与 AI 日报。</footer>
</body>
</html>`;
}

export function buildEmailHtml(input, { reportUrl = "" } = {}) {
  const { report, errors } = validateReport(input);
  if (errors.length) {
    throw new Error(`Invalid report.json:\n${errors.map((error) => `- ${error}`).join("\n")}`);
  }
  const featuredSections = report.sections
    .map((section) => ({ ...section, items: section.items.slice(0, 2) }))
    .filter((section) => section.items.length)
    .slice(0, 5);
  const cta = reportUrl
    ? `<a href="${escapeHtml(reportUrl)}" style="display:inline-block;padding:12px 18px;border-radius:999px;background:#fff;color:#000;text-decoration:none;font-size:14px;font-weight:700;">阅读网页版 →</a>`
    : "";

  return `<!doctype html>
<html lang="zh-CN">
  <body style="margin:0;padding:0;background:#000;color:#f4f4f4;font-family:Inter,-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#000;">
      <tr>
        <td align="center" style="padding:32px 16px;">
          <table role="presentation" width="680" cellspacing="0" cellpadding="0" style="width:100%;max-width:680px;border:1px solid #222;background:#030303;">
            <tr>
              <td style="padding:34px 36px 24px;border-bottom:1px solid #242424;">
                <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
                  <tr>
                    <td style="font-size:20px;font-weight:700;color:#fff;">Whistle</td>
                    <td align="right" style="font-size:13px;color:#888;">${escapeHtml(report.date)}</td>
                  </tr>
                </table>
                <p style="margin:18px 0 0;color:#aaa;font-size:14px;">每日互联网与 AI 简报</p>
              </td>
            </tr>
            <tr>
              <td align="center" style="padding:48px 36px 40px;border-bottom:1px solid #242424;">
                <h1 style="margin:0;color:#fff;font-size:42px;line-height:1.15;letter-spacing:-1.6px;">${escapeHtml(report.title)}</h1>
                <p style="margin:18px auto 0;max-width:560px;color:#bbb;font-size:16px;line-height:1.7;">${escapeHtml(report.summary)}</p>
                <div style="margin-top:26px;">${cta}</div>
              </td>
            </tr>
            ${
              report.topline.length
                ? `<tr>
                    <td style="padding:34px 36px;border-bottom:1px solid #242424;">
                      <h2 style="margin:0 0 16px;color:#fff;font-size:24px;">1. 今日主线</h2>
                      <ul style="margin:0;padding-left:20px;color:#d0d0d0;font-size:15px;line-height:1.8;">
                        ${report.topline.map((item) => `<li>${escapeHtml(item)}</li>`).join("")}
                      </ul>
                    </td>
                  </tr>`
                : ""
            }
            <tr>
              <td style="padding:34px 36px 10px;">
                <h2 style="margin:0 0 22px;color:#fff;font-size:24px;">2. 今日速览</h2>
              </td>
            </tr>
            ${featuredSections
              .map(
                (section) => `<tr>
                  <td style="padding:0 36px 26px;">
                    <p style="margin:0 0 10px;color:#8ab4ff;font-size:13px;">${escapeHtml(section.title)}</p>
                    ${section.items
                      .map(
                        (item) => `<div style="padding:0 0 22px;margin:0 0 22px;border-bottom:1px solid #242424;">
                          <h3 style="margin:0;color:#fff;font-size:20px;line-height:1.35;">${escapeHtml(item.title)}</h3>
                          <p style="margin:10px 0 0;color:#c8c8c8;font-size:15px;line-height:1.7;">${escapeHtml(item.summary)}</p>
                          <p style="margin:12px 0 0;color:#777;font-size:13px;">来源：${
                            item.sourceUrl
                              ? `<a href="${escapeHtml(item.sourceUrl)}" style="color:#aaa;text-decoration:underline;">${escapeHtml(item.sourceName)}</a>`
                              : escapeHtml(item.sourceName)
                          }</p>
                        </div>`,
                      )
                      .join("")}
                  </td>
                </tr>`,
              )
              .join("")}
            ${
              report.actions.length
                ? `<tr>
                    <td style="padding:8px 36px 32px;border-bottom:1px solid #242424;">
                      <h2 style="margin:0 0 16px;color:#fff;font-size:24px;">3. 今日行动建议</h2>
                      ${report.actions
                        .slice(0, 4)
                        .map(
                          (action) => `<p style="margin:0 0 12px;color:#d0d0d0;font-size:15px;line-height:1.7;">${
                            action.audience ? `<strong style="color:#fff;">${escapeHtml(action.audience)}：</strong>` : ""
                          }${escapeHtml(action.text)}</p>`,
                        )
                        .join("")}
                    </td>
                  </tr>`
                : ""
            }
            <tr>
              <td align="center" style="padding:30px 36px 36px;color:#8a8a8a;font-size:13px;line-height:1.7;">
                <p style="margin:0 0 18px;">感谢阅读。低噪音、高信号，保留真正影响工作的互联网变化。</p>
                <p style="margin:0;">
                  <a href="${escapeHtml(reportUrl.replace(/\/reports\/[^/]+$/, "/archive/"))}" style="color:#cfcfcf;text-decoration:none;">查看归档</a>
                  <span style="padding:0 14px;color:#444;">|</span>
                  <a href="${escapeHtml(reportUrl.replace(/\/reports\/[^/]+$/, "/subscribe/"))}" style="color:#cfcfcf;text-decoration:none;">取消订阅</a>
                  <span style="padding:0 14px;color:#444;">|</span>
                  <a href="${escapeHtml(reportUrl.replace(/\/reports\/[^/]+$/, "/rss.xml"))}" style="color:#cfcfcf;text-decoration:none;">RSS</a>
                </p>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;
}

export function reportToIndexEntry(input, { reportPath, pdfPath } = {}) {
  const report = normalizeReport(input);
  const tags = [
    ...new Set(report.sections.flatMap((section) => section.items.flatMap((item) => item.tags))),
  ].slice(0, 6);
  const firstSection = report.sections.find((section) => section.items.length);
  return {
    date: report.date,
    title: report.title,
    summary: compact(report.summary, 220),
    theme: report.theme,
    category: firstSection?.title || "日报",
    tags,
    itemCount: report.sections.reduce((sum, section) => sum + section.items.length, 0),
    reportPath,
    pdfPath,
  };
}
