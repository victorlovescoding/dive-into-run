# Code Review — 008-run-calendar

日期：2026-04-07

---

## Taste Rating: 🟡 **Acceptable** — Works but has a few rough edges that need cleaning

The overall architecture is clean: pure helper functions, thin service layer, hook for orchestration, dumb dialog component. The data pipeline (`Firestore → groupActivitiesByDay → calcMonthSummary → UI`) is straightforward and testable. No over-engineering. But there are real issues that need attention.

---

## Linus's Three Questions

1. **Is this solving a real problem?** — Yes. Monthly calendar view for run tracking is a clear user need.
2. **Is there a simpler way?** — Mostly no. The approach is already lean: native `<dialog>`, no date library, client-side aggregation. One area could be simpler (see month navigation state).
3. **What will this break?** — Nothing in existing code. All changes are additive. Low risk.

---

## **[CRITICAL ISSUES]**

### C1. ESLint Error in `useRunCalendar.js` — `react-hooks/set-state-in-effect`

**[src/hooks/useRunCalendar.js, Line 39]** **Breaking lint rule**

```
39:7  Error: Calling setState synchronously within an effect can trigger cascading renders
      react-hooks/set-state-in-effect
```

The `!user` early return path calls four `setState` in a row synchronously inside `useEffect`. This is a real lint **Error**, not a warning. CLAUDE.md Rule #5 says type-check and lint must pass.

**Fix**: Move the `!user` reset logic outside the effect. Use early return + initial state, or restructure so the reset happens via a separate `useMemo`/conditional, or guard the effect body without calling setState synchronously.

One clean pattern:

```js
useEffect(() => {
  if (!user) return undefined;
  // ... fetch logic
}, [user, year, month]);

// Derive empty state from user being null rather than setting it via setState
```

Or: reset via the return value of a prior render, not inside an effect.

### C2. `handlePrevMonth` / `handleNextMonth` — Non-atomic state update

**[src/components/RunCalendarDialog.jsx, Lines 64-81]** **Data Structure / State Design**

```js
function handlePrevMonth() {
  if (currentMonth === 0) {
    setCurrentYear((y) => y - 1);
    setCurrentMonth(11);
  } else {
    setCurrentMonth((m) => m - 1);
  }
}
```

Two separate `useState` calls (`currentYear`, `currentMonth`) for what is a single conceptual value: "which month are we looking at." This creates:

1. **Potential intermediate render** where year changed but month hasn't (or vice versa) — React 18 batches in event handlers so it's _likely_ fine today, but this is fragile and violates "good taste."
2. **Special-case code** for December↔January boundary that wouldn't exist with a single state.

**Fix**: Use a single `Date` or `{ year, month }` object state:

```js
const [current, setCurrent] = useState({ year: now.getFullYear(), month: now.getMonth() });

function handlePrevMonth() {
  setCurrent((prev) => {
    const d = new Date(prev.year, prev.month - 1, 1);
    return { year: d.getFullYear(), month: d.getMonth() };
  });
}
```

This eliminates the special case entirely — `new Date(2026, -1, 1)` correctly gives December 2025. Good taste = no edge cases.

---

## **[IMPROVEMENT OPPORTUNITIES]**

### I1. `RunCalendarDialog` renders hook + grid even when `open=false`

**[src/components/RunCalendarDialog.jsx, Lines 43-44]** **Pragmatism**

```js
const { dayMap, monthSummary, isLoading, error } = useRunCalendar(currentYear, currentMonth);
const grid = buildCalendarGrid(currentYear, currentMonth);
```

These run on every render regardless of `open`. When `open=false`, the dialog is invisible but the hook still fires a Firestore query. This is wasted network and CPU.

**Fix**: Guard the hook call or conditionally render the component. The simplest approach: in `RunsPage`, don't mount `<RunCalendarDialog>` at all when `!calendarOpen`:

```jsx
{
  calendarOpen && <RunCalendarDialog open={calendarOpen} onClose={() => setCalendarOpen(false)} />;
}
```

Or pass a flag to suppress the query when the dialog is closed.

### I2. `new Date()` called on every render in `RunCalendarDialog`

**[src/components/RunCalendarDialog.jsx, Line 39]** **Simplification**

```js
const now = new Date();
const [currentYear, setCurrentYear] = useState(now.getFullYear());
const [currentMonth, setCurrentMonth] = useState(now.getMonth());
```

`new Date()` is called on every render but only used as the initial value for `useState`. Since `useState` ignores initial values after the first render, this is wasteful (though cheap). The real issue: if this component is unmounted and remounted, it re-reads `new Date()` — which is actually correct behavior. So this is minor. Just noting it's slightly dirty.

**Fix** (optional): Use a lazy initializer or move `now` inside useState callback. Very low priority.

### I3. `formatDistance` imported but inlined in day cells

**[src/components/RunCalendarDialog.jsx, Line 149]** **Inconsistency**

```jsx
// Day cells use inline formatting:
<span className={styles.runDistance}>
  {(run.totalMeters / 1000).toFixed(1)}
</span>

// Footer uses formatDistance:
<div className={styles.totalDistance}>
  總里程：{formatDistance(monthSummary.totalMeters)}
</div>
```

Day cells format distance inline (`(x / 1000).toFixed(1)`) but the footer uses `formatDistance()` which appends " km". This is intentional (day cells are space-constrained and omit "km"), but the inline calculation duplicates the conversion logic. If the conversion formula changes (e.g., locale-specific decimal separator), you'd need to update two places.

**Fix**: Extract a `formatDistanceShort(meters)` that returns just the number string, or use `formatDistance` and strip the unit. Low priority since the formula is trivial.

### I4. `calcMonthSummary` — `byType` order depends on Map insertion order

**[src/lib/strava-helpers.js, Lines 160-172]** **Data Structure**

`typeAccum` is a regular `Map`, and `byType` is built from `typeAccum.entries()`. The iteration order depends on the order `dayMap.values()` were processed and which types appeared first. This means `byType` order could be `[VirtualRun, Run]` if VirtualRun appeared on an earlier day than Run.

In `groupActivitiesByDay`, runs are correctly sorted by `TYPE_ORDER`. But `calcMonthSummary` doesn't preserve that order — it depends on which type was encountered first across all days.

**Fix**: Sort `byType` using `TYPE_ORDER` before returning:

```js
const byType = TYPE_ORDER.filter((t) => typeAccum.has(t)).map((t) => ({
  type: t,
  totalMeters: typeAccum.get(t),
  label: RUN_TYPE_LABELS[t] || t,
}));
```

This ensures the footer always shows 戶外→室內→越野, matching the day cell order.

### I5. `groupActivitiesByDay` — unnecessarily verbose iteration

**[src/lib/strava-helpers.js, Lines 123-132]** **Simplification**

```js
Array.from(intermediate.entries()).forEach(([day, { dateKey, typeMap }]) => { ... });
```

Using `Array.from(map.entries()).forEach(...)` when you could just use `intermediate.forEach((value, key) => ...)` or a `for...of` loop. Same with `Array.from(dayMap.values()).forEach(...)` in `calcMonthSummary`. Not a bug, just verbose.

### I6. Dialog backdrop click doesn't close

**[src/components/RunCalendarDialog.jsx]** **Missing Feature**

The spec says "點擊背景（backdrop）關閉 dialog"（FR-002, component contract behavior）. The `handleCancel` handles Escape key via the `onCancel` event, but clicking `::backdrop` on a native `<dialog>` fires a `click` event on the dialog element itself, not `onCancel`. You need an explicit click handler to detect backdrop clicks:

```js
function handleClick(e) {
  if (e.target === dialogRef.current) {
    onClose();
  }
}

<dialog ... onClick={handleClick}>
```

Without this, backdrop clicks do nothing. This is a spec gap, not just a nice-to-have.

---

## **[STYLE NOTES]**

### S1. `getRunIcon` fallback might mask bugs

**[src/components/RunCalendarDialog.jsx, Line 24]**

```js
function getRunIcon(type) {
  return RUN_ICON_MAP[type] || RunOutdoorIcon;
}
```

Silently falling back to `RunOutdoorIcon` for unknown types means you'll never notice if a new Strava type comes through. Consider logging or throwing in dev.

### S2. CSS uses hardcoded colors instead of design tokens/CSS variables

**[src/components/RunCalendarDialog.module.css]** All colors are raw hex (`#e8f5e9`, `#333`, `#666`, `#1976d2`, `#d32f2f`). If the project has or plans to have a theme system, these should be CSS custom properties. If not, this is fine for now.

### S3. `stravaId` missing in `makeActivity` test helper

**[specs/008-run-calendar/tests/unit/groupActivitiesByDay.test.js, Line 16]**

The `makeActivity` helper omits required fields like `stravaId`, `movingTimeSec`, `startDate`, `averageSpeed`, `syncedAt` from the `StravaActivity` typedef. This causes the TS2322 type error in type-check output. The test runs fine because Vitest doesn't enforce types at runtime, but it's sloppy.

**Fix**: Include all required fields in the default stub, even if they're dummy values.

---

## **[TESTING GAPS]**

### TG1. Integration test mocks the unit under test

**[specs/008-run-calendar/tests/integration/RunCalendarDialog.test.jsx]**

The integration test mocks `useRunCalendar` entirely. This means it's testing:

- That `RunCalendarDialog` renders what the mock returns ✅
- That button clicks update component state ✅
- That the data pipeline from Firestore → helpers → UI works correctly ❌

This is essentially a **unit test** for the component's rendering logic, not an integration test. A real integration test should at minimum:

- Let `useRunCalendar` call `groupActivitiesByDay` and `calcMonthSummary` with real data
- Mock only `getStravaActivitiesByMonth` (the Firestore call)

That said, given jsdom limitations with `<dialog>`, this is a pragmatic tradeoff. Just don't call it "integration" — it's a component render test.

### TG2. No test for error state rendering

No test verifies that when `useRunCalendar` returns `{ error: 'some error', isLoading: false }`, the error alert renders correctly. Edge case but easy to add.

### TG3. No test for loading state rendering

Same — no test for the loading indicator appearing when `isLoading: true`.

### TG4. E2E tests are skipped

**[specs/008-run-calendar/tests/e2e/run-calendar.spec.js, Line 25]**

```js
test.skip(true, 'Requires auth setup + Strava seed data — see TODO above');
```

All E2E tests are globally skipped. This is documented and reasonable (auth fixture needed), but it means zero E2E coverage. The TODO is clear.

---

## **[TASK GAPS]**

### Task Completeness Cross-Reference

| Task | Status | Diff Match | Notes                                                                                                                                            |
| ---- | ------ | ---------- | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| T001 | ✅ [x] | ✅         | `strava-helpers.js` — `RUN_TYPE_LABELS`, `buildCalendarGrid`, `groupActivitiesByDay`, `calcMonthSummary` all present                             |
| T002 | ✅ [x] | ✅         | `firebase-strava.js` — `getStravaActivitiesByMonth` present with correct query                                                                   |
| T003 | ✅ [x] | ✅         | `CalendarIcon.jsx` present                                                                                                                       |
| T004 | ✅ [x] | ✅         | `RunOutdoorIcon.jsx` present                                                                                                                     |
| T005 | ✅ [x] | ✅         | `RunIndoorIcon.jsx` present                                                                                                                      |
| T006 | ✅ [x] | ✅         | `RunTrailIcon.jsx` present                                                                                                                       |
| T007 | ✅ [x] | ✅         | `buildCalendarGrid.test.js` — 8 tests, all passing                                                                                               |
| T008 | ✅ [x] | ✅         | `groupActivitiesByDay.test.js` — 5 tests, all passing                                                                                            |
| T009 | ✅ [x] | ✅         | `calcMonthSummary.test.js` — 5 tests, all passing                                                                                                |
| T010 | ✅ [x] | ✅         | `useRunCalendar.js` present with correct pipeline                                                                                                |
| T011 | ✅ [x] | ✅         | `RunCalendarDialog.jsx` + `.module.css` present with all features                                                                                |
| T012 | ✅ [x] | ✅         | `page.jsx` + `runs.module.css` changes present                                                                                                   |
| T013 | ✅ [x] | ✅         | Unit tests verified — 18/18 passing                                                                                                              |
| T014 | ✅ [x] | ✅         | Integration test present — 9/9 passing                                                                                                           |
| T015 | ✅ [x] | ⚠️         | **Lint has 1 Error** (`react-hooks/set-state-in-effect` in `useRunCalendar.js`). Task says "fix all errors and warnings" but this error remains. |
| T016 | ✅ [x] | ⚠️         | E2E test present but **globally skipped** (`test.skip(true)`). Reasonable given auth setup requirement, but the test never actually runs.        |

### Findings

- **T015** marked complete but **lint error persists** — `react-hooks/set-state-in-effect` in `useRunCalendar.js:39`. This violates the task's completion criteria ("fix all errors and warnings").
- **T016** marked complete but all tests are skipped — no actual E2E execution. Arguably the test _file_ exists and is structurally sound, but 0% of assertions have been verified.
- **No scope creep detected** — all code changes map to defined tasks.

---

## **VERDICT:**

❌ **Needs minor rework** — Two items require attention before merge:

1. **Fix the ESLint error** (`react-hooks/set-state-in-effect` in `useRunCalendar.js`) — this is a hard blocker per CLAUDE.md Rule #5
2. **Add backdrop click-to-close** — spec explicitly requires it (FR-002 + component contract), current implementation doesn't support it

Everything else (C2, I1-I5) is improvement territory that can be addressed now or in follow-up.

## **KEY INSIGHT:**

The data pipeline design (pure functions → hook → dumb component) is exactly right. The main issue is that the lint error and missing backdrop-close slipped through despite a comprehensive task checklist — a sign that T015 "verify" tasks need to actually block on green results, not just be checked off.
