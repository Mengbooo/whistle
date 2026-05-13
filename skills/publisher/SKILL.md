---
name: publisher
description: Publish Whistle reports as HTML archive pages and PDF email attachments.
---

# Publisher Skill

Outputs:
- `outputs/YYYY-MM-DD/report.md`
- `outputs/YYYY-MM-DD/report.html`
- `outputs/YYYY-MM-DD/report.pdf`
- `outputs/YYYY-MM-DD/report.json`
- `site/reports/YYYY-MM-DD.html`
- `site/index.html`

Use Resend for email when `RESEND_API_KEY`, `REPORT_TO`, and `REPORT_FROM` are present.
Do not block report generation if email credentials are missing.
