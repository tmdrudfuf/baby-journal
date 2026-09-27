# PROJECT STATE

_Last updated: 2026-09-26_

## Current milestone
M1 — Magic Journal: code complete, emulator-verified against staging; waiting on physical-device test.
M2 — AI Journal: built and deployed to staging; inactive until an Anthropic API key is set (falls back to no suggestions).
M3 — Family: built, deployed, verified with two accounts (script + emulator). Needs a two-device human check to close.
M4 — Tracker: built, deployed, emulator-verified (feed/diaper/sleep/growth quick log, Growth tab, Home summary).

## Completed milestones
- M0 — Foundation (closed 2026-09-26)

## Active tasks
- [x] Auth (email + password), onboarding (family + baby), protected routes
- [x] Local-first capture (camera/library/text) into on-device SQLite; photo variants; EXIF stripped on upload
- [x] Sync: push with backoff, pull/merge, delete + R2 purge (deletion outbox migration 20260927000000)
- [x] Home (day count, today, hero photo), Journal, memory detail (edit text, delete)
- [x] Emulator E2E (release build, staging): sign-in → onboarding → camera photo → synced; offline capture survives kill/relaunch and syncs on reconnect; delete removes row + R2 objects
- [x] EAS project linked; preview profile (APK) with staging env vars on EAS
- [ ] Physical-device test by human (preview APK: https://expo.dev/artifacts/eas/VOIahyJk_4jJdBgk9Dx-GaK5BXWdHbhjaK1y1iQCZFA.apk, M1 code)
- [x] M2: provider abstraction, ai-journal function, milestones table, cost telemetry, daily cap, confirm/dismiss UI (emulator-verified with seeded suggestion)
- [ ] M2: live AI run (needs ANTHROPIC_API_KEY on staging)
- [x] M3: invite codes, join flow, roles (owner manage/remove, last-owner guard), comments + hearts with realtime, Recorded by, viewer gating
- [x] M3 E2E: `npm run e2e:family` (invite, join, viewer can engage but not write, unrelated user sees nothing, revoke) + emulator (live comment, remove member)
- [x] M4: tracker_events (local-first, 30-day pull, realtime), Quick Log on Capture (one-tap diaper/breastfeed/solid, bottle ml, sleep start/wake, growth measurements), Growth tab (today summary, 7-day history, long-press delete), Home TODAY merges memories + logs

## Known issues
- One family per user: the app shows the oldest baby across the user's families; no family switcher. Invitees must join (not create) on first launch.
- React Compiler turns `x!.prop` in components into render-time reads (crashed QuickLog); lint now forbids non-null assertions in src/**/*.tsx.
- Staging requires email confirmation for sign-up (Supabase default). Confirmation mail links point at `http://localhost:3000` but still confirm the account. Needs a decision: turn off "Confirm email" for staging, or add custom SMTP + deep link before launch.
- Invites are shared as a code (no deep link yet). Comments/hearts/milestone decisions are online-only.
- Pull fetches the newest 500 memories per baby (pagination later).
- See docs/SECURITY.md "Known gaps".

## External dependencies
- Supabase: local via Docker; staging `stdlwvahmexetlrrzpld` (Seoul). Org `ehavtkfjgshwshafwmuz` also holds an unrelated project.
- Cloudflare R2: account 0dbe6f1e92aded8a2aca97127de4e0b9, bucket `baby-journal-media-staging`.
- Expo/EAS: project `@tmdrudfuf/baby-journal` (b539689d-d022-4104-a66f-c140347e1740); Android keystore managed by EAS.

## Required human actions
1. Install the preview APK on an Android phone and run the M1 device checklist.
2. Anthropic API key → `npx supabase secrets set --project-ref stdlwvahmexetlrrzpld ANTHROPIC_API_KEY=...` (model via AI_JOURNAL_MODEL, default claude-opus-5).
3. Decide: staging email confirmation on/off (see Known issues).
4. Decide repo visibility: `tmdrudfuf/baby-journal` is PUBLIC (secret scanning + push protection ON).
5. Confirm Android application ID `com.tmdrudfuf.babyjournal` (permanent after first Play upload).

Done: Supabase, Cloudflare (wrangler), Expo (eas) logins — 2026-09-26.

## Staging status
Supabase staging: migrations 20260926000000 … 20260930000000 applied.
Edge functions: `media-sign` (upload, batch download, purge) and `ai-journal` deployed. `npm run smoke:staging` passes (incl. delete + purge).
Agent test account: credentials in local `.env` only (TEST_USER_EMAIL / TEST_USER_PASSWORD).

## Production status
Not deployed.

## Latest test result
2026-09-26: `npm run verify` ✅ (lint, typecheck, jest), pgTAP 53/53 ✅, family E2E 12/12 ✅, staging smoke ✅, emulator E2E ✅.

## Latest build
- Local Android debug + release builds on emulator (`npx expo run:android [--variant release]`).
- EAS preview APK build b17328a2-bf4b-42cc-8883-206593f74ac4 (FINISHED; commit before M2 client).

## Important architectural decisions
See docs/ARCHITECTURE.md. Highlights:
- Postgres RLS is the single authorization point; all policies route through `has_family_role()`.
- Media in R2 under `families/{family_id}/memories/{memory_id}/`, presigned 5-minute URLs from `media-sign`.
- On-device SQLite is the source of truth for capture; client-generated UUIDs make sync idempotent.
- Deleting asset rows queues R2 keys (`media_deletions`); `media-sign` purge drains them.
- Repo is public: no secrets or family data ever committed.
