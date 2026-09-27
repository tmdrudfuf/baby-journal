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
Logins only; the agent creates projects, buckets and tokens via CLI afterwards.
1. `npx supabase login` → agent runs `supabase projects create baby-journal-staging`.
2. `npx wrangler login` → agent creates R2 buckets. Enabling R2 requires a payment method on the Cloudflare account (free tier: 10 GB).
3. `npx eas-cli login` → needed for first Android device build (M1).
4. Decide repo visibility: `tmdrudfuf/baby-journal` is PUBLIC (secret scanning + push protection are ON).
5. Confirm Android application ID `com.tmdrudfuf.babyjournal` (permanent after first Play upload).

## Staging status
Not deployed.

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
