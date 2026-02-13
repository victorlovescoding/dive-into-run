status: implementation_completed
# Tasks for Strict Type and Lint Fixes for App Events Page

## 1. Foundation (Prerequisites)
- [ ] Task 1: Create CSS Module type declaration
  - Description: Create `src/types/css.d.ts`.
  - Dependency: None.
  - Acceptance: `Cannot find module './events.module.css'` errors are resolved in `tsc`.
- [ ] Task 2: Define shared JSDoc typedefs
  - Description: Add `RoutePoint`, `RouteBBox`, `RoutePayload`, `FirestoreTimestamp`, `EventData`, and `UserPayload` typedefs.
  - Dependency: None (Foundation for all subsequent tasks).
  - Acceptance: `tsc` recognizes these types in `src/app/events/page.jsx`.

## 2. Shared Logic (src/lib/event-helpers.js)
- [ ] Task 3: Refactor `formatPace` and `toNumber`
  - Description: Add JSDoc and handle `null`/`undefined` inputs.
- [ ] Task 4: Refactor `chunkArray`, `getRemainingSeats`, and `buildRoutePayload`
  - Description: Ensure robust logic for edge cases.
- [ ] Task 5: 驗證：執行 Helper 邏輯測試 (Unit Test Green)
  - Description: 執行 `npx vitest run tests/003-strict-type-fixes/app-events-page/unit`。
  - Dependency: Task 3, Task 4.
  - Acceptance: 所有 Unit Tests 變為 **GREEN (PASS)**。

## 3. UI Refactoring (src/app/events/page.jsx)
- [ ] Task 6: Fix Component JSDoc and Imports
  - Description: Fix `root0` JSDoc annotations and add `buildUserPayload` import.
- [ ] Task 7: Refactor loops and return statements
  - Description: Convert `for...of` to standard `for` loop. Fix `consistent-return`.
- [ ] Task 8: Fix Shadowing and A11y
  - Description: Rename shadowed variables and add A11y labels/roles.
- [ ] Task 9: 驗證：執行 UI 整合測試 (Integration Test Green)
  - Description: 執行 `npx vitest run tests/003-strict-type-fixes/app-events-page/integration`。
  - Dependency: **Task 5 (Logic must be correct first)**, Task 6, 7, 8.
  - Acceptance: 所有 Integration Tests 變為 **GREEN (PASS)**。

## 4. Final Quality Gate (MANDATORY)
- [ ] Task 10: 執行全局品質檢查 (The Iron Wall)
  - Description: 執行 `npm run type-check` (0 errors) 與 `npm run lint` (0 problems)。
  - Description: **執行 `grep -r "@ts-ignore" src`**，確保結果為空。
  - Dependency: Task 9.
- [ ] Task 11: 執行 E2E 最終驗收
  - Description: 執行 `npx playwright test tests/003-strict-type-fixes/app-events-page/e2e`。
  - Dependency: Task 10.
  - Acceptance: E2E 流程通過。
