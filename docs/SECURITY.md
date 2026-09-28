# Security

## Guarantees (automated, `supabase/tests/database/rls.test.sql`, CI job `database`)

- Family A cannot read Family B (families, members, babies, memories).
- Family A cannot modify Family B (update/delete no-op, insert rejected).
- A memory cannot reference a baby from another family (FK).
- Asset keys must live under the owning family and memory namespace (check constraint).
- Viewers cannot create, edit, delete memories or invite.
- Expired and already-used invitations fail.
- Revoked members lose read and write access.
- Anonymous users see nothing.

## Media

- R2 credentials exist only as edge-function secrets.
- `media-sign` authorizes through RLS with the caller's JWT and returns 5-minute presigned URLs.
- No permanent public media URLs.

## On-device data

- Uploaded photos are re-encoded, which strips EXIF metadata (including GPS). The on-device original keeps it and never leaves the device in M1.
- Sign-out is blocked while uploads are pending, then wipes the local database and photo files.

## Secrets

- Only `.env.example` is tracked; `.gitignore` blocks `.env*`, keystores, service-account JSON.
- CI runs gitleaks on every push.
- Repository is **public**: never commit real configuration, keys or family data.

## Rate limits

Per-user fixed windows in Postgres (`hit_rate_limit`): upload 600/h, download signing 1200/h, purge 120/h,
export 5/day, account deletion 5/h, upload confirm 600/h, AI (suggestions, Daily Story, Ask) 120/h (plus a
per-family daily AI cap), billing verify 30/h. Exceeding returns 429,
which the app treats as retryable. Non-authenticated callers get 401.

## Known gaps (tracked)

- Closed: object size is measured server-side (`media-sign` confirm, 5 MB/variant cap) and only the server
  writes `memory_assets` rows, so quota counts cannot be under-reported (M10).
- Closed: last-owner guard (M3); scheduled R2 purge every 15 min (pg_cron).
- Open (bigger with video: up to 150 MB per clip, 1 h upload links): an object uploaded with a presigned URL but never confirmed stays in R2 unaccounted (at most one
  5-minute URL per request, rate-limited). Add an R2 lifecycle sweep of unreferenced keys before launch.
- Open: Play real-time developer notifications (refunds/revocations are picked up by the 6-hourly refresh).
