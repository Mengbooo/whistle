---
name: ranking
description: Rank, deduplicate, and reduce noise for Whistle reports.
---

# Ranking Skill

Score items with a transparent, conservative heuristic:
- Recency: newer items score higher within the last 72 hours.
- Source weight: use `source.weight` from `sources.yaml`.
- Keyword match: include-topic hits raise score; exclude-topic hits suppress score.
- Novelty: near-duplicate titles or URLs should collapse into one item.
- Repeat penalty: avoid one source dominating the whole brief.

Do not over-filter in MVP. Prefer keeping borderline useful developer/AI items over deleting them.
