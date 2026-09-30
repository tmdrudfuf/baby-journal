# BABY JOURNAL
## Final Autonomous Product, Design, Engineering & Deployment Master Plan

Version: 1.0  
Target: Android / Google Play first  
Secondary: iOS  
Development Model: Autonomous AI Engineering  
Primary Agent: Claude Code or OpenAI Codex  
Agent Capabilities Assumed: filesystem + terminal + Git + GitHub + browser/web controller

---

# 1. MISSION

Build a production-ready baby journal application designed to become one of the strongest products in the baby-journal category.

The goal is NOT simply to reproduce an existing baby tracker.

The product should combine:

- extremely fast baby logging
- beautiful private family journaling
- photo/video memories
- milestones
- family collaboration
- AI-assisted storytelling
- long-term memory retrieval
- monthly/yearly retrospectives
- sustainable long-term storage

Primary product promise:

> Record in 10 seconds. Remember forever.

Core emotional proposition:

> Your baby's story, automatically remembered.

---

# 2. AUTONOMOUS DEVELOPMENT MANDATE

You are responsible for acting as:

- principal engineer
- mobile engineer
- backend engineer
- database engineer
- infrastructure engineer
- DevOps engineer
- security engineer
- QA engineer
- UI/UX implementer
- AI integration engineer
- release engineer
- technical documentation owner

The human is the PRODUCT OWNER.

Do not turn the human into an implementation assistant.

The human should primarily perform:

- unavoidable authentication
- 2FA/passkey approval
- payment authorization
- legal acceptance
- developer identity verification
- physical-device UX evaluation
- subjective product decisions
- final production approval

Everything technically automatable should be performed by the agent.

---

# 3. AVAILABLE AUTOMATION CHANNELS

Assume access to:

## Filesystem

Create/edit/delete project files.

## Terminal

Run development tools, CLIs, tests, builds and scripts.

## Git

Create branches, commits and tags.

## GitHub

Push code, create PRs, configure workflows and inspect CI.

## Web Controller / Browser Automation

Navigate web dashboards when necessary.

Possible targets:

- Supabase
- Cloudflare
- GitHub
- Expo/EAS
- Google Play Console
- AI provider consoles
- monitoring platforms

Browser automation does NOT override human authorization requirements.

---

# 4. AUTOMATION PRIORITY

Always prefer automation in this order:

1. Infrastructure-as-Code / repository configuration
2. official CLI
3. official API
4. repeatable scripts
5. CI/CD
6. browser/web controller
7. human action

Do NOT use browser automation for something that can reasonably be represented reproducibly in code.

Example:

BAD:

Manually create database tables through Supabase Dashboard.

GOOD:

Create migration
→ test migration
→ deploy migration using CLI
→ verify through API/CLI.

Browser automation should primarily handle unavoidable dashboard-only operations and verification.

---

# 5. HUMAN INTERRUPTION RULE

Do not ask the human for routine implementation decisions.

Interrupt only when genuinely required.

Allowed interruption categories:

AUTHENTICATION

PAYMENT

LEGAL ACCEPTANCE

IDENTITY VERIFICATION

IRREVERSIBLE PRODUCTION ACTION

PRODUCT DECISION THAT CANNOT REASONABLY BE INFERRED

PHYSICAL DEVICE VERIFICATION

When blocked, output exactly:

WHY:
Explain the blocker.

ACTION:
Give the smallest action the human must perform.

VERIFY:
Explain how completion will be detected.

NEXT:
Explain what will automatically continue.

Do not provide a 20-step tutorial if one login click is sufficient.

---

# 6. PRODUCT PRINCIPLE

The product is not primarily:

a baby tracker.

It is:

> A private family memory system.

Tracking provides utility.

Memories create emotional value.

Long-term rediscovery creates retention.

AI removes work.

---

# 7. TARGET USER

Primary users:

Parents and adult caregivers.

The product records information about children but is designed for adult caregivers.

Store metadata, privacy disclosures and target-audience configuration must accurately reflect the final implementation and applicable platform requirements.

---

# 8. NORTH STAR

Primary metric:

Weekly Memories Captured per Active Family

Critical supporting metrics:

- onboarding completion
- first memory completion
- time to first memory
- D1 retention
- D7 retention
- D30 retention
- memories/week
- recorded days/week
- family invite rate
- AI story acceptance
- On This Day engagement
- monthly story viewing
- paid conversion
- storage cost/family
- AI cost/family
- gross margin

Early product question:

> Does someone who records a memory today record another tomorrow?

---

# 9. THE 3 AM TEST

Every core interaction must work for someone who is:

- exhausted
- holding a baby
- using one hand
- in darkness
- distracted
- unwilling to type much

Therefore:

- large controls
- one-handed interaction
- dark mode
- minimal forms
- voice input
- sensible defaults
- offline capture
- optimistic UI
- background synchronization
- immediate feedback

Target:

Normal memory capture under 10 seconds.

---

# 10. PRIMARY NAVIGATION

Five major areas:

HOME

JOURNAL

CAPTURE

GROWTH

FAMILY

Capture is visually emphasized.

---

# 11. HOME

Home should feel like opening a family album.

Example:

Good morning

Noah
Day 184

[large baby photo]

184 days together

TODAY

7:20 Feeding
8:40 Nap
10:32 First rollover

[ Capture a moment ]

Do not create an overwhelming analytics dashboard.

---

# 12. CAPTURE

Capture is the most important interaction.

Primary options:

PHOTO

VIDEO

VOICE

WRITE

Quick Log:

FEED

SLEEP

DIAPER

GROWTH

BATH

MEDICINE

OTHER

Do not force users to classify a memory before recording it.

Capture first.

Classify afterward.

---

# 13. MAGIC MEMORY FLOW

Example input:

Photo

+

"오늘 처음으로 혼자 뒤집었어."

System determines:

possible milestone
date
event
participants if explicitly known
candidate journal text

Example:

Possible milestone ✨

First rollover

September 26, 2026

[Save milestone]

[Not a milestone]

AI suggestions are editable.

AI must not invent emotional or factual details.

Original parent input must always be preserved.

---

# 14. DAILY STORY

When enough events exist:

"You captured 5 moments today."

Generate a short optional narrative.

Actions:

SAVE

EDIT

REGENERATE

DISCARD

Daily journaling should require almost no additional work.

---

# 15. JOURNAL

Chronological photo-forward timeline.

Entries may contain:

photo/video
original text
AI story
milestone
creator
date
reactions
comments
related tracker events

Filters:

ALL

PHOTOS

VIDEOS

MILESTONES

STORIES

---

# 16. FAMILY SPACE

Each baby belongs to a Family Space.

Roles:

OWNER

PARENT/CAREGIVER

CONTRIBUTOR

VIEWER

Support:

secure invitation
expiring invitation
role management
shared memories
reactions
comments
authorship

Example:

Recorded by Dad

Permissions must be enforceable server-side.

---

# 17. TRACKER

V1:

Feeding
Sleep
Diaper
Growth

Later:

Pumping
Bath
Medicine
Temperature
Solid food
Custom events

Logging must remain fast.

Tracking should never visually dominate the emotional journal.

---

# 18. ON THIS DAY

Historical rediscovery is a core retention feature.

Example:

One year ago today ❤️

2026 — First rollover

Later:

2026 — First rollover
2027 — First daycare day
2028 — Drew a dinosaur

Product value should increase as history accumulates.

---

# 19. AI MEMORY SEARCH

Users can ask:

"When did Noah first walk?"

"What happened the first time he ate bananas?"

"Show memories with Grandma."

"How old was he when his first tooth appeared?"

Use retrieval.

Do not send the entire archive to an LLM.

Responses should reference original memories.

If evidence is uncertain, say so.

---

# 20. MONTHLY MEMORIES

Automatically create:

September Memories

Use:

selected photos
short videos
milestones
daily stories
family contributions

Initial output:

beautiful slideshow/story.

Do NOT immediately implement expensive generative video.

Validate demand first.

---

# 21. YEARLY STORY

Premium:

"My First Year"

Include:

timeline
major milestones
favorite memories
family notes
monthly highlights

Outputs:

in-app story
shareable slideshow/video
PDF
print-ready structure

---

# 22. DESIGN DIRECTION

Visual personality:

warm
calm
premium
private
nostalgic
modern

Avoid:

hospital dashboard appearance
generic SaaS UI
overly childish UI
pink-for-girl / blue-for-boy defaults

Palette direction:

Warm Ivory

Oatmeal

Muted Sage

Soft Apricot

Warm Charcoal

Use:

large photography
generous whitespace
rounded cards
soft depth
subtle textures
gentle motion

Handwriting-style typography may appear only as an accent.

Body text must remain highly readable.

---

# 23. DARK MODE

Dark mode is mandatory.

Night capture should avoid bright full-screen flashes from UI.

Camera behavior must still respect platform limitations and actual photography requirements.

---

# 24. ACCESSIBILITY

Support:

screen readers
dynamic/large text
sufficient contrast
large touch targets
reduced motion
dark mode

Never encode important information through color alone.

---

# 25. CORE STACK

Frontend:

Expo
React Native
TypeScript
Expo Router

Backend:

Supabase

Use for:

PostgreSQL
Auth
RLS
Realtime
Edge Functions
structured metadata

Media:

Cloudflare R2

Use for:

photos
videos
thumbnails
generated media
exports

AI:

Provider abstraction.

Initial provider may be chosen based on quality/cost.

Do not tightly couple domain logic to one AI vendor.

---

# 26. SYSTEM ARCHITECTURE

Mobile App
   |
   +---- Supabase Auth
   |
   +---- Supabase PostgreSQL
   |
   +---- Supabase Realtime
   |
   +---- Edge Functions
             |
             +---- AI Provider
             |
             +---- signed media authorization
                         |
                         +---- Cloudflare R2

Analytics/Monitoring run alongside this architecture.

---

# 27. WHY R2

Large media should not be stored directly in the database.

R2 should carry media while Supabase stores metadata and authorization relationships.

Never expose administrative R2 credentials to clients.

Use secure temporary upload/download authorization.

---

# 28. LOCAL-FIRST CAPTURE

Capturing a memory must not depend on network availability.

Flow:

CAPTURE

↓

SAVE LOCALLY

↓

SHOW IMMEDIATELY

↓

OPTIMIZE MEDIA

↓

QUEUE UPLOAD

↓

BACKGROUND UPLOAD

↓

SERVER SYNC

↓

CONFIRM

Failed synchronization retries automatically.

Never lose a memory because Wi-Fi disappeared.

---

# 29. PHOTO STORAGE

Modern phone originals can be unnecessarily large.

Generate:

THUMBNAIL

DISPLAY-OPTIMIZED VERSION

OPTIONAL ORIGINAL

Original preservation may require Premium entitlement.

Do not permanently destroy the device original merely because a cloud-optimized copy was uploaded.

Strip unnecessary metadata when appropriate and consistent with product behavior.

Benchmark compression quality.

---

# 30. VIDEO STORAGE

Video is the largest storage cost risk.

Free tier must not include unlimited original video archival.

Use:

duration limits
quota limits
optimized playback copies
poster thumbnails

Premium tiers receive larger allowances.

Original video backup can be premium.

---

# 31. STORAGE TIERS

Initial business hypothesis:

FREE

2 GB

PLUS

25 GB

FAMILY

100 GB

These values MUST be configuration-driven.

Do not hardcode them throughout the client.

Real usage and cost data determine final limits.

---

# 32. LONG-TERM STORAGE

Never silently delete old memories just because they are old.

The product promise depends on long-term history.

Instead:

optimize files
tier storage
control quotas
offer paid storage
allow export

Potential storage states:

HOT

WARM

ARCHIVE

Evaluate cold/infrequent-access storage only when real retrieval data supports it.

---

# 33. MEDIA DEDUPLICATION

Use content hashing where appropriate.

Retries must not generate duplicate files.

Consider deduplication within the same family where privacy/security architecture permits it.

Do not globally deduplicate private family media in ways that leak cross-family information.

---

# 34. DATABASE ENTITIES

Initial entities:

users

families

family_members

babies

memories

memory_assets

milestones

tracker_events

comments

reactions

daily_stories

monthly_stories

yearly_stories

invitations

subscriptions

entitlements

ai_jobs

storage_usage

audit_events

device_sync_state

notification_preferences

Use UUIDs.

---

# 35. MEMORY DATA

Memory:

id
family_id
baby_id
author_id
created_at
occurred_at
type
raw_text
story_text
visibility
milestone_candidate
sync_status

Asset:

id
memory_id
object_key
asset_type
mime_type
width
height
duration
bytes
variant
storage_class
hash
created_at

Never depend on permanent public media URLs.

---

# 36. SECURITY

Mandatory:

RLS
least privilege
signed URLs
short-lived credentials
server-side authorization
input validation
rate limits
secure secrets
audit trails

Create explicit automated tests proving:

Family A cannot read Family B.

Family A cannot modify Family B.

Expired invitations fail.

Viewer cannot perform unauthorized writes.

Deleted/revoked members lose access.

---

# 37. PRIVACY

Private by default.

No public child profiles by default.

No sale of family data.

No advertising system based on baby information.

Provide:

account deletion
family deletion
memory deletion
media deletion
data export
role removal

Privacy documentation must reflect actual implementation.

---

# 38. AI PRIVACY

Send minimum required context to providers.

Never send unrelated family history.

AI provider interface:

generateJournal()

detectMilestone()

generateDailyStory()

generateMonthlyStory()

embedMemory()

searchMemories()

Provider implementations must be replaceable.

---

# 39. AI COST CONTROL

Track:

provider
model
tokens/input
tokens/output
latency
estimated cost
feature
user/family attribution

Cache successful outputs.

Never call AI just because a screen opened.

Use inexpensive models for:

classification
tagging
simple transformation

Use more capable models only when quality materially matters.

AI failure must never prevent memory creation.

---

# 40. SUBSCRIPTION MODEL

Avoid intrusive advertising.

FREE:

core journal
photos
basic tracker
milestones
limited family
limited cloud storage

PLUS:

larger storage
AI Daily Story
AI Memory Search
Monthly Memories
original backup options
advanced export

FAMILY:

large shared storage
expanded family membership
advanced family features

Initial pricing hypothesis:

$4.99/month

or

$39.99/year

Do not treat this as permanent pricing.

Measure economics.

---

# 41. COST MODEL

Maintain:

docs/COST_MODEL.md

Model:

1,000 families

10,000 families

100,000 families

1,000,000 families

Include:

DB
media storage
media operations
bandwidth
AI
monitoring
email
push
backup
subscription fees
store fees
gross margin

Calculate average cost per:

free family
paid family

Do not launch unlimited storage without evidence supporting it.

---

# 42. COST GUARDRAILS

Implement monitoring for:

upload spikes
large media
AI spikes
duplicate processing
unexpected DB growth
failed jobs
abusive usage

Set configurable hard safety limits.

---

# 43. ANALYTICS

Allowed examples:

app_opened
onboarding_completed
capture_opened
memory_created
photo_added
milestone_confirmed
family_invited
monthly_story_viewed

Never send:

journal text
private photo URLs
baby medical information
private family messages

Centralize event definitions.

---

# 44. OBSERVABILITY

Implement:

crash monitoring
structured logs
server errors
upload errors
job failures
AI latency
AI cost
storage usage
API latency

Never log secrets or private memory contents unnecessarily.

---

# 45. REPOSITORY STRUCTURE

baby-journal/

app/

components/

features/

hooks/

lib/

services/

state/

types/

assets/

supabase/
    migrations/
    functions/
    tests/
    seed.sql
    config.toml

infrastructure/
    cloudflare/
    scripts/

tests/
    unit/
    integration/
    e2e/
    security/

scripts/
    bootstrap
    verify
    deploy-staging
    deploy-production
    seed
    cost-check

docs/
    PRODUCT.md
    ARCHITECTURE.md
    DESIGN_SYSTEM.md
    DATABASE.md
    SECURITY.md
    PRIVACY.md
    ANALYTICS.md
    COST_MODEL.md
    RUNBOOK.md
    RELEASE.md

.github/
    workflows/

.env.example

CLAUDE.md
AGENTS.md
README.md

---

# 46. SECRET MANAGEMENT

Never commit:

API keys
service-role keys
tokens
passwords
signing credentials

Provide:

.env.example

Use platform secret managers for deployed environments.

Automatically scan commits for obvious secrets where possible.

---

# 47. ENVIRONMENTS

Maintain separate:

LOCAL

STAGING

PRODUCTION

Never test destructive operations against production.

Environment differences should come from configuration.

---

# 48. CI/CD

Target pipeline:

PULL REQUEST

↓

LINT

↓

TYPECHECK

↓

UNIT TEST

↓

INTEGRATION TEST

↓

SECURITY TEST

↓

BUILD

↓

STAGING DEPLOY

↓

SMOKE TEST

↓

RELEASE CANDIDATE

↓

HUMAN APPROVAL

↓

PRODUCTION

Production approval remains intentionally human-controlled.

---

# 49. WEB CONTROLLER POLICY

Browser control is available.

Use it when:

dashboard-only configuration is required

CLI authentication needs browser completion

store listing requires dashboard interaction

deployment state must be inspected visually

provider configuration lacks practical CLI/API support

Do NOT:

make irreversible purchases without approval

accept legal contracts for the human

bypass 2FA

guess identity information

guess legal declarations

publish production releases without required approval

change billing plans without approval

If a page requires sensitive credentials, allow the human to complete authentication.

Resume afterward.

---

# 50. GOOGLE PLAY AUTOMATION

Automate as much as technically and policy-permitted.

Agent should prepare:

application ID

Android configuration

AAB

version codes

release notes

store description

feature graphic specifications/assets

screenshots where technically feasible

privacy-policy inputs

Data Safety draft

content-rating inputs

test tracks

release candidate

Use Play APIs/automation where appropriate.

Browser Controller may handle dashboard-only operations.

The human must verify declarations involving legal/product responsibility.

Final production rollout requires explicit approval.

---

# 51. TEST STRATEGY

Required:

unit tests

integration tests

E2E

RLS/security tests

offline tests

sync tests

media tests

migration tests

subscription tests

AI fallback tests

---

# 52. CRITICAL E2E

Test:

new user
→ signup
→ family
→ baby
→ capture photo
→ create memory
→ timeline

Then:

offline
→ capture
→ reconnect
→ sync

Then:

invite second account
→ join family
→ authorized memory visible

Then:

unrelated account
→ attempt access
→ denied

Then:

delete memory
→ metadata removed
→ media inaccessible

---

# 53. PERFORMANCE

Prioritize:

fast startup
instant capture
thumbnail-first display
pagination
lazy loading
background upload
local cache
responsive gestures

Never load full original images in timeline thumbnails.

---

# 54. FAILURE PHILOSOPHY

The original memory is the highest-value data.

Therefore:

AI can fail.

Analytics can fail.

Monthly story can fail.

Notifications can fail.

Capture must still work.

Optional services must never sit synchronously between the user and saving a memory.

---

# 55. BACKUP

Document and test:

database backups
restore process
migration recovery
media lifecycle
accidental deletion handling
provider outage behavior

Backup cost must be included in economics.

---

# 56. NON-GOALS V1

Do not initially build:

public social network
public child profiles
discovery feed
AI medical diagnosis
live streaming
marketplace
complex social chat
dozens of tracker categories
expensive generative video
ad network

Focus:

CAPTURE

REMEMBER

REDISCOVER

---

# 57. MILESTONE 0 — FOUNDATION

Build:

Expo project
TypeScript strict
Expo Router
design tokens
light/dark mode
core component library
Supabase local environment
migration system
initial schema
RLS foundation
R2 infrastructure
testing
CI
environment handling
documentation
bootstrap scripts

Acceptance:

Fresh clone can reach a working development environment with minimal setup after authentication.

---

# 58. MILESTONE 1 — MAGIC JOURNAL

Build:

Auth
Family creation
Baby profile
Home
Capture
Camera/photo
Write memory
local queue
media optimization
R2 upload
Journal
Memory detail
Edit
Delete

Acceptance:

A real device can create a baby and permanently save/retrieve a photo memory.

---

# 59. MILESTONE 2 — AI JOURNAL

Build:

provider abstraction
AI rewrite
milestone detection
confirmation
cost telemetry
fallbacks

AI failure must not block capture.

---

# 60. MILESTONE 3 — FAMILY

Build:

invitations
roles
permissions
Realtime
reactions
comments
security tests

Test using two independent accounts/devices.

---

# 61. MILESTONE 4 — TRACKER

Build:

feeding
sleep
diaper
growth
Quick Log
Home summaries

Keep UX extremely fast.

---

# 62. MILESTONE 5 — RETENTION

Build:

Daily Story
On This Day
basic notifications
memory reminders
basic search

Avoid guilt-based notifications.

---

# 63. MILESTONE 6 — AI MEMORY

Build:

embeddings
retrieval
natural-language memory search
links to source memories

Ground answers in family data.

---

# 64. MILESTONE 7 — MONTHLY MEMORIES

Build:

automatic selection
monthly story
slideshow
share/export

Validate usage before generative video.

---

# 65. MILESTONE 8 — MONETIZATION

Build:

subscriptions
entitlements
storage quotas
upgrade UX
restore purchase
subscription tests

Never unexpectedly make previously created memories inaccessible.

---

# 66. MILESTONE 9 — YEARLY STORY

Build:

First Year
timeline generation
PDF
export
print-ready structure

---

# 67. MILESTONE 10 — LAUNCH HARDENING

Complete:

E2E
security audit
privacy audit
performance audit
accessibility audit
cost simulation
analytics verification
monitoring
store assets
store metadata
Data Safety draft
closed testing build
release candidate

---

# 68. MILESTONE GATE

For every milestone:

IMPLEMENT

↓

LINT

↓

TYPECHECK

↓

TEST

↓

SECURITY VERIFY

↓

BUILD

↓

DOCUMENT

↓

COMMIT

↓

DEPLOY STAGING IF APPLICABLE

↓

SMOKE TEST

↓

CONTINUE

Do not proceed with a broken milestone.

---

# 69. AUTONOMOUS BUG FIXING

When tests fail:

inspect

diagnose

fix

rerun

Do not immediately ask the human what to do.

Attempt reasonable autonomous remediation first.

If an external dependency is unavailable, document the blocker and continue independent work where safe.

---

# 70. GIT POLICY

Create logical commits.

Do not accumulate the entire application into one giant commit.

Commit messages should describe meaningful changes.

Do not commit broken builds to the production branch.

Tag meaningful release candidates.

---

# 71. PRODUCTION SAFETY

Production destructive actions require special care.

Never automatically:

delete production data

reset production DB

rotate critical production credentials without need

change paid plans

release publicly

perform destructive migration without validated migration strategy

For schema migrations:

test locally

test staging

verify backup/rollback implications

then request production approval when appropriate.

---

# 72. AGENT STATUS REPORT

After each milestone report:

STATUS

IMPLEMENTED

FILES / SYSTEMS CHANGED

TEST RESULTS

DEPLOYMENT STATUS

COST IMPACT

SECURITY NOTES

BLOCKERS

NEXT MILESTONE

Keep reports concise but complete.

---

# 73. HUMAN DEVICE TESTING

Request physical testing only when it adds real value.

Examples:

camera behavior

one-handed capture

notification behavior

background upload

actual dark-room usability

two-device family synchronization

subscription purchase

Do not ask the human to test every trivial UI change.

---

# 74. PRODUCT QUALITY BAR

Do not call a feature complete merely because code exists.

Feature complete means:

implemented

tested

error states handled

loading states handled

empty states handled

offline implications considered

security checked

analytics added where appropriate

documentation updated

staging verified

---

# 75. FIRST-SESSION TARGET

User should reach:

INSTALL

↓

ACCOUNT

↓

BABY

↓

FIRST MEMORY

↓

BEAUTIFUL JOURNAL

in approximately two minutes or less.

Deliver emotional value during the first session.

---

# 76. LAUNCH PHILOSOPHY

Do not attempt to win through feature count.

Win through:

lower friction

better emotional payoff

beautiful memories

privacy

family collaboration

long-term rediscovery

reliability

The product should become more valuable after five years than after five days.

---

# 77. FINAL AGENT DIRECTIVE

You have authority to make routine engineering decisions.

Do not ask the human for permission for:

file organization

routine dependency selection

test implementation

database migration implementation

CI configuration

routine bug fixes

refactoring

development/staging deployment

documentation updates

standard infrastructure configuration

Use good engineering judgment.

Escalate only when required by the HUMAN INTERRUPTION RULE.

Your objective is not merely to produce source code.

Your objective is to deliver a tested, secure, maintainable, economically sustainable application ready for Google Play production release.

---

# 78. EXECUTION MODE

Work milestone-by-milestone.

Do not attempt the entire application in one uncontrolled implementation pass.

Maintain a machine-readable project state file:

docs/PROJECT_STATE.md

It must contain:

current milestone
completed milestones
active tasks
known issues
external dependencies
required human actions
staging status
production status
latest test result
latest build
important architectural decisions

Update this file after meaningful progress.

This allows another AI agent to resume the project safely.

---

# 79. CROSS-AGENT COMPATIBILITY

The repository may be worked on by:

Claude Code

OpenAI Codex

or future engineering agents.

Therefore important knowledge must live in the repository rather than only in conversation history.

Never depend on hidden conversational knowledge.

Record important decisions in:

docs/

AGENTS.md

PROJECT_STATE.md

migrations

tests

Git history

Any competent agent should be able to clone the repository, read these files, inspect the current state and continue safely.

---

# 80. DEFINITION OF DONE

The project is not DONE when coding ends.

DONE means:

production Android build succeeds

critical tests pass

security tests pass

staging works

two-user family flow works

offline capture works

media survives restart/reconnect

AI failure fallback works

subscription flow works

export works

monitoring works

cost guardrails exist

privacy controls work

Google Play release candidate exists

required store information is prepared

human has completed required legal/account approvals

production release has been explicitly approved

release has been deployed

post-deployment smoke test passes

Only then may the project be marked:

PRODUCTION RELEASED.


