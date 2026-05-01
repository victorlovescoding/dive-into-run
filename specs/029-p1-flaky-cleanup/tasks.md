# P1-4 / P1-5 Flaky Cleanup Tasks

**Scope**: `2026-04-29-tests-audit-report.md` P1-4 / P1-5 only.
**Out of scope**: P1-1 runtime hook coverage, P1-2 auth-service coverage, P1-3 Strava OAuth callback coverage, P0/P2/P3 items, production behavior changes.
**Mode**: main agent orchestrates only. All implementation must be delegated to Engineer subagents and independently reviewed by Reviewer subagents.

## Source Findings

Audit report findings to preserve:

- P1-4: 109 occurrences of `toHaveBeenCalledTimes(N)` under `tests/**`, identified as flaky risk because exact call-count assertions couple the test to async timing.
- P1-4 recommended replacements: `toHaveBeenCalled()`, `toHaveBeenLastCalledWith(...)`, `toHaveBeenNthCalledWith(n, ...)`, or user-visible behavior assertions when those express the contract better.
- P1-5: hard-coded async wait in `tests/unit/runtime/useStravaConnection.test.jsx:75-96` using `await new Promise(r => setTimeout(r, 10))` with `act()`.
- P1-5 recommended replacements: `waitFor(() => expect(...))`, `findBy*`, or fake timers via `vi.useFakeTimers()` + `vi.runAllTimersAsync()` when timer behavior is the contract.

Planning-time verification on this worktree (`029-p1-flaky-cleanup`) shows drift from the audit base:

- `rg -n "toHaveBeenCalledTimes" tests --glob "*.test.*" --glob "*.spec.*" | wc -l` currently reports `80`, not `109`.
- `rg -n "new Promise.*setTimeout|setTimeout.*Promise" tests --glob "*.test.*" --glob "*.spec.*"` currently reports no executable hard-wait matches.
- `rg -n "setTimeout|waitForTimeout" tests --glob "*.test.*" --glob "*.spec.*"` currently only finds E2E file comments warning against `page.waitForTimeout()`.
- This does not redefine the audit finding; it means P1-1/P1-2/P1-3 or other already-present changes may have reduced the current baseline. Every execution task must regenerate the current baseline before editing.

## Baseline Commands

Run these before any implementation task:

```bash
rg -n "toHaveBeenCalledTimes" tests --glob "*.test.*" --glob "*.spec.*"
rg -n "toHaveBeenCalledTimes" tests --glob "*.test.*" --glob "*.spec.*" | cut -d: -f1 | sort | uniq -c
rg -n "new Promise.*setTimeout|setTimeout.*Promise|page\\.waitForTimeout\\(" tests --glob "*.test.*" --glob "*.spec.*"
```

Expected target at the end:

```bash
rg -n "toHaveBeenCalledTimes" tests --glob "*.test.*" --glob "*.spec.*"
# expected: no output

rg -n "new Promise.*setTimeout|setTimeout.*Promise|page\\.waitForTimeout\\(" tests --glob "*.test.*" --glob "*.spec.*"
# expected: no executable matches; comments documenting forbidden patterns are allowed only if explicitly reviewed
```

## Orchestration Protocol

- Main agent must not implement flaky cleanup. Main agent only assigns tasks, collects reports, updates orchestration state, pushes branch, opens PR, watches CI, and merges after requirements pass.
- A task can move from `[ ]` to `[x]` only after: Engineer completes implementation, Engineer reports changed files and verification output, Reviewer independently inspects the diff, Reviewer runs or validates the task verification, and Reviewer explicitly says pass.
- If Reviewer rejects, the task returns to Engineer. Do not mark `[x]`; do not batch-review unresolved comments.
- Engineer and Reviewer must not edit the same task row concurrently. Reviewer may propose changes but Engineer applies the fix unless the main agent explicitly reassigns.
- Each task must keep scope to its listed target files or discovery method. If discovery finds extra files, create or update a task before editing them.
- No production code changes for this cleanup unless a Reviewer proves a test-only fix is impossible and the user explicitly approves scope expansion.

## Team Allocation Matrix

| Team | Engineer | Reviewer | Primary tasks | Parallelism |
| --- | --- | --- | --- | --- |
| Team A | Team A Engineer | Team A Reviewer | T001, T011, T012 | T001 first; T011/T012 last |
| Team B | Team B Engineer | Team B Reviewer | T002, T003 | T002 after T001; T003 parallel after T001 |
| Team C | Team C Engineer | Team C Reviewer | T004 | Parallel after T001 |
| Team D | Team D Engineer | Team D Reviewer | T005 | Parallel after T001 |
| Team E | Team E Engineer | Team E Reviewer | T006 | Parallel after T001 |
| Team F | Team F Engineer | Team F Reviewer | T007 | Parallel after T001 |
| Team G | Team G Engineer | Team G Reviewer | T008 | Parallel after T001 |
| Team H | Team H Engineer | Team H Reviewer | T009 | Parallel after T001 |
| Team I | Team I Engineer | Team I Reviewer | T010 | After T002-T009 |

Maximum parallel plan:

- Wave 0 serial: T001.
- Wave 1 parallel: T002 through T009, because target files do not overlap by task design.
- Wave 2 serial-ish: T010 after all cleanup tasks, because prevention rules need the final baseline.
- Wave 3 serial: T011 docs/status reconciliation, then T012 PR/CI/merge flow.

## Tasks

### T001. Baseline and Scope Lock

- [x] **Owner team**: Team A Engineer / Team A Reviewer
- **Scope / discovery method**: Regenerate P1-4/P1-5 baseline from current worktree using the Baseline Commands. Record file counts grouped by `tests/integration`, `tests/unit/repo`, `tests/unit/lib`, `tests/unit/runtime`, `tests/e2e`, and any other discovered area.
- **Dependencies**: None.
- **Can run in parallel with**: None. This must finish before implementation tasks.
- **Acceptance criteria**: Current baseline list is captured in the Engineer report; report explicitly compares current count to audit count `109`; any P1-5 executable hard waits are listed with file:line; report states P1-1/P1-2/P1-3 are background only and not part of this scope.
- **Verification commands**:
  ```bash
  rg -n "toHaveBeenCalledTimes" tests --glob "*.test.*" --glob "*.spec.*" | wc -l
  rg -n "toHaveBeenCalledTimes" tests --glob "*.test.*" --glob "*.spec.*" | cut -d: -f1 | sort | uniq -c
  rg -n "new Promise.*setTimeout|setTimeout.*Promise|page\\.waitForTimeout\\(" tests --glob "*.test.*" --glob "*.spec.*"
  ```
- **Commit boundary**: No implementation commit. If a baseline manifest file is created later by explicit user approval, commit alone as `docs(test): record flaky cleanup baseline`.

### T002. P1-5 Hard Wait Cleanup

- [x] **Owner team**: Team B Engineer / Team B Reviewer
- **Scope / target files**: Any executable matches from `rg -n "new Promise.*setTimeout|setTimeout.*Promise|page\\.waitForTimeout\\(" tests --glob "*.test.*" --glob "*.spec.*"`. Audit specifically named `tests/unit/runtime/useStravaConnection.test.jsx`.
- **Dependencies**: T001.
- **Can run in parallel with**: T003-T009 if target files do not overlap.
- **Acceptance criteria**: No executable fixed sleep remains in tests; replacements wait on observable behavior (`waitFor`, `findBy*`, Playwright auto-wait) or use fake timers only when timer behavior is the unit under test; comments documenting forbidden patterns are not changed unless they are misleading. If T001 confirms there are no executable matches and only E2E prohibition comments remain, Reviewer may pass this as a no-op task with the grep output attached.
- **Verification commands**:
  ```bash
  rg -n "new Promise.*setTimeout|setTimeout.*Promise|page\\.waitForTimeout\\(" tests --glob "*.test.*" --glob "*.spec.*"
  npx vitest run tests/unit/runtime/useStravaConnection.test.jsx
  npm run lint:changed
  npm run type-check:changed
  ```
- **Commit boundary**: Commit after Reviewer pass if code changed. Suggested message: `test: remove fixed sleeps from flaky specs`.

### T003. Integration Interaction Call Count Cleanup

- [x] **Owner team**: Team B Engineer / Team B Reviewer
- **Scope / target files**: `tests/integration/**` occurrences of `toHaveBeenCalledTimes`, especially current planning-time files:
  `tests/integration/dashboard/useDashboardTab.test.jsx`,
  `tests/integration/events/EventActionButtons.test.jsx`,
  `tests/integration/events/EventCardMenu.test.jsx`,
  `tests/integration/events/EventDeleteConfirm.test.jsx`,
  `tests/integration/events/EventEditForm.test.jsx`,
  `tests/integration/events/ShareButton.test.jsx`,
  `tests/integration/posts/ComposeModal.test.jsx`,
  `tests/integration/strava/RunsActivityList.test.jsx`,
  `tests/integration/strava/useStravaSync.test.jsx`,
  `tests/integration/toast/toast-container.test.jsx`,
  `tests/integration/toast/toast-ui.test.jsx`.
- **Dependencies**: T001.
- **Can run in parallel with**: T002, T004-T009.
- **Acceptance criteria**: Integration tests assert user-visible results or meaningful callback payloads instead of exact call counts; `userEvent` remains the interaction driver; no new `fireEvent`; no exact call-count assertion remains in `tests/integration/**`.
- **Verification commands**:
  ```bash
  rg -n "toHaveBeenCalledTimes" tests/integration --glob "*.test.*" --glob "*.spec.*"
  npx vitest run tests/integration/dashboard/useDashboardTab.test.jsx tests/integration/events/EventActionButtons.test.jsx tests/integration/events/EventCardMenu.test.jsx tests/integration/events/EventDeleteConfirm.test.jsx tests/integration/events/EventEditForm.test.jsx tests/integration/events/ShareButton.test.jsx tests/integration/posts/ComposeModal.test.jsx tests/integration/strava/RunsActivityList.test.jsx tests/integration/strava/useStravaSync.test.jsx tests/integration/toast/toast-container.test.jsx tests/integration/toast/toast-ui.test.jsx
  npm run lint:changed
  npm run type-check:changed
  ```
- **Commit boundary**: Commit after Reviewer pass. Suggested message: `test: stabilize integration callback assertions`.

### T004. Repo Layer Call Count Cleanup

- [x] **Owner team**: Team C Engineer / Team C Reviewer
- **Scope / target files**: `tests/unit/repo/**` occurrences, currently:
  `tests/unit/repo/firebase-users.test.js`,
  `tests/unit/repo/firebase-weather-favorites.test.js`.
- **Dependencies**: T001.
- **Can run in parallel with**: T002, T003, T005-T009.
- **Acceptance criteria**: Tests verify Firestore path, payload, query constraints, or return behavior instead of brittle exact call counts; exact counts are retained only if Reviewer agrees the count is the contract and the assertion is not timing-sensitive.
- **Verification commands**:
  ```bash
  rg -n "toHaveBeenCalledTimes" tests/unit/repo --glob "*.test.*" --glob "*.spec.*"
  npx vitest run tests/unit/repo/firebase-users.test.js tests/unit/repo/firebase-weather-favorites.test.js
  npm run lint:changed
  npm run type-check:changed
  ```
- **Commit boundary**: Commit after Reviewer pass. Suggested message: `test: stabilize repo call assertions`.

### T005. Posts and Comments Lib Cleanup

- [x] **Owner team**: Team D Engineer / Team D Reviewer
- **Scope / target files**:
  `tests/unit/lib/create-post-validation.test.js`,
  `tests/unit/lib/deletePost.test.js`,
  `tests/unit/lib/firebase-comments.test.js`,
  `tests/unit/lib/firebase-posts-comments-likes.test.js`,
  `tests/unit/lib/firebase-posts-crud.test.js`.
- **Dependencies**: T001.
- **Can run in parallel with**: T002-T004, T006-T009.
- **Acceptance criteria**: CRUD/batch/transaction tests assert exact document refs, mutation payloads, transaction effects, or final behavior; exact batch operation counts are replaced unless the count is the domain contract and Reviewer approves keeping it with rationale in the task report.
- **Verification commands**:
  ```bash
  rg -n "toHaveBeenCalledTimes" tests/unit/lib/create-post-validation.test.js tests/unit/lib/deletePost.test.js tests/unit/lib/firebase-comments.test.js tests/unit/lib/firebase-posts-comments-likes.test.js tests/unit/lib/firebase-posts-crud.test.js
  npx vitest run tests/unit/lib/create-post-validation.test.js tests/unit/lib/deletePost.test.js tests/unit/lib/firebase-comments.test.js tests/unit/lib/firebase-posts-comments-likes.test.js tests/unit/lib/firebase-posts-crud.test.js
  npm run lint:changed
  npm run type-check:changed
  ```
- **Commit boundary**: Commit after Reviewer pass. Suggested message: `test: stabilize post and comment lib assertions`.

### T006. Events and Member Lib Cleanup

- [x] **Owner team**: Team E Engineer / Team E Reviewer
- **Scope / target files**:
  `tests/unit/lib/firebase-events-002-jsdoc.test.js`,
  `tests/unit/lib/firebase-events.test.js`,
  `tests/unit/lib/firebase-events-edit-delete.test.js`,
  `tests/unit/lib/firebase-member.test.js`.
- **Dependencies**: T001.
- **Can run in parallel with**: T002-T005, T007-T009.
- **Acceptance criteria**: Event/member tests assert the intended query/update/delete behavior; cascade-delete tests may assert count only when count is the tested business contract, with Reviewer-approved rationale.
- **Verification commands**:
  ```bash
  rg -n "toHaveBeenCalledTimes" tests/unit/lib/firebase-events-002-jsdoc.test.js tests/unit/lib/firebase-events.test.js tests/unit/lib/firebase-events-edit-delete.test.js tests/unit/lib/firebase-member.test.js
  npx vitest run tests/unit/lib/firebase-events-002-jsdoc.test.js tests/unit/lib/firebase-events.test.js tests/unit/lib/firebase-events-edit-delete.test.js tests/unit/lib/firebase-member.test.js
  npm run lint:changed
  npm run type-check:changed
  ```
- **Commit boundary**: Commit after Reviewer pass. Suggested message: `test: stabilize event and member lib assertions`.

### T007. Notification Lib Cleanup

- [x] **Owner team**: Team F Engineer / Team F Reviewer
- **Scope / target files**:
  `tests/unit/lib/firebase-notifications-read.test.js`,
  `tests/unit/lib/firebase-notifications-write.test.js`,
  `tests/unit/lib/notify-event-new-comment.test.js`,
  `tests/unit/lib/notify-post-comment-reply.test.js`.
- **Dependencies**: T001.
- **Can run in parallel with**: T002-T006, T008-T009.
- **Acceptance criteria**: Notification tests assert recipient filtering, payload shape, notification content, or final side effects instead of exact call counts; large fan-out tests verify representative payloads plus length only if fan-out count is the actual contract.
- **Verification commands**:
  ```bash
  rg -n "toHaveBeenCalledTimes" tests/unit/lib/firebase-notifications-read.test.js tests/unit/lib/firebase-notifications-write.test.js tests/unit/lib/notify-event-new-comment.test.js tests/unit/lib/notify-post-comment-reply.test.js
  npx vitest run tests/unit/lib/firebase-notifications-read.test.js tests/unit/lib/firebase-notifications-write.test.js tests/unit/lib/notify-event-new-comment.test.js tests/unit/lib/notify-post-comment-reply.test.js
  npm run lint:changed
  npm run type-check:changed
  ```
- **Commit boundary**: Commit after Reviewer pass. Suggested message: `test: stabilize notification lib assertions`.

### T008. Runtime Strava Sync Cleanup

- [x] **Owner team**: Team G Engineer / Team G Reviewer
- **Scope / target files**: `tests/unit/runtime/sync-strava-activities.test.js` and any other `tests/unit/runtime/**` exact call-count occurrences found by T001.
- **Dependencies**: T001.
- **Can run in parallel with**: T002-T007, T009.
- **Acceptance criteria**: Runtime sync tests assert fetch endpoint/payload, batch write/update payloads, persisted activity state, or observable return value; exact counts are replaced unless they encode a required batching contract and Reviewer approves.
- **Verification commands**:
  ```bash
  rg -n "toHaveBeenCalledTimes" tests/unit/runtime --glob "*.test.*" --glob "*.spec.*"
  npx vitest run tests/unit/runtime/sync-strava-activities.test.js
  npm run lint:changed
  npm run type-check:changed
  ```
- **Commit boundary**: Commit after Reviewer pass. Suggested message: `test: stabilize Strava sync call assertions`.

### T009. Profile Lib Cleanup

- [x] **Owner team**: Team H Engineer / Team H Reviewer
- **Scope / target files**: `tests/unit/lib/firebase-profile.test.js`, which currently has 3 `toHaveBeenCalledTimes` occurrences.
- **Dependencies**: T001.
- **Can run in parallel with**: T002-T008.
- **Acceptance criteria**: Profile persistence tests assert the intended profile document path, merge option, payload shape, or returned behavior instead of exact call counts; no `toHaveBeenCalledTimes` remains in `tests/unit/lib/firebase-profile.test.js` unless Reviewer explicitly approves a retained count as a real contract with rationale in the task report.
- **Verification commands**:
  ```bash
  rg -n "toHaveBeenCalledTimes" tests/unit/lib/firebase-profile.test.js
  npx vitest run tests/unit/lib/firebase-profile.test.js
  npm run lint:changed
  npm run type-check:changed
  ```
- **Commit boundary**: Commit after Reviewer pass. Suggested message: `test: stabilize profile lib assertions`.

### T010. Flaky Pattern Prevention Gate

- [x] **Owner team**: Team I Engineer / Team I Reviewer
- **Scope / discovery method**: After T002-T009 are clean, add or update the smallest existing prevention surface so new `toHaveBeenCalledTimes` and executable fixed sleeps are blocked or at least surfaced in CI/pre-commit. Prefer existing ESLint/script patterns from the repo; do not introduce a new framework without approval.
- **Dependencies**: T002-T009.
- **Can run in parallel with**: None if it touches shared config.
- **Acceptance criteria**: New flaky patterns are caught by an automated check; existing comments documenting forbidden patterns do not cause false positives; check has a smoke test or documented manual probe in the Engineer report; no broad baseline ignore is introduced after old cleanup reaches zero.
- **Verification commands**:
  ```bash
  npm run lint:changed
  npm run type-check:changed
  npm run test:branch
  ```
- **Commit boundary**: Commit after Reviewer pass. Suggested message: `chore(test): block flaky wait assertions`.

### T011. Final Branch Verification and Task Reconciliation

- [x] **Owner team**: Team A Engineer / Team A Reviewer
- **Scope / discovery method**: Verify branch-wide state after all cleanup commits. Update this `tasks.md` checkbox state only for tasks with Reviewer pass. Do not edit unrelated docs unless explicitly assigned.
- **Dependencies**: T002-T010.
- **Can run in parallel with**: None.
- **Acceptance criteria**: P1-4/P1-5 grep targets are zero or documented with Reviewer-approved exceptions; all target tests pass; branch-level checks pass; `tasks.md` reflects only reviewed work as `[x]`.
- **Verification commands**:
  ```bash
  rg -n "toHaveBeenCalledTimes" tests --glob "*.test.*" --glob "*.spec.*"
  rg -n "new Promise.*setTimeout|setTimeout.*Promise|page\\.waitForTimeout\\(" tests --glob "*.test.*" --glob "*.spec.*"
  npm run lint:changed
  npm run type-check:changed
  npm run test:branch
  npm run test:e2e:branch
  ```
- **Commit boundary**: Commit after Reviewer pass if only task state/docs changed. Suggested message: `docs(test): mark flaky cleanup tasks reviewed`.

### T012. Push, PR, CI, Merge Main

- [ ] **Owner team**: Team A Engineer / Team A Reviewer
- **Scope / discovery method**: Main-agent orchestration only after all implementation tasks are reviewed and committed.
- **Dependencies**: T011.
- **Can run in parallel with**: None.
- **Acceptance criteria**: Branch pushed; PR opened against `main`; GitHub required checks pass (`ci` and `e2e`, plus any repo-required checks visible at PR time); code review gate passed; PR merged to `main`; local main updated; feature branch/worktree follow-up recorded.
- **Verification commands**:
  ```bash
  git status --short --branch
  git log --oneline --decorate -10
  gh pr status
  ```
- **Commit boundary**: No new code commit. PR title suggestion: `test: clean up flaky wait assertions`.

## Commit Checkpoints

| Checkpoint | Tasks | Suggested message | Scope |
| --- | --- | --- | --- |
| C1 | T002 | `test: remove fixed sleeps from flaky specs` | Hard waits only |
| C2 | T003 | `test: stabilize integration callback assertions` | `tests/integration/**` only |
| C3 | T004 | `test: stabilize repo call assertions` | `tests/unit/repo/**` only |
| C4 | T005 | `test: stabilize post and comment lib assertions` | post/comment lib tests only |
| C5 | T006 | `test: stabilize event and member lib assertions` | event/member lib tests only |
| C6 | T007 | `test: stabilize notification lib assertions` | notification lib tests only |
| C7 | T008 | `test: stabilize Strava sync call assertions` | runtime sync tests only |
| C8 | T009 | `test: stabilize profile lib assertions` | profile lib tests only |
| C9 | T010 | `chore(test): block flaky wait assertions` | prevention gate only |
| C10 | T011 | `docs(test): mark flaky cleanup tasks reviewed` | task status/docs only |

## Compact / Resume Guard

If the main agent context is compacted or a new session resumes this work, preserve these facts:

- `specs/029-p1-flaky-cleanup/tasks.md` must be completed; this file is the live tracker.
- Open subagents according to the Team Allocation Matrix; main agent is orchestration only.
- Every task requires Engineer completion, Reviewer pass, then and only then checkbox `[x]`.
- P1-4/P1-5 scope is old flaky cleanup from `2026-04-29-tests-audit-report.md`: `toHaveBeenCalledTimes(N)` and hard-coded sleep waits.
- P1-1/P1-2/P1-3 are background/prior work, not this scope.
- Final flow is push branch, open PR, wait for GitHub CI required checks, pass review gate, merge PR into `main`, then update local main/worktrees as needed.

## PR Completion Flow

1. Confirm `git status --short --branch` has only intended files.
2. Confirm all tasks T001-T011 are `[x]` with Reviewer pass evidence.
3. Push the current branch with `git push -u origin HEAD`.
4. Open a PR against `main` with a body listing P1-4/P1-5 baseline before/after and verification commands.
5. Wait for required GitHub checks to pass. At minimum expect `ci` and `e2e` unless branch protection has changed.
6. Run or request final code review gate.
7. Merge PR into `main` only after checks and review gate pass.
8. Update local `main` and rebase active worktrees if needed.
