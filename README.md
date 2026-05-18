# Whistle

Whistle is a lightweight personal intelligence desk. It collects configured RSS sources, filters noise, ranks useful items, and publishes a daily report as HTML, PDF, email, and a web archive.

## Local Run

```bash
pnpm install
pnpm exec playwright install chromium
pnpm run agent
```

`pnpm run prepare` only collects and ranks source items. `pnpm run agent` asks the headless agent to use the vendored Kami skill to write the report HTML, then the publish scripts generate the PDF and archive pages.

The archive site is a Vite + React static build. Run `pnpm run dev` to preview it locally, or `pnpm run build` to rebuild `site/`.

The current report is written to:

- `outputs/YYYY-MM-DD/report.md`
- `outputs/YYYY-MM-DD/report.html`
- `outputs/YYYY-MM-DD/report.pdf`
- `outputs/YYYY-MM-DD/report.json`
- `site/reports/YYYY-MM-DD.html`
- `site/index.html`

## Configuration

Edit `sources.yaml` to change sources, topic keywords, and ranking weights.

## Skills

Project skills live in `skills/`. The full Kami skill is vendored into `skills/kami/` so local runs and CI runs use the same document guidance.

## GitHub Actions Secrets

Required for headless Codex:

- `MICU_API_KEY`

Optional provider overrides:

- `MICU_BASE_URL`
- `MICU_MODEL`

Default provider values:

- `MICU_BASE_URL=https://www.micuapi.ai/v1`
- `MICU_MODEL=gpt-5.4`

Required for email delivery:

- `RESEND_API_KEY`
- `REPORT_FROM`
- `REPORT_TO`

Optional for email links:

- `REPORT_BASE_URL` defaults to `https://daily.bolaxious.cn`

## Vercel

Deploy the repository to Vercel and set the output directory to `site`. The included `vercel.json` already declares this.
