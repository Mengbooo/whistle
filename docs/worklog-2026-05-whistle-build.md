# Whistle 开发工作记录（2026-05）

本文记录 Whistle 从最初想法到当前可运行版本的开发过程，重点保留关键决策、踩坑过程和最终结论，方便后续回看与继续迭代。

## 一、项目目标的逐步收敛

Whistle 最初不是一个泛资讯聚合器，而是一个面向互联网工作群体的低噪音日报系统。目标在开发过程中逐渐收敛为四件事：

- 每日自动抓取信息源，做去重、排序、降噪。
- 用 Agent 对素材进行编辑重写，生成一份更像“工作日报”而不是“RSS 摘抄”的内容。
- 同时产出 HTML 与 PDF，用于归档和邮件分发。
- 提供一个静态网站，承载首页、订阅页、归档页和单期日报页。

后续讨论中，日报定位又进一步明确：

- 工作性优先于话题性。
- 内容在精不在多。
- AI 与新工具板块可以适当扩展。
- 需要保留一个“社交热度观察”板块，但不能让它挤占核心工作信号。

## 二、内容链路是怎么搭起来的

当前日报生成流程分成两层：

1. 脚本层负责抓取、清洗、排序。
2. Agent 层负责编辑、重写、排版。

脚本层的核心职责包括：

- 从 `sources.yaml` 中读取 RSS 源配置。
- 拉取 RSS 内容。
- 去重、去过期、做关键词与板块打分。
- 生成 `outputs/YYYY-MM-DD/report.json`、`report.md`、`ranked-items.json` 等中间产物。

这一层最终落在 [`scripts/generate-report.js`](/Users/qiumengbo.123/Desktop/whistle/scripts/generate-report.js)。

Agent 层的目标则是基于中间素材，按照 Whistle 的结构与 Kami 风格生成最终日报。相关提示词和规则主要集中在：

- [`prompts/daily_report.md`](/Users/qiumengbo.123/Desktop/whistle/prompts/daily_report.md)
- [`prompts/kami_report_only.md`](/Users/qiumengbo.123/Desktop/whistle/prompts/kami_report_only.md)
- [`skills/kami/SKILL.md`](/Users/qiumengbo.123/Desktop/whistle/skills/kami/SKILL.md)
- [`skills/summarizer/SKILL.md`](/Users/qiumengbo.123/Desktop/whistle/skills/summarizer/SKILL.md)

这套分层是后来逐步形成的。早期其实有过“让脚本直接做更多内容拼装”的倾向，但很快发现那样产物更像机器整理，不像一份有编辑判断的日报。

## 三、HTML / PDF / 归档网站是怎么成型的

日报的最终输出分成三个方向：

- `report.html`：日报源文件
- `report.pdf`：邮件附件与打印稿
- `site/`：静态归档站点

PDF 生成由 [`scripts/html-to-pdf.js`](/Users/qiumengbo.123/Desktop/whistle/scripts/html-to-pdf.js) 完成，底层用 Playwright 打开本地 HTML 再导出 PDF。这意味着：

- 本地和 CI 都需要 Chromium。
- PDF 生成本身不是最慢的步骤，但也不是“瞬间完成”。

归档与站点构建则由：

- [`scripts/archive-report.js`](/Users/qiumengbo.123/Desktop/whistle/scripts/archive-report.js)
- [`scripts/build-site-index.js`](/Users/qiumengbo.123/Desktop/whistle/scripts/build-site-index.js)

来负责。

前端一开始尝试过 Next，但后面遇到了 `__next.*.txt` 等静态产物问题，样式加载也不够顺滑，最后迁移为 Vite + React。这一步的收益很明确：

- 站点结构更简单。
- `site/` 产物更可控。
- 挂 Vercel 和自定义域名时更省心。

最终站点保持了 Kami 风格：暖纸底、ink-blue 强调色、serif 主导、克制的编辑感。

## 四、邮件链路的决策与经验

邮件发送最终接入的是 Resend。

原因很现实：

- API 简单。
- 免费额度相对友好。
- 域名验证与发件域配置路径清晰。

最后邮件内容也从“塞整篇日报正文”收敛成了更轻的形式：

- 标题
- 第一段总结性概览
- 网页阅读链接
- PDF 附件

这样邮件本身更像提醒和分发入口，而不是阅读主载体。相关逻辑在 [`scripts/send-report-email.js`](/Users/qiumengbo.123/Desktop/whistle/scripts/send-report-email.js)。

## 五、GitHub Actions 这条线踩过的坑

这是整个项目里最花时间、也最值得记录的一段。

### 1. 最早的问题不是 API 不通，而是 Codex CLI 跑不通

GitHub Actions 里最初方案是：

- 安装 `@openai/codex`
- 通过 `~/.codex/config.toml` 注入 MICU provider
- 直接用 `codex exec` 跑日报 prompt

但实际现象是：

- `curl /models` 可以返回 200
- `curl /responses` 也可以返回 200
- 只有 `codex exec` 在 GitHub runner 上持续报 401

这说明问题并不是第三方 provider 完全不可用，而是 Codex CLI 在 runner 上的 provider 解析和本地不一致。

### 2. 本地能用，不代表 CI 也会按同样方式工作

本地 Codex 使用了 `cc switch` 做适配，而 GitHub Actions 环境没有这层适配。于是出现了一个很典型的错觉：

- 本地 `codex` 正常
- 同样的 key、同样的 base URL，CI 里却失败

这一点后来被反复验证。

### 3. 直连 `/responses` 的 API 方案尝试过，但最后放弃

后来做过“方法二”：

- 不再走 `codex exec`
- 改为脚本直接调用 `MICU /responses`
- 让模型直接生成 HTML 或 JSON 再回填模板

这条线从工程上是可行的，也确实实现过脚本原型，但最终没有作为正式方案保留，核心原因是第三方 provider 在长请求下不稳定：

- 大 prompt 容易出现 Cloudflare `524`
- 即使把 prompt 显著缩短，稳定性也不够理想
- 这条链路更像“可实验”，不像“可放心每天定时跑”

所以最后明确结论是：**暂时不用 API 直连生成日报**。

### 4. 当前 workflow 能跑通，靠的是“把配置收敛”

GitHub Actions 后来之所以能跑通，不是因为多加了多少参数，而是因为把配置路径收紧了。

有两个关键经验：

- 不要同时把同一份 provider 配置写进 `config.toml`、环境变量和 `codex exec --config` 三个地方。
- 不要把 `ANTHROPIC_*`、`OPENAI_API_KEY` 之类互不相干的环境变量一起塞进去，尤其在自定义 provider 场景下。

最终的收敛方向是：

- `~/.codex/config.toml` 成为唯一 provider 配置源。
- workflow 只传 `MICU_API_KEY`、`MICU_BASE_URL`、`MICU_MODEL`。
- `codex exec` 不再重复注入一长串 `--config`。

这让 GitHub runner 上的行为更接近“单入口启动”，也更接近官方文档希望的最小配置思路。

### 5. 生成日报本身就是长任务

GitHub Actions 最终跑通后，整条链路大约需要 15 分钟。这不是异常值。

主要耗时点通常在：

- `codex exec` 生成与重写日报内容
- HTML 覆盖与 PDF 生成
- 后续归档与推送

所以“卡在覆盖 html”未必是坏事，往往只是 Agent 还在工作。

## 六、模型与 provider 相关的结论

在尝试过程中，模型默认值也做过调整：

- 早期默认是 `gpt-5.5`
- 后来临时切到 `gpt-5.4`

这类切换本身不复杂，但要注意两点：

- 仓库里的默认值要改
- GitHub Secrets 里如果显式配置了 `MICU_MODEL`，也要同步改

否则 workflow 表面上看改了，实际运行的还是旧值。

## 七、过程中几次重要回退

整个开发里做过几次明确回退，这其实是有价值的：

- 从 Next 回退并切到 Vite 静态站方案
- 从“API 直连生成日报”回退到“继续使用 Codex CLI 路径”
- 从若干实验性 workflow 回退到更稳定的提交点

这些回退不是白折腾，而是在帮项目把“不值得坚持的复杂度”剥掉。

## 八、当前项目状态

截至这份 worklog 记录时，Whistle 已经具备：

- RSS 抓取、去重、排序、分板块的日报素材准备能力
- 基于 Agent 的日报生成链路
- HTML / PDF / 静态站归档能力
- Resend 邮件推送能力
- GitHub Actions 定时任务能力
- Vercel 静态部署与自定义域名承载能力

同时也已经明确知道：

- 直接通过第三方 `/responses` 长请求生成完整日报，目前不够稳定
- GitHub Actions 中自定义 Codex provider 的配置必须尽量单一、克制
- 日报生成属于“分钟级任务”，不能按普通脚本秒级完成来期待

## 九、后续建议

后面继续开发时，建议优先沿这几个方向推进：

- 继续优化信息源与板块划分，而不是扩展更多生成链路
- 给每期日报增加更稳定的元数据摘要，服务首页和归档页
- 保持 GitHub Actions 配置简单，减少 provider 配置面
- 把“可实验方案”和“正式生产路径”分开，不要混在同一份 workflow 里

## 十、一个实用结论

这次开发里最实用的经验，不是某个具体命令，而是一个判断标准：

当链路里同时出现“本地有适配层”“第三方 provider”“长上下文 agent 请求”“GitHub runner”这几件事时，优先怀疑的是环境装配差异，而不是业务代码本身。

这个判断，帮我们少绕了很多圈。
