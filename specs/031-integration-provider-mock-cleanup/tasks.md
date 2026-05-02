# 031 Integration Provider Mock Cleanup Tasks

## Goal

Remove the remaining integration-test mocks of internal runtime providers so `tests/integration/**` exercises real context/provider wiring instead of replacing repo-owned modules.

Required end-state:

```bash
test "$(grep -rln "vi\.mock(['\"]@/\(repo\|service\|runtime\)/" tests/integration/ --include="*.test.*" | sort -u | wc -l | tr -d ' ')" -eq 0

source specs/031-integration-provider-mock-cleanup/t001-baseline.env
test "$(grep -rln "toHaveBeenCalledTimes\|new Promise.*setTimeout" tests --include="*.test.*" | sort -u | wc -l | tr -d ' ')" -le "$T001_FLAKY_PATTERN_BASELINE"
npm run lint -- --max-warnings 0
```

- First command must exit `0` only when the forbidden internal mock count is `0`.
- Second command must exit `0` only when the flaky-pattern count is not higher than the T001 baseline.
- Lint must pass with zero warnings.

## Non-Goals

- Do not edit production code.
- Do not add files back to ESLint ignores.
- Do not weaken or remove the S8 mock-boundary rule.
- Do not narrow the scope to only flaky cleanup or only one provider.
- Do not replace `@/runtime/providers/AuthProvider` / `ToastProvider` mocks with other `@/repo`, `@/service`, or `@/runtime` mocks.
- Do not mock `useWeatherPageRuntime` or repo modules in weather integration tests.
- Do not weaken delete-race assertions or exact toast message/type assertions.

## Team Roster

| Pair | Engineer | Reviewer | Primary Tasks |
| --- | --- | --- | --- |
| Alpha | Engineer A | Reviewer A | T001, T002, T003, T004 |
| Bravo | Engineer B | Reviewer B | T005, T006a, T006b, T007 |
| Charlie | Engineer C | Reviewer C | T008, T009, T010 |
| Delta | Engineer D | Reviewer D | T011, T012, T013 |
| Echo | Engineer E | Reviewer E | T014, T015, T016, T017 |

The main agent is orchestration-only. It may read reports, run verification, update this file after reviewer approval, commit reviewed work, push, open/merge PR, and sync local `main`. It must not directly implement test/code fixes.

## Execution Rules

- Every implementation task must be done by its assigned Engineer and reviewed by its assigned Reviewer.
- A task checkbox may be changed to `[x]` only after the Reviewer explicitly passes it on the real worktree state.
- If Reviewer rejects, the task stays `[ ]`; send it back to the same Engineer until it passes.
- Do not commit a task that has not passed review.
- Do not commit unrelated files or partial off-scope cleanup.
- Preserve external boundary mocks when valid, such as Firebase SDK, fetch/network, browser APIs, and third-party packages.
- Internal repo mocks in `tests/integration/**` matching `@/repo`, `@/service`, or `@/runtime` are forbidden by final acceptance.
- Prefer real `AuthContext.Provider`, real `ToastContext.Provider` with spy/no-op value, existing real providers where already proven locally, or behavior-level assertions.
- Each Engineer must report changed files, commands run, exit codes, remaining risks, and whether any new `toHaveBeenCalledTimes` / `setTimeout` patterns were introduced.
- Each Reviewer must inspect the diff and run the task verification command, not just read the Engineer report.

## Compaction Survival Note

If the session compacts or a new agent resumes, this file is the execution source of truth. `tasks.md` must be completed. Continue using the team configuration above: each task needs its assigned Engineer plus Reviewer, and the main agent remains orchestration-only. Do not skip reviewer signoff, do not mark checkboxes from Engineer self-report alone, and do not start publish/merge work until all implementation and final-gate tasks are checked.

## Concurrency Plan

- T001 must run first to capture baselines and confirm current offending files.
- T002 must run before domain tasks if it creates or changes shared harness helpers.
- After T002 passes review, T003, T005, T008, T011, and T012 may run in parallel.
- T004 depends on T003 because event delete-race and event comments should share the same event harness pattern.
- T006a and T006b both depend on T005 and may run in parallel after the T005 post harness is reviewed.
- T007 depends on both T006a and T006b because `post-comment-reply` has the widest mock scope and should consume stabilized post harness decisions.
- T009 depends on T008; T010 depends on T009 so the sync-error test consumes the reviewed runs-page auth/toast harness instead of racing a separate harness decision.
- T013 depends on T012; the weather track can run independently of the toast-only T011 track.
- T015 depends on T014.
- T016 depends on T015.
- T017 depends on T016 and must be performed after the final reviewed commit so CI attaches to the exact code SHA.

## Tasks

- [x] T001 - Baseline scan and harness decision record
  - Owner engineer: Engineer A
  - Reviewer: Reviewer A
  - Depends on: none
  - Scope/files: read-only inspection of the 18 target files, existing helpers under `tests/_helpers/**`, local provider usage patterns, and baseline artifact `specs/031-integration-provider-mock-cleanup/t001-baseline.env`.
  - Implementation guidance: record starting counts for the three PR acceptance commands in shell-sourceable form: `T001_FORBIDDEN_MOCK_BASELINE=<count>` and `T001_FLAKY_PATTERN_BASELINE=<count>`. Confirm every target file still has the forbidden provider mock or explain any mismatch. Identify common wrapper needs without editing production/test code.
  - Acceptance criteria: baseline report lists all 18 files, current forbidden mock count, current flaky-pattern count, and proposed helper strategy; `t001-baseline.env` exists with numeric baseline values; no files except this task report/baseline artifact, if any, are changed.
  - Verification command:
    ```bash
    forbidden_count="$(grep -rln "vi\.mock(['\"]@/\(repo\|service\|runtime\)/" tests/integration/ --include="*.test.*" | sort -u | wc -l | tr -d ' ')"
    flaky_count="$(grep -rln "toHaveBeenCalledTimes\|new Promise.*setTimeout" tests --include="*.test.*" | sort -u | wc -l | tr -d ' ')"
    printf 'T001_FORBIDDEN_MOCK_BASELINE=%s\nT001_FLAKY_PATTERN_BASELINE=%s\n' "$forbidden_count" "$flaky_count" > specs/031-integration-provider-mock-cleanup/t001-baseline.env
    test "$forbidden_count" -eq 18
    git status --short
    ```
  - Commit point: no.

- [x] T002 - Shared auth/toast harness helper setup
  - Owner engineer: Engineer A
  - Reviewer: Reviewer A
  - Depends on: T001
  - Scope/files: only `tests/_helpers/**` if a shared helper is justified, otherwise document that each file will use local wrappers.
  - Implementation guidance: create small render/context helpers for `AuthContext.Provider` and `ToastContext.Provider` spy/no-op values only if they reduce duplication. Do not use real `AuthProvider` for weather tests because auth watchers are out of scope. Avoid broad abstractions that hide assertions.
  - Acceptance criteria: helper API is minimal, JSDoc/import style matches repo tests, no internal `@/repo`, `@/service`, or `@/runtime` mock is added, and at least one existing local pattern remains understandable without indirection.
  - Verification command: `npx vitest run tests/integration/events/EventsPage.test.jsx tests/integration/notifications/notification-error.test.jsx`
  - Commit point: yes, after review. Suggested message: `test: add provider harness helpers`.

- [ ] T003 - Events delete-race integration cleanup
  - Owner engineer: Engineer A
  - Reviewer: Reviewer A
  - Depends on: T002
  - Scope/files: `tests/integration/events/EventDetailClient-delete-race.test.jsx`
  - Implementation guidance: remove `@/runtime/providers/AuthProvider` / `ToastProvider` mocks. Use real context/provider harness. Preserve Firestore/fetch external boundary mocks. Do not weaken the race-vs-real-error contract.
  - Acceptance criteria: target file has no `vi.mock('@/runtime/providers/...')`; delete race still asserts the intended failure/race behavior; no new `toHaveBeenCalledTimes` or sleep-based waiting is introduced.
  - Verification command: `npx vitest run tests/integration/events/EventDetailClient-delete-race.test.jsx`
  - Commit point: no; commit with T004.

- [ ] T004 - Events comment runtime cleanup
  - Owner engineer: Engineer A
  - Reviewer: Reviewer A
  - Depends on: T003
  - Scope/files: `tests/integration/events/event-detail-comment-runtime.test.jsx`
  - Implementation guidance: follow the reviewed event harness from T003. Keep user/auth state explicit through context value. Assert behavior rather than provider mock calls.
  - Acceptance criteria: target file has no internal runtime provider mock; comment runtime behavior remains covered; targeted test passes with the event delete-race test.
  - Verification command: `npx vitest run tests/integration/events/EventDetailClient-delete-race.test.jsx tests/integration/events/event-detail-comment-runtime.test.jsx`
  - Commit point: yes, after review. Suggested message: `test: remove event provider mocks`.

- [ ] T005 - Posts detail/feed baseline cleanup
  - Owner engineer: Engineer B
  - Reviewer: Reviewer B
  - Depends on: T002
  - Scope/files: `tests/integration/posts/PostDetail.test.jsx`, `tests/integration/posts/PostFeed.test.jsx`
  - Implementation guidance: use real auth/toast context wrapper. Keep external Firestore/fetch mocks. Replace provider mock expectations with visible UI, data mutation, navigation, or toast behavior assertions.
  - Acceptance criteria: both files contain no forbidden `@/runtime/providers` mock; coverage intent is unchanged; targeted tests pass together.
  - Verification command: `npx vitest run tests/integration/posts/PostDetail.test.jsx tests/integration/posts/PostFeed.test.jsx`
  - Commit point: no; commit with T006a/T006b.

- [ ] T006a - Posts dirty-state cleanup
  - Owner engineer: Engineer B
  - Reviewer: Reviewer B
  - Depends on: T005
  - Scope/files: `tests/integration/posts/post-detail-edit-dirty.test.jsx`, `tests/integration/posts/posts-page-edit-dirty.test.jsx`
  - Implementation guidance: reuse the post harness from T005. Keep dirty-state assertions specific to unsaved edit behavior and navigation/close prevention. Do not collapse dirty-state coverage into weaker smoke tests.
  - Acceptance criteria: both dirty-state files have no forbidden internal runtime provider mock; dirty-state assertions remain specific; no new flaky timing pattern is introduced.
  - Verification command: `npx vitest run tests/integration/posts/post-detail-edit-dirty.test.jsx tests/integration/posts/posts-page-edit-dirty.test.jsx`
  - Commit point: no; commit with T006b.

- [ ] T006b - Posts validation/form cleanup
  - Owner engineer: Engineer B
  - Reviewer: Reviewer B
  - Depends on: T005
  - Scope/files: `tests/integration/posts/post-edit-validation.test.jsx`, `tests/integration/posts/post-form-validation.test.jsx`
  - Implementation guidance: reuse the post harness from T005. Keep validation assertions at behavior level and preserve field/message specificity. Do not replace validation behavior with provider-call expectations.
  - Acceptance criteria: both validation/form files have no forbidden internal runtime provider mock; validation assertions remain specific; no new flaky timing pattern is introduced.
  - Verification command: `npx vitest run tests/integration/posts/post-edit-validation.test.jsx tests/integration/posts/post-form-validation.test.jsx`
  - Commit point: yes, after T006a and T006b both pass review. Suggested message: `test: remove post form provider mocks`.

- [ ] T007 - Posts delete-race and reply cleanup
  - Owner engineer: Engineer B
  - Reviewer: Reviewer B
  - Depends on: T006a, T006b
  - Scope/files: `tests/integration/posts/PostDetailClient-delete-race.test.jsx`, `tests/integration/posts/post-comment-reply.test.jsx`
  - Implementation guidance: handle this last in the posts domain because `post-comment-reply` has the widest mock scope. Preserve delete-race semantics and nested reply behavior. Do not trade provider mocks for runtime/repo/service mocks.
  - Acceptance criteria: both files have no forbidden internal mocks; delete-race contract is still asserted; reply behavior still covers nested comment flow; targeted tests pass together.
  - Verification command: `npx vitest run tests/integration/posts/PostDetailClient-delete-race.test.jsx tests/integration/posts/post-comment-reply.test.jsx`
  - Commit point: yes, after review. Suggested message: `test: remove post race provider mocks`.

- [ ] T008 - Strava auth-context cleanup
  - Owner engineer: Engineer C
  - Reviewer: Reviewer C
  - Depends on: T002
  - Scope/files: `tests/integration/strava/CallbackPage.test.jsx`, `tests/integration/strava/RunCalendarDialog.test.jsx`
  - Implementation guidance: use real `AuthContext.Provider`. Keep only valid third-party package, fetch/network, SDK, or browser-boundary mocks. Do not mock runtime providers and do not introduce any `@/service` mock.
  - Acceptance criteria: both files have no `@/runtime/providers/AuthProvider` mock and no `@/repo`, `@/service`, or `@/runtime` mock; auth state is supplied through context; targeted tests pass.
  - Verification command: `npx vitest run tests/integration/strava/CallbackPage.test.jsx tests/integration/strava/RunCalendarDialog.test.jsx`
  - Commit point: no; commit with T010.

- [ ] T009 - Strava runs page cleanup
  - Owner engineer: Engineer C
  - Reviewer: Reviewer C
  - Depends on: T008
  - Scope/files: `tests/integration/strava/RunsPage.test.jsx`
  - Implementation guidance: use real `AuthContext.Provider` and `ToastContext.Provider` spy. Preserve existing behavior assertions around sync, display, and error handling.
  - Acceptance criteria: file has no forbidden provider mock; toast assertions inspect real context spy behavior; targeted test passes.
  - Verification command: `npx vitest run tests/integration/strava/RunsPage.test.jsx`
  - Commit point: no.

- [ ] T010 - Strava sync-error cleanup
  - Owner engineer: Engineer C
  - Reviewer: Reviewer C
  - Depends on: T009
  - Scope/files: `tests/integration/strava/runs-page-sync-error.test.jsx`
  - Implementation guidance: match T009's auth/toast harness. Keep sync-error behavior and user-facing failure assertion specific.
  - Acceptance criteria: file has no forbidden provider mock; sync error still asserts the intended toast/message path; T008-T010 tests pass together.
  - Verification command: `npx vitest run tests/integration/strava/CallbackPage.test.jsx tests/integration/strava/RunCalendarDialog.test.jsx tests/integration/strava/RunsPage.test.jsx tests/integration/strava/runs-page-sync-error.test.jsx`
  - Commit point: yes, after review. Suggested message: `test: remove strava provider mocks`.

- [ ] T011 - CRUD toast provider cleanup
  - Owner engineer: Engineer D
  - Reviewer: Reviewer D
  - Depends on: T002
  - Scope/files: `tests/integration/toast/crud-toast.test.jsx`
  - Implementation guidance: use `ToastContext.Provider` spy instead of mocking `ToastProvider`. Keep exact toast message/type assertions.
  - Acceptance criteria: file has no forbidden provider mock; exact message/type assertions remain; targeted test passes.
  - Verification command: `npx vitest run tests/integration/toast/crud-toast.test.jsx`
  - Commit point: yes, after review. Suggested message: `test: remove crud toast provider mock`.

- [ ] T012 - Weather favorites cleanup
  - Owner engineer: Engineer D
  - Reviewer: Reviewer D
  - Depends on: T002
  - Scope/files: `tests/integration/weather/favorites.test.jsx`
  - Implementation guidance: do not use real `AuthProvider`. Supply real `AuthContext.Provider` and `ToastContext.Provider` value directly. Preserve exact path-aware Firestore assertions. Do not mock `useWeatherPageRuntime` or repo modules.
  - Acceptance criteria: file has no forbidden internal mock; exact Firestore path assertions remain; targeted test passes.
  - Verification command: `npx vitest run tests/integration/weather/favorites.test.jsx`
  - Commit point: no; commit with T013.

- [ ] T013 - Weather township/page cleanup
  - Owner engineer: Engineer D
  - Reviewer: Reviewer D
  - Depends on: T012
  - Scope/files: `tests/integration/weather/township-drilldown.test.jsx`, `tests/integration/weather/weather-page.test.jsx`
  - Implementation guidance: use direct auth context and no-op toast context. Use existing weather fixtures from `tests/_helpers/use-weather-page-runtime-test-helpers.js` where useful. Do not introduce runtime/repo/service mocks.
  - Acceptance criteria: both files have no forbidden internal mocks; township drilldown and page behavior assertions remain specific; T012-T013 tests pass together.
  - Verification command: `npx vitest run tests/integration/weather/favorites.test.jsx tests/integration/weather/township-drilldown.test.jsx tests/integration/weather/weather-page.test.jsx`
  - Commit point: yes, after review. Suggested message: `test: remove weather provider mocks`.

- [ ] T014 - Domain integration sweep
  - Owner engineer: Engineer E
  - Reviewer: Reviewer E
  - Depends on: T004, T007, T010, T011, T013
  - Scope/files: all 18 target files and any changed `tests/_helpers/**`.
  - Implementation guidance: run domain suites in batches and fix only regressions caused by this cleanup. Do not broaden scope into unrelated flaky rewrites.
  - Acceptance criteria: all 18 target files are free of `vi.mock('@/runtime/providers/AuthProvider')` and `vi.mock('@/runtime/providers/ToastProvider')`; no `@/repo`, `@/service`, or `@/runtime` mocks remain in `tests/integration/**`; domain tests pass or any unrelated pre-existing failure is documented with evidence.
  - Verification command: `npx vitest run tests/integration/events/EventDetailClient-delete-race.test.jsx tests/integration/events/event-detail-comment-runtime.test.jsx tests/integration/posts/PostDetail.test.jsx tests/integration/posts/PostDetailClient-delete-race.test.jsx tests/integration/posts/PostFeed.test.jsx tests/integration/posts/post-comment-reply.test.jsx tests/integration/posts/post-detail-edit-dirty.test.jsx tests/integration/posts/post-edit-validation.test.jsx tests/integration/posts/post-form-validation.test.jsx tests/integration/posts/posts-page-edit-dirty.test.jsx tests/integration/strava/CallbackPage.test.jsx tests/integration/strava/RunCalendarDialog.test.jsx tests/integration/strava/RunsPage.test.jsx tests/integration/strava/runs-page-sync-error.test.jsx tests/integration/toast/crud-toast.test.jsx tests/integration/weather/favorites.test.jsx tests/integration/weather/township-drilldown.test.jsx tests/integration/weather/weather-page.test.jsx`
  - Commit point: no.

- [ ] T015 - Final PR acceptance gates
  - Owner engineer: Engineer E
  - Reviewer: Reviewer E
  - Depends on: T014
  - Scope/files: verification only, plus minimal test/doc fixes if a gate exposes a cleanup-caused issue.
  - Implementation guidance: run the exact PR acceptance commands as failing assertions. Compare flaky-pattern count against `T001_FLAKY_PATTERN_BASELINE` from `specs/031-integration-provider-mock-cleanup/t001-baseline.env`. If lint fails, fix root cause without ignores or rule relaxation.
  - Acceptance criteria: forbidden internal mock assertion exits `0` with count `0`; flaky-pattern assertion exits `0` with count not higher than T001 baseline; `npm run lint -- --max-warnings 0` exits `0`; `git diff --check` exits `0`.
  - Verification command:
    ```bash
    source specs/031-integration-provider-mock-cleanup/t001-baseline.env
    git diff --check
    test "$(grep -rln "vi\.mock(['\"]@/\(repo\|service\|runtime\)/" tests/integration/ --include="*.test.*" | sort -u | wc -l | tr -d ' ')" -eq 0
    test "$(grep -rln "toHaveBeenCalledTimes\|new Promise.*setTimeout" tests --include="*.test.*" | sort -u | wc -l | tr -d ' ')" -le "$T001_FLAKY_PATTERN_BASELINE"
    npm run lint -- --max-warnings 0
    ```
  - Commit point: yes, after review. Suggested message: `test: remove integration provider mocks`.

- [ ] T016 - Branch push and PR open
  - Owner engineer: Engineer E
  - Reviewer: Reviewer E
  - Depends on: T015
  - Scope/files: git/GitHub delivery plus transient PR body artifact `/tmp/dive-into-run-031-pr-body.md`.
  - Implementation guidance: ensure clean worktree after final commit, generate `/tmp/dive-into-run-031-pr-body.md` from the T015 final grep/lint evidence, include the 18-file target list, and note that implementation used Engineer + Reviewer pairing. Then push the current feature branch and open PR using that exact body file.
  - Acceptance criteria: `/tmp/dive-into-run-031-pr-body.md` exists and contains final grep/lint evidence plus the 18-file target list; branch is pushed to origin; PR exists; PR references this cleanup scope; CI has started on the final reviewed commit SHA.
  - Verification command: `test -z "$(git status --short)" && git rev-parse --abbrev-ref HEAD && test -s /tmp/dive-into-run-031-pr-body.md && git push -u origin HEAD && gh pr create --title "test: remove integration provider mocks" --body-file /tmp/dive-into-run-031-pr-body.md`
  - Commit point: no new code commit after CI starts.

- [ ] T017 - CI pass, GitHub merge, and local main sync
  - Owner engineer: Engineer E
  - Reviewer: Reviewer E
  - Depends on: T016
  - Scope/files: GitHub CI/merge and local branch sync only.
  - Implementation guidance: wait for required checks to complete on the PR head SHA. Merge through GitHub after checks pass. Then update local `main` by fast-forwarding the main worktree at `/Users/chentzuyu/Desktop/dive-into-run` to `origin/main`. Do not run `git checkout main` inside this feature linked worktree, and do not push directly to protected `main`.
  - Acceptance criteria: required GitHub checks pass; PR is merged to `main`; remote feature branch is deleted if merge command supports it; `/Users/chentzuyu/Desktop/dive-into-run` is on `main`; local `main` equals `origin/main`; original feature worktree has no uncommitted changes.
  - Verification command: `gh pr checks --watch && gh pr merge --merge --delete-branch && test "$(git -C /Users/chentzuyu/Desktop/dive-into-run rev-parse --abbrev-ref HEAD)" = main && git -C /Users/chentzuyu/Desktop/dive-into-run fetch origin main --prune && git -C /Users/chentzuyu/Desktop/dive-into-run merge --ff-only origin/main && test -z "$(git -C /Users/chentzuyu/Desktop/dive-into-run status --short)" && test -z "$(git status --short)"`
  - Commit point: no.

## Reviewer Rejection Checklist

Reject the task if any item is true:

- The task replaces provider mocks with any `@/repo`, `@/service`, or `@/runtime` mock.
- The task weakens assertions to snapshots or smoke checks without preserving the original behavior contract.
- Delete-race tests no longer prove the race/error behavior they were meant to cover.
- Toast tests no longer verify the exact message/type where they did before.
- Weather tests use real `AuthProvider` and start auth watchers.
- Weather tests mock `useWeatherPageRuntime` or repo modules.
- The diff adds `toHaveBeenCalledTimes` or `new Promise(...setTimeout...)` without an explicit approved reason and unchanged final baseline.
- ESLint ignores, rule config, S8 scope, or grep patterns are relaxed.
- The Engineer report lacks changed files, commands, exit codes, or residual risk.
- The task touches production code or unrelated tests.
