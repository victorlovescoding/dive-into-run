# 033 S9 Coverage Gap Tasks

## Source Of Truth

- This file is the only compact-safe source of truth for `033-s9-coverage-gap`.
- Main agent role: process coordinator only. It may read, dispatch, verify evidence, and report status.
- All repo writes must be done by task subagents.
- Every implementation task must run as an Engineer + Reviewer pair.
- A checkbox may become `[x]` only after the Reviewer has inspected the task-local diff and accepted the evidence.
- Do not start a later task until all listed dependencies are satisfied.
- Parallel tasks are allowed only where this file explicitly marks them as parallel-safe.

## Scope

### Goal

Close Session 9 coverage gaps with fresh coverage evidence from this worktree.

Fresh coverage summary requirement:

- Recompute all 8 tracked source groups from `coverage/coverage-summary.json`:
  - `src/types/**`
  - `src/config/**`
  - `src/repo/**`
  - `src/service/**`
  - `src/runtime/**`
  - `src/ui/**`
  - `src/components/**`
  - `src/app/**`

Required fresh layer targets:

- `src/ui/** >= 94.43`
- `src/components/** >= 91.64`
- `src/app/** >= 95.07`

The targets must be computed from a fresh `coverage/coverage-summary.json`, not copied from old reports.

### Allowed To Change

- `tests/**`
- `tests/_helpers/**`
- `specs/033-s9-coverage-gap/tasks.md`
- `specs/033-s9-coverage-gap/handoff.md`
- Production code only when needed for testability, only after the Engineer explains why tests cannot cover the behavior otherwise, and only after the paired Reviewer agrees before the edit.

### Forbidden To Change

- `vitest.config.mjs` coverage thresholds
- `docs/QUALITY_SCORE.md`
- `specs/026-tests-audit-report/tasks.md`
- `specs/026-tests-audit-report/handoff.md`
- `.github/pull_request_template.md`
- Coverage policy
- Any coverage include/exclude reduction
- Any threshold reduction
- Any baseline-ignore or suppression mechanism
- Production behavior changes for the sake of making tests easier

### Test Quality Rules

- Add true behavior tests.
- Do not add snapshot-only, import-only, render-only, or empty tests.
- Do not mock this repo's own canonical layers:
  - `@/repo`
  - `@/service`
  - `@/runtime`
  - `@/ui`
  - `@/components`
  - `@/app`
- Avoid anti-patterns such as:
  - `vi.mock('@/repo...')`
  - `vi.mock('@/service...')`
  - `vi.mock('@/runtime...')`
- External services, browser APIs, Firebase SDK boundaries, timers, network, and map libraries may be mocked only when the test still verifies real user-visible behavior or real integration behavior through the canonical production surface.
- Prefer user-event driven assertions, visible output, state transitions, emitted calls at external boundaries, and regression-specific assertions.

## Required Gates

Run these before delivery:

- `npm run test:coverage`
- `npm run lint -- --max-warnings 0`
- `npm run type-check`
- `npm run depcruise`
- `npm run spellcheck`
- `npx vitest run --project=browser`
- `bash scripts/audit-mock-boundary.sh`
- `bash scripts/audit-flaky-patterns.sh`

PR/handoff must record:

- Before coverage for `src/ui/**`, `src/components/**`, `src/app/**`
- After coverage for `src/ui/**`, `src/components/**`, `src/app/**`
- Touched test files
- Production files touched and why
- Remaining risk

## Coverage Recalculation Protocol

Use this logic after each `npm run test:coverage` run:

1. Read `coverage/coverage-summary.json`.
2. Recalculate coverage for all 8 tracked source groups:
   - `src/types/**`
   - `src/config/**`
   - `src/repo/**`
   - `src/service/**`
   - `src/runtime/**`
   - `src/ui/**`
   - `src/components/**`
   - `src/app/**`
3. Use statement coverage unless the repo already has a documented per-layer metric in the fresh summary script.
4. Record the command, timestamp, and computed before/after values in `handoff.md`.
5. Do not accept hand-copied numbers from old reports.

## Commit Plan

- Commit after T005 if baseline docs are reviewed and no test implementation has started.
- Commit after each accepted implementation slice that adds meaningful coverage and passes its focused verification.
- Do not make checkbox-only commits after CI has passed.
- Delivery, PR, CI, and merge state are evidence-only gates unless a real code/doc change is required before CI starts.

## Task Graph

Legend:

- Engineer: writes or updates files.
- Reviewer: reads the task-local diff, checks evidence, and either accepts or returns with concrete fixes.
- Parallel-safe means tasks may run at the same time after their shared dependencies are complete.

### Setup And Baseline

- [x] T001 Verify worktree bootstrapping
  - Owner: Setup Engineer
  - Reviewer: Setup Reviewer
  - Dependencies: none
  - Parallel-safe: no
  - Steps:
    - Confirm branch is `033-s9-coverage-gap`.
    - Confirm worktree path is `/Users/chentzuyu/Desktop/dive-into-run-033-s9-coverage-gap`.
    - Confirm base commit is current `main`.
    - Confirm `specs/033-s9-coverage-gap/tasks.md` and `handoff.md` exist.
    - Confirm forbidden 026 files are untouched.
  - Acceptance:
    - `git status --short --branch` shows only intended planning docs if uncommitted.
    - `git diff --name-only` does not include forbidden files.
    - Reviewer signs off in `handoff.md`.

- [x] T002 Run fresh coverage baseline
  - Owner: Baseline Engineer
  - Reviewer: Baseline Reviewer
  - Dependencies: T001
  - Parallel-safe: no
  - Steps:
    - Run `npm run test:coverage`.
    - Do not edit tests while collecting baseline.
    - Preserve `coverage/coverage-summary.json` as generated output only.
    - Recalculate all 8 tracked source groups.
    - Record command result, timestamp, raw summary location, and computed layer numbers in `handoff.md`.
  - Acceptance:
    - Baseline numbers come from the fresh generated `coverage/coverage-summary.json`.
    - `handoff.md` has `Coverage Baseline` filled.
    - Reviewer confirms no old report numbers were copied.

- [x] T003 Identify coverage gaps by file
  - Owner: Analysis Engineer
  - Reviewer: Analysis Reviewer
  - Dependencies: T002
  - Parallel-safe: no
  - Steps:
    - List lowest uncovered files under `src/ui/**`, `src/components/**`, and `src/app/**`.
    - Group candidates by domain and test surface.
    - Mark whether each candidate already has nearby tests.
    - Reject candidates that would require forbidden policy or threshold edits.
  - Acceptance:
    - `handoff.md` lists candidate files and rationale.
    - Each candidate includes expected test type: unit, integration, or app thin-entry behavior.
    - Reviewer confirms candidates are behavior-testable without mocking canonical layers.

- [x] T004 Slice work into independent implementation tracks
  - Owner: Planning Engineer
  - Reviewer: Planning Reviewer
  - Dependencies: T003
  - Parallel-safe: no
  - Steps:
    - Convert candidate files into small implementation slices.
    - Ensure each slice can be reviewed independently.
    - Mark conflicts where two slices would touch the same test helper or same test file.
    - Update the Parallel Execution Plan below if live baseline shows different gaps.
  - Acceptance:
    - No slice is a large bucket such as "improve UI coverage".
    - Each slice has one clear target surface, one likely test file area, and focused verification.
    - Reviewer confirms parallel-safe grouping is realistic.

- [x] T005 Commit planning baseline
  - Owner: Setup Engineer
  - Reviewer: Setup Reviewer
  - Dependencies: T004
  - Parallel-safe: no
  - Steps:
    - Review only planning docs.
    - Commit `specs/033-s9-coverage-gap/tasks.md` and `specs/033-s9-coverage-gap/handoff.md`.
  - Acceptance:
    - Commit contains only 033 planning docs.
    - No coverage implementation has started.
    - Reviewer confirms commit scope.

- [x] T006 Model src-ui test bucket surface
  - Owner: Policy Modeling Engineer
  - Reviewer: Policy Modeling Reviewer
  - Dependencies: T005
  - Parallel-safe: no
  - Blocker fixed: T010/T012 depcruise failure caused by test bucket policy lacking a `src-ui` surface.
  - Steps:
    - Add a precise `src-ui` surface matcher in `specs/021-layered-dependency-architecture/test-buckets/policy.js`.
    - Allow only unit and integration test buckets to import `src-ui` through explicit allowed surfaces/path patterns.
    - Add focused policy tests proving the intended allow/deny matrix.
    - Run the focused policy test and repo depcruise gate.
  - Acceptance:
    - `specs/021-layered-dependency-architecture/test-buckets/policy.js` adds precise `src-ui` surface `^src/ui(?:/|$)`.
    - Unit and integration buckets may import `src-ui` via allowed surfaces/path patterns.
    - E2E and tests-helper buckets still may not import `src/ui`.
    - No `src-other` surface is added.
    - Deny rules, thresholds, coverage include/exclude, baseline ignore, and suppression are unchanged.
    - `tests/unit/lib/test-bucket-policy.test.js` proves unit/integration allow `src-ui` and e2e/helper deny it.
    - `npm run depcruise` passes.
    - `npx vitest run --project=browser tests/unit/lib/test-bucket-policy.test.js` passes.

### Parallel Execution Plan

After T005, run T006 as a serial blocker-fix before any Wave A commit. After T006 is accepted, run these tracks with at most one Engineer and one Reviewer per track. Tracks in the same wave may run concurrently if they do not touch the same files.

Wave A:

- T010-T013: concrete `src/ui/**` slices from T003: `event-formatters.js`, then `DashboardTabsScreen.jsx`
- T020-T023: concrete `src/components/**` slices from T003: `CommentCardMenu.jsx`, then `NotificationPanel.jsx`
- T030-T033: concrete `src/app/**` thin-entry slices from T003: root layout, then weather layout/page entries

Wave B:

- T040-T043: second-pass targets chosen from the concrete T003 fallback pools below after fresh mid-point coverage
- T050-T053: cleanup and gate stabilization

Parallel conflict rules for Wave A:

- Do not create or modify shared test helpers in Wave A unless the affected tracks are serialized.
- T006 should land before any Wave A commit because the commit gate runs repo-wide depcruise.
- T030 and T032 must use separate focused app test files; if an app helper is needed, coordinate through T031/T033 before either commit.
- T022 owns `tests/integration/notifications/NotificationPanel.test.jsx`; no other concurrent task should edit notification panel tests.
- T010/T012/T020 should use new focused test files and are expected to have no file overlap with each other or with T030/T032.

### UI Coverage Track

- [x] T010 Add first UI behavior coverage slice
  - Owner: UI Engineer A
  - Reviewer: UI Reviewer A
  - Dependencies: T006
  - Parallel-safe: yes, with T020 and T030
  - Target production surface: `src/ui/events/event-formatters.js`
  - Expected test file: `tests/unit/ui/event-formatters.test.js`
  - Focused command: `npx vitest run --project=browser tests/unit/ui/event-formatters.test.js`
  - Steps:
    - Add pure behavior coverage for `formatDateTime`, `formatPace`, and `renderRouteLabel`.
    - Cover the T003 gaps: null date fallback, plain string `T` replacement, Timestamp-like `toDate()`, non-Date fallback, blank/null/invalid pace fallback, route coordinates, and legacy `route.pointsCount`.
    - Avoid canonical-layer mocks.
    - Run the focused Vitest command above.
  - Acceptance:
    - Tests execute the real formatter module and real route point counting.
    - Tests would fail on a real formatting regression, not only on import/render existence.
    - Focused Vitest passes with the exact command above.
    - Reviewer confirms no canonical-layer mocks, no production change, and no shared helper edit.

- [x] T011 Review and commit first UI slice
  - Owner: UI Reviewer A
  - Reviewer: Flow Reviewer
  - Dependencies: T010
  - Parallel-safe: no
  - Steps:
    - Inspect task-local diff.
    - Run or verify focused test evidence.
    - Commit accepted UI slice.
  - Acceptance:
    - Commit contains only the accepted UI test slice and any approved helper changes.
    - `handoff.md` records touched files and evidence.

- [x] T012 Add second UI behavior coverage slice
  - Owner: UI Engineer B
  - Reviewer: UI Reviewer B
  - Dependencies: T006
  - Parallel-safe: yes, if it does not touch files from T010
  - Target production surface: `src/ui/member/DashboardTabsScreen.jsx`
  - Expected test file: `tests/integration/dashboard/DashboardTabsScreen.test.jsx`
  - Focused command: `npx vitest run --project=browser tests/integration/dashboard/DashboardTabsScreen.test.jsx`
  - Steps:
    - Render `DashboardTabsScreen` with literal runtime props, not with mocked canonical layers.
    - Cover posts and comments item-list branches, empty/error states, `loadMoreError` retry, `isLoadingMore`, and end hint behavior where practical.
    - Prefer real dashboard card components; mock only external Next/browser boundaries if jsdom requires it.
    - Run the focused Vitest command above.
  - Acceptance:
    - Coverage target is distinct from T010 and does not touch `tests/unit/ui/event-formatters.test.js`.
    - No snapshot-only/import-only tests.
    - Focused Vitest passes with the exact command above.
    - Reviewer confirms the test would catch a realistic render-state regression and no forbidden mocks were added.

- [x] T013 Review and commit second UI slice
  - Owner: UI Reviewer B
  - Reviewer: Flow Reviewer
  - Dependencies: T012
  - Parallel-safe: no
  - Steps:
    - Inspect task-local diff.
    - Verify focused test evidence.
    - Commit accepted UI slice.
  - Acceptance:
    - Commit scope is only T012.
    - `handoff.md` records evidence and remaining UI gap.

### Components Coverage Track

- [x] T020 Add first components behavior coverage slice
  - Owner: Components Engineer A
  - Reviewer: Components Reviewer A
  - Dependencies: T005
  - Parallel-safe: yes, with T010 and T030
  - Target production surface: `src/components/CommentCardMenu.jsx`
  - Expected test file: `tests/integration/comments/CommentCardMenu.test.jsx`
  - Focused command: `npx vitest run --project=browser tests/integration/comments/CommentCardMenu.test.jsx`
  - Steps:
    - Add behavior coverage for opening the menu, focusing the first item, ArrowDown/ArrowUp/Home/End focus movement, Escape close with focus return, outside-click close, and Edit/Delete callback invocation.
    - Prefer user interactions and accessible assertions.
    - Avoid exact call-count assertions unless exact cardinality is the behavior contract.
    - Run the focused Vitest command above.
  - Acceptance:
    - Tests cover keyboard and click behavior, not component existence.
    - No canonical-layer mocks.
    - Focused Vitest passes with the exact command above.
    - Reviewer confirms this slice does not edit `tests/integration/notifications/NotificationPanel.test.jsx`.

- [x] T021 Review and commit first components slice
  - Owner: Components Reviewer A
  - Reviewer: Flow Reviewer
  - Dependencies: T020
  - Parallel-safe: no
  - Steps:
    - Inspect task-local diff.
    - Confirm behavior assertions are meaningful.
    - Commit accepted slice.
  - Acceptance:
    - Commit contains only T020 files.
    - `handoff.md` records touched files and evidence.

- [x] T022 Add second components behavior coverage slice
  - Owner: Components Engineer B
  - Reviewer: Components Reviewer B
  - Dependencies: T005
  - Parallel-safe: yes, if it does not touch files from T020
  - Target production surface: `src/components/Notifications/NotificationPanel.jsx`
  - Expected test file: `tests/integration/notifications/NotificationPanel.test.jsx`
  - Focused command: `npx vitest run --project=browser tests/integration/notifications/NotificationPanel.test.jsx`
  - Steps:
    - Extend the existing real `NotificationContext.Provider` test surface.
    - Cover Escape close, Tab/Shift+Tab focus trap, bell-control outside-click exception, `showLoadMoreButton` load-more click, sentinel `IntersectionObserver` load-more callback, and notification click mark-read/push/close behavior where not already covered.
    - Mock only external Next/Firebase/browser APIs such as router, Firebase SDK boundary, and `IntersectionObserver`; do not mock `@/components/Notifications/NotificationPanel`.
    - Run the focused Vitest command above.
  - Acceptance:
    - The test is not snapshot-only, import-only, or render-only.
    - The candidate is distinct from T020.
    - Focused Vitest passes with the exact command above.
    - Reviewer confirms no concurrent task edited the same notification test file.

- [x] T023 Review and commit second components slice
  - Owner: Components Reviewer B
  - Reviewer: Flow Reviewer
  - Dependencies: T022
  - Parallel-safe: no
  - Steps:
    - Inspect task-local diff.
    - Verify focused test evidence.
    - Commit accepted slice.
  - Acceptance:
    - Commit scope is only T022.
    - `handoff.md` records evidence and remaining components gap.

### App Coverage Track

- [x] T030 Add first app thin-entry behavior coverage slice
  - Owner: App Engineer A
  - Reviewer: App Reviewer A
  - Dependencies: T005
  - Parallel-safe: yes, with T010 and T020
  - Target production surface: `src/app/layout.jsx`
  - Expected test file: `tests/integration/app/root-layout.test.jsx`
  - Focused command: `npx vitest run --project=browser tests/integration/app/root-layout.test.jsx`
  - Steps:
    - Test exported metadata for configured/fallback site URL behavior.
    - Render `RootLayout` and assert the root shell contract: `lang="zh-Hant-TW"`, font variable classes, children placement, and provider/nav/toast shell presence through observable output.
    - Mock only external `next/font/google` and jsdom-unsafe external/Firebase boundaries if needed; do not mock `@/runtime/providers` or app/component internals.
    - Run the focused Vitest command above.
  - Acceptance:
    - Test covers observable app behavior or route contract.
    - No import-only thin-entry test unless paired with behavior assertion.
    - Focused Vitest passes with the exact command above.
    - Reviewer confirms this slice does not edit the T032 weather app test file.

- [x] T031 Review and commit first app slice
  - Owner: App Reviewer A
  - Reviewer: Flow Reviewer
  - Dependencies: T030
  - Parallel-safe: no
  - Steps:
    - Inspect task-local diff.
    - Confirm the test is not just importing the page.
    - Commit accepted slice.
  - Acceptance:
    - Commit contains only T030 files.
    - `handoff.md` records touched files and evidence.

- [x] T032 Add second app thin-entry behavior coverage slice
  - Owner: App Engineer B
  - Reviewer: App Reviewer B
  - Dependencies: T005
  - Parallel-safe: yes, if it does not touch files from T030
  - Target production surfaces: `src/app/weather/layout.jsx` and `src/app/weather/page.jsx`
  - Expected test files: `tests/integration/app/weather-layout.test.jsx` and `tests/integration/app/weather-page-entry.test.jsx`
  - Focused command: `npx vitest run --project=browser tests/integration/app/weather-layout.test.jsx tests/integration/app/weather-page-entry.test.jsx`
  - Steps:
    - Test weather layout metadata and that children render inside the Fraunces variable wrapper.
    - Test the weather page entry delegates through `next/dynamic({ ssr: false })` while loading the real weather component path; do not replace `@/components/weather/WeatherPage` with a local mock.
    - Mock only external `next/font/google`, `next/dynamic`, Leaflet/topology/browser APIs, Firebase SDK boundary, fetch, or image boundaries as required by jsdom.
    - Run the focused Vitest command above.
  - Acceptance:
    - Distinct app surface from T030.
    - No snapshot-only/import-only test.
    - Focused Vitest passes with the exact command above.
    - Reviewer confirms no shared app helper or `tests/integration/app/root-layout.test.jsx` conflict was introduced.

- [x] T033 Review and commit second app slice
  - Owner: App Reviewer B
  - Reviewer: Flow Reviewer
  - Dependencies: T032
  - Parallel-safe: no
  - Steps:
    - Inspect task-local diff.
    - Verify focused test evidence.
    - Commit accepted slice.
  - Acceptance:
    - Commit scope is only T032.
    - `handoff.md` records evidence and remaining app gap.

### Rebaseline And Second Pass

- [x] T040 Run mid-point coverage rebaseline
  - Owner: Coverage Engineer
  - Reviewer: Coverage Reviewer
  - Dependencies: T011, T013, T021, T023, T031, T033
  - Parallel-safe: no
  - Steps:
    - Run `npm run test:coverage`.
    - Recalculate all 8 tracked source groups.
    - Compare against targets.
    - Record before/current delta in `handoff.md`.
  - Acceptance:
    - Fresh coverage values are recorded.
    - Reviewer confirms whether each target is met or still short.

- [x] T041 Add targeted gap slice if UI remains below 94.43
  - Owner: UI Gap Engineer
  - Reviewer: UI Gap Reviewer
  - Dependencies: T040
  - Parallel-safe: yes, with T042 and T043 if files do not overlap
  - Concrete second-pass pool from T003:
    - Primary: `src/ui/posts/PostDetailScreen.jsx` -> `tests/integration/posts/PostDetailScreen.test.jsx`; focused command `npx vitest run --project=browser tests/integration/posts/PostDetailScreen.test.jsx`.
    - Secondary only after metadata completion in `handoff.md`: `src/ui/events/EventDetailScreen.jsx`, `src/ui/events/EventCreateForm.jsx`, or `src/ui/weather/WeatherPageScreen.jsx`.
  - Steps:
    - Skip if `src/ui/** >= 94.43`.
    - Prefer the primary `PostDetailScreen` callback-adapter slice: comments map to `CommentCard`, and edit/delete actions call runtime handlers with the comment ID.
    - If the primary slice is unsuitable or already covered, first add complete metadata to `handoff.md` for exactly one secondary candidate: current coverage, uncovered lines/branches, behavior to test, test file/type, nearby tests, mock boundary, and rationale.
    - Do not implement a secondary candidate until the Reviewer accepts that metadata.
    - Add behavior coverage and run the focused command for the chosen file.
  - Acceptance:
    - If skipped, `handoff.md` records fresh value and reason.
    - If executed, focused test passes and Reviewer accepts diff.
    - Reviewer confirms any secondary candidate had complete metadata before implementation.

- [x] T042 Add targeted gap slice if components remains below 91.64
  - Owner: Components Gap Engineer
  - Reviewer: Components Gap Reviewer
  - Dependencies: T040
  - Parallel-safe: yes, with T041 and T043 if files do not overlap
  - Concrete second-pass pool from T003:
    - Primary: `src/components/CommentSection.jsx` -> extend `tests/integration/comments/CommentSection.test.jsx`; focused command `npx vitest run --project=browser tests/integration/comments/CommentSection.test.jsx`.
    - Fallback: `src/components/EventEditForm.jsx` -> extend `tests/integration/events/EventEditForm.test.jsx`; focused command `npx vitest run --project=browser tests/integration/events/EventEditForm.test.jsx`.
    - Tertiary only after metadata completion in `handoff.md`: `src/components/weather/TaiwanMap.jsx`.
  - Steps:
    - Skip if `src/components/** >= 91.64`.
    - Prefer the primary `CommentSection` scroll-to-comment slice if components still need a large delta.
    - Use the fallback `EventEditForm` field-change/submit-delta slice if the remaining gap is smaller or if timer/focus work is too risky after T040.
    - If considering `TaiwanMap`, first add complete metadata to `handoff.md` and get Reviewer acceptance before implementation.
    - Add behavior coverage and run the focused command for the chosen file.
  - Acceptance:
    - If skipped, `handoff.md` records fresh value and reason.
    - If executed, focused test passes and Reviewer accepts diff.
    - Reviewer confirms no rejected wrapper/static candidate was used.

- [x] T043 Add targeted gap slice if app remains below 95.07
  - Owner: App Gap Engineer
  - Reviewer: App Gap Reviewer
  - Dependencies: T040
  - Parallel-safe: yes, with T041 and T042 if files do not overlap
  - Concrete second-pass pool from T003:
    - First recover any unimplemented T030/T032 app candidate.
    - Primary fallback: `src/app/member/BioEditor.jsx` -> extend `tests/integration/profile/BioEditor.test.jsx`; focused command `npx vitest run --project=browser tests/integration/profile/BioEditor.test.jsx`.
    - One-point filler: `src/app/users/[uid]/ProfileHeader.jsx` -> extend `tests/integration/profile/ProfileHeader.test.jsx`; focused command `npx vitest run --project=browser tests/integration/profile/ProfileHeader.test.jsx`.
  - Steps:
    - Skip if `src/app/** >= 95.07`.
    - If any T030/T032 app surface was skipped or under-covered, finish that first.
    - Otherwise choose `BioEditor` for status/error reset and over-limit save-guard behavior.
    - Use `ProfileHeader` only if the fresh app gap is small enough that the empty/non-string avatar fallback can close it.
    - Do not use `src/app/page.jsx` unless complete metadata is first added to `handoff.md` and Reviewer accepts that the test is behavior-bearing rather than static render-only.
    - Add behavior coverage and run the focused command for the chosen file.
  - Acceptance:
    - If skipped, `handoff.md` records fresh value and reason.
    - If executed, focused test passes and Reviewer accepts diff.
    - Reviewer confirms no `@/components`, `@/runtime`, or `@/app` internal mock was added.

- [x] T044 Review and commit second-pass coverage slices
  - Owner: Flow Engineer
  - Reviewer: Flow Reviewer
  - Dependencies: T041, T042, T043
  - Parallel-safe: no
  - Steps:
    - Review all second-pass slices by task-local diff.
    - Commit each accepted slice separately unless files are tightly coupled.
  - Acceptance:
    - No unrelated files in commits.
    - `handoff.md` records evidence and skipped-slice reasons.

### Quality Gates And Delivery

- [ ] T050 Run full local gates
  - Owner: Gate Engineer
  - Reviewer: Gate Reviewer
  - Dependencies: T044
  - Parallel-safe: no
  - Steps:
    - Run all Required Gates listed above.
    - Save command outputs or concise evidence in `handoff.md`.
    - Do not patch thresholds, includes, excludes, or policy to pass gates.
  - Acceptance:
    - Every gate passes, or any failure is recorded with exact command and failure summary.
    - Reviewer confirms no policy weakening.

- [ ] T051 Final coverage confirmation
  - Owner: Coverage Engineer
  - Reviewer: Coverage Reviewer
  - Dependencies: T050
  - Parallel-safe: no
  - Steps:
    - Use the final `coverage/coverage-summary.json`.
    - Recalculate all 8 tracked source groups.
    - Update `handoff.md` Coverage After.
  - Acceptance:
    - `src/ui/** >= 94.43`.
    - `src/components/** >= 91.64`.
    - `src/app/** >= 95.07`.
    - Reviewer confirms numbers are fresh and reproducible.

- [ ] T052 Final docs evidence update
  - Owner: Handoff Engineer
  - Reviewer: Handoff Reviewer
  - Dependencies: T051
  - Parallel-safe: no
  - Steps:
    - Update only `specs/033-s9-coverage-gap/tasks.md` and `handoff.md`.
    - Record before/after coverage, touched test files, production files touched and why, remaining risk, and reviewer notes.
    - Do not update 026 docs or `docs/QUALITY_SCORE.md`.
  - Acceptance:
    - Handoff has complete delivery evidence.
    - Forbidden docs remain untouched.
    - Reviewer accepts final docs.

- [ ] T053 Final commit before PR
  - Owner: Flow Engineer
  - Reviewer: Flow Reviewer
  - Dependencies: T052
  - Parallel-safe: no
  - Steps:
    - Commit final accepted changes if there are real doc/code changes after gates.
    - Do not make checkbox-only commits after CI has passed.
  - Acceptance:
    - Commit is scoped.
    - Working tree is clean except generated ignored files.
    - Reviewer confirms PR-ready state.

## Evidence-Only Delivery Gates

These are not checkboxes and should not trigger checkbox-only commits:

- Push branch after T053.
- Open PR.
- Record PR URL in final report or handoff if this happens before CI.
- Wait for CI.
- If CI passes, do not edit docs just to mark CI complete.
- If CI fails, fix with a new Engineer + Reviewer task added above T053, then rerun gates.

## Reviewer Checklist

Reviewer must verify for every checked task:

- Task-local diff only; do not fail a task for unrelated dirty files from another active task.
- No forbidden files changed.
- Tests assert behavior.
- No canonical-layer mocks.
- Focused command evidence matches touched files.
- `handoff.md` is updated when evidence or risk changed.
- Checkbox changed to `[x]` only after acceptance.
