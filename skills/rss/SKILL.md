---
name: rss
description: Fetch RSS/Atom sources for Whistle daily reports.
---

# RSS Skill

Use `sources.yaml` entries with `type: rss`.

Rules:
- Fetch each source with a browser-like User-Agent.
- Keep source id, source name, source weight, title, url, publishedAt, author, summary, tags.
- Do not fail the whole run when one source fails; record the failure.
- Prefer canonical URLs from feed entries.
- Keep raw text short; the ranking and report layers decide what to keep.
