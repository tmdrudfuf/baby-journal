# Baby Journal — Agent Instructions

Canonical instructions for every engineering agent (Claude Code, Codex, others). `CLAUDE.md` only points here.

## Source of truth

1. `masterplan.md` — product, architecture, milestones, policies.
2. `docs/PROJECT_STATE.md` — current milestone, tasks, blockers, human actions. Update after meaningful progress.
3. `docs/` — architecture, database, security decisions.
4. `supabase/migrations/` and tests — the schema and its guarantees.

Never rely on conversation history. If a decision matters, write it into the repo.

## Working rules

- Work milestone-by-milestone (masterplan §57–§67). Do not proceed past a broken milestone.
- Make the smallest correct change. Match existing style.
- Logical commits; push each finished step to `origin/main` while the project is pre-release.
- Never commit secrets. Only `.env.example` is tracked.
- Interrupt the human only per masterplan §5 (auth, payment, legal, identity, irreversible prod, product decisions, physical device), using the WHY / ACTION / VERIFY / NEXT format.

## Gate (run before every commit)

```
npm run verify
```

Runs lint, typecheck and unit tests. Database/RLS tests run with `npm run db:test` (needs Docker) and always in CI.

## Expo

- Expo SDK changes often: check the `expo` major in `package.json` and read https://docs.expo.dev/versions/v<major>.0.0/ before touching Expo APIs.
- Add packages with `npx expo install <pkg>` (add `-- -D` for dev deps).
- `android/` and `ios/` are generated (CNG). Configure native behaviour via `app.json` / config plugins only.

## Layout

- `src/app/` — Expo Router screens (every file is a route; keep non-route code out)
- `src/components/`, `src/hooks/`, `src/constants/` — UI primitives, hooks, design tokens (`@/` alias = `src/`)
- `tests/unit/` — Jest (jest-expo preset)
- `supabase/` — config, migrations, edge functions, pgTAP tests
- `scripts/` — cross-platform Node scripts (bootstrap, verify)
- `docs/` — project documentation
