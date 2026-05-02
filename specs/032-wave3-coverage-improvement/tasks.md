# 032 Wave 3 Coverage Improvement Tasks

> 這份文件是 **026 S9 T54 前置 Wave 3 coverage evidence**。
> 它不是 S9 threshold 實作，也不是 S9 target 設定；S9 只能在本檔任務完成、reviewer evidence 通過、且 coverage 補測成果存在後，才可把本檔當作 T54 的 Wave 3 evidence。

## 0. Compact 保留資訊

- 後續 session 必須先讀本檔，並以本檔作為 `032-wave3-coverage-improvement` 的唯一任務來源；最終交付 evidence 另寫入 `specs/032-wave3-coverage-improvement/handoff.md`。
- 後續 session 必須完成本檔所有 task，且按下方團隊配置開 subagent；主 agent 只做 Tech Lead / coordinator，不直接下場寫測試實作。
- 每個 task 皆採 engineer + reviewer 配對；engineer 完成後 reviewer 通過才可把 checkbox 標成 `[x]`。reviewer 不通過時標回 `[ ]`，在該 task 的 evidence 區寫 `REJECT` 原因，交回 engineer 修。
- 不可覆蓋或 revert 他人改動。進任務前先跑 `git -C /Users/chentzuyu/Desktop/dive-into-run-032-wave3-coverage-improvement status --short --branch`；若看到與本 task 無關的 dirty file，先記錄並協調處理。最終 T012 後 `git status --short --branch` 必須乾淨，不能把 pre-existing unrelated dirty 當成功狀態。
- 多 worktree git 操作一律用 `git -C <path>`。commit message 不加 `Co-Authored-By`。
- `coverage/` 是 generated artifact，不可 commit。

## 1. Worktree 與 Baseline

- Worktree path: `/Users/chentzuyu/Desktop/dive-into-run-032-wave3-coverage-improvement`
- Branch: `032-wave3-coverage-improvement`
- Fresh baseline command: `npm run test:coverage`
- Fresh baseline result: 154 test files passed, 1365 tests passed, exit 0
- Fresh total coverage:

| Metric | Covered / Total | Percent |
| ------ | --------------- | ------- |
| Lines | 4121 / 4681 | 88.03% |
| Statements | 4435 / 5155 | 86.03% |
| Branches | 2424 / 3225 | 75.16% |
| Functions | 1122 / 1281 | 87.58% |

- Wave 3 target layers:

| Layer | Baseline before (S3/user-specified) | Fresh/current baseline (Team P2) | Fresh after requirement |
| ----- | ----------------------------------- | ------------------------------- | ----------------------- |
| `src/ui/**` | 62.52% | 96 / 123 = 78.05% | Must record final post-implementation line% as `Fresh after` and show delta from both S3 baseline and current baseline. |
| `src/components/**` | 52.43% | 639 / 853 = 74.91% | Must record final post-implementation line% as `Fresh after` and show delta from both S3 baseline and current baseline. |
| `src/app/**` | 47.92% | 93 / 151 = 61.59% | Must record final post-implementation line% as `Fresh after` and show delta from both S3 baseline and current baseline. |

Baseline before 固定寫：

```text
ui 62.52 / components 52.43 / app 47.92
```

`62.52 / 52.43 / 47.92` 是固定的 **Baseline before**，不可被本次 fresh/current baseline 取代。本次 `78.05 / 74.91 / 61.59` 只能標成 fresh/current baseline。最終 handoff 的 **Fresh after** 必須是補測後重新跑 coverage 得到的新數字；若某層沒有高於 fresh/current baseline，handoff 必須寫 `BLOCKED_FOR_S9_T54` 或說明 reviewer 接受的 coverage-improvement evidence。

Low-coverage guide from `coverage/coverage-summary.json`:

| Area | Lowest files |
| ---- | ------------ |
| `src/ui/**` | `src/ui/member/MemberPageScreen.jsx` 0/2, `src/ui/events/EventsFilterPanel.jsx` 2/12, `src/ui/events/ParticipantsModal.jsx` 2/4, `src/ui/posts/PostDetailScreen.jsx` 4/6 |
| `src/components/**` | `src/components/EventMap.jsx` 0/84, `src/components/EventRouteEditor.jsx` 2/14, `src/components/RunsLoginGuide.jsx` 2/7, `src/components/CommentSection.jsx` 10/24, `src/components/CommentCardMenu.jsx` 21/43 |
| `src/app/**` | `src/app/users/[uid]/page.jsx` 0/19, `src/app/events/[id]/page.jsx` 0/10, `src/app/posts/[id]/page.jsx` 0/10, `src/app/member/page.jsx` 0/4, layout/page thin entries 0/1-4 |

## 2. 禁止 / 允許修改範圍

允許修改：

- `tests/**`
- `tests/_helpers/**`，限測試重複 setup 明顯需要抽共用 helper 時
- `src/ui/**`，僅限 semantic query 無法達成、且 reviewer 接受的最小必要 a11y/label/testability 修正
- `src/components/**`，僅限 semantic query 無法達成、且 reviewer 接受的最小必要 a11y/label/testability 修正
- `src/app/**`，僅限 semantic query 無法達成、且 reviewer 接受的最小必要 route/page handoff 或 metadata testability 修正
- 本檔 `specs/032-wave3-coverage-improvement/tasks.md`
- `specs/032-wave3-coverage-improvement/handoff.md`

禁止修改：

- `src/config/**`
- `src/repo/**`
- `src/service/**`
- `src/runtime/**`
- `src/lib/**`
- `vitest.config.mjs`
- `eslint.config.mjs`
- `.husky/**`
- `.github/**`
- `package.json`
- `package-lock.json`
- `docs/QUALITY_SCORE.md`
- `specs/026-tests-audit-report/**`
- `coverage/**`
- `node_modules/**`

例外規則：

- 若測試暴露 production bug，或需要超出 `src/ui/**` / `src/components/**` / `src/app/**` 最小 semantic query 修正的 production change，不准直接改。在對應 task evidence 寫 `BLOCKED_PROD_CHANGE_REQUIRED: <file> <reason> <minimal proposed change>`，交給使用者決定。
- 若 task 真的修改 `src/ui/**` / `src/components/**` / `src/app/**`，必須在 evidence 寫明「為什麼 semantic query 最小必要」、修改前後的 query、以及 reviewer PASS；不得順手重構。
- 若 `package-lock.json` 已 dirty，視為既有外部變更，不可 stage、revert、format 或覆蓋。
- 若需要新增 test helper，必須由該 task reviewer 確認 helper 沒把 production 行為 mock 成假象。
- 各 task 的 `Files allowed` 是預設測試路徑；若 §2 的 semantic query 最小必要條件成立，可額外納入對應 `src/ui/**` / `src/components/**` / `src/app/**` 檔，但必須在 task evidence 和 reviewer PASS 中點名。

## 3. 補測原則

- 只補行為測試，不補 snapshot-only 測試。
- UI / component 測試優先用 React Testing Library + `userEvent.setup()`；禁止新增 `fireEvent`。
- 查詢優先使用 `screen.getByRole` / `getByLabelText` / `getByText`，避免 `container.querySelector`。
- 可以 mock 邊界外套件：`next/navigation`、`next/image`、`next/dynamic`、Leaflet / React-Leaflet、Firebase SDK、瀏覽器 API；每個外部/browser mock 必須在測試檔或 task evidence 寫清楚原因。
- 禁止 mock 邊界內 production module 來製造 coverage 假象，尤其不要在 integration test 中 mock `@/repo/**`、`@/service/**`、`@/runtime/**`、`@/components/**` 後宣稱該檔已被覆蓋。
- 不以 `toHaveBeenCalledTimes(N)` 作為 async UI behavior 的核心驗證；優先驗 visible state、role/name、payload、URL、callback args 或 final state。
- 不用 `setTimeout` / sleep / `waitForTimeout` 製造等待；等待必須來自 Testing Library async query、`waitFor` 單一斷言、或被測 promise。
- 不新增 inline `eslint-disable`、`cspell:disable`、`@ts-ignore`；若工具報錯，修測試寫法或在 task evidence escalated。
- 若測 page thin entry，可 mock direct child client component 或 Next.js boundary，但要測到 page 自己的 metadata / params / notFound / prop handoff 行為。
- 每批補測後都要跑該批 targeted Vitest；commit task 前還要跑 `npm run test:coverage` 確認 fresh numbers。
- 目標是讓 `src/ui/**`、`src/components/**`、`src/app/**` 產生可交給 026 S9 T54 的 Wave 3 coverage-improvement evidence；不是在本 branch 設 threshold，也不是把 fresh/current baseline 冒充 S3 Baseline before。

## 4. 團隊配置與平行策略

| Lane | Engineer | Reviewer | Scope | Can run in parallel |
| ---- | -------- | -------- | ----- | ------------------- |
| A | P2-E1 | P2-R1 | `src/components/EventMap.jsx` / route-map heavy components | B, C, D after T001 |
| B | P2-E2 | P2-R2 | `src/ui/events/**` + `EventRouteEditor.jsx` | A, C, D after T001 |
| C | P2-E3 | P2-R3 | app thin entries / RSC metadata | A, B, D after T001 |
| D | P2-E4 | P2-R4 | member/profile/runs small UI gaps | A, B, C after T001 |
| E | P2-E5 | P2-R5 | comments / notification component residual gaps | after T002-T005, if still needed |
| Z | P2-E0 | P2-R0 | integration baseline, docs, commit coordination | serial |

Reviewer rules:

- Reviewer must read the exact diff for their lane and run at least the targeted test command.
- Reviewer may not edit the task under review.
- Reviewer records `PASS` or `REJECT` in this file under the task evidence section.
- A task may be marked `[x]` only after reviewer `PASS`.

Commit policy:

- Commit only at T006, T010, and T012.
- Do not commit after T001-T005 or T007-T009 individually.
- Each commit must be atomic, must not include `coverage/`, logs, temp files, `package-lock.json`, or unrelated dirty files.
- Commit messages must not include `Co-Authored-By`.
- T012 is the final evidence commit and must include `specs/032-wave3-coverage-improvement/handoff.md`.
- After T012 commit, `git -C /Users/chentzuyu/Desktop/dive-into-run-032-wave3-coverage-improvement status --short --branch` must show a clean worktree. If unrelated dirty files exist, T012 cannot pass until they are explicitly resolved by owner-approved action.

## 5. Tasks

### T001 — Baseline handoff sanity gate

- **Status**: `[x]`
- **Owner**: P2-E0
- **Reviewer**: P2-R0
- **Dependencies**: none
- **Parallel**: blocks T002-T005
- **Files allowed**: this `tasks.md` only

Engineer action:

1. Re-run `git -C /Users/chentzuyu/Desktop/dive-into-run-032-wave3-coverage-improvement status --short --branch`.
2. Confirm branch is `032-wave3-coverage-improvement`.
3. Confirm `coverage/coverage-summary.json` exists from fresh baseline.
4. Record any pre-existing dirty files. Team P2 takeover initially observed `package-lock.json` as modified, but later status showed no package-lock diff; always trust the current `git status`. If unrelated dirty files appear, do not touch them blindly, but open an owner-approved resolution path because T012 final status must be clean.
5. Do not alter production code or tests.

Acceptance criteria:

- AC-T001.1: Branch/path are recorded exactly.
- AC-T001.2: Fresh baseline numbers in §1 match `coverage/coverage-summary.json`.
- AC-T001.3: Existing dirty files are recorded with an owner-approved resolution plan; no unrelated dirty file is accepted as final success state.
- AC-T001.4: T002-T005 remain `[ ]` until reviewer PASS.

Evidence:

- Engineer: P2-E0 2026-05-02 PASS candidate.
  - Command: `git -C /Users/chentzuyu/Desktop/dive-into-run-032-wave3-coverage-improvement status --short --branch`
    - Output: `## 032-wave3-coverage-improvement`; dirty: `?? specs/032-wave3-coverage-improvement/tasks.md`.
  - Branch/path confirmed: `/Users/chentzuyu/Desktop/dive-into-run-032-wave3-coverage-improvement` on `032-wave3-coverage-improvement`.
  - `coverage/coverage-summary.json` exists; `stat` observed mtime `May  2 16:44:25 2026`.
  - Baseline matches JSON:
    - Total lines `4121 / 4681 = 88.03%`; statements `4435 / 5155 = 86.03%`; branches `2424 / 3225 = 75.16%`; functions `1122 / 1281 = 87.58%`.
    - `src/ui/**` lines `96 / 123 = 78.05%`; `src/components/**` lines `639 / 853 = 74.91%`; `src/app/**` lines `93 / 151 = 61.59%`.
  - Dirty-file resolution plan: no unrelated dirty files observed outside this allowed evidence file. Do not stage/commit during T001; T012 coordinator must include only intended spec/handoff files or obtain owner approval for any other dirty file before final clean status.
  - T002-T005 remain `[ ]`.
- Reviewer: P2-R0 2026-05-02 PASS.
  - Verified `git -C /Users/chentzuyu/Desktop/dive-into-run-032-wave3-coverage-improvement status --short --branch`: branch `032-wave3-coverage-improvement`; only dirty file was untracked `specs/032-wave3-coverage-improvement/tasks.md`.
  - Confirmed `coverage/coverage-summary.json` exists.
  - Verified JSON matches §1 baseline: total lines `4121/4681 88.03%`, statements `4435/5155 86.03%`, branches `2424/3225 75.16%`, functions `1122/1281 87.58%`; `src/ui/**` lines `96/123 78.05%`, `src/components/**` lines `639/853 74.91%`, `src/app/**` lines `93/151 61.59%`.
  - Confirmed T002-T005 remained `[ ]`.
  - Confirmed no tracked diff and no test/production code dirty files.

### T002 — Lane A: EventMap / map component coverage

- **Status**: `[x]`
- **Owner**: P2-E1
- **Reviewer**: P2-R1
- **Dependencies**: T001 `[x]`
- **Parallel**: T003, T004, T005
- **Files allowed**: `tests/integration/events/EventMap.test.jsx` or `tests/unit/components/EventMap.test.jsx`; optional helper under `tests/_helpers/leaflet-*`
- **Commit**: no; commit in T006

Engineer action:

1. Add tests that execute `src/components/EventMap.jsx` without real browser map rendering.
2. Mock only boundary packages: `react-leaflet`, `leaflet`, `leaflet-draw`, `leaflet-geosearch`, `@mapbox/polyline`.
3. Cover view mode with valid encoded polylines, empty/malformed polyline fallback, bbox fit behavior, and cleanup.
4. Cover draw mode setup enough to execute initial route loading and draw/edit/delete callback branches.
5. Keep assertions behavioral: callbacks, map API calls, rendered container height/mode boundary.

Acceptance criteria:

- AC-T002.1: `src/components/EventMap.jsx` line coverage improves from 0/84 to at least 55/84.
- AC-T002.2: No `src/**` file is changed unless it is an allowed minimal semantic query/testability fix under §2, with reviewer PASS evidence.
- AC-T002.3: No internal app module is mocked to fake coverage.
- AC-T002.4: Targeted command exits 0, e.g. `npx vitest run tests/integration/events/EventMap.test.jsx --coverage`.
- AC-T002.5: Reviewer verifies `coverage-summary.json` or targeted coverage output shows `EventMap.jsx` executed.

Evidence:

- Engineer: P2-E1 2026-05-02 PASS.
  - Added `tests/integration/events/EventMap.test.jsx`; did not modify production or `tasks.md`.
  - `npx eslint tests/integration/events/EventMap.test.jsx` exit 0, with only the repo-existing React version warning.
  - `npx vitest run tests/integration/events/EventMap.test.jsx --coverage --coverage.include src/components/EventMap.jsx --coverage.reportsDirectory /private/tmp/p2e1-eventmap-coverage` exit 0, 4/4 tests passed.
  - `src/components/EventMap.jsx` target coverage: lines `83/84`, statements `91/93`, branches `30/38`, functions `25/26`.
  - Mock reasons: `react-leaflet`, `leaflet`, `leaflet-draw`, `leaflet-geosearch`, and `@mapbox/polyline` are external map/browser boundaries that jsdom cannot instantiate directly.
  - Confirmed no `@/repo/**`, `@/service/**`, `@/runtime/**`, or `@/components/**` mocks; no `toHaveBeenCalledTimes`, sleep/setTimeout, inline disable, cspell disable, or `@ts-ignore`.
- Reviewer: P2-R1 2026-05-02 PASS.
  - Scoped review to `src/components/EventMap.jsx` and `tests/integration/events/EventMap.test.jsx`; `EventMap.jsx` has no path-limited diff and T002 adds only the EventMap integration test.
  - `npx eslint tests/integration/events/EventMap.test.jsx` exit 0 with only the repo-existing React version warning.
  - `npx vitest run tests/integration/events/EventMap.test.jsx --coverage --coverage.include src/components/EventMap.jsx --coverage.reportsDirectory /private/tmp/p2r1-eventmap-coverage-2` exit 0, 4/4 tests passed, `EventMap.jsx` lines `83/84`.
  - Verified boundary mocks only; no repo/service/runtime/component mocks; no `toHaveBeenCalledTimes`, sleeps, inline disables, cspell disable, or `@ts-ignore`.

### T003 — Lane B: Events UI and EventRouteEditor coverage

- **Status**: `[x]`
- **Owner**: P2-E2
- **Reviewer**: P2-R2
- **Dependencies**: T001 `[x]`
- **Parallel**: T002, T004, T005
- **Files allowed**: `tests/integration/events/EventsFilterPanel.test.jsx`, `tests/integration/events/ParticipantsModal.test.jsx`, `tests/integration/events/EventRouteEditor.test.jsx`
- **Commit**: no; commit in T006

Engineer action:

1. Add behavior tests for `EventsFilterPanel`: close overlay by click / Escape / Enter / Space, checkbox, date/distance/city/district changes, clear and search buttons.
2. Add behavior tests for `ParticipantsModal`: empty participants, rendered participants, close action if present.
3. Add behavior tests for `EventRouteEditor`: view mode, clear route, restore route, draw mode, cancel draw, edited route point count.
4. Mock `next/dynamic` only to make `EventMap` render a harmless boundary stub; do not mock the component under test.

Acceptance criteria:

- AC-T003.1: `src/ui/events/EventsFilterPanel.jsx` improves from 2/12 to at least 10/12.
- AC-T003.2: `src/ui/events/ParticipantsModal.jsx` improves from 2/4 to 4/4.
- AC-T003.3: `src/components/EventRouteEditor.jsx` improves from 2/14 to at least 12/14.
- AC-T003.4: Tests use `userEvent`, not `fireEvent`.
- AC-T003.5: Targeted Vitest exits 0 for all files added in this task.

Evidence:

- Engineer: P2-E2 2026-05-02 PASS after app-boundary repair.
  - Reworked `tests/integration/events/EventsFilterPanel.test.jsx` and `tests/integration/events/ParticipantsModal.test.jsx` to avoid direct `@/ui/**` imports. They now exercise `EventsFilterPanel` through `@/app/events/page` and `ParticipantsModal` through `@/app/events/[id]/eventDetailClient`.
  - Kept `tests/integration/events/EventRouteEditor.test.jsx` as a policy-valid component integration test.
  - No production files or `tasks.md` were changed by the engineer repair; no `@/runtime/**`, `@/repo/**`, or `@/service/**` mocks were introduced.
  - Added app-boundary keyboard coverage for `EventsFilterPanel`: Escape, Enter, and Space on the overlay close target close the dialog.
  - `npx eslint tests/integration/events/EventsFilterPanel.test.jsx tests/integration/events/ParticipantsModal.test.jsx tests/integration/events/EventRouteEditor.test.jsx` exit 0 with only the repo-existing React version warning.
  - `npx vitest run tests/integration/events/EventsFilterPanel.test.jsx tests/integration/events/ParticipantsModal.test.jsx tests/integration/events/EventRouteEditor.test.jsx --coverage --coverage.include=src/ui/events/EventsFilterPanel.jsx --coverage.include=src/ui/events/ParticipantsModal.jsx --coverage.include=src/components/EventRouteEditor.jsx --coverage.reportsDirectory=/private/tmp/p2e2-final-keyboard-coverage` exit 0, 3 files passed, 18 tests passed.
  - Target coverage from isolated `coverage-summary.json`: `EventsFilterPanel.jsx` lines `12/12`, functions `11/11`; `ParticipantsModal.jsx` lines `4/4`; `EventRouteEditor.jsx` lines `14/14`.
- Reviewer: P2-R2 2026-05-02 PASS after app-boundary repair.
  - Confirmed `EventsFilterPanel` and `ParticipantsModal` tests do not directly import `@/ui/**`; runtime imports are real provider/context harness imports.
  - Confirmed no `vi.mock('@/runtime/**')`, no repo/service/runtime mocks, and no relative-import policy bypass.
  - Confirmed `EventsFilterPanel` keyboard close path is covered through the `EventsPage` app boundary.
  - `npx eslint tests/integration/events/EventsFilterPanel.test.jsx tests/integration/events/ParticipantsModal.test.jsx tests/integration/events/EventRouteEditor.test.jsx` exit 0 with only the repo-existing React version warning.
  - `npx vitest run tests/integration/events/EventsFilterPanel.test.jsx tests/integration/events/ParticipantsModal.test.jsx tests/integration/events/EventRouteEditor.test.jsx --coverage --coverage.include=src/ui/events/EventsFilterPanel.jsx --coverage.include=src/ui/events/ParticipantsModal.jsx --coverage.include=src/components/EventRouteEditor.jsx --coverage.reportsDirectory=/private/tmp/p2r2-final-keyboard-coverage` exit 0, 3 files passed, 18 tests passed, lines 100%.
  - `npx vitest run tests/unit/lib/test-bucket-policy.test.js` exit 0, 4 tests passed.

### T004 — Lane C: App thin entries and metadata coverage

- **Status**: `[x]`
- **Owner**: P2-E3
- **Reviewer**: P2-R3
- **Dependencies**: T001 `[x]`
- **Parallel**: T002, T003, T005
- **Files allowed**: tests under `tests/unit/app/**` or `tests/integration/app/**`
- **Commit**: no; commit in T006

Engineer action:

1. Add tests for `src/app/users/[uid]/page.jsx`: `generateMetadata` success/fallback, `notFound()` path, profile serialization, `ProfileClient` prop handoff.
2. Add tests for `src/app/events/[id]/page.jsx`: metadata success/fallback and `EventDetailClient` id handoff.
3. Add tests for `src/app/posts/[id]/page.jsx`: metadata success/fallback and `PostDetailClient` postId handoff.
4. Add tiny tests for `src/app/member/page.jsx`, `src/app/page.jsx`, and weather layout/page only if needed to reach app baseline +5.
5. Mock Next.js boundary modules and direct child client components only; do not mock the page module under test.

Acceptance criteria:

- AC-T004.1: `src/app/**` line coverage improves from 93/151 = 61.59% to at least 101/151 = 66.89%, or equivalent if line totals drift.
- AC-T004.2: `src/app/users/[uid]/page.jsx` no longer reports 0% line coverage.
- AC-T004.3: `src/app/events/[id]/page.jsx` and `src/app/posts/[id]/page.jsx` no longer report 0% line coverage.
- AC-T004.4: Targeted Vitest exits 0.
- AC-T004.5: No `src/app/**` file is changed unless it is an allowed minimal route/page handoff or metadata testability fix under §2, with reviewer PASS evidence.

Evidence:

- Engineer: P2-E3 2026-05-02 PASS after bucket-policy repair.
  - Added `tests/integration/app/app-thin-entries.test.jsx`; did not modify production or `tasks.md`.
  - Root-cause repair: moved the app thin-entry test out of `tests/unit/app/**` because `test-bucket-policy` allows `tests/unit/**` to test `src/app/api/**` only, not non-API `src/app/**` pages.
  - `npx eslint tests/integration/app/app-thin-entries.test.jsx` exit 0 with only the repo-existing React version warning.
  - Tests cover users metadata success/fallback, `notFound()`, profile serialization, `ProfileClient` prop handoff; events/posts metadata success/fallback and client id/postId handoff.
  - Mock reasons: `next/navigation.notFound` is a Next boundary; direct child client components are mocked to verify RSC prop handoff without executing client runtime; external Firebase SDK packages are mocked to avoid Firestore/Admin side effects.
  - Confirmed no page-module-under-test mock and no `@/repo/**`, `@/service/**`, or `@/runtime/**` mocks.
- Reviewer: P2-R3 2026-05-02 PASS.
  - Path-limited review found only `tests/integration/app/app-thin-entries.test.jsx` added for T004; `src/app/users/[uid]/page.jsx`, `src/app/events/[id]/page.jsx`, and `src/app/posts/[id]/page.jsx` have no production diff.
  - `npx eslint tests/integration/app/app-thin-entries.test.jsx` exit 0 with only the repo-existing React version warning.
  - `npx vitest run tests/integration/app/app-thin-entries.test.jsx --coverage --coverage.include='src/app/users/[uid]/page.jsx' --coverage.include='src/app/events/[id]/page.jsx' --coverage.include='src/app/posts/[id]/page.jsx' --coverage.reportsDirectory=/private/tmp/p2r3-app-coverage` exit 0, 10/10 tests passed, target page lines `39/39`.
  - Verified mock boundary limited to Next boundary/direct child clients/external Firebase SDK; no `@/lib/**`, `@/repo/**`, `@/service/**`, `@/runtime/**` mocks and no page-module mock.
  - Confirmed no `toHaveBeenCalledTimes`, sleep/setTimeout, inline disable, cspell disable, or `@ts-ignore`.

### T005 — Lane D: Member/profile/runs small UI gaps

- **Status**: `[x]`
- **Owner**: P2-E4
- **Reviewer**: P2-R4
- **Dependencies**: T001 `[x]`
- **Parallel**: T002, T003, T004
- **Files allowed**: `tests/integration/member/MemberPage.test.jsx`, updates to existing `tests/integration/strava/RunsLoginGuide.test.jsx`, optional focused tests for `PostDetailScreen.jsx`
- **Commit**: no; commit in T006

Engineer action:

1. Add `MemberPageScreen` tests for fallback runner name, user name/email display, avatar click callback, file input callback, name form submit, public profile link, and slot rendering.
2. Extend `RunsLoginGuide` tests to cover busy state success and error path by mocking `signInWithGoogle`.
3. Add focused `PostDetailScreen` tests only if ui layer still needs line lift after T003.
4. Keep tests behavior-level and avoid testing CSS modules directly.

Acceptance criteria:

- AC-T005.1: `src/ui/member/MemberPageScreen.jsx` improves from 0/2 to 2/2.
- AC-T005.2: `src/components/RunsLoginGuide.jsx` improves from 2/7 to at least 6/7.
- AC-T005.3: If `PostDetailScreen.jsx` is touched, tests assert visible behavior and callbacks, not implementation details.
- AC-T005.4: Targeted Vitest exits 0.
- AC-T005.5: No `src/**` file is changed unless it is an allowed minimal semantic query/testability fix under §2, with reviewer PASS evidence.

Evidence:

- Engineer: P2-E4 2026-05-02 PASS after app-boundary repair.
  - Added `tests/integration/member/MemberPage.test.jsx` through `@/app/member/page` and updated `tests/integration/strava/RunsLoginGuide.test.jsx`; did not modify production or `tasks.md`.
  - Removed the failed untracked direct-UI approach `tests/integration/member/MemberPageScreen.test.jsx`.
  - Covered `MemberPageScreen` through the real `useMemberPageRuntime` app-composed path: guest/logged-in headings, profile link, slot rendering, name submit, avatar click, and file upload.
  - Avatar upload assertions inspect external Firebase boundary payloads: storage ref path, uploaded Blob/content type, download URL ref, and Firestore `photoURL` update.
  - `npx eslint tests/integration/member/MemberPage.test.jsx tests/integration/strava/RunsLoginGuide.test.jsx` exit 0 with only the repo-existing React version warning.
  - `npx vitest run tests/integration/member/MemberPage.test.jsx tests/integration/strava/RunsLoginGuide.test.jsx --coverage --coverage.include=src/ui/member/MemberPageScreen.jsx --coverage.include=src/components/RunsLoginGuide.jsx --coverage.reportsDirectory=/private/tmp/p2e4-final-upload-coverage` exit 0, 2 files passed, 8 tests passed, target lines `9/9`.
  - `npx vitest run tests/unit/lib/test-bucket-policy.test.js` exit 0, 4 tests passed.
  - Confirmed no direct `@/ui/member/MemberPageScreen` import, no `@/runtime/**`, `@/repo/**`, or `@/service/**` mocks, no `fireEvent`, no `toHaveBeenCalledTimes` core assertion, no sleep/setTimeout, and no inline disable/cspell/`@ts-ignore`.
- Reviewer: P2-R4 2026-05-02 PASS after avatar upload repair.
  - Confirmed `MemberPage.test.jsx` imports the production app boundary via `@/app/member/page`, with no direct `@/ui/member/MemberPageScreen` import.
  - Confirmed no `vi.mock('@/runtime/**')`, `vi.mock('@/repo/**')`, or `vi.mock('@/service/**')`.
  - Confirmed avatar path is covered through app-composed runtime: click avatar image -> file input -> upload.
  - Core assertions inspect external Firebase boundary payloads: storage ref path `users/user-1/avatar.png`, upload Blob/content type, download URL input, Firestore `photoURL` cache-busted CDN URL, `photoUpdatedAt` server timestamp sentinel, and input reset.
  - `npx eslint tests/integration/member/MemberPage.test.jsx tests/integration/strava/RunsLoginGuide.test.jsx` exit 0 with only the repo-existing React version warning.
  - `npx vitest run tests/integration/member/MemberPage.test.jsx tests/integration/strava/RunsLoginGuide.test.jsx --coverage --coverage.include=src/ui/member/MemberPageScreen.jsx --coverage.include=src/components/RunsLoginGuide.jsx --coverage.reportsDirectory=/private/tmp/p2r4-final-upload-coverage` exit 0, 2 files/8 tests passed, statements/branches/functions/lines 100%.
  - `npx vitest run tests/unit/lib/test-bucket-policy.test.js` exit 0, 4 tests passed.

### T006 — Commit wave 3 batch 1

- **Status**: `[ ]`
- **Owner**: P2-E0
- **Reviewer**: P2-R0
- **Dependencies**: T002-T005 reviewer PASS
- **Parallel**: none
- **Files allowed**: test files from T002-T005, `tests/_helpers/**` helpers created by those tasks, reviewer-approved minimal `src/ui/**` / `src/components/**` / `src/app/**` semantic query fixes, this `tasks.md`
- **Commit**: yes

Engineer action:

1. Verify T002-T005 all reviewer PASS.
2. Run `npm run test:coverage`.
3. Extract total coverage and `src/ui/**`, `src/components/**`, `src/app/**` line coverage.
4. Run `npm run lint:changed` and targeted Vitest commands from T002-T005 if not already fresh.
5. Stage only allowed test/helper files, reviewer-approved minimal `src/ui/**` / `src/components/**` / `src/app/**` semantic query fixes, and this `tasks.md`; do not stage `coverage/`, `package-lock.json`, logs, temp files.
6. Commit with message:

```text
test(coverage): cover wave3 ui surfaces

Baseline change: ui/components/app coverage lifted for 026 S9 T54 evidence
```

Acceptance criteria:

- AC-T006.1: `npm run test:coverage` exits 0.
- AC-T006.2: `src/ui/**`, `src/components/**`, and `src/app/**` line coverage all improve over §1 baseline.
- AC-T006.3: `git diff --name-only --cached` contains only allowed files.
- AC-T006.4: `git log -1 --format=%B | grep -ic "Co-Authored-By"` returns 0 after commit.
- AC-T006.5: `package-lock.json` remains unstaged if it is still dirty.

Evidence:

- Engineer: P2-E0 2026-05-02 BLOCKED_COVERAGE_FRESH_VERIFY.
  - Third execution fresh verify.
  - Verified T002-T005 all have task status `[x]` and reviewer `PASS` before running gates.
  - Command: `npm run test:coverage`
    - Exit: 1.
    - Result: 159 test files passed, 1 test file failed; 1390 tests passed, 13 tests failed.
    - Failing file: `tests/integration/comments/CommentSection.test.jsx`.
    - Representative failures:
      - `should load more comments when sentinel intersects`: `mockedStartAfter` was not called.
      - `should show end hint when no more comments to load`: unable to find `/已顯示所有留言/`.
      - delete-flow tests could not find expected list/menu/alert state.
      - semantic list test expected 3 `listitem` elements but got 1.
    - Coverage totals were not accepted/extracted for commit evidence because the required coverage command exited non-zero.
  - BLOCKED: Commit 1 was not created. Per T006 policy, stopped before `lint:changed`, `type-check`, targeted Vitest, staging, and commit.
  - Commit 1 hash: `n/a`.
- Engineer: P2-E0 2026-05-02 BLOCKED_PRE_COMMIT.
  - Verified T002-T005 all have reviewer `PASS` and task status `[x]`.
  - Command: `npm run test:coverage`
    - Exit: 0.
    - Result: 160 test files passed, 1403 tests passed.
  - Fresh coverage from `coverage/coverage-summary.json`:
    - Total lines: `4280 / 4681 = 91.43%` (baseline `4121 / 4681 = 88.03%`).
    - `src/ui/**` lines: `110 / 123 = 89.43%` (S3 baseline `62.52%`; fresh/current baseline `96 / 123 = 78.05%`).
    - `src/components/**` lines: `739 / 853 = 86.64%` (S3 baseline `52.43%`; fresh/current baseline `639 / 853 = 74.91%`).
    - `src/app/**` lines: `136 / 151 = 90.07%` (S3 baseline `47.92%`; fresh/current baseline `93 / 151 = 61.59%`).
  - Command: `npm run lint:changed`
    - Exit: 0.
    - Output: repo-existing React version warning only.
  - Command: `npx vitest run tests/integration/events/EventMap.test.jsx tests/integration/events/EventsFilterPanel.test.jsx tests/integration/events/ParticipantsModal.test.jsx tests/integration/events/EventRouteEditor.test.jsx tests/integration/app/app-thin-entries.test.jsx tests/integration/member/MemberPage.test.jsx tests/integration/strava/RunsLoginGuide.test.jsx`
    - Exit: 0.
    - Result: 7 test files passed, 40 tests passed.
  - Dirty scope check:
    - `git diff --name-only` exit 0: `tests/integration/strava/RunsLoginGuide.test.jsx`.
    - `git ls-files -o --exclude-standard` exit 0: `specs/032-wave3-coverage-improvement/tasks.md`, `tests/integration/app/app-thin-entries.test.jsx`, `tests/integration/events/EventMap.test.jsx`, `tests/integration/events/EventRouteEditor.test.jsx`, `tests/integration/events/EventsFilterPanel.test.jsx`, `tests/integration/events/ParticipantsModal.test.jsx`, `tests/integration/member/MemberPage.test.jsx`.
    - No production files, `coverage/`, logs, temp files, or `package-lock.json` are part of the changed file set.
  - Files staged for attempted Commit 1: `specs/032-wave3-coverage-improvement/tasks.md`, `tests/integration/app/app-thin-entries.test.jsx`, `tests/integration/events/EventMap.test.jsx`, `tests/integration/events/EventRouteEditor.test.jsx`, `tests/integration/events/EventsFilterPanel.test.jsx`, `tests/integration/events/ParticipantsModal.test.jsx`, `tests/integration/member/MemberPage.test.jsx`, `tests/integration/strava/RunsLoginGuide.test.jsx`.
  - Command: `git commit -m "test(coverage): cover wave3 ui surfaces" -m "Baseline change: ui/components/app coverage lifted for 026 S9 T54 evidence"`
    - Exit: 1.
    - Result: pre-commit hook ran `eslint src specs tests --max-warnings 0` successfully with the repo-existing React version warning, then `tsc --noEmit` failed.
    - Type-check blockers:
      - `tests/integration/app/app-thin-entries.test.jsx`: `FieldValue` / `Timestamp` properties on `mockAdminFirestore`, `notFound` mock cast, and numeric post id fixture type.
      - `tests/integration/events/EventsFilterPanel.test.jsx`: mocked user missing `email`, `bio`, and `getIdToken`.
      - `tests/integration/member/MemberPage.test.jsx`: test user missing `getIdToken`, canvas context mock type mismatch, and unknown avatar/input element narrowing.
      - `tests/integration/strava/RunsLoginGuide.test.jsx`: `onClick` mock signature mismatch.
  - BLOCKED: Commit 1 was not created because the pre-commit type-check gate exited non-zero.
  - Commit 1 hash: `n/a`.
- Engineer: P2-E0 2026-05-02 PASS candidate, fourth execution.
  - Verified T002-T005 all have reviewer `PASS` and task status `[x]`.
  - Command: `npm run test:coverage`
    - Exit: 0.
    - Result: 160 test files passed, 1403 tests passed.
  - Fresh coverage from `coverage/coverage-summary.json`:
    - Total lines: `4280 / 4681 = 91.43%` (baseline `4121 / 4681 = 88.03%`).
    - `src/ui/**` lines: `110 / 123 = 89.43%` (S3 baseline `62.52%`; fresh/current baseline `96 / 123 = 78.05%`).
    - `src/components/**` lines: `739 / 853 = 86.64%` (S3 baseline `52.43%`; fresh/current baseline `639 / 853 = 74.91%`).
    - `src/app/**` lines: `136 / 151 = 90.07%` (S3 baseline `47.92%`; fresh/current baseline `93 / 151 = 61.59%`).
  - Command: `npm run lint:changed`
    - Exit: 0.
    - Output: repo-existing React version warning only.
  - Command: `npm run type-check`
    - Exit: 0.
  - Command: `npx vitest run tests/integration/events/EventMap.test.jsx tests/integration/events/EventsFilterPanel.test.jsx tests/integration/events/ParticipantsModal.test.jsx tests/integration/events/EventRouteEditor.test.jsx tests/integration/app/app-thin-entries.test.jsx tests/integration/member/MemberPage.test.jsx tests/integration/strava/RunsLoginGuide.test.jsx`
    - Exit: 0.
    - Result: 7 test files passed, 40 tests passed.
  - Command: `npx vitest run tests/unit/lib/test-bucket-policy.test.js`
    - Exit: 0.
    - Result: 1 test file passed, 4 tests passed.
  - Dirty scope check:
    - `git diff --name-only` exit 0: `tests/integration/strava/RunsLoginGuide.test.jsx`.
    - `git ls-files -o --exclude-standard` exit 0: `specs/032-wave3-coverage-improvement/tasks.md`, `tests/integration/app/app-thin-entries.test.jsx`, `tests/integration/events/EventMap.test.jsx`, `tests/integration/events/EventRouteEditor.test.jsx`, `tests/integration/events/EventsFilterPanel.test.jsx`, `tests/integration/events/ParticipantsModal.test.jsx`, `tests/integration/member/MemberPage.test.jsx`.
    - No production files, `coverage/`, logs, temp files, or `package-lock.json` are part of the changed file set.
  - Files staged for Commit 1: `specs/032-wave3-coverage-improvement/tasks.md`, `tests/integration/app/app-thin-entries.test.jsx`, `tests/integration/events/EventMap.test.jsx`, `tests/integration/events/EventRouteEditor.test.jsx`, `tests/integration/events/EventsFilterPanel.test.jsx`, `tests/integration/events/ParticipantsModal.test.jsx`, `tests/integration/member/MemberPage.test.jsx`, `tests/integration/strava/RunsLoginGuide.test.jsx`.
  - Commit 1 message: `test(coverage): cover wave3 ui surfaces`.
  - Commit 1 hash: `<pending>`.
- Reviewer:

### T007 — Lane E triage: decide if residual component gaps need another batch

- **Status**: `[ ]`
- **Owner**: P2-E5
- **Reviewer**: P2-R5
- **Dependencies**: T006 `[x]`
- **Parallel**: blocks T008-T009
- **Files allowed**: this `tasks.md` only unless reviewer approves T008/T009 scope
- **Commit**: no

Engineer action:

1. Read post-T006 `coverage/coverage-summary.json`.
2. Compare against target candidates: ui 83.05%, components 79.91%, app 66.59%.
3. If all three are at/above target candidates, mark T008/T009 not needed in evidence and proceed to T010.
4. If any layer is still short, select the smallest next file set from the low-coverage table and write exact scope in T008/T009 evidence before implementation starts.

Acceptance criteria:

- AC-T007.1: Triage uses fresh post-T006 coverage, not §1 baseline.
- AC-T007.2: Decision is exactly `ENOUGH_FOR_S9_T54` or `NEEDS_BATCH_2: <layers/files>`.
- AC-T007.3: Reviewer agrees that selected files are the smallest useful set.

Evidence:

- Engineer:
- Reviewer:

### T008 — Optional batch 2: comments / notification component residuals

- **Status**: `[ ]`
- **Owner**: P2-E5
- **Reviewer**: P2-R5
- **Dependencies**: T007 decision `NEEDS_BATCH_2`
- **Parallel**: T009 if scopes do not overlap
- **Files allowed**: existing tests under `tests/integration/comments/**`, `tests/integration/notifications/**`, or new focused component tests in those domains
- **Commit**: no; commit in T010

Engineer action:

1. Target only files named by T007.
2. Prefer extending existing tests over adding broad new suites.
3. Cover real user behavior: menus open/close, edit/delete confirm flows, loading/error/empty states.
4. Avoid increasing test flakiness or heavy fixture size.

Acceptance criteria:

- AC-T008.1: The deficient layer named by T007 improves enough to meet target, or evidence explains exact remaining blocker.
- AC-T008.2: Targeted Vitest exits 0.
- AC-T008.3: No `src/**` file is changed unless it is an allowed minimal semantic query/testability fix under §2, with reviewer PASS evidence.
- AC-T008.4: No `toHaveBeenCalledTimes(N)` is added for async UI behavior unless reviewer accepts it as non-flaky and explains why.

Evidence:

- Engineer:
- Reviewer:

### T009 — Optional batch 2: app/layout thin-entry residuals

- **Status**: `[ ]`
- **Owner**: P2-E3
- **Reviewer**: P2-R3
- **Dependencies**: T007 decision `NEEDS_BATCH_2`
- **Parallel**: T008 if scopes do not overlap
- **Files allowed**: tests under `tests/unit/app/**` or `tests/integration/app/**`
- **Commit**: no; commit in T010

Engineer action:

1. Target only app files named by T007.
2. For layout/page files with 1-4 uncovered lines, add the smallest test that imports/renders the entry and verifies child handoff.
3. Do not over-test Next.js framework behavior.

Acceptance criteria:

- AC-T009.1: `src/app/**` reaches at least baseline +5 candidate or T007/T009 evidence records blocker.
- AC-T009.2: Targeted Vitest exits 0.
- AC-T009.3: No `src/**` file is changed unless it is an allowed minimal route/page handoff or metadata testability fix under §2, with reviewer PASS evidence.

Evidence:

- Engineer:
- Reviewer:

### T010 — Commit optional batch 2 or record no-op

- **Status**: `[ ]`
- **Owner**: P2-E0
- **Reviewer**: P2-R0
- **Dependencies**: T007 `[x]`; T008/T009 if needed
- **Parallel**: none
- **Files allowed**: T008/T009 test files, reviewer-approved minimal `src/ui/**` / `src/components/**` / `src/app/**` semantic query fixes, this `tasks.md`
- **Commit**: yes only if T008/T009 changed files

Engineer action:

1. If T007 says `ENOUGH_FOR_S9_T54` and no files changed after T006, record no-op and do not commit.
2. If T008/T009 changed files, run targeted tests, `npm run test:coverage`, and `npm run lint:changed`.
3. Stage only allowed files.
4. Commit with message:

```text
test(coverage): finish wave3 coverage lift

Baseline change: ui/components/app coverage ready for 026 S9 T54 evidence
```

Acceptance criteria:

- AC-T010.1: No-op path leaves git history untouched and records why.
- AC-T010.2: Commit path has clean allowed staged file list and no generated artifacts.
- AC-T010.3: Commit message has no `Co-Authored-By`.

Evidence:

- Engineer:
- Reviewer:

### T011 — Final gate + handoff.md evidence package

- **Status**: `[ ]`
- **Owner**: P2-E0
- **Reviewer**: P2-R0
- **Dependencies**: T006 `[x]`, T010 `[x]` or no-op
- **Parallel**: none
- **Files allowed**: `specs/032-wave3-coverage-improvement/handoff.md`, this `tasks.md`
- **Commit**: no; commit in T012

Engineer action:

1. Run final gate commands:

   ```bash
   npm run test:coverage
   # targeted Vitest: list every test file changed by T002-T009
   npx vitest run <changed-test-files>
   npm run lint -- --max-warnings 0
   npm run type-check
   npm run depcruise
   npm run spellcheck
   npx vitest run --project=browser
   bash scripts/audit-mock-boundary.sh
   bash scripts/audit-flaky-patterns.sh
   ```

2. Extract final total coverage and `src/ui/**`, `src/components/**`, `src/app/**` line coverage.
3. Record deltas from both S3 Baseline before (`62.52 / 52.43 / 47.92`) and Team P2 fresh/current baseline (`78.05 / 74.91 / 61.59`).
4. Record exact commit hashes from T006 and T010 if T010 committed.
5. Create or update `specs/032-wave3-coverage-improvement/handoff.md` as the authoritative handoff deliverable.
6. `handoff.md` must include these exact strings:

   ```text
   Wave 3 coverage-improvement evidence for ui/components/app exists.
   Baseline before
   Fresh after
   Commit hash
   S9 T54 can treat this as coverage-improvement evidence.
   ```

7. Write PR-ready handoff evidence in `handoff.md`; keep this `tasks.md` evidence concise and point to the handoff section.

Acceptance criteria:

- AC-T011.1: All final gate commands exit 0, including targeted Vitest for every changed test file.
- AC-T011.2: Final evidence includes total lines/statements/branches/functions.
- AC-T011.3: Final evidence includes ui/components/app `Baseline before`, fresh/current baseline, `Fresh after`, delta from S3 baseline, delta from current baseline, and target verdict.
- AC-T011.4: `handoff.md` includes all exact strings required above.
- AC-T011.5: `handoff.md` explicitly says: `This is 026 S9 T54 Wave 3 coverage evidence, not S9 threshold implementation.`
- AC-T011.6: If any target candidate is missed, evidence uses `BLOCKED_FOR_S9_T54: <layer> current X target Y` and T012 does not claim ready.
- AC-T011.7: Every external/browser mock added during T002-T009 has a reason recorded in test comments or task evidence.

Evidence:

- Engineer:
- Reviewer:

### T012 — Final handoff docs commit

- **Status**: `[ ]`
- **Owner**: P2-E0
- **Reviewer**: P2-R0
- **Dependencies**: T011 reviewer PASS
- **Parallel**: none
- **Files allowed**: `specs/032-wave3-coverage-improvement/tasks.md`, `specs/032-wave3-coverage-improvement/handoff.md`
- **Commit**: yes

Engineer action:

1. Run `git -C /Users/chentzuyu/Desktop/dive-into-run-032-wave3-coverage-improvement status --short --branch`.
2. If any unrelated dirty file exists, T012 cannot proceed until it is resolved by owner-approved action. Do not silently ignore it, and do not revert someone else's work without approval.
3. Stage only `tasks.md` and `handoff.md`.
4. Commit with message:

```text
docs(coverage): record wave3 evidence plan

Refs: 026 S9 T54 precondition
```

5. After commit, run:

   ```bash
   git -C /Users/chentzuyu/Desktop/dive-into-run-032-wave3-coverage-improvement log -1 --format=%B
   git -C /Users/chentzuyu/Desktop/dive-into-run-032-wave3-coverage-improvement status --short --branch
   ```

Acceptance criteria:

- AC-T012.1: `git diff --name-only --cached` contains only `specs/032-wave3-coverage-improvement/tasks.md` and `specs/032-wave3-coverage-improvement/handoff.md`.
- AC-T012.2: Commit message has no `Co-Authored-By`.
- AC-T012.3: Post-commit `git status --short --branch` is clean. Any pre-existing unrelated dirty file is a blocker until resolved; it cannot remain documented as a successful final state.
- AC-T012.4: No push or PR is done.
- AC-T012.5: `handoff.md` is included in the commit and contains the exact strings required by T011.

Evidence:

- Engineer:
- Reviewer:

## 6. Handoff Evidence

Use this section as the compact-safe task ledger. The authoritative final handoff deliverable is `specs/032-wave3-coverage-improvement/handoff.md`; do not replace it with this section.

### Current setup evidence

- Worktree existed before Team P2 takeover.
- `git -C /Users/chentzuyu/Desktop/dive-into-run worktree list` includes `/Users/chentzuyu/Desktop/dive-into-run-032-wave3-coverage-improvement` on branch `032-wave3-coverage-improvement`.
- Fresh baseline command `npm run test:coverage` exited 0.
- Team P2 takeover initially observed `package-lock.json` as modified, but final planning status showed no package-lock diff. If it reappears, treat it as unrelated and leave it untouched.

### Required `handoff.md` template

```text
Wave 3 coverage-improvement evidence for ui/components/app exists.
This is 026 S9 T54 Wave 3 coverage evidence, not S9 threshold implementation.
S9 T54 can treat this as coverage-improvement evidence.

Baseline before
- src/ui/**: 62.52%
- src/components/**: 52.43%
- src/app/**: 47.92%

Fresh/current baseline
- src/ui/**: 78.05%
- src/components/**: 74.91%
- src/app/**: 61.59%

Fresh after
- src/ui/**: <final percent> (<delta from Baseline before>, <delta from fresh/current baseline>)
- src/components/**: <final percent> (<delta from Baseline before>, <delta from fresh/current baseline>)
- src/app/**: <final percent> (<delta from Baseline before>, <delta from fresh/current baseline>)

Commands:
- npm run test:coverage => exit <code>
- npx vitest run <changed-test-files> => exit <code>
- npm run lint -- --max-warnings 0 => exit <code>
- npm run type-check => exit <code>
- npm run depcruise => exit <code>
- npm run spellcheck => exit <code>
- npx vitest run --project=browser => exit <code>
- bash scripts/audit-mock-boundary.sh => exit <code>
- bash scripts/audit-flaky-patterns.sh => exit <code>

Final coverage:
- total lines/statements/branches/functions: ...

Commit hash
- T006: <hash or n/a>
- T010: <hash or n/a>
- T012: <hash or n/a>

Post-commit status:
- git status --short --branch: clean

Blockers:
- none | BLOCKED_FOR_S9_T54: ...
```
