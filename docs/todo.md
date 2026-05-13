# Whistle TODO

本文记录 Whistle 当前阶段除信息源扩展之外，值得继续推进的事项。

## 1. Reliability

- Add failure notification for report generation and email delivery.
- Support rerunning a specific date via `WHISTLE_DATE`.
- Strengthen artifact checks before sending email, including title and file size validation.
- Separate experimental workflows from stable production workflows.

## 2. Metadata Layer

- Generate a stable `meta.json` for each daily report.
- Move title, summary, date, and paths out of HTML parsing and into structured metadata.
- Make homepage, archive page, and email all read from the same metadata source.

## 3. Subscription System

- Implement real email collection and storage.
- Add double opt-in.
- Add unsubscribe support.
- Add duplicate email and invalid email handling.
- Define a minimal subscriber management flow before opening subscription publicly.

## 4. Archive Site

- Add archive search.
- Add tag or section filtering.
- Improve homepage summary cards using structured report metadata.
- Expose a simple RSS feed for published reports.

## 5. Testing

- Add tests for ranking and deduplication logic in `scripts/generate-report.js`.
- Add tests for email summary extraction in `scripts/send-report-email.js`.
- Add structural validation for generated HTML reports.
- Add a lightweight CI smoke check for the publish pipeline.

## 6. Performance

- Reduce unnecessary context read by the agent during report generation.
- Review PDF generation cost and Chromium install overhead.
- Keep generation, publishing, and email steps clearly separated.
- Track average daily workflow runtime and failure patterns.

## 7. Product Direction

- Keep the project focused on low-noise work signals instead of expanding into broad media aggregation.
- Continue improving report quality before adding more delivery channels.
- Prioritize stability and repeatability over experimental generation paths.
