# Architecture

```
Expo app (React Native, Expo Router, TypeScript strict)
  ├─ Supabase Auth ── JWT
  ├─ Supabase Postgres (RLS on every table) ── metadata + authorization
  ├─ Supabase Realtime (M3)
  └─ Edge Functions
        ├─ media-sign ── presigned R2 URLs (5 min) ── Cloudflare R2 (media bytes)
        └─ AI provider abstraction (M2)
```

## Decisions

| Decision | Why |
|---|---|
| Media bytes in R2, metadata in Postgres | Cheap egress, DB stays small (§27). |
| Authorization lives in Postgres RLS | One enforcement point; edge functions query with the caller's JWT so RLS decides. |
| R2 keys `families/{family_id}/memories/{memory_id}/{variant}.{ext}` | Namespaced per family (DB check constraint); derived server-side from the memory row. |
| Client may supply memory UUIDs | Offline capture retries are idempotent (§28, §33). |
| `src/` layout (Expo SDK 57 default) | Differs from masterplan §45 `app/` at root; routes are `src/app/`. |
| Single root Tabs navigator | Auth/onboarding stack added in M1 when needed. |
| Web output `single` | Web is not a target; avoids SSR color-scheme hydration code. |

## Environments

LOCAL: `npm run db:start` (Docker). STAGING / PRODUCTION: not yet created (needs Supabase + Cloudflare accounts).
