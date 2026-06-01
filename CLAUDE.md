# CLAUDE.md

本文件为 Claude Code（claude.ai/code）在此仓库中工作时提供指导。

## 项目概述

Whistle 是一个个人情报台，收集配置的 RSS 源，过滤噪音，排序有用条目，并以 HTML、PDF、邮件和 Vite + React 静态网站归档的形式发布日报。核心价值在于加工流水线 —— 不仅仅是抓取，而是过滤、去重、打分和由 Agent 驱动的编辑重写。

## 常用命令

```bash
pnpm install                          # 安装依赖
pnpm exec playwright install chromium # 安装 PDF 生成所需的浏览器（必须）

pnpm run prepare                      # 抓取 RSS → 清洗 → 去重 → 排序 → 输出 JSON/MD 到 outputs/YYYY-MM-DD/
pnpm run brief                        # prepare 的别名
pnpm run agent                        # prepare + 无头 Codex agent 生成 report.html
pnpm run publish                      # HTML → PDF → 归档到 public/ → 构建 Vite 站点
pnpm run pdf                          # 将 report.html 转为 report.pdf（通过 Playwright）
pnpm run archive                      # 将报告复制到 public/ + 重建站点索引
pnpm run email                        # 通过 Resend 发送报告邮件
pnpm run build                        # 仅重建站点索引（报告列表 JSON）
pnpm run dev                          # Vite 开发服务器（前端热更新）
pnpm run site:build                   # Vite 静态构建到 site/
```

开发前端时使用 `pnpm run dev`。开发流水线脚本时，使用 `node scripts/<name>.js` 单独运行脚本。本地测试完整流水线：`pnpm run agent`（需要 Codex 和 API key）。

## 架构

### 核心流水线

主处理链路：`sources.yaml` → RSS 抓取 → 文本清洗 → 去重 → 打分排序 → 板块归类 → Agent 重写成稿 → HTML → PDF → 归档 → 邮件。

**`scripts/generate-report.js`**（约 17k，最大的文件）负责所有预处理：
1. 读取 `sources.yaml` 获取源配置、板块定义、排序权重、主题关键词
2. 用 `feedparser` 逐个抓取已启用的 RSS 源
3. 去除 HTML 标签、归一化标题、提取文本
4. 去重：精确 URL 匹配 + 标题 Jaccard 相似度
5. 对每条内容综合打分（新鲜度、来源权重、关键词命中、新颖度、板块匹配、工作信号加分、噪音惩罚、同源重复惩罚）
6. 按关键词匹配将条目分配到各板块，遵循每个板块的最小/最大数量限制
7. 写入 `outputs/YYYY-MM-DD/raw-items.json`、`ranked-items.json`、`report.json`、`report.md`

此脚本**不生成** HTML —— 它只为 Agent 提供结构化数据。

**Agent 阶段**（`prompts/daily_report.md` 和 `prompts/kami_report_only.md`）：无头 Codex agent 读取 JSON/MD 输出，结合 vendored skills 进行编辑判断，生成 `report.html`。`daily_report.md` 执行完整流水线（prepare + 编辑 + publish）。`kami_report_only.md` 假设 prepare 已完成。

**`scripts/html-to-pdf.js`**：通过 Playwright 启动无头 Chromium，以 `file://` URL 加载 `report.html`，打印为 A4 PDF。

**`scripts/archive-report.js`**：将 `report.html` 和 `report.pdf` 从 `outputs/` 复制到 `public/reports/` 和 `public/assets/`，并将 CSS/PDF 路径改写为静态站点可用的路径。

**`scripts/build-site-index.js`**：扫描 `public/reports/` 中的日期 HTML 文件，提取摘要，写入 `src/reports.generated.json`，然后运行 `vite build` 生成静态 `site/`。

**`scripts/send-report-email.js`**：读取当天的 `report.html` 和 `report.pdf`，构建包含摘要摘录的 HTML 邮件正文，通过 Resend API 发送并附带 PDF 附件。

### 配置：`sources.yaml`

所有定制化都在这里，不写在代码中：
- `profile` — 时区、语言、最多保留条数、回看天数
- `sections` — 每个板块的 id、名称、最大/最小条数、关键词、优先级系数
- `topics.include` / `topics.exclude` — 全局关键词过滤器
- `relevance` — 工作信号关键词（加分）和噪音关键词（扣分）
- `ranking` — 各打分因子的权重（新鲜度、来源权重、关键词匹配、新颖度、重复惩罚、板块匹配、工作信号、噪音、标题扣分、最低阈值）
- `sources` — 每个 RSS 源的 id、url、权重、默认板块、标签、启用标志

### 前端：Vite + React 静态站点

**`src/main.jsx`** — 单页 React 应用，通过读取 HTML 中 `<div id="root">` 的 `data-page` 属性来渲染三个"页面"之一：`home`（首页）、`archive`（归档）、`subscribe`（订阅）。所有数据来自构建时生成的 `src/reports.generated.json`。

**`index.html`**、**`archive/index.html`**、**`subscribe/index.html`** — 三个 HTML 入口文件，各自设置正确的 `data-page` 值并加载同一个 `src/main.jsx` 打包文件。

**`src/styles.css`** — Kami 设计语言：暖纸色 `#f5f4ed`、ink-blue `#1B365D`、衬线字体栈、克制留白布局。

**`public/`** — 静态资源目录。`public/reports/YYYY-MM-DD.html` 和 `public/assets/report-YYYY-MM-DD.pdf` 是归档后的报告文件，会提交到 git。

**`site/`** — Vite 构建输出，部署到 Vercel。已提交到 git（不在 .gitignore 中）。

### API

**`api/trigger-daily.js`** — Vercel serverless 函数。接收 cron 触发的请求（Vercel cron 北京时间凌晨 1 点），通过 `CRON_SECRET` Bearer token 认证，然后使用 `GITHUB_TRIGGER_TOKEN` 通过 GitHub API 触发 `daily.yml` workflow。

### Skills 目录

Vendored agent skills，在 HTML 报告生成过程中引导 Codex agent：
- **`skills/kami/`** — 设计系统：CSS、排版、配色、布局规则。主要设计参考。
- **`skills/rss/SKILL.md`** — RSS 抓取约定
- **`skills/ranking/SKILL.md`** — 打分策略说明
- **`skills/summarizer/SKILL.md`** — 编辑语气、板块结构、写作风格规则
- **`skills/publisher/SKILL.md`** — 输出路径和发布约定

### CI/CD

**`.github/workflows/daily.yml`** — 主报告流水线。通过 `workflow_dispatch` 运行（由 Vercel API 函数触发）。步骤：checkout → 安装依赖 + Playwright + Codex → 配置 Codex provider（MICU API）→ 使用 `prompts/daily_report.md` 运行 agent → 验证输出文件存在 → 发送邮件 → 将所有输出提交并推送回仓库。

**`vercel.json`** — 设置输出目录为 `site`，定义 cron 为 `0 1 * * *`，触发 `/api/trigger-daily`。

### 输出结构

每次运行生成：
```
outputs/YYYY-MM-DD/
  raw-items.json      # 原始抓取条目（git 忽略）
  ranked-items.json   # 打分排序后的条目（git 忽略）
  report.json         # 按板块分配的结构化结果
  report.md           # 给 Agent 的 Markdown 草稿
  report.html         # 最终 HTML 报告（Agent 生成）
  report.pdf          # 由 HTML 生成的 PDF

public/reports/YYYY-MM-DD.html    # 归档 HTML（已提交）
public/assets/report-YYYY-MM-DD.pdf # 归档 PDF（已提交）
src/reports.generated.json         # 静态站点的索引元数据（已提交）
site/                              # Vite 构建输出（已提交）
```

### 关键设计决策

- **日期统一使用 Asia/Shanghai 时区。** 所有脚本使用 `todayInShanghai()` 模式。可通过 `WHISTLE_DATE` 环境变量覆盖以进行补录。
- **HTML 仅由 Agent 生成。** `generate-report.js` 明确不得生成 HTML —— 它只产出结构化数据。Agent（Codex）是唯一的 HTML 生产者。
- **报告板块顺序固定。** 11 个板块（今日头条、AI 与新工具、大厂与平台动态、产品与增长观察、开发者与工程实践、投融资与行业机会、政策监管与合规、社交热度观察、今日行动建议、去噪说明、抓取异常）必须按此顺序排列。
- **工作性优先于话题热度。** 排序系统优先保留影响产品、研发、增长、商业化、基础设施或合规决策的条目，而不是仅仅热门或有争议的内容。
- **所有产出物均提交到 git。** 生成的 `outputs/`、`public/`、`site/` 和 `src/reports.generated.json` 都会被提交，确保静态站点始终保持最新。
