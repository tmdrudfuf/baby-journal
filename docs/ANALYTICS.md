# Analytics (§43)

All events are defined in `src/lib/analytics.ts`. No provider is connected yet; in development events are
logged to the console, in production they are dropped. Connecting a provider = `setAnalyticsSink(...)`.

## Rules

- Properties may only be numbers, booleans or fixed enums (enforced by the `Props` type).
- Never send: journal text, names, photo URLs, baby health data (feeding/sleep/growth values), comments.
- Analytics failures never affect the app (`track` swallows errors).

## Events

| Event | When | Properties |
|---|---|---|
| `app_opened` | App start | — |
| `onboarding_completed` | Family + baby created | — |
| `family_joined` | Invite accepted | — |
| `capture_opened` | Capture screen shown | — |
| `memory_created` | Memory saved (on device) | `has_photo`, `has_text` |
| `photo_added` | Memory saved with a photo | — |
| `quick_log` | Tracker entry logged | `kind` (feed/sleep/diaper/growth) — no amounts |
| `milestone_confirmed` | "Save milestone" | — |
| `family_invited` | Invite created | — |
| `monthly_story_viewed` | Monthly slideshow opened | — |
| `yearly_story_viewed` | Yearly story opened | `year` |

These cover the §8 North Star (weekly memories per family) and the funnel: onboarding → first memory → invites.
