# Strict Type and Lint Fixes for App Events Page Implementation Plan

**Feature Branch**: `003-strict-type-fixes`
**Spec**: `specs/003-strict-type-fixes/app-events-page/spec.md`
**Tests**: `tests/003-strict-type-fixes/app-events-page/`

## 1. JSDoc Type Definitions (src/types/ & src/app/events/page.jsx)

### 1.1 CSS Module Type

- [ ] Create `src/types/css.d.ts` to fix `Cannot find module './events.module.css'` errors.
  ```typescript
  declare module '*.module.css' {
    const classes: { readonly [key: string]: string };
    export default classes;
  }
  ```

### 1.2 Component Internal Types

Define the following `typedef` at the top of `src/app/events/page.jsx` (or extract to a shared type file if reused):

- `RoutePoint`, `RouteBBox`, `RoutePayload`
- `FirestoreTimestamp`
- `EventData` (Must match structure tested in `event-helpers.test.js`)
- `UserPayload`

## 2. Shared Logic Refactoring (src/lib/event-helpers.js)

Refactor `src/lib/event-helpers.js` to meet Unit Test expectations and strict JSDoc requirements.

- [ ] **`formatPace`**:
  - Add strict JSDoc: `@param {number|string} paceSec`, `@param {string} [fallbackText]`.
  - Logic: Handle `null`/`undefined` gracefully (return fallback).
- [ ] **`toNumber`**:
  - Add strict JSDoc: `@param {any} v`.
  - Logic: Ensure robust conversion (handle `null`, `undefined`, non-finite).
- [ ] **`chunkArray`**:
  - Add generic JSDoc: `@template T @param {T[]} arr`.
  - Logic: Return `[]` if input is null/undefined.
- [ ] **`getRemainingSeats`**:
  - Add strict JSDoc: `@param {EventData} ev`.
  - Logic: Ensure proper calculation using `toNumber` internally.
- [ ] **`buildRoutePayload`**:
  - Add strict JSDoc.
  - Logic: Return `null` if input array is empty or invalid.

## 3. UI Component Refactoring (src/app/events/page.jsx)

Refactor component logic to pass Integration/E2E tests and Lint checks.

### 3.1 ESLint Fixes

- [ ] **Loop Refactoring**: Convert `for...of` in `useEffect` (batch checking joined status) to standard `for` loop to satisfy `no-restricted-syntax`.
- [ ] **Return Consistency**: Fix `consistent-return` issues in array callbacks or effects.
- [ ] **Shadowing**: Rename shadowed variables (e.g., `e` -> `err`).
- [ ] **Accessibility (A11y)**:
  - Add `htmlFor` to form labels.
  - Add `role="button"` and `onKeyDown` to non-semantic interactive elements.

### 3.2 Type Fixes (TS8032 & TS2339)

- [ ] **JSDoc Annotation**: Ensure all component props and helper functions have valid JSDoc with `root0` param definitions where destructured.
- [ ] **API Integration**: Ensure `createEvent` call matches the expected signature (fix `extra` parameter type issue).

## 4. 品質保證與規範 (MANDATORY)

- [ ] **風格規範**: 遵循憲法 Principle VI (Airbnb Style)。
- [ ] **JSDoc 契約**: 所有 Helper Functions 與 Component Props 必須有完整的 `@param` 定義。
- [ ] **驗收門檻**:
  - `npm run type-check` 必須為 **0 errors**。
  - `npm run lint -- --file src/app/events/page.jsx` 必須為 **0 problems**。
  - `grep -r "@ts-ignore" src/app/events/page.jsx` 必須為 **Empty**。
  - 所有測試 (`unit`, `integration`, `e2e`) 必須 **PASS (GREEN)**。

## 5. Step-by-Step Implementation Guide

### Phase 1: Logic & Types (Unit Test Green)

1.  **Create Type Definitions**: Add `src/types/css.d.ts`.
2.  **Refactor `src/lib/event-helpers.js`**:
    - Implement robust logic for `formatPace`, `toNumber`, etc.
    - Add full JSDoc.
    - **Verify**: Run `npx vitest run tests/003-strict-type-fixes/app-events-page/unit`.

### Phase 2: Component Fixes (Integration Test Green)

3.  **Refactor `src/app/events/page.jsx` - Part 1 (Structure)**:
    - Add JSDoc `typedef`s.
    - Fix imports.
4.  **Refactor `src/app/events/page.jsx` - Part 2 (Logic & Lint)**:
    - Fix `no-restricted-syntax`, `consistent-return`, `no-shadow`.
    - Fix A11y issues.
5.  **Refactor `src/app/events/page.jsx` - Part 3 (Type Check)**:
    - Fix JSDoc annotations for `createEvent` and other API calls.
    - **Verify**: Run `npm run type-check` (targeting this file) and `npx vitest run tests/003-strict-type-fixes/app-events-page/integration`.

### Phase 3: Final Verification (E2E & Quality Gate)

6.  **Full Quality Check**:
    - Run `npm run lint`.
    - Run `npm run type-check`.
    - Check for `@ts-ignore`.
7.  **E2E Verification**:
    - Run `npx playwright test tests/003-strict-type-fixes/app-events-page/e2e`.
