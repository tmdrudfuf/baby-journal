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
export 5/day, account deletion 5/h, AI journal 120/h (plus a per-family daily AI cap). Exceeding returns 429,
which the app treats as retryable. Non-authenticated callers get 401.

## Known gaps (tracked)

- Presigned PUT cannot cap object size → quota enforcement at asset-row insert (M8).
- Owner can demote/remove themselves leaving an ownerless family → guard in M3 (roles).
- R2 object purge runs when a client calls `media-sign` purge after deletes; add a scheduled drain before launch.
