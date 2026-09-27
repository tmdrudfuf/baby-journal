# PROJECT STATE

_Last updated: 2026-09-26_

## Current milestone
M0 — Foundation: code complete, CI green, staging DB live. Remaining: R2 access key for media-sign (human creates in dashboard), then end-to-end upload smoke test.
Next: M1 — Magic Journal.

## Completed milestones
- none fully closed (M0 pending staging infrastructure)

## Active tasks
- [x] Repository hygiene, agent instructions, state file
- [x] Expo SDK 57 scaffold (TypeScript strict, Expo Router)
- [x] Design tokens, light/dark, core components (Screen/Text/Card/Button), 5-tab navigation
- [x] Supabase local config, initial schema, RLS foundation, 24 pgTAP security tests
- [x] R2 signed-URL edge function (`media-sign`)
- [x] CI: verify (lint/typecheck/jest), supabase test db, deno check, gitleaks
- [x] Bootstrap/verify scripts, ARCHITECTURE/DATABASE/SECURITY docs
- [x] Staging Supabase project `baby-journal-staging` (ref `stdlwvahmexetlrrzpld`, ap-northeast-2), schema deployed
- [x] R2 enabled; bucket `baby-journal-media-staging` (APAC) created
- [x] `media-sign` deployed to staging; secrets R2_ACCOUNT_ID, R2_BUCKET set
- [ ] R2 bucket-scoped API token → secrets R2_ACCESS_KEY_ID / R2_SECRET_ACCESS_KEY, then upload smoke test

## Known issues
- none (local Docker + Supabase verified 2026-09-26: 25/25 pgTAP, schema lint clean).
- See docs/SECURITY.md "Known gaps".

## External dependencies
- Supabase: local via Docker; staging `stdlwvahmexetlrrzpld` (Seoul). Org `ehavtkfjgshwshafwmuz` also holds an unrelated project.
- Cloudflare R2: account 0dbe6f1e92aded8a2aca97127de4e0b9, bucket `baby-journal-media-staging`.
- Expo/EAS: not yet linked (needed for Android builds in M1).

## Required human actions
1. Create R2 API token (Object Read & Write, bucket `baby-journal-media-staging` only) and store it with `npx supabase secrets set`.
2. Decide repo visibility: `tmdrudfuf/baby-journal` is PUBLIC (secret scanning + push protection ON).
3. Confirm Android application ID `com.tmdrudfuf.babyjournal` (permanent after first Play upload).

Done: Supabase, Cloudflare (wrangler), Expo (eas) logins — 2026-09-26.

## Staging status
Supabase staging: migration 20260926000000 applied, schema lint clean, anon smoke test denied (2026-09-26).
Edge functions: `media-sign` deployed; not functional until R2 access key secrets are set.

## Production status
Not deployed.

## Latest test result
2026-09-26 CI on main: app ✅ (lint, typecheck, 16 jest tests), database ✅ (25/25 pgTAP), functions ✅, secrets ✅.

## Latest build
Fresh clone → `npm run bootstrap && npm run verify` passes (M0 acceptance, minus Docker).
Android JS bundle exports cleanly (`expo export --platform android`). No native/AAB build yet.

## Important architectural decisions
See docs/ARCHITECTURE.md. Highlights:
- Postgres RLS is the single authorization point; all policies route through `has_family_role()`.
- Media in R2 under `families/{family_id}/…`, presigned 5-minute URLs from `media-sign`.
- Client-generated memory UUIDs for idempotent offline sync.
- Repo is public: no secrets or family data ever committed.
