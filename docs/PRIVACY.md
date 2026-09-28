# Privacy (as implemented)

This describes what the app actually does today. Keep it in sync with the code; it is the source for the
privacy policy and the Google Play Data Safety form (masterplan §37, §50).

## What is collected

| Data | Where it lives | Why |
|---|---|---|
| Email + password (hashed by Supabase Auth) | Supabase Auth | Sign-in |
| Display name ("Mom", "Grandma") | `profiles` | Show who recorded or commented |
| Baby name, birth date | `babies` | Day count, age labels |
| Memories: text, capture time, photos, short videos (≤30 s, paid plans) | `memories`, R2 (`families/{id}/memories/{id}/`) | The journal |
| Tracker logs: feeds, sleep, diapers, growth | `tracker_events` | Tracker, summaries |
| Comments, hearts | `comments`, `reactions` | Family engagement |
| AI usage (tokens, cost, feature; no content) | `ai_usage` | Cost control (§39) |

Not collected: location (photo EXIF, including GPS, is stripped from uploaded copies), contacts,
advertising IDs, analytics about journal content. There is no advertising and no sale of data.

## Who can see it

- Only members of the family, enforced in the database (row-level security, tested in `supabase/tests`).
- Private memories: only the author.
- Photos and videos are served through 5-minute signed URLs; there are no public links.
- Videos are stored as recorded (no re-encoding), so any location the camera embedded is kept; the still frame used for previews is re-encoded without metadata.
- AI (when enabled): only the one note being processed, its date and the baby's age are sent to the
  AI provider (OpenAI; requests sent with `store: false`; Anthropic is supported as an alternative). No photos and no other history. A Daily Story, only when a family member asks
  for one, sends that day's notes the same way (`daily_stories`). Asking the journal a question sends the question
  and up to 8 matching notes (500 characters each); the question is not stored or logged.
- Search index: each note's text is turned into a numeric embedding (`memories.embedding`) by a model that
  runs inside our Supabase edge functions (gte-small), so no third party sees it. This does not depend on the
  AI switch; the embedding is deleted with the memory. The family owner can turn AI suggestions off
  (`families.ai_enabled`); then nothing is sent.

## On the device

- Memories and photos are kept on the phone until uploaded; the original camera photo stays on the phone.
- Sign-out wipes the local database, photo files and the daily reminder.
- Deleted photos are removed from R2 immediately, and a sweep every 15 minutes retries anything that could not be removed at once.
- Losing access to a family removes that family's synced data from the phone.

## Deletion and control

| Action | Where | Effect |
|---|---|---|
| Delete a memory | Memory screen | Row deleted; R2 photos queued and purged |
| Delete the family (owner) | Family → Privacy | Everything in the family, including photos |
| Delete my account | Family → Privacy, or site/delete-account.html | Login + profile removed. A family with no other members is deleted with all content. Families other people belong to are kept: you leave, ownership passes to the highest-ranked member if you were the only owner, your memories stay with the family (author cleared) |
| Remove a member (owner) | Family → Members | They lose access immediately |
| Download my data | Family → Privacy | Zip(s) with journal.json, a readable index.html and photos (50 per part; unzip all parts into one folder), built from what you can see; stored under `exports/` in R2 and auto-deleted after 1 day |

Tested end to end: `npm run e2e:delete-account`.

## Not yet done

- Large exports come in 50-photo parts (edge-function memory/CPU limits); a streaming exporter would allow one file.
- A web page for account-deletion requests (Google Play asks for one) — needs a public URL.
- Custom email sender for sign-up confirmation.
