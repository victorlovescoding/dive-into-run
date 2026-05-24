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
- For repo-changing requests such as develop, implement, fix, refactor, test,
  document, 開發, 實作, 修, 修正, 修 bug, 重構, 補測試, 改文件, or
  更新文件, read `docs/superpowers/workflow.md` before planning,
  dispatching, or editing. This detects repo-changing intent only; it is not
  edit authorization, and edits still require explicit confirmation.
- When choosing profile, artifacts, branch/worktree, or authorization boundary,
  read `docs/superpowers/task-profiles.md`.
- Do not revert changes you did not make. Work with existing dirty state.

## Repo Invariants

- Do not make repo-changing edits or commits directly on `main`.
- Use branch/worktree isolation for repo-changing work.
- Main agent coordinates; repo-changing implementation goes Engineer-first.
- Non-read-only repo-changing work needs Reviewer check before completion.
- Fresh verification evidence is required before claiming work is done.
- Default closeout is feature branch push -> PR -> required GitHub checks
  green -> GitHub merge -> local `main` fast-forward.
- Local `main` merge is only an explicit user-requested fallback.
- Commit messages must not include `Co-Authored-By`.
- Secrets belong in `.env` only; never commit secrets.
- `.env` must remain ignored.

## Context Routing

- Coding/style gates: `.codex/rules/coding-rules.md` and
  `.codex/rules/code-style.md`.
- Tests are temporarily removed for the testless reset. Test commands and
  test-related gates are disabled until a replacement suite is introduced.
- Verification sensors and pre-commit expectations: `.codex/rules/sensors.md`.
- Communication details: `.codex/references/communication-style.md`.
- Quality, review, troubleshooting, and closeout:
  `.codex/references/quality-gates.md`,
  `.codex/references/review-standards.md`,
  `.codex/references/troubleshooting.md`,
  `.codex/references/github-closeout.md`.
- Superpowers lifecycle and task routing:
  `docs/superpowers/workflow.md` and `docs/superpowers/task-profiles.md`.
- Subagent staffing, stage leads, role boundaries, and dispatch rules:
  `.codex/references/subagent-roles.md`.
- Durable architecture/workflow decisions: `docs/decisions/INDEX.md`.
- Active feature specs: read only the active `specs/<feature>/` directory.
  Start from `handoff.md`, `tasks.md`, and `status.json` when present; open
  `spec.md` or `plan.md` only for missing scope or acceptance details.
- Legacy Superpowers plugin outputs live under `specs/_legacy/superpowers/**`
  and are lookup/provenance only. They are not active workflow state or resume
  entrypoints.
- Historical specs, `project-health/**`, archives, and old handoffs are lookup
  payloads, not startup context.

## Architecture Snapshot

- Stack: Next.js 15 / React 19 App Router, JavaScript with JSDoc
  `checkJs: true`.
- Backend: Firebase v9+ / Firestore. Firebase access goes through canonical
  `src/repo/` and `src/service/` layers; `src/lib/firebase-*` is compatibility
  facade only.
- Tests: temporarily removed for the testless reset.
- Path alias: `@/` -> `./src/`.
- Dependency direction is forward-only:
  Types -> Config -> Repo -> Service -> Runtime -> UI.
- App Router files in `src/app/` stay thin. Render-only screens live in
  `src/ui/`; state/use-cases live in `src/runtime/`.
- No executable test tree is present during the testless reset; `specs/` remains
  for feature planning artifacts only.

## Agent Workflow Boundaries

- Superpowers lifecycle and task profile details live in
  `docs/superpowers/workflow.md` and `docs/superpowers/task-profiles.md`; this
  file is only the entry map.
- Main agent is control plane only. It may read `AGENTS.md`,
  `docs/superpowers/workflow.md`, active `handoff.md/tasks.md/status.json`,
  `git status --short --branch`, task-local diffs or changed-file lists, and
  exact Engineer/Reviewer evidence lines.
- Main agent must not do broad source exploration, design fixes from its own
  code investigation, or replace Engineer/Reviewer with self-review.
- Repo-changing implementation goes Engineer-first. Docs-only, workflow docs,
  ADRs, `.codex/**`, scripts, and config changes are still repo-changing work:
  default Engineer-owned edit plus Reviewer check.
- The only main-agent edit exception is workflow state updates that record
  dispatch, review result, blocker, or closeout evidence.
- Pure exploration, research, investigation, audit, or analysis without
  immediate edits goes to a bounded read-only Explorer subagent. Dispatch must
  include the specific question, allowed context, forbidden writes, and required
  file/line/command/uncertainty evidence.
- If `tasks.md`, `status.json`, or `handoff.md` drift, do not dispatch, commit,
  push, open PRs, merge, or sync local `main`; reconcile first or block.
- Fresh verification evidence is one command per evidence item. Do not record
  `&&` or `;` chains as a single verification result.
- Main agent closeout may stage, commit, push, open PRs, watch CI, and sync
  `main` only after reviewed diff and when the user's authorization boundary
  explicitly includes each specific step. Start or edit authorization does not
  imply commit, push, PR, merge, CI watch, or local sync authorization. Staging
  must list concrete files; do not use `git add .`, `git add -A`, or
  `git add --all`.

## Common Commands

```bash
npm run dev                 # local Next.js dev server
npm run build               # production build
npm run lint:changed        # lint changed files
npm run type-check:changed  # changed-file type-check report
npm run test                # disabled during testless reset
npm run test:server         # disabled during testless reset
npm run test:branch         # disabled during testless reset
npm run test:e2e:branch     # disabled during testless reset
npm run depcruise           # dependency direction check
```

## Legacy

- `speckit.*` is legacy. Do not use it unless the user explicitly asks.
- docs/superpowers/specs/ and docs/superpowers/plans/ were old
  Superpowers plugin default paths and are no longer used. If a plugin skill
  names those paths as defaults, repo policy overrides the plugin default.
- Add durable workflow state according to `docs/superpowers/task-profiles.md`.
  P4 uses `specs/<feature>/`; P1/P2 default to no `specs/` artifacts; P3 uses
  compact artifacts only for cross-session, multi-task, or dispatcher
  continuity needs.
- Prefer installed Superpowers plugin skills for generic workflow skills; keep
  repo-local `.agents/skills/**` for project-specific workflows and references.
