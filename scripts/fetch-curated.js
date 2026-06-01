import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import FeedParser from "feedparser";
import { JSDOM } from "jsdom";
import { Readable } from "node:stream";

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

// ---- juya-ai-daily RSS ----

async function fetchJuyaDaily() {
  try {
    const response = await fetch(
      "https://imjuya.github.io/juya-ai-daily/rss.xml",
      { headers: { "User-Agent": USER_AGENT } },
    );
    if (!response.ok) throw new Error(`juya RSS fetch failed: ${response.status}`);
    const xml = await response.text();

    const items = await new Promise((resolve, reject) => {
      const parser = new FeedParser({});
      const result = [];
      parser.on("readable", () => {
        let item;
        while ((item = parser.read())) result.push(item);
      });
      parser.on("error", reject);
      parser.on("end", () => resolve(result));
      const stream = new Readable();
      stream.push(xml);
      stream.push(null);
      stream.pipe(parser);
    });

    if (items.length === 0) return null;

    const latest = items[0];
    let contentHtml = latest["content:encoded"]?.["#"] || latest.description || "";
    // Ensure we have HTML content; feedparser may put it in summary as plaintext
    if (!contentHtml.includes("<") && latest.summary) {
      contentHtml = latest.summary;
    }

    return {
      source: "juya-ai-daily",
      title: latest.title || `AI 早报 ${todayInShanghai()}`,
      url: latest.link || `https://imjuya.github.io/juya-ai-daily/`,
      publishedAt: latest.pubDate || latest.pubdate || null,
      contentHtml,
      contentText: stripHtml(contentHtml).slice(0, 8000),
    };
  } catch (error) {
    console.warn(`[juya] fetch failed: ${error.message}`);
    return null;
  }
}

// ---- AI HOT API ----

async function fetchAIHotDaily() {
  try {
    const response = await fetch("https://aihot.virxact.com/api/public/daily", {
      headers: { "User-Agent": USER_AGENT },
    });
    if (!response.ok) throw new Error(`AI HOT daily fetch failed: ${response.status}`);
    return {
      source: "aihot",
      ...(await response.json()),
    };
  } catch (error) {
    console.warn(`[aihot] daily fetch failed: ${error.message}`);
    return null;
  }
}

async function fetchAIHotItems(take = 40) {
  try {
    const response = await fetch(
      `https://aihot.virxact.com/api/public/items?mode=selected&take=${take}`,
      { headers: { "User-Agent": USER_AGENT } },
    );
    if (!response.ok) throw new Error(`AI HOT items fetch failed: ${response.status}`);
    const data = await response.json();
    return {
      source: "aihot-items",
      count: data.count,
      hasNext: data.hasNext,
      items: (data.items || []).map((item) => ({
        id: item.id,
        title: item.title,
        url: item.url,
        source: item.source,
        publishedAt: item.publishedAt,
        summary: item.summary,
        category: item.category,
      })),
    };
  } catch (error) {
    console.warn(`[aihot] items fetch failed: ${error.message}`);
    return null;
  }
}

// ---- Hacker News Firebase API ----

async function fetchHNItem(id) {
  try {
    const response = await fetch(
      `https://hacker-news.firebaseio.com/v0/item/${id}.json`,
      { headers: { "User-Agent": USER_AGENT } },
    );
    if (!response.ok) return null;
    return await response.json();
  } catch {
    return null;
  }
}

async function fetchHackerNews(topN = 50) {
  try {
    const topResponse = await fetch(
      "https://hacker-news.firebaseio.com/v0/topstories.json",
      { headers: { "User-Agent": USER_AGENT } },
    );
    if (!topResponse.ok) throw new Error(`HN topstories failed: ${topResponse.status}`);
    const ids = (await topResponse.json()).slice(0, topN);

    const items = (await Promise.all(ids.map(fetchHNItem))).filter(Boolean);
    const stories = items
      .filter((item) => item.type === "story" && item.score >= 30)
      .map((item) => ({
        id: item.id,
        title: item.title,
        url: item.url || `https://news.ycombinator.com/item?id=${item.id}`,
        score: item.score,
        descendants: item.descendants || 0,
        by: item.by,
        time: item.time ? new Date(item.time * 1000).toISOString() : null,
      }))
      .sort((a, b) => b.score - a.score);

    return {
      source: "hackernews",
      fetchedAt: new Date().toISOString(),
      totalFetched: ids.length,
      highSignalCount: stories.length,
      threshold: 30,
      items: stories,
    };
  } catch (error) {
    console.warn(`[hn] fetch failed: ${error.message}`);
    return null;
  }
}

// ---- GitHub Trending ----

async function fetchGitHubTrending() {
  try {
    const response = await fetch("https://github.com/trending", {
      headers: { "User-Agent": USER_AGENT },
    });
    if (!response.ok) throw new Error(`GitHub Trending fetch failed: ${response.status}`);
    const html = await response.text();
    const dom = new JSDOM(html);
    const doc = dom.window.document;

    const repos = [];
    const articles = doc.querySelectorAll("article.Box-row");
    for (const article of articles) {
      const h2 = article.querySelector("h2");
      if (!h2) continue;
      const link = h2.querySelector("a");
      const href = link?.getAttribute("href")?.trim() || "";
      const fullName = href.replace(/^\//, "");
      const [owner, name] = fullName.split("/");

      const descEl = article.querySelector("p");
      const description = descEl?.textContent?.trim() || "";

      const langEl = article.querySelector("[itemprop='programmingLanguage']");
      const language = langEl?.textContent?.trim() || null;

      const starEl = article.querySelector(`a[href="/${fullName}/stargazers"]`);
      const starsText = starEl?.textContent?.trim() || "0";
      const totalStars = parseInt(starsText.replace(/,/g, ""), 10) || 0;

      const todayStarsEl = article.querySelector("span.d-inline-block.float-sm-right");
      const todayText = todayStarsEl?.textContent?.trim() || "";
      const todayMatch = todayText.match(/([\d,]+)\s*stars?\s*today/i);
      const todayStars = todayMatch
        ? parseInt(todayMatch[1].replace(/,/g, ""), 10)
        : 0;

      repos.push({
        owner,
        name,
        fullName,
        url: `https://github.com/${fullName}`,
        description,
        language,
        totalStars,
        todayStars,
      });
    }

    return {
      source: "github-trending",
      fetchedAt: new Date().toISOString(),
      count: repos.length,
      repos,
    };
  } catch (error) {
    console.warn(`[github-trending] fetch failed: ${error.message}`);
    return null;
  }
}

// ---- Main ----

async function main() {
  const date = process.env.WHISTLE_DATE || todayInShanghai();
  console.log(`Fetching curated sources for ${date}...`);

  const [juya, aihotDaily, aihotItems, hackernews, githubTrending] =
    await Promise.all([
      fetchJuyaDaily(),
      fetchAIHotDaily(),
      fetchAIHotItems(),
      fetchHackerNews(50),
      fetchGitHubTrending(),
    ]);

  const result = {
    date,
    fetchedAt: new Date().toISOString(),
    timezone: "Asia/Shanghai",
    sources: {
      juya,
      aihot: aihotDaily,
      aihotItems,
      hackernews,
      githubTrending,
    },
    fetchSummary: {
      juya: juya ? "ok" : "failed",
      aihotDaily: aihotDaily ? "ok" : "failed",
      aihotItems: aihotItems ? `ok (${aihotItems.count} items)` : "failed",
      hackernews: hackernews ? `ok (${hackernews.highSignalCount} stories >= 30pts)` : "failed",
      githubTrending: githubTrending ? `ok (${githubTrending.count} repos)` : "failed",
    },
  };

  const outDir = path.join(root, "outputs", date);
  await fs.mkdir(outDir, { recursive: true });
  const outPath = path.join(outDir, "curated-sources.json");
  await fs.writeFile(outPath, JSON.stringify(result, null, 2));
  console.log(`Wrote curated sources to ${outPath}`);
  console.log(JSON.stringify(result.fetchSummary, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
