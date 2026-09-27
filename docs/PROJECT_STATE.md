# PROJECT STATE

_Last updated: 2026-09-26_

## Current milestone
M1 — Magic Journal (not started).

## Completed milestones
- M0 — Foundation (closed 2026-09-26)

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
- [x] R2 bucket-scoped API token `baby-journal-staging` stored as Supabase secrets
- [x] Staging E2E smoke passed (`npm run smoke:staging`)

## Known issues
- none (local Docker + Supabase verified 2026-09-26: 25/25 pgTAP, schema lint clean).
- See docs/SECURITY.md "Known gaps".

## External dependencies
- Supabase: local via Docker; staging `stdlwvahmexetlrrzpld` (Seoul). Org `ehavtkfjgshwshafwmuz` also holds an unrelated project.
- Cloudflare R2: account 0dbe6f1e92aded8a2aca97127de4e0b9, bucket `baby-journal-media-staging`.
- Expo/EAS: not yet linked (needed for Android builds in M1).

## Required human actions
1. Decide repo visibility: `tmdrudfuf/baby-journal` is PUBLIC (secret scanning + push protection ON).
2. Confirm Android application ID `com.tmdrudfuf.babyjournal` (permanent after first Play upload).

Done: Supabase, Cloudflare (wrangler), Expo (eas) logins — 2026-09-26.

## Staging status
Supabase staging: migration 20260926000000 applied, schema lint clean, anon smoke test denied (2026-09-26).
Edge functions: `media-sign` deployed and working. Smoke 2026-09-26: create user/family/baby/memory, signed upload + download (bytes match), unsigned URL denied, anon signing denied, cleanup OK.

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
