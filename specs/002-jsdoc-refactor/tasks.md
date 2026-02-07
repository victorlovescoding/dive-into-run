# Tasks for JSDoc Refactor (002-jsdoc-refactor)

status: verified

## 1. Refactor Write Operations
- [ ] Task: Refactor `normalizeEventPayload`
  - Description: Rename unused destructured variables (`planRoute` -> `_planRoute`) and add complete JSDoc.
  - Verification: `npx eslint src/lib/firebase-events.js`
- [ ] Task: Refactor `createEvent`
  - Description: Rename unused destructured variables in `extra` and add complete JSDoc.
  - Verification: `npx eslint src/lib/firebase-events.js`
- [ ] Task: 驗證：執行 Lint 與測試
  - Description: 執行 `npx eslint src/lib/firebase-events.js` 並確保邏輯通過 `vitest run tests/002-jsdoc-refactor/unit/firebase-events.test.js`。

## 2. Refactor Read Operations (Shadowing Fix)
- [ ] Task: Refactor `fetchLatestEvents`
  - Description: Rename local `doc` to `snapshot` to fix shadowing and add complete JSDoc.
  - Verification: `npx eslint src/lib/firebase-events.js`
- [ ] Task: Refactor `fetchNextEvents`
  - Description: Rename local `doc` to `snapshot` to fix shadowing and add complete JSDoc.
  - Verification: `npx eslint src/lib/firebase-events.js`
- [ ] Task: 驗證：執行 Lint 與測試
  - Description: 執行 `npx eslint src/lib/firebase-events.js` 並確保邏輯通過 `vitest run tests/002-jsdoc-refactor/unit/firebase-events.test.js`。

## 3. Complete JSDoc Documentation
- [ ] Task: Add JSDoc to remaining query functions
  - Description: Add JSDoc to `queryEvents` and `fetchEventById`.
- [ ] Task: Add JSDoc to transaction functions
  - Description: Add JSDoc to `joinEvent` and `leaveEvent`.
- [ ] Task: Add JSDoc to participant functions
  - Description: Add JSDoc to `fetchParticipants` and `fetchMyJoinedEventsForIds`.
- [ ] Task: 驗證：執行 Lint 與測試
  - Description: 執行 `npx eslint src/lib/firebase-events.js` 並修復所有 errors 與 warnings (JSDoc, Airbnb style)。確保 `npm run test` 全數通過。

## 4. Final Review
- [ ] Task: 最終代碼品質檢查
  - Description: 確保 `src/lib/firebase-events.js` 完全符合 Airbnb 風格且 JSDoc 完整。
  - Verification: `npx eslint src/lib/firebase-events.js` 回報 0 problems。
