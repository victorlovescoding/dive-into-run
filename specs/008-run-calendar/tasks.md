# Tasks: Run Calendar

**Input**: Design documents from `/specs/008-run-calendar/`
**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/components.md, quickstart.md

**Tests**: Unit tests included (plan.md lists test files). Integration test in Polish phase.

**Organization**: Optimized for subagent parallel execution. Phase 2 has 9 fully parallelizable tasks across different files.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies on incomplete tasks)
- **[Story]**: Which user story this task belongs to (US1, US2, US3, US4)
- Include exact file paths in descriptions

---

## Phase 2: Foundational (9 Parallel Tasks)

**Purpose**: All independent building blocks — helper functions, service layer, SVG icons, unit tests. Each task touches a unique file with zero inter-dependencies.

**9 subagents can execute simultaneously.**

- [x] T001 [P] Add `RUN_TYPE_LABELS` constant, `buildCalendarGrid()`, `groupActivitiesByDay()`, `calcMonthSummary()` to `src/lib/strava-helpers.js` — follow signatures in `specs/008-run-calendar/contracts/components.md` and types in `specs/008-run-calendar/data-model.md`
- [x] T002 [P] Add `getStravaActivitiesByMonth(uid, year, month)` to `src/lib/firebase-strava.js` — Firestore range query using `where('uid','==',uid)` + `where('startDate','>=',monthStart)` + `where('startDate','<',nextMonthStart)`, see `specs/008-run-calendar/research.md` R1
- [x] T003 [P] Create `CalendarIcon` SVG component in `src/components/icons/CalendarIcon.jsx` — inline SVG, props: `size` (default 16), `className`, see `specs/008-run-calendar/contracts/components.md` shared icon interface
- [x] T004 [P] Create `RunOutdoorIcon` SVG component (runner silhouette) in `src/components/icons/RunOutdoorIcon.jsx` — same props interface as T003
- [x] T005 [P] Create `RunIndoorIcon` SVG component (treadmill) in `src/components/icons/RunIndoorIcon.jsx` — same props interface as T003
- [x] T006 [P] Create `RunTrailIcon` SVG component (person running in mountains) in `src/components/icons/RunTrailIcon.jsx` — same props interface as T003
- [x] T007 [P] Create unit test for `buildCalendarGrid` in `specs/008-run-calendar/tests/unit/buildCalendarGrid.test.js` — test month-start alignment, correct day count, null padding, edge cases (Feb leap year, months starting on Sunday/Saturday)
- [x] T008 [P] Create unit test for `groupActivitiesByDay` in `specs/008-run-calendar/tests/unit/groupActivitiesByDay.test.js` — test grouping by `startDateLocal`, same-type distance aggregation, multi-type same day, empty input, type sort order (Run > VirtualRun > TrailRun)
- [x] T009 [P] Create unit test for `calcMonthSummary` in `specs/008-run-calendar/tests/unit/calcMonthSummary.test.js` — test total distance, per-type subtotals, types with zero records excluded from `byType`, empty map, label mapping correctness

**Checkpoint**: All building blocks ready. Unit tests written.

---

## Phase 3: User Story 1+2+3 — Core Calendar (Priority: P1) 🎯 MVP

**Goal**: 在 runs 頁面點擊月曆按鈕，彈出月曆 dialog 顯示當月日曆、三種跑步類型圖示、公里數、月份總結、及月份切換

**Independent Test**: 登入並連接 Strava 後，進入 runs 頁面，點擊月曆按鈕，確認 dialog 顯示當月日曆網格、跑步紀錄日期以淡綠底色 + 類型圖示 + 公里數標示、底部顯示總里程及各類型小計

**Note**: US4（月份切換）為 P2 但與 dialog 共用同一元件檔，為避免 subagent 同檔衝突，併入 T011 一起實作。

### Implementation

- [x] T010 [US1] Create `useRunCalendar` hook in `src/hooks/useRunCalendar.js` — call `getStravaActivitiesByMonth`, pipe through `groupActivitiesByDay` + `calcMonthSummary`, manage loading/error state, return `{ dayMap, monthSummary, isLoading, error }`, see `specs/008-run-calendar/contracts/components.md` hook contract (depends: T001, T002)
- [x] T011 [US1][US2][US3][US4] Create `RunCalendarDialog` component in `src/components/RunCalendarDialog.jsx` + styles in `src/components/RunCalendarDialog.module.css` — native `<dialog>` with `showModal()`/`close()`, calendar header with month title + prev/next navigation (US4), 7-column grid with weekday headers (日~六), day cells rendering type-specific icons + km (US2), light-green background for days with runs, month summary footer with total + per-type subtotals (US3), loading indicator + error state, close via backdrop/button/Escape, desktop centered modal (max-width ~420px) + mobile fullscreen, see `specs/008-run-calendar/contracts/components.md` full component contract (depends: T003–T006, T010)
- [x] T012 [US1] Add calendar button to runs page header in `src/app/runs/page.jsx` + button styles in `src/app/runs/runs.module.css` — import `CalendarIcon` + `RunCalendarDialog`, manage `open`/`onClose` state, only show button when user has Strava connection (depends: T003, T011)

**Checkpoint**: Full calendar feature functional — grid, icons, summary, month navigation all working

---

## Phase 4: Polish & Verification

**Purpose**: Test verification + code quality checks

- [x] T013 [P] Verify unit tests pass — run `npx vitest run specs/008-run-calendar/tests/unit/` and fix any failures (depends: T001, T007–T009)
- [x] T014 [P] Create integration test in `specs/008-run-calendar/tests/integration/RunCalendarDialog.test.jsx` — test dialog open/close, calendar grid rendering, icon display per activity type, month summary values, month navigation, use `@testing-library/user-event` + `screen.getByRole`, mock `useRunCalendar` hook, assert calendar data loads within 2s (SC-003/SC-004) (depends: T012)
- [x] T015 Run `npm run type-check` and `npm run lint` — fix all errors and warnings (depends: T012)
- [x] T016 [P] Create E2E happy path test in `specs/008-run-calendar/tests/e2e/run-calendar.spec.js` — 登入已連接 Strava 使用者，進入 runs 頁面，點擊月曆按鈕，確認 dialog 開啟、日曆網格顯示、有跑步日期顯示圖示+公里數、底部總里程正確、月份切換正常，使用 `page.getByRole` locators (depends: T012)

---

## Dependencies & Execution Order

### Phase Dependencies

- **Foundational (Phase 2)**: No dependencies — start immediately, all 9 tasks in parallel
- **Core Calendar (Phase 3)**: Sequential chain T010 → T011 → T012, each depends on prior
- **Polish (Phase 4)**: T013 can start after Phase 2; T014+T015+T016 require T012

### Batch Execution Plan (subagent parallelism)

```
Batch 1 — 9 parallel subagents (Phase 2):
  T001, T002, T003, T004, T005, T006, T007, T008, T009

Batch 2 — 2 parallel subagents:
  T010 (hook — needs T001+T002)
  T013 (unit test verify — needs T001+T007-T009)

Batch 3 — 1 subagent:
  T011 (dialog — needs T003-T006+T010)

Batch 4 — 1 subagent:
  T012 (page integration — needs T003+T011)

Batch 5 — 3 parallel subagents:
  T014 (integration test — needs T012)
  T015 (type-check + lint — needs T012)
  T016 (E2E test — needs T012)
```

### User Story Tracing

| Story | Priority | Tasks                              | Description           |
| ----- | -------- | ---------------------------------- | --------------------- |
| US1   | P1       | T001, T002, T003, T010, T011, T012 | 查看當月跑步月曆      |
| US2   | P1       | T004–T006, T011                    | 區分三種跑步類型圖示  |
| US3   | P1       | T001, T010, T011                   | 月曆底部當月跑步總結  |
| US4   | P2       | T011                               | 月份切換（prev/next） |

### Parallel Opportunities

- **Batch 1**: 9 tasks simultaneously (all different files, zero deps)
- **Batch 2**: T010 + T013 (hook creation + unit test verification)
- **Batch 5**: T014 + T015 + T016 (integration test + lint + E2E)

---

## Parallel Example: Phase 2

```bash
# Launch all 9 foundational tasks as parallel subagents:
Agent 1: "Add helpers + constants to src/lib/strava-helpers.js"
Agent 2: "Add getStravaActivitiesByMonth to src/lib/firebase-strava.js"
Agent 3: "Create CalendarIcon in src/components/icons/CalendarIcon.jsx"
Agent 4: "Create RunOutdoorIcon in src/components/icons/RunOutdoorIcon.jsx"
Agent 5: "Create RunIndoorIcon in src/components/icons/RunIndoorIcon.jsx"
Agent 6: "Create RunTrailIcon in src/components/icons/RunTrailIcon.jsx"
Agent 7: "Unit test for buildCalendarGrid"
Agent 8: "Unit test for groupActivitiesByDay"
Agent 9: "Unit test for calcMonthSummary"
```

---

## Implementation Strategy

### MVP First (US1+US2+US3+US4)

1. Complete Phase 2: Foundational (9 parallel tasks)
2. Complete Phase 3: T010 → T011 → T012 (sequential chain)
3. **STOP and VALIDATE**: Calendar dialog fully functional with all features
4. Complete Phase 4: Tests + lint

### Incremental Delivery

1. Phase 2 → All building blocks ready (helpers, service, icons, tests)
2. T010 → Hook fetches + aggregates monthly data
3. T011 → Dialog renders complete calendar (grid, icons, summary, navigation)
4. T012 → Button on runs page → Dialog opens → Feature complete
5. Phase 4 → Quality verification + integration test

---

## Notes

- All 4 user stories share `RunCalendarDialog.jsx` — separating US4 into its own phase would cause same-file subagent conflicts, so it's folded into T011
- SVG icons are self-made inline SVG (FR-014), no external icon library
- Native `<dialog>` follows existing `CommentEditModal` pattern
- `month` parameter uses JavaScript convention: 0-11
- Distance display: `(meters / 1000).toFixed(1)` + ` km`
