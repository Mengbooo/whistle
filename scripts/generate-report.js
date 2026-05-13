import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import FeedParser from "feedparser";
import YAML from "yaml";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");

const USER_AGENT =
  "Mozilla/5.0 (compatible; Whistle/0.1; +https://github.com/whistle)";

function todayInShanghai() {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Shanghai",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

function stripHtml(value = "") {
  return String(value)
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function normalizeTitle(title = "") {
  return title
    .toLowerCase()
    .replace(/https?:\/\/\S+/g, "")
    .replace(/[^a-z0-9\u4e00-\u9fa5]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function tokenSet(value) {
  return new Set(
    normalizeTitle(value)
      .split(" ")
      .filter((token) => token.length >= 2),
  );
}

function jaccard(a, b) {
  if (!a.size || !b.size) return 0;
  let intersection = 0;
  for (const item of a) {
    if (b.has(item)) intersection += 1;
  }
  return intersection / (a.size + b.size - intersection);
}

function compactSummary(value = "", limit = 180) {
  const text = stripHtml(value);
  if (text.length <= limit) return text;
  return `${text.slice(0, limit - 1)}...`;
}

function asKeywords(values = []) {
  return values.map((value) => String(value).toLowerCase()).filter(Boolean);
}

function keywordHits(text, values = []) {
  return values.filter((keyword) => text.includes(keyword));
}

async function readConfig() {
  const raw = await fs.readFile(path.join(root, "sources.yaml"), "utf8");
  return YAML.parse(raw);
}

function parseFeedXml(xml, source) {
  return new Promise((resolve, reject) => {
    const parser = new FeedParser({ normalize: true });
    const items = [];

    parser.on("error", reject);
    parser.on("readable", function onReadable() {
      let item;
      while ((item = this.read())) {
        const publishedAt =
          item.pubdate || item.date || item["rss:pubdate"] || new Date();
        items.push({
          id: `${source.id}:${item.guid || item.link || item.title}`,
          sourceId: source.id,
          sourceName: source.name,
          sourceWeight: Number(source.weight || 1),
          sourceTags: source.tags || [],
          sourceSection: source.section || "headlines",
          title: item.title || "Untitled",
          url: item.link || item.origlink || "",
          author: item.author || "",
          publishedAt: new Date(publishedAt).toISOString(),
          summary: compactSummary(item.summary || item.description || "", 240),
        });
      }
    });
    parser.on("end", () => resolve(items));
    parser.end(xml);
  });
}

async function fetchRssSource(source) {
  const response = await fetch(source.url, {
    headers: {
      "User-Agent": USER_AGENT,
      Accept: "application/rss+xml, application/atom+xml, text/xml;q=0.9, */*;q=0.8",
    },
  });
  if (!response.ok) {
    throw new Error(`${response.status} ${response.statusText}`);
  }
  const xml = await response.text();
  return parseFeedXml(xml, source);
}

async function collectItems(config) {
  const rssSources = (config.sources || []).filter(
    (source) => source.type === "rss" && source.enabled !== false,
  );
  const allItems = [];
  const errors = [];

  for (const source of rssSources) {
    try {
      const items = await fetchRssSource(source);
      allItems.push(...items);
    } catch (error) {
      errors.push({
        sourceId: source.id,
        sourceName: source.name,
        message: error.message,
      });
    }
  }

  return { allItems, errors };
}

function scoreItems(items, config) {
  const include = (config.topics?.include || []).map((item) => item.toLowerCase());
  const exclude = (config.topics?.exclude || []).map((item) => item.toLowerCase());
  const workSignals = asKeywords(config.relevance?.work_signals || []);
  const topicNoise = asKeywords(config.relevance?.topic_noise || []);
  const tagRepeatPenalty = config.relevance?.source_repeat_penalty_by_tag || {};
  const sections = config.sections || [];
  const sectionById = new Map(sections.map((section) => [section.id, section]));
  const sectionKeywords = sections.map((section) => ({
    ...section,
    keywords: asKeywords(section.keywords || []),
  }));
  const lookbackDays = Number(config.profile?.lookback_days || 7);
  const weights = {
    recency: Number(config.ranking?.recency || 0.3),
    sourceWeight: Number(config.ranking?.source_weight || 0.25),
    keywordMatch: Number(config.ranking?.keyword_match || 0.25),
    novelty: Number(config.ranking?.novelty || 0.2),
    sourceRepeatPenalty: Number(config.ranking?.source_repeat_penalty || 0.08),
    sectionMatchBonus: Number(config.ranking?.section_match_bonus || 0.12),
    weakRelevancePenalty: Number(config.ranking?.weak_relevance_penalty || 0.18),
    workSignalBonus: Number(config.ranking?.work_signal_bonus || 0),
    topicNoisePenalty: Number(config.ranking?.topic_noise_penalty || 0),
    titleOnlyPenalty: Number(config.ranking?.title_only_penalty || 0),
  };
  const minAdjustedScore =
    config.ranking?.min_adjusted_score === undefined
      ? null
      : Number(config.ranking.min_adjusted_score);
  const now = Date.now();
  const seenUrls = new Set();
  const accepted = [];
  const dropped = [];

  for (const item of items) {
    const text = `${item.title} ${item.summary}`.toLowerCase();
    const normalizedUrl = item.url.replace(/[?#].*$/, "");
    const ageHours = Math.max(0, (now - new Date(item.publishedAt).getTime()) / 36e5);
    if (ageHours > lookbackDays * 24) {
      dropped.push({ ...item, dropReason: `stale:${lookbackDays}d` });
      continue;
    }

    const titleTokens = tokenSet(item.title);
    const duplicate = accepted.find(
      (existing) =>
        existing.url.replace(/[?#].*$/, "") === normalizedUrl ||
        jaccard(titleTokens, existing.titleTokens) > 0.72,
    );
    if (seenUrls.has(normalizedUrl) || duplicate) {
      dropped.push({ ...item, dropReason: "duplicate" });
      continue;
    }

    const excludeHits = keywordHits(text, exclude);
    if (excludeHits.length) {
      dropped.push({ ...item, dropReason: `excluded:${excludeHits.join(",")}` });
      continue;
    }

    const recencyScore = Math.max(0, 1 - ageHours / 168);
    const includeHits = keywordHits(text, include);
    const keywordScore = Math.min(1, includeHits.length / 3);
    const workHits = keywordHits(text, workSignals);
    const noiseHits = keywordHits(text, topicNoise);
    const workScore = Math.min(1, workHits.length / 3);
    const noiseScore = Math.min(1, noiseHits.length / 2);
    const hasWeakSummary = !item.summary || item.summary.length < 24;
    const sectionMatches = sectionKeywords
      .map((section) => ({
        id: section.id,
        name: section.name,
        hits: keywordHits(text, section.keywords),
      }))
      .filter((match) => match.hits.length > 0)
      .sort((a, b) => b.hits.length - a.hits.length);
    const fallbackSection = sectionById.has(item.sourceSection)
      ? item.sourceSection
      : "headlines";
    let primarySection = sectionMatches[0]?.id || fallbackSection;
    if (
      primarySection !== "social-buzz" &&
      noiseHits.length > 0 &&
      workHits.length > 0 &&
      (item.sourceTags || []).some((tag) => ["media", "community", "consumer-tech"].includes(tag))
    ) {
      primarySection = "social-buzz";
    }
    const sectionPriority = Number(sectionById.get(primarySection)?.priority || 1);
    const hasRelevance = includeHits.length > 0 || sectionMatches.length > 0 || workHits.length > 0;
    const sourceScore = Math.min(1, item.sourceWeight / 1.8);
    const noveltyScore = duplicate ? 0 : 1;
    const score =
      recencyScore * weights.recency +
      sourceScore * weights.sourceWeight +
      keywordScore * weights.keywordMatch +
      noveltyScore * weights.novelty +
      workScore * weights.workSignalBonus +
      Math.min(1, sectionMatches[0]?.hits.length || 0) * weights.sectionMatchBonus -
      noiseScore * weights.topicNoisePenalty -
      (hasWeakSummary ? weights.titleOnlyPenalty : 0) -
      (hasRelevance ? 0 : weights.weakRelevancePenalty);

    accepted.push({
      ...item,
      primarySection,
      sectionName: sectionById.get(primarySection)?.name || primarySection,
      sectionHits: sectionMatches[0]?.hits || [],
      sectionMatches,
      titleTokens,
      keywordHits: includeHits,
      workSignalHits: workHits,
      topicNoiseHits: noiseHits,
      ageHours,
      score: score * sectionPriority,
    });
    seenUrls.add(normalizedUrl);
  }

  const sourceCounts = new Map();
  const ranked = accepted
    .sort((a, b) => b.score - a.score)
    .map((item) => {
      const sourceCount = sourceCounts.get(item.sourceId) || 0;
      sourceCounts.set(item.sourceId, sourceCount + 1);
      const extraRepeatPenalty = (item.sourceTags || []).reduce(
        (sum, tag) => sum + Number(tagRepeatPenalty[tag] || 0),
        0,
      );
      return {
        ...item,
        adjustedScore:
          item.score - sourceCount * (weights.sourceRepeatPenalty + extraRepeatPenalty),
      };
    })
    .sort((a, b) => b.adjustedScore - a.adjustedScore)
    .map(({ titleTokens: _titleTokens, ...item }) => item);

  if (minAdjustedScore === null) {
    return { ranked, dropped };
  }

  const filteredRanked = [];
  for (const item of ranked) {
    if (item.adjustedScore >= minAdjustedScore) {
      filteredRanked.push(item);
    } else {
      dropped.push({ ...item, dropReason: `low-score:${item.adjustedScore.toFixed(2)}` });
    }
  }

  return { ranked: filteredRanked, dropped };
}

function selectBySections(ranked, config) {
  const sections = (config.sections || []).filter((section) => Number(section.max_items || 0) > 0);
  const maxItems = Number(config.profile?.max_items || 18);
  const selected = [];
  const selectedIds = new Set();
  const bySection = {};

  for (const section of sections) {
    const candidates = ranked
      .filter((item) => item.primarySection === section.id && !selectedIds.has(item.id))
      .slice(0, Number(section.max_items || 0));
    bySection[section.id] = candidates;
    for (const item of candidates) {
      selected.push(item);
      selectedIds.add(item.id);
    }
  }

  if (selected.length < maxItems) {
    for (const item of ranked) {
      if (selected.length >= maxItems) break;
      const section = sections.find((candidate) => candidate.id === item.primarySection);
      const sectionLimit = Number(section?.max_items || 0);
      const sectionCount = bySection[item.primarySection]?.length || 0;
      if (!sectionLimit || sectionCount >= sectionLimit) continue;
      if (!selectedIds.has(item.id)) {
        selected.push(item);
        selectedIds.add(item.id);
        bySection[item.primarySection] = [...(bySection[item.primarySection] || []), item];
      }
    }
  }

  const finalSelected = selected
    .sort((a, b) => b.adjustedScore - a.adjustedScore)
    .slice(0, maxItems);
  const finalIds = new Set(finalSelected.map((item) => item.id));

  const finalBySection = {};
  for (const section of sections) {
    finalBySection[section.id] = finalSelected.filter((item) => item.primarySection === section.id);
  }

  return {
    selected: finalSelected,
    bySection: finalBySection,
    overflow: ranked.filter((item) => !finalIds.has(item.id)),
  };
}

function formatDateTime(iso) {
  return new Intl.DateTimeFormat("zh-CN", {
    timeZone: "Asia/Shanghai",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(iso));
}

function renderMarkdown({ date, selected, briefItems, dropped, errors }) {
  const top = selected.slice(0, briefItems);
  const detail = selected;
  const lines = [
    `# Whistle 互联网日报｜${date}`,
    "",
    "## 今日速报",
    "",
    ...top.map(
      (item, index) =>
        `${index + 1}. [${item.title}](${item.url})  \n   ${item.summary || "暂无摘要"}  \n   来源：${item.sourceName}｜时间：${formatDateTime(item.publishedAt)}｜评分：${item.adjustedScore.toFixed(2)}`,
    ),
    "",
    "## 详细报告",
    "",
    ...detail.map(
      (item) =>
        `### ${item.title}\n\n- 来源：[${item.sourceName}](${item.url})\n- 发布时间：${formatDateTime(item.publishedAt)}\n- 命中主题：${item.keywordHits.length ? item.keywordHits.join(", ") : "无明确命中"}\n- 摘要：${item.summary || "暂无摘要"}\n`,
    ),
    "## 去噪说明",
    "",
    `- 本次保留 ${selected.length} 条，过滤 ${dropped.length} 条重复或低相关内容。`,
    `- 抓取异常 ${errors.length} 个。`,
    ...errors.map((error) => `- ${error.sourceName}: ${error.message}`),
    "",
  ];
  return lines.join("\n");
}

function renderSectionMarkdown({ date, selected, bySection, sections, dropped, errors }) {
  const lines = [
    `# Whistle 互联网日报素材｜${date}`,
    "",
    "这份 Markdown 是给 Agent 的素材，不是最终日报。最终日报标题必须是 `Whistle 互联网日报｜YYYY-MM-DD`。最终日报应按新版板块重写中文内容，并使用 Kami 生成 HTML。正文目标刊发 20 到 26 条，优先保留工作性信号：会影响产品、研发、增长、商业化、基础设施、合规或团队决策的信息。不要因为话题热、争议大、媒体讨论多就放在前面。每条 item 的正文应是一段自然中文，覆盖发生了什么、为什么重要、启发与行动；如果条目具备趋势信号，请自然加入一句未来判断或编辑评论，不要硬凑预测。",
    "",
    "## 今日头条候选",
    "",
    ...selected.slice(0, 5).map(
      (item, index) =>
        `${index + 1}. [${item.title}](${item.url})  \n   来源：${item.sourceName}｜板块：${item.sectionName}｜时间：${formatDateTime(item.publishedAt)}｜评分：${item.adjustedScore.toFixed(2)}  \n   摘要：${item.summary || "暂无摘要"}`,
    ),
    "",
  ];

  for (const section of sections.filter((item) => item.id !== "actions")) {
    const items = bySection[section.id] || [];
    lines.push(`## ${section.name}`, "", section.description || "", "");
    if (!items.length) {
      lines.push("- 本期没有足够强的入选条目。", "");
      continue;
    }
    for (const item of items) {
      lines.push(
        `### ${item.title}`,
        "",
        `- 来源：[${item.sourceName}](${item.url})`,
        `- 发布时间：${formatDateTime(item.publishedAt)}`,
        `- 命中主题：${item.keywordHits.length ? item.keywordHits.join(", ") : "无明确命中"}`,
        `- 命中板块词：${item.sectionHits.length ? item.sectionHits.join(", ") : "无明确命中"}`,
        `- 排序分：${item.adjustedScore.toFixed(2)}`,
        `- 摘要：${item.summary || "暂无摘要"}`,
        "",
      );
    }
  }

  lines.push(
    "## 今日行动建议",
    "",
    "请 Agent 基于前面板块生成，分别面向产品、研发、运营、设计、创业者/管理者给出轻量建议。建议用自然段落，不要写成生硬问答；可以补充值得持续观察的趋势，但要落到可尝试的行动上。",
    "",
    "## 去噪说明",
    "",
    `- 本次保留 ${selected.length} 条，过滤 ${dropped.length} 条重复、过期或低相关内容。`,
    `- 抓取异常 ${errors.length} 个。`,
    ...errors.map((error) => `- ${error.sourceName}: ${error.message}`),
    "",
  );

  return lines.join("\n");
}

async function main() {
  const config = await readConfig();
  const date = process.env.WHISTLE_DATE || todayInShanghai();
  const outDir = path.join(root, "outputs", date);
  await fs.mkdir(outDir, { recursive: true });

  const { allItems, errors } = await collectItems(config);
  const { ranked, dropped } = scoreItems(allItems, config);
  const { selected, bySection, overflow } = selectBySections(ranked, config);
  const briefItems = Number(config.profile?.brief_items || 8);

  const sections = config.sections || [];
  const payload = {
    date,
    sections,
    selected,
    bySection,
    overflow,
    dropped,
    errors,
    generatedAt: new Date().toISOString(),
  };
  const markdown = renderSectionMarkdown({ date, selected, bySection, sections, dropped, errors });

  await fs.writeFile(path.join(outDir, "raw-items.json"), JSON.stringify(allItems, null, 2));
  await fs.writeFile(path.join(outDir, "ranked-items.json"), JSON.stringify(ranked, null, 2));
  await fs.writeFile(path.join(outDir, "report.json"), JSON.stringify(payload, null, 2));
  await fs.writeFile(path.join(outDir, "report.md"), markdown);

  console.log(`Prepared Whistle report data for ${date}: ${selected.length} selected, ${dropped.length} dropped, ${errors.length} errors.`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
