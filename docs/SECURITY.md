# Security

## Guarantees (automated, `supabase/tests/database/rls.test.sql`, CI job `database`)

- Family A cannot read Family B (families, members, babies, memories).
- Family A cannot modify Family B (update/delete no-op, insert rejected).
- A memory cannot reference a baby from another family (FK).
- Asset keys must live under the owning family's namespace (check constraint).
- Viewers cannot create, edit, delete memories or invite.
- Expired and already-used invitations fail.
- Revoked members lose read and write access.
- Anonymous users see nothing.

## Media

- R2 credentials exist only as edge-function secrets.
- `media-sign` authorizes through RLS with the caller's JWT and returns 5-minute presigned URLs.
- No permanent public media URLs.

## Secrets

- Only `.env.example` is tracked; `.gitignore` blocks `.env*`, keystores, service-account JSON.
- CI runs gitleaks on every push.
- Repository is **public**: never commit real configuration, keys or family data.

## Known gaps (tracked)

- Presigned PUT cannot cap object size → quota enforcement at asset-row insert (M8).
- Owner can demote/remove themselves leaving an ownerless family → guard in M3 (roles).
- Rate limiting on edge functions → before staging launch.
