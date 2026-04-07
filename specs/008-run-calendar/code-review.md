# Code Review — 008-run-calendar

日期：2026-04-07（Re-review #2）

---

## Taste Rating: 🟡 **Acceptable** — Works but has a few rough edges that need cleaning

The architecture is solid: pure helper functions, thin service layer, hook for orchestration, dumb dialog component. The data pipeline (`Firestore → groupActivitiesByDay → calcMonthSummary → UI`) is clean and testable. No over-engineering.

**However: all critical issues and improvement opportunities from the first review remain unaddressed.** The source code is unchanged between reviews. This re-review confirms the same findings.

---

## Linus's Three Questions

1. **Is this solving a real problem?** — Yes. Monthly calendar view for run tracking is a clear user need.
2. **Is there a simpler way?** — Mostly no. The approach is lean: native `<dialog>`, no date library, client-side aggregation. But month navigation state could be simpler (see C2).
3. **What will this break?** — Nothing in existing code. All changes are additive. Low risk.

---

## **[CRITICAL ISSUES]**

### C1. ESLint Error in `useRunCalendar.js` — `react-hooks/set-state-in-effect` ⛔ STILL PRESENT

**[src/hooks/useRunCalendar.js, Lines 38-43]** **Breaking lint rule**

```
39:7  Error: Calling setState synchronously within an effect can trigger cascading renders
      react-hooks/set-state-in-effect
```

The `!user` early return path calls four `setState` in a row synchronously inside `useEffect`:

```js
useEffect(() => {
  if (!user) {
    setDayMap(new Map()); // ← setState #1
    setMonthSummary(EMPTY_SUMMARY); // ← setState #2
    setIsLoading(false); // ← setState #3
    setError(null); // ← setState #4
    return undefined;
  }
  // ...
}, [user, year, month]);
```

This is a lint **Error**, not a warning. CLAUDE.md Rule #5 says type-check and lint must pass. **Hard blocker.**

**Fix**: Don't reset state inside the effect. Let the component derive "empty" from `!user`:

```js
useEffect(() => {
  if (!user) return undefined;
  // ... fetch logic only
}, [user, year, month]);

// Outside the effect: derive empty state from user being null
const effectiveDayMap = user ? dayMap : new Map();
const effectiveSummary = user ? monthSummary : EMPTY_SUMMARY;
```

Or: reduce four `useState` into one `useReducer` with a `RESET` action.

### C2. `handlePrevMonth` / `handleNextMonth` — Non-atomic state update ⚠️ STILL PRESENT

**[src/components/RunCalendarDialog.jsx, Lines 40-41, 64-81]** **Data Structure / State Design**

Two separate `useState` for `currentYear` and `currentMonth`:

```js
const [currentYear, setCurrentYear] = useState(now.getFullYear());
const [currentMonth, setCurrentMonth] = useState(now.getMonth());

function handlePrevMonth() {
  if (currentMonth === 0) {
    // ← special case: shouldn't exist
    setCurrentYear((y) => y - 1);
    setCurrentMonth(11);
  } else {
    setCurrentMonth((m) => m - 1);
  }
}
```

Problems:

1. **Two states for one concept** ("which month are we looking at") — fragile, even if React 18 batches in event handlers today.
2. **Special-case code** for December↔January boundary — the hallmark of a wrong data structure.

**Fix**: Single `{ year, month }` object state eliminates all special cases:

```js
const [current, setCurrent] = useState(() => {
  const now = new Date();
  return { year: now.getFullYear(), month: now.getMonth() };
});

function handlePrevMonth() {
  setCurrent((prev) => {
    const d = new Date(prev.year, prev.month - 1, 1);
    return { year: d.getFullYear(), month: d.getMonth() };
  });
}
```

`new Date(2026, -1, 1)` correctly gives December 2025. Zero edge cases. Also fixes I2 (`new Date()` on every render) as a side effect via the lazy initializer.

### C3. JSDoc Lint Warnings on Icon Components — 6 warnings ⚠️ NEW FINDING

**[src/components/icons/RunOutdoorIcon.jsx, RunIndoorIcon.jsx, RunTrailIcon.jsx]** **Lint warnings**

```
3:1  Warning: Missing JSDoc @param "props" description.  jsdoc/require-param-description
4:1  Warning: Defaults are not permitted on @param.      jsdoc/no-defaults
```

Each of the 3 icon components has 2 warnings = 6 total. T015 says "fix all errors and warnings."

Current:

```js
 * @param {object} props
 * @param {number} [props.size=16] - 圖示尺寸。
```

**Fix**:

```js
 * @param {object} props - 元件屬性。
 * @param {number} [props.size] - 圖示尺寸（寬高相同），預設 16。
```

---

## **[IMPROVEMENT OPPORTUNITIES]**

### I1. `RunCalendarDialog` renders hook + grid even when `open=false` — STILL PRESENT

**[src/app/runs/page.jsx, Line 165]** **Wasted Resources**

```jsx
<RunCalendarDialog open={calendarOpen} onClose={() => setCalendarOpen(false)} />
```

The component is always mounted. When `open=false`, `useRunCalendar` still fires a Firestore query on every render. Wasted network + CPU.

**Fix**: Conditionally mount:

```jsx
{
  calendarOpen && <RunCalendarDialog open={calendarOpen} onClose={() => setCalendarOpen(false)} />;
}
```

This is a one-line change that eliminates unnecessary Firestore calls.

### I2. `new Date()` called on every render — STILL PRESENT (resolved by C2 fix)

**[src/components/RunCalendarDialog.jsx, Line 39]**

If you adopt the C2 fix with a lazy initializer `useState(() => { ... })`, this issue goes away automatically.

### I3. Inline distance formatting inconsistency — STILL PRESENT

**[src/components/RunCalendarDialog.jsx, Line 149]**

Day cells use `(run.totalMeters / 1000).toFixed(1)` inline, while the footer uses `formatDistance()`. Conversion logic is duplicated. Low priority — the formula is trivial — but violates DRY.

### I4. `calcMonthSummary` `byType` order non-deterministic — STILL PRESENT

**[src/lib/strava-helpers.js, Lines 167-173]** **Data Structure Bug**

```js
const byType = Array.from(typeAccum.entries()).map(([type, meters]) => ({
  type,
  totalMeters: meters,
  label: RUN_TYPE_LABELS[type] || type,
}));
```

`typeAccum` is a regular Map. The iteration order depends on which type was encountered first across all days. If VirtualRun appears on day 1 and Run on day 5, `byType` will be `[VirtualRun, Run]` — not the expected `[Run, VirtualRun, TrailRun]` order.

**Fix**: Use `TYPE_ORDER` to enforce deterministic ordering:

```js
const byType = TYPE_ORDER.filter((t) => typeAccum.has(t)).map((t) => ({
  type: t,
  totalMeters: /** @type {number} */ (typeAccum.get(t)),
  label: RUN_TYPE_LABELS[t] || t,
}));
```

### I5. Verbose iteration patterns — STILL PRESENT

**[src/lib/strava-helpers.js, Lines 123, 160]**

`Array.from(map.entries()).forEach(...)` when `map.forEach()` or `for...of` works. Not a bug, just needlessly verbose.

### I6. Dialog backdrop click doesn't close — STILL PRESENT ⛔

**[src/components/RunCalendarDialog.jsx]** **Missing Spec Requirement**

The spec (FR-002, component contract) says "點擊背景（backdrop）關閉 dialog." Currently clicking the backdrop does nothing — only Escape key and the close button work.

Native `<dialog>` doesn't fire `onCancel` on backdrop click. You need an explicit click handler:

```jsx
function handleBackdropClick(e) {
  if (e.target === dialogRef.current) {
    onClose();
  }
}

<dialog ... onClick={handleBackdropClick}>
```

This is a spec gap, not a nice-to-have. **Should be fixed before merge.**

---

## **[STYLE NOTES]**

### S1. `getRunIcon` fallback silently masks unknown types — STILL PRESENT

**[src/components/RunCalendarDialog.jsx, Line 24]**

```js
return RUN_ICON_MAP[type] || RunOutdoorIcon;
```

Silent fallback means you'll never notice new Strava activity types. Consider a `console.warn` in dev or a stricter approach.

### S2. CSS hardcoded colors — STILL PRESENT

**[src/components/RunCalendarDialog.module.css]** — Raw hex values (`#e8f5e9`, `#333`, `#1976d2`, `#d32f2f`). Fine if no theme system exists. Flag if one is introduced.

### S3. `makeActivity` test helper incomplete — STILL PRESENT

**[specs/008-run-calendar/tests/unit/groupActivitiesByDay.test.js, Lines 15-25]**

The `makeActivity` helper omits required `StravaActivity` fields: `stravaId`, `movingTimeSec`, `startDate`, `averageSpeed`, `syncedAt`. This causes a TS2322 type error in `npm run type-check`:

```
specs/008-run-calendar/tests/unit/groupActivitiesByDay.test.js(16,3): error TS2322:
  Property 'stravaId' is optional in type '...' but required in type 'StravaActivity'.
```

**Fix**: Add all required fields with dummy defaults:

```js
function makeActivity(overrides = {}) {
  return {
    id: 'act-1',
    uid: 'user-1',
    stravaId: 12345,
    name: 'Morning Run',
    type: 'Run',
    distanceMeters: 5000,
    movingTimeSec: 1800,
    startDate: { toDate: () => new Date('2026-04-07T06:30:00Z') },
    startDateLocal: '2026-04-07T06:30:00Z',
    summaryPolyline: null,
    averageSpeed: 2.78,
    syncedAt: { toDate: () => new Date() },
    ...overrides,
  };
}
```

---

## **[TESTING GAPS]**

### TG1. Integration test mocks the unit under test — STILL PRESENT

**[specs/008-run-calendar/tests/integration/RunCalendarDialog.test.jsx]**

The test mocks `useRunCalendar` entirely, making it a component render test, not an integration test. It doesn't verify the data pipeline `Firestore → groupActivitiesByDay → calcMonthSummary → UI`.

A real integration test should mock only `getStravaActivitiesByMonth` (the Firestore call) and let the hook + helpers run with real data.

Given jsdom `<dialog>` limitations, this is a pragmatic tradeoff. But accuracy of naming matters.

### TG2. No test for error state rendering — STILL MISSING

No test verifies that `{ error: 'some error', isLoading: false }` renders the error alert. Easy to add:

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

### TG3. No test for loading state rendering — STILL MISSING

No test for `{ isLoading: true }` showing the loading indicator.

### TG4. E2E tests globally skipped — STILL SKIPPED

All E2E tests remain skipped via `test.skip(true)`. Documented and reasonable (auth fixture needed), but zero E2E coverage.

---

## **[TASK GAPS]**

### Task Completeness Cross-Reference

| Task | Status | Diff Match | Notes                                                                            |
| ---- | ------ | ---------- | -------------------------------------------------------------------------------- |
| T001 | ✅ [x] | ✅         | `strava-helpers.js` — all 4 exports present                                      |
| T002 | ✅ [x] | ✅         | `firebase-strava.js` — `getStravaActivitiesByMonth` correct                      |
| T003 | ✅ [x] | ✅         | `CalendarIcon.jsx` present                                                       |
| T004 | ✅ [x] | ✅         | `RunOutdoorIcon.jsx` present                                                     |
| T005 | ✅ [x] | ✅         | `RunIndoorIcon.jsx` present                                                      |
| T006 | ✅ [x] | ✅         | `RunTrailIcon.jsx` present                                                       |
| T007 | ✅ [x] | ✅         | `buildCalendarGrid.test.js` — 8/8 passing                                        |
| T008 | ✅ [x] | ✅         | `groupActivitiesByDay.test.js` — 5/5 passing                                     |
| T009 | ✅ [x] | ✅         | `calcMonthSummary.test.js` — 5/5 passing                                         |
| T010 | ✅ [x] | ✅         | `useRunCalendar.js` pipeline correct                                             |
| T011 | ✅ [x] | ⚠️         | Dialog present but **missing backdrop click-to-close** (I6)                      |
| T012 | ✅ [x] | ✅         | `page.jsx` + `runs.module.css` changes present                                   |
| T013 | ✅ [x] | ✅         | Unit tests verified — 18/18 passing                                              |
| T014 | ✅ [x] | ✅         | Integration test present — 9/9 passing                                           |
| T015 | ✅ [x] | ❌         | **1 ESLint Error + 6 Warnings remain.** Task says "fix all errors and warnings." |
| T016 | ✅ [x] | ⚠️         | E2E test file present but globally `test.skip(true)`. 0% executed.               |

### Findings

- **T015 is NOT complete**: 1 Error (`react-hooks/set-state-in-effect`) + 6 Warnings (`jsdoc/require-param-description` × 3, `jsdoc/no-defaults` × 3) + 1 type-check error (`TS2322` in `makeActivity` test helper). This violates the task's own completion criteria.
- **T011** missing backdrop close per spec FR-002.
- **No scope creep** — all code changes map to defined tasks.

---

## **VERDICT:**

❌ **Needs minor rework** — Three items require attention before merge:

1. **Fix the ESLint error** (`react-hooks/set-state-in-effect` in `useRunCalendar.js:39`) — hard blocker per CLAUDE.md Rule #5
2. **Fix 6 JSDoc lint warnings** on icon components — also required by T015
3. **Add backdrop click-to-close** (`RunCalendarDialog.jsx`) — spec FR-002 explicitly requires it

**Strongly recommended** (can be addressed now with minimal effort):

4. **Merge `currentYear`/`currentMonth` into single state** (C2) — eliminates all special-case code
5. **Conditionally mount `RunCalendarDialog`** (I1) — one-line fix, stops wasted Firestore queries
6. **Fix `calcMonthSummary` `byType` ordering** (I4) — use `TYPE_ORDER` filter for deterministic output
7. **Fix `makeActivity` test helper** (S3) — add missing required fields to clear type-check error

## **KEY INSIGHT:**

The data pipeline design (pure functions → hook → dumb component) is exactly right. The issues are all at the edges: a lint rule violation, a missing event handler, and non-atomic state management. These are quick fixes that would elevate the code from "acceptable" to "good taste." The fact that T015 was marked complete while `npm run lint` still shows errors means the verification step was nominal, not actual.
