import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { validateReport } from "./report-renderer.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");

const FORBIDDEN_LANGUAGE = [
  { pattern: /今天的主线是/, label: "AI 套话：今天的主线是" },
  { pattern: /(?:继续)?向[^。！？\n]{0,24}下沉/, label: "AI 套话：向……下沉" },
  { pattern: /可执行工作流/, label: "AI 套话：可执行工作流" },
  { pattern: /反向约束/, label: "AI 套话：反向约束" },
  { pattern: /行业图景/, label: "AI 套话：行业图景" },
  { pattern: /范式转移/, label: "AI 套话：范式转移" },
  { pattern: /生态闭环/, label: "AI 套话：生态闭环" },
  { pattern: /关键抓手/, label: "AI 套话：关键抓手" },
  { pattern: /赋能/, label: "AI 套话：赋能" },
  { pattern: /加速重塑/, label: "AI 套话：加速重塑" },
  { pattern: /团队应该|团队可以|今日可以采取|值得立刻/, label: "行动建议口吻" },
  {
    pattern: /对(?:产品|研发|运营|设计|创业者|管理者|安全|工程)(?:、(?:产品|研发|运营|设计|创业者|管理者|安全|工程))*[^。！？\n]{0,18}(?:团队|岗位|从业者)/,
    label: "岗位化表达",
  },
  {
    pattern: /(?:产品|研发|运营|设计|创业者|管理者)(?:、(?:产品|研发|运营|设计|创业者|管理者))+[^。！？\n]{0,18}(?:团队|岗位|从业者)/,
    label: "岗位化表达",
  },
];

function pushLanguageErrors(errors, label, value = "") {
  const text = String(value || "");
  for (const rule of FORBIDDEN_LANGUAGE) {
    if (rule.pattern.test(text)) {
      errors.push(`${label} contains forbidden wording (${rule.label})`);
    }
  }
}

function todayInShanghai() {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Shanghai",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

async function main() {
  const date = process.env.WHISTLE_DATE || todayInShanghai();
  const jsonPath = path.join(root, "outputs", date, "report.json");
  const input = JSON.parse(await fs.readFile(jsonPath, "utf8"));
  const { report, errors } = validateReport(input);
  if (report.actions.length) {
    errors.push("actions must be an empty array");
  }
  pushLanguageErrors(errors, "summary", report.summary);
  for (const section of report.sections) {
    pushLanguageErrors(errors, `section ${section.id} summary`, section.summary);
    for (const item of section.items) {
      pushLanguageErrors(errors, `item ${section.id} / ${item.title}`, `${item.title}\n${item.summary}`);
    }
  }
  if (errors.length) {
    throw new Error(`Invalid ${jsonPath}:\n${errors.map((error) => `- ${error}`).join("\n")}`);
  }
  console.log(`Validated structured report: ${report.title}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
