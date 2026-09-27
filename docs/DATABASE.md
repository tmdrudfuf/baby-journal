# Database

Migrations: `supabase/migrations/`. Tests: `supabase/tests/database/` (pgTAP, `npm run db:test`, always in CI).

## Tables (M0)

| Table | Purpose |
|---|---|
| `profiles` | 1:1 with `auth.users`, auto-created by trigger |
| `families` | Family Space; created only via `create_family(name)` (caller becomes owner) |
| `family_members` | `(family_id, user_id)`, `role`, `revoked_at` |
| `babies` | belongs to a family |
| `memories` | §35 fields; `(baby_id, family_id)` FK guarantees the baby is in the same family |
| `memory_assets` | R2 object metadata; `(memory_id, family_id)` FK; key must start with `families/{family_id}/memories/{memory_id}/` |
| `invitations` | SHA-256 token hash, role (never owner), expiry, single use |
| `comments`, `reactions` | Family-visible engagement; **viewers may comment and react** (product decision), never on others' private memories |
| `milestones` | Confirmed milestones; survive memory deletion (link set null) |
| `ai_usage` | AI cost telemetry; service role only |
| `plans` | Config-driven tiers (§31): storage bytes, member limit, originals; edit rows, not code |
| `entitlements` | Family → plan (+ expiry); written only by the billing backend (service role) |
| `plan_products` | Store product id → plan (`plus_monthly`, `plus_yearly`, `family_monthly`, `family_yearly`) |
| `purchases` | One row per store purchase token (bound to one family); service role only; `sync_store_entitlement()` rebuilds the family's plan; pg_cron `refresh-purchases` re-checks renewals every 6 h |
| `daily_stories` | One optional AI day story per baby per day |
| `rate_limits` | Per-user fixed-window counters for edge functions |
| `media_deletions` | R2 keys queued by an `AFTER DELETE` trigger on `memory_assets`; drained by `media-sign` purge; service role only |

Remaining §34 entities (milestones, tracker_events, comments, reactions, stories, subscriptions, entitlements, ai_jobs, storage_usage, audit_events, …) are added in the milestone that uses them.

## Roles

`family_role` enum, ranked by declaration order: `viewer < contributor < caregiver < owner`.

| Action | Minimum role |
|---|---|
| Read family, babies, memories | viewer |
| Create memory / assets | contributor (own memories) |
| Edit/delete others' memories, manage babies, invite | caregiver |
| Rename/delete family, change member roles | owner |
| Comment, heart | viewer |

A family always keeps at least one active owner (constraint trigger `family_members_keep_owner`).

`private` visibility memories are readable only by their author.

## Functions

| Function | Notes |
|---|---|
| `has_family_role(fid, min_role)` | SECURITY DEFINER; every policy routes through it (no recursive RLS); ignores revoked members |
| `can_edit_memory(mid)` | shared by asset policies and `media-sign` |
| `create_family(name)` | atomic family + owner membership |
| `create_invitation(fid, role, ttl)` | caregiver+; returns raw token once; ttl ≤ 30 days |
| `accept_invitation(token)` | rejects expired / used / unknown tokens; re-activates revoked membership |

## Limits

- Storage: `memory_assets` insert refused (23514 `storage quota exceeded`) when a family would exceed its plan; `media-sign` checks before issuing an upload URL. Existing memories are never hidden.
- Members: `accept_invitation` refuses when the family is at its plan's member limit (`family is full`).
- Plan hypothesis: free 2 GB / 6 members, plus 25 GB / 10, family 100 GB / 30.
