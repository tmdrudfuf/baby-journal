# PROJECT STATE

_Last updated: 2026-09-27 (evening)_

## Current milestone
All milestones M1–M10 are built. Verified on emulator + staging; AI runs on the mock provider (real Claude output needs an API key); subscriptions run on a mock store (real Google Play needs Play Console); launch builds need production infrastructure (not created yet).
The closing step for M1 and M3 is a **physical-device test by the owner** (APK below).

| Milestone | State |
|---|---|
| M0 Foundation | Closed |
| M1 Magic Journal | **Closed 2026-09-27** — owner phone test passed (capture, Quick Log, offline, delete, sign-out/in) |
| M2 AI Journal | Done with mock provider (staging `AI_PROVIDER=mock`): suggestions, milestone confirm, edit/regenerate/discard, family on/off switch, cache, daily cap, usage telemetry, graceful fallback. `npm run e2e:ai-local` 20/20. Real Claude output unverified until `ANTHROPIC_API_KEY` is set |
| M3 Family | Done 2026-09-27: two independent accounts verified (script: 13 checks; emulator + second account live: invite join, realtime memory, heart, comment) |
| M4 Tracker | Built, emulator-verified |
| M5 Retention | Done 2026-09-27: On This Day, search, opt-in daily reminder, Daily Story (3+ notes; save/edit/regenerate/discard; emulator + `e2e:ai-local` 27/27 with mock) |
| M6 AI Memory | Done 2026-09-27: gte-small embeddings in the edge runtime (no extra vendor), pgvector exact per-baby search under RLS, "Ask your journal" with grounded, linked answers; sources-only fallback when AI is off/unavailable. `e2e:ai-local` 37/37 incl. Korean |
| M7 Monthly Memories | Highlights + slideshow done; share/export of a month later |
| M8 Monetization | Built 2026-09-27: `billing` function (server verify + acknowledge, token bound to one family and to the buyer's account tag, 6-hourly renewal refresh), plan features (Daily Story + Ask answers are Plus), plans screen (store price/period/renewal terms, restore, manage link), downgrade never hides data. Mock store verified (`e2e:billing-local` 14/14). Google Play adapter (expo-iap 5.8) compiles but is **unverified** until Play Console products exist |
| M9 Yearly Story | "First year" story (milestones, one highlight per month of life, totals) + print-ready A5 PDF via share sheet; full data export (zip parts) done |
| M10 Launch hardening | Audits done 2026-09-27 (docs/AUDIT_M10.md): security fixes (server-measured uploads, anon revokes), indexes, accessibility fixes, cost simulation, error boundary + monitoring sink, store drafts (listing, Data Safety, icon, feature graphic, draft screenshots). Closed-testing build and release candidate wait for production infrastructure (not created, per instruction) and Play Console |

## Completed milestones
- M0 — Foundation (closed 2026-09-26)
- M1 — Magic Journal (closed 2026-09-27, physical device)

## Active tasks
- [ ] Owner: Anthropic API key on staging
- [ ] Google Play Console account (billing, internal testing track)
- [ ] Crash monitoring + analytics provider accounts (Sentry / PostHog or similar)
- [x] Invite links (babyjournal://join), export parts (50 photos), scheduled R2 sweep (pg_cron), first-year PDF

## Known issues
- One family per user: the app shows the oldest baby across the user's families; no family switcher. Invitees must join (not create) on first launch.
- React Compiler turns `x!.prop` in components into render-time reads (crashed QuickLog); lint forbids non-null assertions in src/**/*.tsx.
- Production will need a custom email sender (SMTP) if email confirmation is turned on there.
- Invites: code + babyjournal://join link (custom scheme; an https link needs the public site). Comments/hearts/milestone decisions are online-only.
- Pull fetches the newest 500 memories per baby (pagination later). On This Day / monthly look at on-device memories.
- Export zips are built in memory (max 1000 photos per download).
- R2 purge runs on deletes and account deletion; no scheduled sweep yet.
- See docs/SECURITY.md "Known gaps".

## External dependencies
- Supabase: local via Docker; staging `stdlwvahmexetlrrzpld` (Seoul). Org `ehavtkfjgshwshafwmuz` also holds an unrelated project.
- Cloudflare R2: account 0dbe6f1e92aded8a2aca97127de4e0b9, bucket `baby-journal-media-staging` (lifecycle: `exports/` expire after 1 day).
- Expo/EAS: project `@tmdrudfuf/baby-journal` (b539689d-d022-4104-a66f-c140347e1740); Android keystore managed by EAS.

## Required human actions
1. Anthropic API key (needed only to verify real Claude output). Then: `npx supabase secrets set AI_PROVIDER=anthropic ANTHROPIC_API_KEY=... --project-ref stdlwvahmexetlrrzpld`.
2. Optional: a real second phone joining via invite (M3 is already verified with two accounts).
3. Google Play Console (needed to verify real subscriptions; see M8): developer account, products `plus_monthly`, `plus_yearly`, `family_monthly`, `family_yearly`, a service account with Play Developer API access (JSON key → `GOOGLE_PLAY_SERVICE_ACCOUNT` secret, `BILLING_PROVIDER=google`), a license tester, and an internal-testing upload (only with explicit approval).
4. Later: paid Supabase plan for production; crash/analytics provider.

Owner decisions pending: Monthly Memories is listed as Plus in §40 but stays free (already shipped to families); pricing hypothesis $4.99/mo, $39.99/yr for Plus. If the purchaser leaves or deletes their account, the family keeps the plan until the paid period ends (Play keeps billing the purchaser until they cancel).

Decisions (2026-09-27): repo stays public until Play launch; app ID `com.tmdrudfuf.babyjournal` confirmed; public contact tmdrudfuf@gmail.com; staging email confirmation OFF; site published: https://tmdrudfuf.github.io/baby-journal/ (privacy.html, delete-account.html).

Done: Supabase, Cloudflare (wrangler), Expo (eas) logins; R2 enabled; R2 API token — 2026-09-26.

## Staging status
Supabase staging migrations: 20260926000000 … 20261009000000 applied. Secret `AI_PROVIDER=mock` (deterministic suggestions, no cost).
Edge functions: `media-sign` (upload, batch download, purge, export, delete_account; CORS; rate limits) `ai-journal` (suggestions, Daily Story, embeddings, Ask) and `billing` (not configured on staging: purchases are refused until Play is set up) deployed.
Scripts: `npm run smoke:staging` ✅, `npm run e2e:family` ✅ (13/13), `npm run e2e:delete-account` ✅, `npm run smoke:ai` ✅; local: `e2e:ai-local` 40/40, `e2e:billing-local` 14/14, pgTAP 87/87.
Agent test account: credentials in local `.env` only (TEST_USER_EMAIL / TEST_USER_PASSWORD).

## Production status
Not deployed.

## Latest test result
2026-09-27: `npm run verify` ✅ (lint, typecheck, jest), pgTAP 67/67 ✅, staging smoke + family E2E + delete-account E2E ✅, CI ✅.

## Latest build
- EAS preview APK d1034997 (arm64 only, 47 MB): https://expo.dev/artifacts/eas/DS9uTIGTgnr6Hl194wrhkib3seKpa_6_goUlsM0fD9o.apk
- Owner installed via computer → phone transfer (direct phone download stalled at 100%, likely Play Protect scan).

## Important architectural decisions
See docs/ARCHITECTURE.md, DATABASE.md, SECURITY.md, PRIVACY.md, COST_MODEL.md. Highlights:
- Postgres RLS is the single authorization point; all policies route through `has_family_role()`.
- Media in R2 under `families/{family_id}/memories/{memory_id}/`, presigned 5-minute URLs from `media-sign`.
- On-device SQLite is the source of truth for capture; client UUIDs make sync idempotent; permanent failures are kept on the device, never retried forever.
- Deleting asset rows queues R2 keys (`media_deletions`); `media-sign` purge drains them.
- Plans/limits are data (`plans` rows), billing will only write `entitlements`.
- Repo is public: no secrets or family data ever committed.
