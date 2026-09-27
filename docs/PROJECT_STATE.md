# PROJECT STATE

_Last updated: 2026-09-27_

## Current milestone
Milestones 1–5, 7 built and emulator-verified against staging; M2 (AI) waits for an API key; M8 has plans/quotas but no billing; M9/M10 partly prepared.
The closing step for M1 and M3 is a **physical-device test by the owner** (APK below).

| Milestone | State |
|---|---|
| M0 Foundation | Closed |
| M1 Magic Journal | Built, emulator-verified; waiting on phone test |
| M2 AI Journal | Built + deployed; inactive until `ANTHROPIC_API_KEY` is set (falls back to no suggestions) |
| M3 Family | Built, two-account verified (script + emulator); waiting on two-device check |
| M4 Tracker | Built, emulator-verified |
| M5 Retention | On This Day, search, opt-in daily reminder done; Daily Story needs the AI key |
| M6 AI Memory | Not started (needs AI key + embeddings provider decision) |
| M7 Monthly Memories | Highlights + slideshow done; share/export of a month later |
| M8 Monetization | Plans, entitlements, storage quota, member limits done; Google Play Billing not started (needs Play Console) |
| M9 Yearly Story | Not started; full data export (zip) done |
| M10 Launch hardening | Privacy controls, account deletion (app + web page), rate limits, cost model, Data Safety + listing drafts done; monitoring/analytics/store assets pending |

## Completed milestones
- M0 — Foundation (closed 2026-09-26)

## Active tasks
- [ ] Owner: phone test with the latest APK (checklist in the latest report)
- [ ] Owner: Anthropic API key on staging
- [ ] Owner decisions: staging email confirmation, repo visibility, Android app ID, contact email, GitHub Pages for `site/`
- [ ] Google Play Console account (billing, internal testing track)
- [ ] Crash monitoring + analytics provider accounts (Sentry / PostHog or similar)

## Known issues
- One family per user: the app shows the oldest baby across the user's families; no family switcher. Invitees must join (not create) on first launch.
- React Compiler turns `x!.prop` in components into render-time reads (crashed QuickLog); lint forbids non-null assertions in src/**/*.tsx.
- Staging requires email confirmation (Supabase default mailer only sends to project team addresses; links land on localhost but confirm).
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
1. Install the latest preview APK on an Android phone and run the device checklist.
2. Anthropic API key → `npx supabase secrets set --project-ref stdlwvahmexetlrrzpld ANTHROPIC_API_KEY=...` (model via `AI_JOURNAL_MODEL`, default claude-opus-5).
3. Decide: staging email confirmation on/off.
4. Decide repo visibility: `tmdrudfuf/baby-journal` is PUBLIC (secret scanning + push protection ON).
5. Confirm Android application ID `com.tmdrudfuf.babyjournal` (permanent after first Play upload).
6. Provide a public contact email and approve hosting `site/` (privacy policy, account deletion) e.g. on GitHub Pages.
7. Later: Google Play Console developer account (identity verification + fee).

Done: Supabase, Cloudflare (wrangler), Expo (eas) logins; R2 enabled; R2 API token — 2026-09-26.

## Staging status
Supabase staging migrations: 20260926000000 … 20261002000000 applied.
Edge functions: `media-sign` (upload, batch download, purge, export, delete_account; CORS; rate limits) and `ai-journal` deployed.
Scripts: `npm run smoke:staging` ✅, `npm run e2e:family` ✅ (13/13), `npm run e2e:delete-account` ✅ (7/7).
Agent test account: credentials in local `.env` only (TEST_USER_EMAIL / TEST_USER_PASSWORD).

## Production status
Not deployed.

## Latest test result
2026-09-27: `npm run verify` ✅ (lint, typecheck, jest), pgTAP 67/67 ✅, staging smoke + family E2E + delete-account E2E ✅, CI ✅.

## Latest build
- EAS preview APK 7ade66b5-5b3e-413b-b525-9995f17bd4e7: https://expo.dev/artifacts/eas/FLE9aNYlCd5Q8knby4GeLB1m8rsIUMaNCiXM_ly6ooo.apk
  (includes M1–M5, M7, privacy controls, new icon; launch-tested on emulator: fresh install, sign-in, Quick Log). Later commits add only the plan/storage line and server-side changes.

## Important architectural decisions
See docs/ARCHITECTURE.md, DATABASE.md, SECURITY.md, PRIVACY.md, COST_MODEL.md. Highlights:
- Postgres RLS is the single authorization point; all policies route through `has_family_role()`.
- Media in R2 under `families/{family_id}/memories/{memory_id}/`, presigned 5-minute URLs from `media-sign`.
- On-device SQLite is the source of truth for capture; client UUIDs make sync idempotent; permanent failures are kept on the device, never retried forever.
- Deleting asset rows queues R2 keys (`media_deletions`); `media-sign` purge drains them.
- Plans/limits are data (`plans` rows), billing will only write `entitlements`.
- Repo is public: no secrets or family data ever committed.
