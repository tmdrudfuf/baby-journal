# Launch hardening audit (M10, 2026-09-27)

What was checked, what was fixed, and what still needs a person. Staging only; no production exists yet.

## Security
- Schema lint (`supabase db lint --linked`): clean.
- Advisor-style SQL checks (RLS on every table, pinned `search_path`, SECURITY DEFINER exposure):
  - Fixed: `has_family_role`, `can_edit_memory`, `ensure_family_owner` were executable by `anon`
    (harmless, returned false) → revoked (migration 20261009000000).
- Fixed: storage quota trusted the client-reported asset size. Asset rows are now written only by
  `media-sign` confirm after measuring the object in R2; oversize objects (>5 MB/variant) are deleted
  (migration 20261008000000; `smoke:staging` steps 2b/2c).
- Purchases: server-verified, token bound to one family and the buyer, service-only tables (M8 tests).
- AI: plan/role/family-switch gates, citations grounded to retrieved notes, no content in logs or telemetry.
- Secrets: gitleaks in CI; R2/AI/billing keys only as Supabase secrets.
- Remaining: see docs/SECURITY.md "Known gaps".

## Privacy
- Every data flow is in docs/PRIVACY.md, the public policy and the Data Safety draft, including AI
  (single note / day's notes / question + ≤8 notes), in-house embeddings, and subscriptions (no card data).
- Analytics properties are type-restricted to numbers/booleans/enums (no free text).
- Deletion: in-app and web; subscriptions are not canceled by deletion (stated in both places).

## Performance
- Added indexes for the journal pull (`baby_id, occurred_at`) and user-deletion paths; other FKs are covered
  by existing composite indexes.
- Search uses an exact per-baby vector scan (no ANN index, so RLS filters never drop results); fine to
  tens of thousands of memories per baby.
- Release APK (arm64) builds in ~1 min locally; the journal list is virtualized (FlatList); photos are
  1600 px display / 400 px thumbnails with EXIF stripped.

## Accessibility
- Every pressable has a role and label (automated scan).
- Fixed: Today rows (32 px) and Growth rows (36 px) now meet the 56 px touch target; Growth's long-press
  delete is exposed as a screen-reader action.
- Contrast is covered by `tests/unit/theme.test.ts`; status is never shown by colour alone.

## Cost
- `npm run cost:sim`: AI journal suggestions for Free families are the dominant cost at Opus 5 prices
  (margin ~68% vs ~90%). Owner decision recorded in docs/COST_MODEL.md.

## Analytics and monitoring
- Events fire as expected in emulator runs (`app_opened`, `onboarding_completed`, `memory_created`,
  `milestone_confirmed`, `plans_viewed`, `upgrade_started`, `upgrade_completed` seen in Metro logs).
- Added `src/lib/monitoring.ts` (error sink + uncaught-error hook), a root `ErrorBoundary`, and reports for
  permanently failed uploads. No provider is connected (needs an account decision, e.g. Sentry).
- Server side: Supabase function logs; `smoke:staging` and `smoke:ai` act as health checks.

## Store
- Listing, Data Safety and privacy policy updated for AI and subscriptions.
- Draft assets in docs/store/assets (icon, feature graphic, 4 screenshots at 1080×2160). Retake screenshots
  with real AI output before submission.

## Needs a person
- Production Supabase/R2 (paid) and the production EAS environment → then a closed-testing AAB and a
  release candidate. Not created, per instruction.
- Play Console (account, products, service account, license tester); upload only with explicit approval.
- Anthropic API key to verify real AI output; crash/analytics provider choice.
- Decisions: AI suggestions for Free families (cost), Monthly Memories free vs Plus, final pricing.
