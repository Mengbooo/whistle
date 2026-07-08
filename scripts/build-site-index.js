import fs from "node:fs/promises";
import path from "node:path";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import { reportToIndexEntry, stripHtml } from "./report-renderer.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");

function run(command, args) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      cwd: root,
      stdio: "inherit",
      shell: false,
      env: {
        ...process.env,
        PATH: `/usr/local/n/versions/node/22.11.0/bin:/usr/local/bin:${process.env.PATH || ""}`,
      },
    });
    child.on("error", reject);
    child.on("exit", (code) => {
      if (code === 0) resolve();
      else reject(new Error(`${command} ${args.join(" ")} exited with ${code}`));
    });
  });
}

function extractSummary(html) {
  const match = html.match(/<p class=["']intro["'][^>]*>([\s\S]*?)<\/p>/i);
  if (!match) {
    return "低噪音互联网工作日报，聚焦产品、研发、增长、商业化、基础设施与合规判断。";
  }
  return match[1].replace(/<[^>]+>/g, "").replace(/\s+/g, " ").trim();
}

async function buildReportsIndex() {
  const reportsDir = path.join(root, "public", "reports");
  const generatedPath = path.join(root, "src", "reports.generated.json");
  let files = [];

  try {
    files = await fs.readdir(reportsDir);
  } catch (error) {
    if (error.code !== "ENOENT") throw error;
  }

  const reports = [];
  for (const file of files.filter((item) => /^\d{4}-\d{2}-\d{2}\.html$/.test(item)).sort().reverse()) {
    const date = file.replace(".html", "");
    const jsonPath = path.join(reportsDir, `${date}.json`);
    try {
      const report = JSON.parse(await fs.readFile(jsonPath, "utf8"));
      reports.push(
        reportToIndexEntry(report, {
          reportPath: `reports/${file}`,
          pdfPath: `assets/report-${date}.pdf`,
        }),
      );
    } catch (error) {
      const html = await fs.readFile(path.join(reportsDir, file), "utf8");
      reports.push({
        date,
        title: `Whistle 互联网日报｜${date}`,
        summary: stripHtml(extractSummary(html)),
        theme: "",
        category: "历史日报",
        tags: [],
        itemCount: null,
        reportPath: `reports/${file}`,
        pdfPath: `assets/report-${date}.pdf`,
      });
    }
  }

  await fs.mkdir(path.dirname(generatedPath), { recursive: true });
  await fs.writeFile(generatedPath, `${JSON.stringify(reports, null, 2)}\n`);
}

async function main() {
  await buildReportsIndex();
  await run("pnpm", ["exec", "vite", "build"]);
  console.log("Built Vite static site into site/.");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
