# Privacy (as implemented)

This describes what the app actually does today. Keep it in sync with the code; it is the source for the
privacy policy and the Google Play Data Safety form (masterplan §37, §50).

## What is collected

| Data | Where it lives | Why |
|---|---|---|
| Email + password (hashed by Supabase Auth) | Supabase Auth | Sign-in |
| Display name ("Mom", "Grandma") | `profiles` | Show who recorded or commented |
| Baby name, birth date | `babies` | Day count, age labels |
| Memories: text, capture time, photos | `memories`, R2 (`families/{id}/memories/{id}/`) | The journal |
| Tracker logs: feeds, sleep, diapers, growth | `tracker_events` | Tracker, summaries |
| Comments, hearts | `comments`, `reactions` | Family engagement |
| AI usage (tokens, cost, feature; no content) | `ai_usage` | Cost control (§39) |

Not collected: location (photo EXIF, including GPS, is stripped from uploaded copies), contacts,
advertising IDs, analytics about journal content. There is no advertising and no sale of data.

## Who can see it

- Only members of the family, enforced in the database (row-level security, tested in `supabase/tests`).
- Private memories: only the author.
- Photos are served through 5-minute signed URLs; there are no public links.
- AI (when enabled): only the one note being processed, its date and the baby's age are sent to the
  AI provider (Anthropic). No photos and no other history.

## On the device

- Memories and photos are kept on the phone until uploaded; the original camera photo stays on the phone.
- Sign-out wipes the local database, photo files and the daily reminder.
- Losing access to a family removes that family's synced data from the phone.

## Deletion and control

| Action | Where | Effect |
|---|---|---|
| Delete a memory | Memory screen | Row deleted; R2 photos queued and purged |
| Delete the family (owner) | Family → Privacy | Everything in the family, including photos |
| Delete my account | Family → Privacy | Families you alone own are deleted with all content; in shared families you leave and your memories stay with the family (author cleared); your login is removed |
| Remove a member (owner) | Family → Members | They lose access immediately |

Tested end to end: `npm run e2e:delete-account`.

## Not yet done

- Data export (planned with the yearly story / export milestone).
- A web page for account-deletion requests (Google Play asks for one) — needs a public URL.
- Custom email sender for sign-up confirmation.
