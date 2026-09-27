# PROJECT STATE

_Last updated: 2026-09-26_

## Current milestone
M0 — Foundation: **code complete, CI green**. Remaining items need human accounts (see below).
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
- [ ] Staging Supabase project + R2 bucket (blocked on human accounts)

## Known issues
- Local Docker Desktop daemon did not start on the dev machine; DB tests verified in CI only.
- See docs/SECURITY.md "Known gaps".

## External dependencies
- Supabase: local via Docker; hosted staging not created.
- Cloudflare R2: no bucket yet.
- Expo/EAS: not yet linked (needed for Android builds in M1).

## Required human actions
1. Supabase account → create project `baby-journal-staging`, then run `npx supabase login` once.
2. Cloudflare account → run `npx wrangler login` once (agent then creates buckets and R2 API token via CLI/dashboard).
3. Expo account → run `npx eas-cli login` once (needed for first device build in M1).
4. Decide repo visibility: `tmdrudfuf/baby-journal` is PUBLIC.
5. Confirm Android application ID `com.tmdrudfuf.babyjournal` (permanent after first Play upload).

## Staging status
Not deployed.

## Production status
Not deployed.

## Latest test result
2026-09-26 CI on main: app ✅ (lint, typecheck, 16 jest tests), database ✅ (24/24 pgTAP), functions ✅, secrets ✅.

## Latest build
Android JS bundle exports cleanly (`expo export --platform android`). No native/AAB build yet.

## Important architectural decisions
See docs/ARCHITECTURE.md. Highlights:
- Postgres RLS is the single authorization point; all policies route through `has_family_role()`.
- Media in R2 under `families/{family_id}/…`, presigned 5-minute URLs from `media-sign`.
- Client-generated memory UUIDs for idempotent offline sync.
- Repo is public: no secrets or family data ever committed.
