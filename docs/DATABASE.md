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

Remaining §34 entities (milestones, tracker_events, comments, reactions, stories, subscriptions, entitlements, ai_jobs, storage_usage, audit_events, …) are added in the milestone that uses them.

## Roles

`family_role` enum, ranked by declaration order: `viewer < contributor < caregiver < owner`.

| Action | Minimum role |
|---|---|
| Read family, babies, memories | viewer |
| Create memory / assets | contributor (own memories) |
| Edit/delete others' memories, manage babies, invite | caregiver |
| Rename/delete family, change member roles | owner |

`private` visibility memories are readable only by their author.

## Functions

| Function | Notes |
|---|---|
| `has_family_role(fid, min_role)` | SECURITY DEFINER; every policy routes through it (no recursive RLS); ignores revoked members |
| `can_edit_memory(mid)` | shared by asset policies and `media-sign` |
| `create_family(name)` | atomic family + owner membership |
| `create_invitation(fid, role, ttl)` | caregiver+; returns raw token once; ttl ≤ 30 days |
| `accept_invitation(token)` | rejects expired / used / unknown tokens; re-activates revoked membership |
