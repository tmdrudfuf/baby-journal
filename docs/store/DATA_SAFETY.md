# Google Play Data Safety — draft (§50)

Draft answers derived from the implementation (see docs/PRIVACY.md). **A human must review and submit these;
they are legal declarations.**

## Data collection and security

| Question | Draft answer |
|---|---|
| Does the app collect or share user data? | Collects: yes. Shares: no (service providers acting on our behalf are not "sharing" under Play's definition) |
| Is data encrypted in transit? | Yes (HTTPS/TLS everywhere) |
| Can users request deletion? | Yes — in the app (Family → Privacy → Delete my account) and on the web (site/delete-account.html). Shared family journals are kept for the remaining members (content the user added stays, without their name). |
| Committed to Play Families policy? | Review needed: the app is for adult caregivers but stores information about children |

## Data types collected

| Category / type | Collected | Purpose | Optional? |
|---|---|---|---|
| Personal info → Email address | Yes | Account management | Required |
| Personal info → Name (display name, baby's name) | Yes | App functionality | Display name optional; baby name required |
| Photos and videos → Photos | Yes | App functionality | Optional |
| Photos and videos → Videos | Yes (short clips, Plus/Family plans) | App functionality | Optional |
| Personal info → Other (baby birth date) | Yes | App functionality | Required |
| Health and fitness → Health info (feeding, sleep, diaper, growth logs) | Yes | App functionality | Optional |
| App activity → Other user-generated content (notes, comments) | Yes | App functionality | Optional |
| Location | No (photo EXIF GPS stripped; video recording location blanked before upload) | — | — |
| Financial info → Purchase history (subscription product, status, expiry, store purchase token) | Yes | App functionality (unlocking the family's plan) | Only if the owner subscribes |
| Contacts, payment/card details, messages, device IDs, ads IDs | No (payment is handled entirely by Google Play) | — | — |

Processed by AI (when enabled): the text of a single note, its date and the baby's age, sent to OpenAI to
suggest a journal line (or, on request, that day's notes for a Daily Story, or a question plus up to 8 matching notes); not used for advertising. The family owner can turn this off.

## Open items for the human

- Target audience and content settings: adults (parents/caregivers).
- Privacy policy URL: https://tmdrudfuf.github.io/baby-journal/privacy.html
- Account deletion URL: https://tmdrudfuf.github.io/baby-journal/delete-account.html
