# Code Review — 008-run-calendar

日期：2026-04-07（Re-review #3）

---

## Taste Rating: 🟢 **Good taste** — Clean architecture, all critical issues resolved, elegant solutions throughout

The data pipeline (`Firestore → groupActivitiesByDay → calcMonthSummary → UI`) remains clean and testable. All three critical blockers from the previous review are now fixed with good-taste solutions. The `loaded`-state pattern in `useRunCalendar` is a clever alternative to setState-in-effect. The single `{ year, month }` state eliminates all month-boundary special cases. `TYPE_ORDER.filter().map()` enforces deterministic ordering. No over-engineering.

---

## Linus's Three Questions

1. **Is this solving a real problem?** — Yes. Monthly calendar view for run tracking is a clear user need.
2. **Is there a simpler way?** — No. The approach is lean: native `<dialog>`, no date library, client-side aggregation. State management is now atomic.
3. **What will this break?** — Nothing in existing code. All changes are additive. Low risk.

---

## **[CRITICAL ISSUES]**

None. All three blockers from the previous review are resolved:

| Previous Issue                               | Status   | Solution                                                            |
| -------------------------------------------- | -------- | ------------------------------------------------------------------- |
| C1. ESLint `react-hooks/set-state-in-effect` | ✅ Fixed | `loaded` state + derived `isLoading` outside effect                 |
| C2. Non-atomic `currentYear`/`currentMonth`  | ✅ Fixed | Single `{ year, month }` object state, `new Date()` arithmetic      |
| C3. JSDoc lint warnings (6 total)            | ✅ Fixed | `@param {number} [props.size]` without defaults, added descriptions |

---

## **[IMPROVEMENT OPPORTUNITIES]**

### I1. Inline distance formatting inconsistency — LOW PRIORITY, ACKNOWLEDGED

**[src/components/RunCalendarDialog.jsx, Line 158]**

Day cells use `(run.totalMeters / 1000).toFixed(1)` inline, while the footer uses `formatDistance()`. The formats are intentionally different — day cells omit the "km" suffix for space economy. This is a defensible trade-off in a constrained UI, not a DRY violation per se.

If you later add more display contexts, extract a `formatKm(meters, { suffix: boolean })` helper. Not blocking.

### I2. Verbose iteration patterns — STYLE ONLY

**[src/lib/strava-helpers.js, Lines 123, 160]**

`Array.from(intermediate.entries()).forEach(...)` where `for...of` works. With `checkJs: true`, `Array.from` may be needed for Map iteration type safety. Not worth changing if it passes type-check.

### I3. Stale data flash on month navigation — MINOR UX

**[src/hooks/useRunCalendar.js, Lines 71-78]** + **[src/components/RunCalendarDialog.jsx, Lines 149-165]**

When navigating months, `isLoading` becomes true but the grid still renders the previous month's `dayMap` (stale data) while the footer hides via `!isLoading` check. The loading indicator appears _above_ the stale grid. Behavior is inconsistent — either show old data everywhere or hide it everywhere.

Not a bug (data refreshes within ~200ms on fast connections), but on slow networks users briefly see last month's runs in the new month's grid.

**Fix** (if desired): Wrap the grid in the same `!isLoading && !error` guard as the footer, or accept the stale-while-revalidate behavior as intentional.

---

## **[STYLE NOTES]**

### S1. `getRunIcon` fallback silently masks unknown types — UNCHANGED

**[src/components/RunCalendarDialog.jsx, Line 24]**

```js
return RUN_ICON_MAP[type] || RunOutdoorIcon;
```

Silent fallback means new Strava activity types won't be noticed. Fine for now. Consider a `console.warn` in dev if the Strava API starts returning new types.

### S2. CSS hardcoded colors — UNCHANGED, ACCEPTABLE

**[src/components/RunCalendarDialog.module.css]** — Raw hex values (`#e8f5e9`, `#333`, `#1976d2`, `#d32f2f`). No theme system exists in this project. Flag if one is introduced.

---

## **[TESTING GAPS]**

### TG1. Integration test mocks the unit under test — UNCHANGED, PRAGMATIC

**[specs/008-run-calendar/tests/integration/RunCalendarDialog.test.jsx]**

The test mocks `useRunCalendar` entirely. This verifies the component's rendering logic but not the data pipeline integration (`getStravaActivitiesByMonth → groupActivitiesByDay → calcMonthSummary → UI`). Given jsdom `<dialog>` limitations and the unit tests already covering the helper functions, this is a pragmatic tradeoff. Naming is slightly misleading ("integration" when it's closer to "component render test").

### TG2. No test for error state rendering — EASY WIN

No test verifies that `{ error: '載入失敗', isLoading: false }` renders the error alert with `role="alert"`. One simple test case:

```js
it('error 狀態顯示 alert', () => {
  mockedUseRunCalendar.mockReturnValue({
    dayMap: new Map(),
    monthSummary: { totalMeters: 0, byType: [] },
    isLoading: false,
    error: '載入失敗',
  });
  render(<RunCalendarDialog open={true} onClose={vi.fn()} />);
  expect(screen.getByRole('alert')).toHaveTextContent('載入失敗');
});
```

### TG3. No test for loading state rendering — EASY WIN

No test for `{ isLoading: true }` showing the loading indicator text.

### TG4. E2E tests globally skipped — UNCHANGED, DOCUMENTED

All E2E tests remain skipped via `test.skip(true)`. Documented and reasonable (auth fixture needed). Zero E2E coverage.

---

## **[TASK GAPS]**

### Task Completeness Cross-Reference

| Task | Status | Diff Match | Notes                                                                                     |
| ---- | ------ | ---------- | ----------------------------------------------------------------------------------------- |
| T001 | ✅ [x] | ✅         | `strava-helpers.js` — all 4 exports present, `TYPE_ORDER` deterministic ordering          |
| T002 | ✅ [x] | ✅         | `firebase-strava.js` — `getStravaActivitiesByMonth` correct                               |
| T003 | ✅ [x] | ✅         | `CalendarIcon.jsx` present, JSDoc clean                                                   |
| T004 | ✅ [x] | ✅         | `RunOutdoorIcon.jsx` present, JSDoc clean                                                 |
| T005 | ✅ [x] | ✅         | `RunIndoorIcon.jsx` present, JSDoc clean                                                  |
| T006 | ✅ [x] | ✅         | `RunTrailIcon.jsx` present, JSDoc clean                                                   |
| T007 | ✅ [x] | ✅         | `buildCalendarGrid.test.js` — 8/8 passing                                                 |
| T008 | ✅ [x] | ✅         | `groupActivitiesByDay.test.js` — 5/5 passing, `makeActivity` includes all required fields |
| T009 | ✅ [x] | ✅         | `calcMonthSummary.test.js` — 5/5 passing                                                  |
| T010 | ✅ [x] | ✅         | `useRunCalendar.js` — derived `isLoading`, no setState-in-effect                          |
| T011 | ✅ [x] | ✅         | Dialog complete: grid, icons, summary, month nav, **backdrop click-to-close**             |
| T012 | ✅ [x] | ✅         | `page.jsx` + `runs.module.css` — conditional mounting                                     |
| T013 | ✅ [x] | ✅         | Unit tests verified — 18/18 passing                                                       |
| T014 | ✅ [x] | ✅         | Integration test — 9/9 passing                                                            |
| T015 | ✅ [x] | ✅         | **ESLint 0 errors, 0 warnings. Type-check 0 new errors.**                                 |
| T016 | ✅ [x] | ⚠️         | E2E test file present but globally `test.skip(true)`. 0% executed.                        |

### Findings

- **All tasks match their implementations.** T015 now genuinely passes — `npm run lint` confirms zero errors/warnings.
- **No scope creep** — all code changes map to defined tasks.

---

## **VERDICT:**

✅ **Worth merging** — All critical blockers resolved. Clean code, correct architecture, passing lint and type-check.

**Optional before merge** (non-blocking):

1. Add error state test (TG2) — 5-line test case, easy win
2. Add loading state test (TG3) — equally trivial

**Post-merge / future improvements:**

- Extract distance formatting if more display contexts appear (I1)
- Add E2E auth fixture to enable skipped tests (TG4)

## **KEY INSIGHT:**

The fixes demonstrate good engineering instinct: the `loaded`-state pattern in `useRunCalendar` doesn't just suppress a lint error — it fundamentally separates "what data have we fetched" (state) from "are we still waiting" (derived). The `{ year, month }` single-state fix in the dialog doesn't just batch two setStates — it eliminates the entire category of month-boundary edge cases by making the impossible state unrepresentable. These are the kind of fixes that make code simpler, not just compliant.
