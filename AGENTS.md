# AGENTS.md

> Last-Verified: 2026-05-11

Codex agents use this file as the repo entry map, not a complete manual.

`AGENTS.md` is the Codex source of truth. `CLAUDE.md` and `.claude/**` are
legacy provenance only; read them only for migration/debugging history or when
no Codex-native source exists.

## Startup Contract

- Default to 正體中文, keep ordinary replies concise, and answer first.
- Before modifying code, obtain explicit user confirmation.
- Before creating planning, analysis, progress, or review Markdown files, ask:
  long-term repo doc or scratchpad?
- Load only task-relevant context. Do not expand every linked doc at startup.
- Keep `AGENTS.md` as the entry map; open referenced docs only when they match
  the current task.
- Do not revert changes you did not make. Work with existing dirty state.

## Repo Invariants

- Do not make repo-changing edits or commits directly on `main`.
- Use branch/worktree isolation for repo-changing work.
- Main agent coordinates; repo-changing implementation goes Engineer-first.
- Non-read-only repo-changing work needs Reviewer check before completion.
- Fresh verification evidence is required before claiming work is done.
- Default closeout is feature branch push -> PR -> required `ci` and `e2e`
  green -> GitHub merge -> local `main` fast-forward.
- Local `main` merge is only an explicit user-requested fallback.
- Commit messages must not include `Co-Authored-By`.
- Secrets belong in `.env` only; never commit secrets.
- `.env` must remain ignored.

## Context Routing

- Coding/style gates: `.codex/rules/coding-rules.md` and
  `.codex/rules/code-style.md`.
- Tests: `.codex/rules/testing-standards.md`; E2E commands:
  `.codex/rules/e2e-commands.md`.
- Verification sensors and pre-commit expectations: `.codex/rules/sensors.md`.
- Communication details: `.codex/references/communication-style.md`.
- Quality, review, troubleshooting, and closeout:
  `.codex/references/quality-gates.md`,
  `.codex/references/review-standards.md`,
  `.codex/references/troubleshooting.md`,
  `.codex/references/github-closeout.md`.
- Superpowers lifecycle and task routing:
  `docs/superpowers/workflow.md` and `docs/superpowers/task-profiles.md`.
- Durable architecture/workflow decisions: `docs/decisions/INDEX.md`.
- Active feature specs: read only the active `specs/<feature>/` directory.
  Start from `handoff.md`, `tasks.md`, and `status.json` when present; open
  `spec.md` or `plan.md` only for missing scope or acceptance details.
- Historical specs, `project-health/**`, archives, and old handoffs are lookup
  payloads, not startup context.

## Architecture Snapshot

- Stack: Next.js 15 / React 19 App Router, JavaScript with JSDoc
  `checkJs: true`.
- Backend: Firebase v9+ / Firestore. Firebase access goes through canonical
  `src/repo/` and `src/service/` layers; `src/lib/firebase-*` is compatibility
  facade only.
- Tests: Vitest for unit/integration jsdom; Playwright for Chromium E2E.
- Path alias: `@/` -> `./src/`.
- Dependency direction is forward-only:
  Types -> Config -> Repo -> Service -> Runtime -> UI.
- App Router files in `src/app/` stay thin. Render-only screens live in
  `src/ui/`; state/use-cases live in `src/runtime/`.
- Executable tests live under `tests/`; `specs/` is for feature planning
  artifacts only.

## Common Commands

```bash
npm run dev                 # local Next.js dev server
npm run build               # production build
npm run lint:changed        # lint changed files
npm run type-check:changed  # changed-file type-check report
npm run test                # browser/jsdom Vitest
npm run test:server         # server Vitest via Firebase emulators
npm run test:branch         # branch-scoped test gate
npm run test:e2e:branch     # branch-scoped Playwright gate
npm run depcruise           # dependency direction check
```

## Legacy

- `speckit.*` is legacy. Do not use it unless the user explicitly asks.
- Prefer installed Superpowers plugin skills for generic workflow skills; keep
  repo-local `.agents/skills/**` for project-specific workflows and references.
