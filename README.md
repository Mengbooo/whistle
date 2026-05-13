# Whistle

Whistle is a lightweight daily brief project for internet and tech work signals.

It collects configured RSS sources, filters and ranks them, then uses an agent workflow to produce a daily HTML report, a PDF version, and a static archive site.

## Features

- Collect and rank configured sources
- Generate report materials and final HTML
- Export PDF
- Build a static archive site
- Send email via Resend
- Run on a daily GitHub Actions schedule

## Local Run

Install dependencies and Chromium first:

```bash
pnpm install
pnpm exec playwright install chromium
```

Generate the daily report:

```bash
pnpm run agent
```

Prepare materials only:

```bash
pnpm run prepare
```

Preview the site locally:

```bash
pnpm run dev
```

## Outputs

- `outputs/YYYY-MM-DD/report.md`
- `outputs/YYYY-MM-DD/report.html`
- `outputs/YYYY-MM-DD/report.pdf`
- `outputs/YYYY-MM-DD/report.json`
- `site/reports/YYYY-MM-DD.html`
- `site/index.html`

## Configuration

- Sources, keywords, and ranking weights live in `sources.yaml`
- Project skills live in `skills/`
- The full Kami skill is vendored in `skills/kami/` so local runs and CI use the same document guidance

GitHub Actions / headless Codex variables:

- `MICU_API_KEY`
- `MICU_BASE_URL`, default: `https://www.openclaudecode.cn/v1`
- `MICU_MODEL`, default: `gpt-5.4`

Email variables:

- `RESEND_API_KEY`
- `REPORT_FROM`
- `REPORT_TO`
- `REPORT_BASE_URL`, default: `https://daily.bolaxious.cn`

Alert variables:

- `ALERT_FROM`, optional, falls back to `REPORT_FROM`
- `ALERT_TO`, optional, falls back to `REPORT_TO`
- `ALERT_WEBHOOK_URL`, optional, used for non-email failure alerts
- `ALERT_WEBHOOK_TYPE`, optional, supports `discord`, `generic`, `slack`, `feishu`, `lark`, or `wecom`

## Deployment

The static site can be deployed to Vercel with `site` as the output directory. The repository already includes `vercel.json`.

## License

This project is provided under the terms in [`LICENSE`](/Users/qiumengbo.123/Desktop/whistle/LICENSE).
