# Cost model (§41)

Estimates, not measurements. Replace assumptions with real numbers from `ai_usage` and R2/Supabase billing once
real families use the app. Prices are list prices as of 2026-09; check before relying on them.

## Assumptions per active family per month

| Item | Assumption |
|---|---|
| Memories | 60 (2/day), half with a photo → 30 photos |
| Photo storage (uploaded copies) | display ~350 KB + thumbnail ~30 KB → ~11 MB/month, ~140 MB/year |
| Originals (paid tiers only, future) | ~3 MB each → ~90 MB/month |
| Photo views | ~600 signed downloads/month (R2 class B) |
| Uploads | ~60 PUTs/month (R2 class A) |
| Tracker logs | ~300 rows/month; memories/comments ~100 rows → ~0.5 MB DB/year |
| AI journal (paid only) | 30 text memories/month, ~500 input + ~200 output tokens each |

## Unit prices

| Service | Price |
|---|---|
| R2 storage | $0.015 / GB-month; egress free |
| R2 class A / B ops | $4.50 / M, $0.36 / M |
| Supabase | Pro $25/month base; larger compute and disk ($0.125/GB) as we grow |
| Claude Opus 5 (current AI default) | $5 / $25 per M input/output tokens → ~$0.0075 per memory |
| Claude Haiku 4.5 (option) | $1 / $5 per M → ~$0.0015 per memory |
| Google Play fee | 15% of subscriptions |
| Email (sign-up confirmation, future) | ~$20/month per 50k emails |

## Per-family monthly cost

| | Free family | Paid family (Opus 5 AI) | Paid family (Haiku AI) |
|---|---|---|---|
| R2 storage (year-1 average ~70 MB; paid adds originals ~550 MB) | $0.001 | $0.009 | $0.009 |
| R2 operations | $0.0005 | $0.0005 | $0.0005 |
| AI | $0 | ~$0.23 | ~$0.05 |
| Supabase share (see table below) | ~$0.01–0.03 | same | same |
| **Total** | **~$0.01–0.03** | **~$0.25** | **~$0.07** |

Storage grows every year a family stays (we never delete old memories, §32): a 5-year free family holds ~700 MB
(~$0.01/month). That is still small; video (not built yet) is the real storage risk and must be quota-limited (§30).

## At scale (monthly)

| Families | Supabase (est.) | R2 (est.) | AI (20% paid, Opus) | Total infra | Revenue (20% paid × $4.99 − 15%) | Gross margin |
|---|---|---|---|---|---|---|
| 1,000 | $25 | ~$1 | ~$46 | ~$75 | ~$850 | ~91% |
| 10,000 | ~$60 | ~$10 | ~$460 | ~$530 | ~$8,500 | ~94% |
| 100,000 | ~$600 | ~$100 | ~$4,600 | ~$5,300 | ~$85,000 | ~94% |
| 1,000,000 | ~$4,000 | ~$1,000 | ~$46,000 | ~$51,000 | ~$850,000 | ~94% |

The 20% paid conversion is a placeholder hypothesis; margins are dominated by AI cost per paid family.

## What this means

- Free tier is cheap to carry: photos only (no originals, no video), ~$0.01–0.03/family/month.
- AI is the main variable cost. Levers: cheaper model for the journal suggestion (`AI_JOURNAL_MODEL`),
  input-hash cache (already on), per-family daily cap (already on, `AI_DAILY_LIMIT_PER_FAMILY`).
- Unlimited storage is not justified yet; keep the configurable tiers (2 / 25 / 100 GB hypothesis, §31).
- Guardrails in place: per-user rate limits, AI daily cap, 5-minute signed URLs, export links expire in 24 h.

## To measure (once live)

- `ai_usage`: cost per family per month (`sum(est_cost_usd)` by `family_id`).
- R2 bucket size / operations per month from the Cloudflare dashboard.
- Supabase compute and disk usage.
